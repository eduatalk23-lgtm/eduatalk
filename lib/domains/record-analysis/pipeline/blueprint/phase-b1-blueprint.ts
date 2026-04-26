// ============================================
// B1: Blueprint Phase — 진로→3년 수렴 설계 (top-down)
//
// 4축×3층 통합 아키텍처 B층(2026-04-16 D).
// 기존 synthesis/phase-s1p5-blueprint.ts에서 이전.
//
// main_exploration seed + exemplar few-shot → LLM → blueprint 하이퍼엣지.
// 설계 대상 학년(consultingGrades)이 존재할 때만 실행. k=3(졸업)은 스킵.
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { PipelineContext, TaskRunnerOutput } from "../pipeline-types";
import { setTaskResult } from "../pipeline-helpers";
import { getPreviousRunResult } from "../pipeline-previous-run";
import type { BlueprintPhaseInput } from "../../blueprint/types";

/** blueprint_generation 의 writesForNextRun 출력 — 다음 실행이 연속성 힌트로 읽음 */
type BlueprintPreviousRunPayload = {
  convergences: NonNullable<BlueprintPhaseInput["previousConvergences"]>;
};

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

/**
 * Blueprint 파이프라인 타입 가드.
 * pipelineType 확인만 수행 — unifiedInput 없이도 실행 가능.
 */
export function assertBlueprintCtx(
  ctx: PipelineContext,
): asserts ctx is PipelineContext & { pipelineType: "blueprint" } {
  if (ctx.pipelineType !== "blueprint") {
    throw new Error(`assertBlueprintCtx: expected blueprint pipeline, got ${ctx.pipelineType}`);
  }
}

export async function runBlueprintGeneration(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertBlueprintCtx(ctx);
  const { studentId, tenantId, pipelineId } = ctx;

  // ── 설계 모드 여부 판정 ──────────────────────────
  // consultingGrades가 있으면 설계 모드(prospective) 학년 존재.
  // 순수 분석 모드(k=3, 전 학년 NEIS)면 blueprint 불필요 → 오케스트레이터가 사전 스킵.
  const hasDesignGrades = ctx.consultingGrades && ctx.consultingGrades.length > 0;
  if (!hasDesignGrades) {
    return "분석 모드 전용 — Blueprint 설계 건너뜀";
  }

  // ── 활성 메인 탐구 확인 (L0 전제) ────────────────
  const { listActiveMainExplorations } = await import(
    "@/lib/domains/student-record/repository/main-exploration-repository"
  );
  const active = await listActiveMainExplorations(studentId, tenantId);
  if (active.length === 0) {
    // Bootstrap(BT1)이 실행된 후에도 활성 메인 탐구가 없으면 실질적 오류.
    // silent completed 대신 failed 마킹 → 사용자에게 명시적 실패 노출.
    // (오케스트레이터가 BT1 실패 시 이미 차단하지만, BT1이 completed이어도
    //  사용자가 메인 탐구를 수동 삭제하는 경우를 포함해 이중 방어 적용.)
    throw new Error("활성 메인 탐구 없음 — 메인 탐구를 설정한 후 Blueprint를 재실행해주세요");
  }

  // ── Cross-run 연속성 힌트 로드 ────────────────────
  // 직전 실행의 blueprint_generation 이 writesForNextRun 으로 남긴 convergences 를 꺼내
  // LLM 프롬프트에 주입. 강한 이유 없이 테마 교체 방지.
  const prevPayload = getPreviousRunResult<BlueprintPreviousRunPayload>(
    ctx.belief.previousRunOutputs,
    "blueprint_generation",
  );
  const previousConvergences = prevPayload?.convergences;

  // ── LLM 호출 ──────────────────────────────────
  try {
    const { generateBlueprintDesign } = await import(
      "../../llm/actions/generateBlueprint"
    );
    const result = await generateBlueprintDesign(studentId, { previousConvergences });

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
      previousConvergenceCount: previousConvergences?.length ?? 0,
    });

    // 다음 실행을 위한 cross-run payload — 현재 수렴 테마를 writesForNextRun 형식으로 저장.
    const nextRunPayload: BlueprintPreviousRunPayload = {
      convergences: output.targetConvergences.map((conv) => ({
        grade: conv.grade,
        themeLabel: conv.themeLabel,
        themeKeywords: conv.themeKeywords,
        sharedCompetencies: conv.sharedCompetencies,
      })),
    };

    return {
      preview: `Blueprint 설계 완료 (수렴 ${output.targetConvergences.length}개, 마일스톤 ${Object.keys(output.milestones).length}학년)`,
      result: {
        convergenceCount: output.targetConvergences.length,
        milestoneGrades: Object.keys(output.milestones).map(Number),
        growthTargetCount: output.competencyGrowthTargets.length,
        priorConvergenceCount: previousConvergences?.length ?? 0,
        ...nextRunPayload,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, `Blueprint Phase 실패: ${msg}`, { pipelineId });
    throw err;
  }
}
