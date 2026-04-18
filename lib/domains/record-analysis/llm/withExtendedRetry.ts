// ============================================
// withExtendedRetry — 장시간 rate limit 회복 자동화 (Phase 3 Auto-Bootstrap)
//
// 기존 `withRetry` (1s/3s/10s × 3회) 는 Bootstrap 의 Flash LLM 호출이 Gemini Free Tier
// 분당/일일 할당량에 걸렸을 때 충분한 대기 시간을 확보하지 못한다. 15분 단위까지 대기하며
// 분 단위 회복을 기다리는 것이 이 래퍼의 역할.
//
// 좀비 판정 회피 — `student_record_analysis_pipelines.status='running' AND updated_at < now() - 5분`
// 에 걸리면 rate limit 대기 중에도 자동 cancel 된다. 그래서 각 대기 인터벌은 **30초 chunk** 로
// 쪼개서 매 chunk 말미에 `touchPipelineHeartbeat` 을 호출 → pipelines 테이블 UPDATE 로 heartbeat 유지.
//
// 정책:
//   delays = [1s, 10s, 1min, 5min, 15min]  (총 5회, 누적 ~21분)
//   client_error 카테고리는 즉시 throw (재시도 무의미)
//   5회 전부 실패 시 최종 에러 throw
// ============================================

import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { touchPipelineHeartbeat } from "../pipeline/pipeline-executor";
import { logActionWarn } from "@/lib/logging/actionLogger";

const EXTENDED_DELAYS_MS = [
  1_000,           // 1 초
  10_000,          // 10 초
  60_000,          // 1 분
  5 * 60_000,      // 5 분
  15 * 60_000,     // 15 분
] as const;

const HEARTBEAT_CHUNK_MS = 30_000; // heartbeat 간격 — 5분 좀비 창의 1/10

/**
 * heartbeat 을 찍으며 긴 시간 sleep.
 *   chunk (30초) 단위로 쪼개서 매 chunk 말미에 pipelines.updated_at UPDATE.
 *   좀비 판정(`updated_at < now() - 5분`) 회피.
 */
async function sleepWithHeartbeat(
  totalMs: number,
  pipelineId: string,
  supabase: SupabaseAdminClient,
): Promise<void> {
  let remaining = totalMs;
  while (remaining > 0) {
    const sleepMs = Math.min(HEARTBEAT_CHUNK_MS, remaining);
    await new Promise<void>((resolve) => setTimeout(resolve, sleepMs));
    remaining -= sleepMs;
    if (remaining > 0) {
      await touchPipelineHeartbeat(supabase, pipelineId);
    }
  }
}

/** `withRetry` 의 classifyError 와 동일 규칙. client_error 는 재시도 스킵용. */
function isClientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  // 4xx non-429 만. 429 (rate limit) 는 재시도 대상.
  if (msg.includes("429")) return false;
  return (
    msg.includes("400") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("404") ||
    msg.includes("invalid")
  );
}

export interface WithExtendedRetryOptions {
  pipelineId: string;
  supabase: SupabaseAdminClient;
  /** 로그/디버깅용 라벨. 예: "bootstrap.main_exploration_seed" */
  label?: string;
}

/**
 * 장시간 rate limit 회복을 허용하는 재시도 래퍼.
 *
 * 사용처: `ensureBootstrap` → `generateMainExplorationSeed` 등 Phase 0 LLM 호출.
 *   Synthesis/Grade 의 짧은 LLM 호출은 기존 `withRetry` 유지 (15분 대기가 UX 악영향).
 */
export async function withExtendedRetry<T>(
  fn: () => Promise<T>,
  options: WithExtendedRetryOptions,
): Promise<T> {
  const { pipelineId, supabase, label = "LLM" } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= EXTENDED_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (isClientError(error)) {
        // 400/401/403/404 류 — 재시도 의미 없음. 즉시 throw.
        throw error;
      }

      if (attempt >= EXTENDED_DELAYS_MS.length) break; // 최종 시도 실패

      const delayMs = EXTENDED_DELAYS_MS[attempt];
      logActionWarn(
        { domain: "record-analysis", action: "llm-extended-retry" },
        `[${label}] 재시도 ${attempt + 1}/${EXTENDED_DELAYS_MS.length} — ${Math.round(delayMs / 1000)}s 대기 (heartbeat 유지)`,
        { pipelineId },
      );
      await sleepWithHeartbeat(delayMs, pipelineId, supabase);
    }
  }

  throw lastError;
}
