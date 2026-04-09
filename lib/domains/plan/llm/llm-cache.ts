/**
 * LLM Response Cache — 개발용 record/replay 레이어
 *
 * 파이프라인 흐름 점검 시 실제 Gemini 호출 없이 이전 응답을 재생.
 * 프로덕션은 항상 off. 개발/테스트에서만 사용.
 *
 * 모드:
 *  - off    (default): 기존 동작 그대로, 캐시 관여 없음
 *  - record           : 실제 LLM 호출 후 응답을 `.llm-cache/{hash}.json`에 저장
 *  - replay           : 캐시에서만 응답 반환. 미스 시 CacheMissError throw
 *
 * 사용:
 *   LLM_CACHE_MODE=record pnpm dev   # 한 번 실제로 돌려 캐시 채우기
 *   LLM_CACHE_MODE=replay pnpm dev   # 이후 모든 LLM 호출은 초 단위로 replay
 *
 * 캐시 키:
 *   sha256({system, messages, modelTier, kind, schemaSignature?, responseFormat?, groundingEnabled?})
 *
 * temperature / maxTokens / timeoutMs는 의도적으로 키에서 제외.
 * 이 값들을 바꿔도 흐름 점검용으로는 같은 응답을 재사용하는 편이 유용.
 */

import { createHash } from "node:crypto";

// NOTE: node:fs/promises, node:path의 static import를 의도적으로 피한다.
// 이 모듈이 client 컴포넌트 barrel(e.g. content-research/index.ts)의
// transitive import 그래프에 올라가면 Turbopack이 fs/promises를 chunk에
// 포함시키려다 "does not support external modules" 에러로 빌드가 실패한다.
// 실제 IO는 off가 아닐 때만 수행되므로, record/replay 모드 함수 내부에서
// 동적 import로 해결한다.

export type LlmCacheMode = "off" | "record" | "replay";

/** 환경변수 LLM_CACHE_MODE를 해석 — 알 수 없는 값이면 "off" */
export function getLlmCacheMode(): LlmCacheMode {
  const raw = process.env.LLM_CACHE_MODE?.toLowerCase();
  if (raw === "record" || raw === "replay") return raw;
  return "off";
}

/** 캐시 디렉터리 (lazy — node:path static import를 피하기 위해 함수로) */
async function getCacheDir(): Promise<string> {
  const { resolve } = await import("node:path");
  return resolve(process.cwd(), ".llm-cache");
}

export interface LlmCacheKeyInput {
  system: string;
  messages: Array<{ role: string; content: string }>;
  modelTier: string;
  kind: "text" | "object";
  /** generateObject 전용 — AI SDK Schema 또는 zod 기반 fingerprint */
  schemaSignature?: string;
  /** generateText 전용 — "json" 모드 여부 */
  responseFormat?: "json" | "text";
  /** grounding(Web Search) 활성화 여부 */
  groundingEnabled?: boolean;
}

/** 결정적 캐시 키 계산 */
export function hashCacheKey(input: LlmCacheKeyInput): string {
  const normalized = {
    s: input.system,
    m: input.messages.map((m) => ({ r: m.role, c: m.content })),
    t: input.modelTier,
    k: input.kind,
    ss: input.schemaSignature ?? null,
    rf: input.responseFormat ?? null,
    g: input.groundingEnabled ?? false,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/** AI SDK Schema 또는 zod 스키마의 지문 추출 */
export function getSchemaSignature(schema: unknown): string {
  if (schema && typeof schema === "object") {
    // AI SDK Schema<T>는 jsonSchema 필드 보유
    if ("jsonSchema" in schema) {
      try {
        return JSON.stringify((schema as { jsonSchema: unknown }).jsonSchema);
      } catch {
        /* fall through */
      }
    }
  }
  try {
    return JSON.stringify(schema, (_, v) => {
      if (typeof v === "function") return "[fn]";
      if (typeof v === "symbol") return "[sym]";
      return v;
    });
  } catch {
    return String(schema);
  }
}

interface CacheEntry<T> {
  cachedAt: string;
  modelTier: string;
  kind: "text" | "object";
  /** 디스크에서 사람이 확인할 수 있게 원문 일부 저장 (디버깅용) */
  preview: {
    systemHead: string;
    lastUserHead: string;
  };
  result: T;
}

/** 캐시 히트면 result, 미스면 null */
export async function readFromCache<T>(hash: string): Promise<T | null> {
  // 동적 import: client 번들에 fs/promises가 끌려오지 않도록.
  const [{ readFile }, { join }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const file = join(await getCacheDir(), `${hash}.json`);
  try {
    const raw = await readFile(file, "utf-8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return entry.result;
  } catch {
    return null;
  }
}

/** 원자적 쓰기 (write-to-tmp → rename) */
export async function writeToCache<T>(
  hash: string,
  meta: {
    modelTier: string;
    kind: "text" | "object";
    systemHead: string;
    lastUserHead: string;
  },
  result: T,
): Promise<void> {
  try {
    // 동적 import: client 번들에 fs/promises가 끌려오지 않도록.
    const [{ mkdir, writeFile, rename }, { dirname, join }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const file = join(await getCacheDir(), `${hash}.json`);
    await mkdir(dirname(file), { recursive: true });
    const entry: CacheEntry<T> = {
      cachedAt: new Date().toISOString(),
      modelTier: meta.modelTier,
      kind: meta.kind,
      preview: {
        systemHead: meta.systemHead.slice(0, 200),
        lastUserHead: meta.lastUserHead.slice(0, 200),
      },
      result,
    };
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, JSON.stringify(entry, null, 2), "utf-8");
    await rename(tmp, file);
  } catch (err) {
    // 캐시 쓰기 실패는 치명적이지 않음 — 경고만 찍고 계속
    // eslint-disable-next-line no-console
    console.warn(
      `[llm-cache] write failed (hash=${hash.slice(0, 12)}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/** replay 모드에서 캐시 미스 시 throw */
export class LlmCacheMissError extends Error {
  readonly hash: string;
  readonly kind: "text" | "object";
  constructor(hash: string, kind: "text" | "object") {
    super(
      `[LLM_CACHE_MODE=replay] ${kind} 캐시 미스 (hash=${hash.slice(
        0,
        12,
      )}...). 먼저 LLM_CACHE_MODE=record 로 1회 실행해 캐시를 채우세요.`,
    );
    this.name = "LlmCacheMissError";
    this.hash = hash;
    this.kind = kind;
  }
}

/** 마지막 user 메시지 content 추출 (preview용) */
export function lastUserMessage(
  messages: Array<{ role: string; content: string }>,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return messages[messages.length - 1]?.content ?? "";
}
