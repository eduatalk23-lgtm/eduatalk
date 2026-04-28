// ============================================
// 파이프라인 API Route 공통 헬퍼
// ============================================

import { NextResponse } from "next/server";
import type { PipelineContext } from "./pipeline-types";
import { checkCancelled } from "./pipeline-executor";
import { logActionWarn } from "@/lib/logging/actionLogger";

// Vercel Hobby maxDuration=300s. 안전 마진 30s 빼고 270s 를 Phase 누적 예산으로 사용.
// Phase 함수가 task 사이에 enforcePhaseDeadline 으로 잔여 시간 확인 → 임박 시 early return.
// 클라이언트는 다음 polling cycle 에서 같은 phase 를 재호출 → 미완 task 가 이어서 실행 (skip-if-completed).
export const PHASE_BUDGET_MS = 270_000;
const PHASE_BUDGET_SAFETY_MS = 30_000;

/**
 * 파이프라인이 cancelled 상태이면 499(Client Closed Request)로 응답.
 * API route 진입 직후 loadPipelineContext 다음에 호출.
 *
 * 반환값이 null이 아니면 그대로 return 하여 phase 실행을 건너뛴다.
 */
export async function guardCancelled(
  ctx: PipelineContext,
): Promise<NextResponse | null> {
  if (await checkCancelled(ctx)) {
    return NextResponse.json(
      { cancelled: true, pipelineId: ctx.pipelineId },
      { status: 499 },
    );
  }
  return null;
}

/**
 * M1-c W6 (2026-04-28): 파이프라인 자체가 이미 completed 면 즉시 200 + skip 응답.
 *
 * 문제: client cache stale 또는 cachedGrade undefined 로 client-side 가드
 * (executeGradePhasesForPipeline) 통과 못 함 → phase route 호출 → updatePipelineState
 * (running) 가 status 'completed' → 'running' 으로 reset 하는 표시 버그.
 *
 * 해결: phase route 진입 직후 ctx.snapshot.status === 'completed' 면 즉시 skip.
 * guardCancelled 와 동일 패턴.
 */
export function guardAlreadyCompleted(
  ctx: PipelineContext,
): NextResponse | null {
  const status = (ctx.snapshot as { status?: string } | null)?.status;
  if (status === "completed") {
    return NextResponse.json({
      pipelineId: ctx.pipelineId,
      skipped: true,
      reason: "이미 완료된 파이프라인 — phase 실행 스킵",
    });
  }
  return null;
}

// ============================================
// Phase 누적 timeout 가드 (2026-04-26)
//
// 문제: Vercel Hobby 단일 route 5분 (maxDuration=300) 한도에서, 한 Phase 함수가
//   여러 task 를 직렬 실행하면 누적 시간이 초과해도 사전 감지 못 함 → Vercel 강제 종료
//   → 마지막 task 가 `running` 으로 stuck → zombie cleanup (5분 heartbeat) 까지 영구 정지.
//   04-26 핸드오프에서 식별된 운영 관찰 항목.
//
// 해결: 각 Phase 함수가 시작 시점 startMs 기록, task 사이에 enforcePhaseDeadline 호출.
//   잔여 시간이 안전 마진(30s) 미만이면 false 반환 → Phase 가 early return.
//   미완 task 는 `pending` 으로 유지되어 다음 polling cycle 에서 같은 phase 재호출 시 이어짐.
// ============================================

export interface PhaseDeadlineState {
  startMs: number;
  budgetMs: number;
  phaseLabel: string;
}

/** Phase 함수 진입 시 호출하여 누적 timer 생성 */
export function startPhaseDeadline(phaseLabel: string, budgetMs = PHASE_BUDGET_MS): PhaseDeadlineState {
  return { startMs: Date.now(), budgetMs, phaseLabel };
}

/**
 * task 시작 전에 호출. 잔여 예산이 안전 마진보다 작으면 false 반환.
 * false 반환 시 호출 측은 즉시 return 하여 phase 종료 (미완 task 는 pending 유지).
 */
export function enforcePhaseDeadline(
  state: PhaseDeadlineState,
  nextTaskKey: string,
  pipelineId: string,
): boolean {
  const elapsed = Date.now() - state.startMs;
  const remaining = state.budgetMs - elapsed;
  if (remaining < PHASE_BUDGET_SAFETY_MS) {
    logActionWarn(
      { domain: "record-analysis", action: "pipeline.phase-deadline" },
      `[${state.phaseLabel}] 누적 ${(elapsed / 1000).toFixed(1)}s — task '${nextTaskKey}' 진입 보류 (잔여 ${(remaining / 1000).toFixed(1)}s < 안전 마진 ${PHASE_BUDGET_SAFETY_MS / 1000}s). 다음 호출에서 재개.`,
      { pipelineId, taskKey: nextTaskKey },
    );
    return false;
  }
  return true;
}
