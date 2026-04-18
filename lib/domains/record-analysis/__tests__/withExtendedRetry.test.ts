// ============================================
// withExtendedRetry 유닛 테스트 (Phase 3 Step 3)
//
// 대상: lib/domains/record-analysis/llm/withExtendedRetry.ts
// 핵심 시나리오:
//   1. 첫 시도 성공 → fn 1회 호출, heartbeat 0회
//   2. 5회 전부 실패 → 최종 에러 throw, heartbeat N회
//   3. client_error (400/401) → 즉시 throw, retry 안 함
//   4. 2회 실패 후 3회째 성공 → 총 3회 호출
// 시간 제어: vi.useFakeTimers() 로 15분 대기를 즉시 흘러가게 함.
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../pipeline/pipeline-executor", () => ({
  touchPipelineHeartbeat: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionWarn: vi.fn(),
}));

import { withExtendedRetry } from "../llm/withExtendedRetry";
import { touchPipelineHeartbeat } from "../pipeline/pipeline-executor";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";

const mockSupabase = {} as SupabaseAdminClient;
const PIPELINE_ID = "pipeline-test-01";

describe("withExtendedRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("첫 시도 성공 → fn 1회 호출, heartbeat 미호출", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });

    const resultPromise = withExtendedRetry(fn, {
      pipelineId: PIPELINE_ID,
      supabase: mockSupabase,
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(touchPipelineHeartbeat).not.toHaveBeenCalled();
  });

  it("client_error (400) → 즉시 throw, retry 안 함", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("HTTP 400 Bad Request"));

    await expect(
      withExtendedRetry(fn, { pipelineId: PIPELINE_ID, supabase: mockSupabase }),
    ).rejects.toThrow("HTTP 400");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(touchPipelineHeartbeat).not.toHaveBeenCalled();
  });

  it("client_error (401) → 즉시 throw", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("HTTP 401 Unauthorized"));

    await expect(
      withExtendedRetry(fn, { pipelineId: PIPELINE_ID, supabase: mockSupabase }),
    ).rejects.toThrow("HTTP 401");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("2회 실패 후 3회째 성공 → 총 3회 호출 + 2회 sleep 구간 heartbeat", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ ok: true });

    const resultPromise = withExtendedRetry(fn, {
      pipelineId: PIPELINE_ID,
      supabase: mockSupabase,
      label: "test",
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(3);
    // 2 번의 retry sleep 동안 heartbeat 최소 1회씩 (30초 chunk)
    // 1초 + 10초 = 약 1개 미만/1개 → 최소 0회 ~ 1회 근사.
    // 보수적으로 "호출된 기록이 존재하거나 안 하거나 모두 허용", 다만 sleep 은 수행됐어야 함.
    // 실제 chunk 로직은 remaining > 0 일 때만 heartbeat → 1s/10s 는 1 chunk(30s) 안에서 끝나므로 0회.
    // 더 엄격한 heartbeat 호출 여부 테스트는 1분 이상 delay 케이스에서 확인.
    expect(touchPipelineHeartbeat).toHaveBeenCalledTimes(0);
  });

  it("3회 delay (1s/10s/1min) 까지 실패하면 1min delay 중 heartbeat 호출", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("rate limit 1"))
      .mockRejectedValueOnce(new Error("rate limit 2"))
      .mockRejectedValueOnce(new Error("rate limit 3"))
      .mockResolvedValueOnce({ ok: true });

    const resultPromise = withExtendedRetry(fn, {
      pipelineId: PIPELINE_ID,
      supabase: mockSupabase,
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(4);
    // 1s + 10s + 60s = 71s 총 delay. 60s delay 구간에서 30초 chunk 경계 1회 heartbeat 발생.
    expect(touchPipelineHeartbeat).toHaveBeenCalled();
    expect(touchPipelineHeartbeat).toHaveBeenCalledWith(mockSupabase, PIPELINE_ID);
  });

  it("5회 delay 전부 실패 → 최종 에러 throw", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("rate limit persistent"));

    const promise = withExtendedRetry(fn, {
      pipelineId: PIPELINE_ID,
      supabase: mockSupabase,
    });
    // 반드시 `vi.runAllTimersAsync()` 전에 rejection handler 를 먼저 등록.
    // 그렇지 않으면 타이머가 흘러가면서 await 전 rejection 이 unhandled 로 보고됨.
    const expectation = expect(promise).rejects.toThrow("rate limit persistent");

    await vi.runAllTimersAsync();
    await expectation;

    // 초기 시도 1회 + 5회 재시도 = 총 6회 호출
    expect(fn).toHaveBeenCalledTimes(6);
    // 15분(900s) + 5분(300s) + 1분(60s) 구간 전부 30초 chunk heartbeat 발생
    expect(touchPipelineHeartbeat).toHaveBeenCalled();
  });
});
