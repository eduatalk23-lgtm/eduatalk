/**
 * Phase D-5 — Resumable streaming 의 SSE 청크 저장소.
 *
 * POST /api/chat 이 생성하는 SSE 스트림의 **tee 복사본**을 Upstash Redis 에
 * 누적해 두고, GET /api/chat/<id>/stream 이 재생할 수 있게 한다.
 *
 * ## Redis 키 구조
 * - `ai-chat:stream:<conversationId>:chunks`  — SSE 라인 RPUSH 리스트
 * - `ai-chat:stream:<conversationId>:status`  — `"streaming"` / `"done"`
 *
 * ## 수명주기
 * 1. `beginStream(id)`         — 새 POST 진입 시 과거 청크 제거 + status=streaming (TTL 5m)
 * 2. `appendChunk(id, chunk)`  — consumeSseStream 콜백에서 호출. RPUSH + TTL 갱신
 * 3. `completeStream(id)`      — 스트림 종료 시 status=done 으로 교체 (TTL 60s 축소)
 * 4. `replayStream(id)`        — GET 핸들러가 호출. 기존 청크 즉시 flush 후
 *                                status=done 까지 250ms 폴링으로 실시간 추종
 *
 * ## 환경 변수
 * `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` 둘 다 있을 때만 활성.
 * 없으면 모든 함수가 no-op (local dev / 미설정 환경에서는 resume 기능 비활성).
 * 이 경우 클라이언트의 `resumeStream()` 호출은 GET 이 204 를 돌려받아 no-op.
 */

import type { Redis } from "@upstash/redis";

// ────────────────────────────────────────────────────────────
// 설정 / 키 생성
// ────────────────────────────────────────────────────────────

const CHUNK_TTL_SECONDS = 300; // 5분
const DONE_TTL_SECONDS = 60; // 종료 후 1분만 유지
const POLL_INTERVAL_MS = 250;

function chunksKey(conversationId: string): string {
  return `ai-chat:stream:${conversationId}:chunks`;
}

function statusKey(conversationId: string): string {
  return `ai-chat:stream:${conversationId}:status`;
}

type StreamStatus = "streaming" | "done";

/**
 * 환경변수가 전부 갖춰졌는지 동기적으로 확인.
 * 서버 route 에서 "tee 를 설정할지" 판단용.
 */
export function isStreamStoreConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

// ────────────────────────────────────────────────────────────
// Redis lazy 초기화 (rate-limit.ts 와 동일 패턴)
// ────────────────────────────────────────────────────────────

let redisSingleton: Redis | null = null;

async function getRedis(): Promise<Redis | null> {
  if (redisSingleton) return redisSingleton;
  if (!isStreamStoreConfigured()) return null;
  const { Redis: RedisCtor } = await import("@upstash/redis");
  redisSingleton = new RedisCtor({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redisSingleton;
}

// 테스트 용도: 주입된 Redis 를 사용하도록 override.
// 프로덕션 코드에서는 사용 금지.
export function __setRedisForTests(client: Redis | null): void {
  redisSingleton = client;
}

// ────────────────────────────────────────────────────────────
// 공개 API
// ────────────────────────────────────────────────────────────

/**
 * 새 스트림 시작 전에 과거 잔여 청크를 제거하고 status='streaming' 으로 마킹.
 * Redis 미설정 시 no-op.
 */
export async function beginStream(conversationId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  const ck = chunksKey(conversationId);
  const sk = statusKey(conversationId);
  await redis.del(ck);
  await redis.set(sk, "streaming" satisfies StreamStatus, {
    ex: CHUNK_TTL_SECONDS,
  });
}

/**
 * consumeSseStream 콜백 내부에서 SSE 문자열 청크 1건을 누적.
 * TTL 을 매번 갱신해 장시간 스트림에서 만료되지 않도록 한다.
 */
export async function appendChunk(
  conversationId: string,
  chunk: string,
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  const ck = chunksKey(conversationId);
  await redis.rpush(ck, chunk);
  await redis.expire(ck, CHUNK_TTL_SECONDS);
}

/**
 * 스트림 종료 시 status='done' 으로 교체하고 청크 TTL 을 단축.
 * 이후 `replayStream` 은 null 을 반환 (완료된 스트림은 재생하지 않음).
 */
export async function completeStream(conversationId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  const ck = chunksKey(conversationId);
  const sk = statusKey(conversationId);
  await redis.set(sk, "done" satisfies StreamStatus, {
    ex: DONE_TTL_SECONDS,
  });
  await redis.expire(ck, DONE_TTL_SECONDS);
}

/**
 * 현재 활성 스트림이 있으면 SSE 텍스트 ReadableStream 을 돌려준다.
 *
 * 전략:
 *   - status != 'streaming' 이면 null 반환 (이미 끝났거나 없음)
 *   - pull-based ReadableStream 으로 기존 청크 즉시 enqueue
 *   - status === 'done' 감지 시 close, 아니면 POLL_INTERVAL_MS 대기 후 다음 pull
 *
 * 주의: ReadableStream 의 pull 은 consumer backpressure 기반이므로,
 *       청크가 없는 상태에서 `return` 만 해도 바로 pull 이 재호출된다.
 *       따라서 sleep 을 끼워 polling 간격을 확보한다.
 */
export async function replayStream(
  conversationId: string,
): Promise<ReadableStream<string> | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const initialStatus = await redis.get<StreamStatus>(
    statusKey(conversationId),
  );
  if (initialStatus !== "streaming") return null;

  const ck = chunksKey(conversationId);
  const sk = statusKey(conversationId);
  let cursor = 0;

  return new ReadableStream<string>({
    async pull(controller) {
      // LRANGE [cursor, -1] — 지금까지 쌓인 전체 중 미송신분만.
      const pending = await redis.lrange<string>(ck, cursor, -1);
      for (const line of pending) {
        controller.enqueue(line);
      }
      cursor += pending.length;

      const nowStatus = await redis.get<StreamStatus>(sk);
      if (nowStatus !== "streaming") {
        // 종료 감지 — 혹시 마지막 pull 직전에 추가된 청크가 있으면 한 번 더 긁어낸다.
        const tail = await redis.lrange<string>(ck, cursor, -1);
        for (const line of tail) {
          controller.enqueue(line);
        }
        controller.close();
        return;
      }

      // 아직 스트리밍 중 → polling 간격
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    },
    cancel() {
      // 클라이언트가 연결을 끊으면 pull 이 더이상 호출되지 않는다 — 별도 정리 불필요.
    },
  });
}
