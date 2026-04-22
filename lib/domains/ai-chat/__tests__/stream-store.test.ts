// ============================================
// Phase D-5 — Resumable streaming SSE 저장소 단위 테스트.
// Upstash Redis 호출을 in-memory fake 로 대체.
// ============================================

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { Redis } from "@upstash/redis";

import {
  __setRedisForTests,
  appendChunk,
  beginStream,
  completeStream,
  isStreamStoreConfigured,
  replayStream,
} from "../stream-store";

// ────────────────────────────────────────────────────────────
// 인메모리 Redis fake — 사용하는 API(set/get/del/rpush/expire/lrange)만 구현.
// ────────────────────────────────────────────────────────────

type Entry =
  | { kind: "string"; value: string }
  | { kind: "list"; items: string[] };

class FakeRedis {
  store = new Map<string, Entry>();

  async set(
    key: string,
    value: string,
    opts?: { ex?: number },
  ): Promise<"OK"> {
    void opts;
    this.store.set(key, { kind: "string", value });
    return "OK";
  }

  async get<T = string>(key: string): Promise<T | null> {
    const e = this.store.get(key);
    if (!e || e.kind !== "string") return null;
    return e.value as unknown as T;
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) {
      if (this.store.delete(k)) n++;
    }
    return n;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    const e = this.store.get(key);
    if (!e) {
      this.store.set(key, { kind: "list", items: [...values] });
      return values.length;
    }
    if (e.kind !== "list") throw new Error("wrong type");
    e.items.push(...values);
    return e.items.length;
  }

  async lrange<T = string>(
    key: string,
    start: number,
    stop: number,
  ): Promise<T[]> {
    const e = this.store.get(key);
    if (!e || e.kind !== "list") return [];
    const end = stop === -1 ? e.items.length : stop + 1;
    return e.items.slice(start, end) as unknown as T[];
  }

  async expire(key: string, seconds: number): Promise<number> {
    void key;
    void seconds;
    // TTL semantics는 테스트 범위 밖 — 성공 1 반환.
    return 1;
  }
}

// ────────────────────────────────────────────────────────────
// 공통 세팅 — env 주입 + fake redis 주입.
// ────────────────────────────────────────────────────────────

const ORIGINAL_URL = process.env.UPSTASH_REDIS_REST_URL;
const ORIGINAL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: FakeRedis;

beforeEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  redis = new FakeRedis();
  __setRedisForTests(redis as unknown as Redis);
});

afterEach(() => {
  __setRedisForTests(null);
  if (ORIGINAL_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_URL;
  if (ORIGINAL_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_TOKEN;
});

// ────────────────────────────────────────────────────────────
// 테스트
// ────────────────────────────────────────────────────────────

describe("isStreamStoreConfigured", () => {
  it("env 가 전부 있으면 true", () => {
    expect(isStreamStoreConfigured()).toBe(true);
  });

  it("URL 또는 TOKEN 이 없으면 false", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    expect(isStreamStoreConfigured()).toBe(false);
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(isStreamStoreConfigured()).toBe(false);
  });
});

describe("beginStream", () => {
  it("이전 청크 키를 제거하고 status=streaming 으로 기록", async () => {
    // 선행 상태: 과거 청크가 있음
    await redis.rpush("ai-chat:stream:conv-1:chunks", "stale-chunk");

    await beginStream("conv-1");

    const chunks = await redis.lrange<string>(
      "ai-chat:stream:conv-1:chunks",
      0,
      -1,
    );
    expect(chunks).toEqual([]);
    const status = await redis.get<string>("ai-chat:stream:conv-1:status");
    expect(status).toBe("streaming");
  });
});

describe("appendChunk", () => {
  it("SSE 청크를 순서대로 RPUSH", async () => {
    await beginStream("conv-2");
    await appendChunk("conv-2", "data: a\n\n");
    await appendChunk("conv-2", "data: b\n\n");
    const chunks = await redis.lrange<string>(
      "ai-chat:stream:conv-2:chunks",
      0,
      -1,
    );
    expect(chunks).toEqual(["data: a\n\n", "data: b\n\n"]);
  });
});

describe("completeStream", () => {
  it("status 를 done 으로 전환", async () => {
    await beginStream("conv-3");
    await completeStream("conv-3");
    const status = await redis.get<string>("ai-chat:stream:conv-3:status");
    expect(status).toBe("done");
  });
});

describe("replayStream", () => {
  it("status 가 streaming 이 아니면 null", async () => {
    // 애초에 아무것도 없음 → null
    const s1 = await replayStream("conv-missing");
    expect(s1).toBeNull();

    // done 상태 → null
    await beginStream("conv-done");
    await completeStream("conv-done");
    const s2 = await replayStream("conv-done");
    expect(s2).toBeNull();
  });

  it("이미 쌓인 청크 + 신규 청크 + done 까지 전부 소비", async () => {
    vi.useFakeTimers();
    try {
      await beginStream("conv-live");
      await appendChunk("conv-live", "chunk-1");
      await appendChunk("conv-live", "chunk-2");

      const stream = await replayStream("conv-live");
      expect(stream).not.toBeNull();
      const reader = stream!.getReader();

      // 첫 pull: 기존 2건 수신
      const r1 = await reader.read();
      expect(r1.done).toBe(false);
      expect(r1.value).toBe("chunk-1");
      const r2 = await reader.read();
      expect(r2.done).toBe(false);
      expect(r2.value).toBe("chunk-2");

      // 아직 streaming → 다음 pull 은 setTimeout 대기 → 새 청크 추가 후 타이머 전진
      const r3Promise = reader.read();
      await appendChunk("conv-live", "chunk-3");
      await vi.advanceTimersByTimeAsync(300);
      const r3 = await r3Promise;
      expect(r3.done).toBe(false);
      expect(r3.value).toBe("chunk-3");

      // 종료 선언 + 꼬리 청크 추가 → done 감지 전에 tail 도 flush
      await appendChunk("conv-live", "chunk-final");
      await completeStream("conv-live");
      await vi.advanceTimersByTimeAsync(300);

      const rFinal = await reader.read();
      expect(rFinal.done).toBe(false);
      expect(rFinal.value).toBe("chunk-final");

      const rEnd = await reader.read();
      expect(rEnd.done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
