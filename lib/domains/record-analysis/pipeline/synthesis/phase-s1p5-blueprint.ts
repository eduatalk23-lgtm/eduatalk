// ============================================
// S1.5: Blueprint Phase — 진로→3년 수렴 설계 (top-down)
//
// 설계 모드(prospective) 학생 전용.
// main_exploration seed + exemplar few-shot → LLM → blueprint 하이퍼엣지.
// 분석 모드(analysis) 학생은 건너뜀 (blueprint 불필요).
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../pipeline-types";
import { setTaskResult } from "../pipeline-helpers";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

export async function runBlueprintGeneration(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, pipelineId } = ctx;

  // ── 설계 모드 여부 판정 ──────────────────────────
  // consultingGrades가 있으면 설계 모드(prospective) 학년 존재.
  // 순수 분석 모드(전 학년 NEIS)면 blueprint 불필요.
  const hasDesignGrades = ctx.consultingGrades && ctx.consultingGrades.length > 0;
  if (!hasDesignGrades) {
    return "분석 모드 전용 — Blueprint 설계 건너뜀";
  }

  // ── 활성 메인 탐구 확인 ──────────────────────────
  const { listActiveMainExplorations } = await import(
    "@/lib/domains/student-record/repository/main-exploration-repository"
  );
  const active = await listActiveMainExplorations(studentId, tenantId);
  if (active.length === 0) {
    return "활성 메인 탐구 없음 — Blueprint 생성 불가 (메인 탐구 설정 필요)";
  }

  // ── LLM 호출 ──────────────────────────────────
  try {
    const { generateBlueprintDesign } = await import(
      "../../llm/actions/generateBlueprint"
    );
    const result = await generateBlueprintDesign(studentId);

    if (!result.success) {
      logActionError(LOG_CTX, `Blueprint 생성 실패: ${result.error}`, { pipelineId });
      throw new Error(result.error);
    }

    const output = result.data;
    setTaskResult(ctx.results, "_blueprintPhase", output);

    logActionDebug(LOG_CTX, "Blueprint Phase 완료", {
      pipelineId,
      convergenceCount: output.targetConvergences.length,
      milestoneGrades: Object.keys(output.milestones),
    });

    return {
      preview: `Blueprint 설계 완료 (수렴 ${output.targetConvergences.length}개, 마일스톤 ${Object.keys(output.milestones).length}학년)`,
      result: {
        convergenceCount: output.targetConvergences.length,
        milestoneGrades: Object.keys(output.milestones).map(Number),
        growthTargetCount: output.competencyGrowthTargets.length,
      },
    };
  } catch (err) {
    // non-fatal: Blueprint 실패해도 파이프라인 계속 진행 (기존 경로 유지)
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, `Blueprint Phase non-fatal 실패: ${msg}`, { pipelineId });
    throw err;
  }
}
