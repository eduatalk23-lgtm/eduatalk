// ============================================
// A3: Past Strategy — 즉시 행동 권고 (scope='past')
//
// 4축×3층 통합 아키텍처 A층. 2026-04-16 D.
//
// 입력: Past Diagnosis(DB scope='past') + 부족 역량.
// 출력: scope='past' strategies 2~4건 영속화.
// 톤: 이번/다음 학기 내 "즉시 행동 권고". 장기/Blueprint 언급 금지.
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { PipelineContext, TaskRunnerOutput } from "../pipeline-types";
import { deriveCurrentSemester } from "../pipeline-helpers";
import { assertPastAnalyticsCtx } from "./phase-a1-past-storyline";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

export async function runPastStrategy(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertPastAnalyticsCtx(ctx);
  const { pipelineId, studentId, tenantId, neisGrades, studentGrade } = ctx;

  const neisYears = neisGrades ?? [];
  if (neisYears.length === 0) {
    return "NEIS 학년 없음 — Past Strategy 건너뜀";
  }

  logActionDebug(LOG_CTX, "A3 Past Strategy 시작", {
    pipelineId,
    neisGrades: neisYears,
    currentGrade: studentGrade,
  });

  try {
    const currentSemester = deriveCurrentSemester();

    const { generatePastStrategy } = await import(
      "../../llm/actions/generatePastStrategy"
    );
    const result = await generatePastStrategy(
      studentId,
      tenantId,
      neisYears,
      studentGrade,
      currentSemester,
    );

    if (!result.success) {
      logActionError(LOG_CTX, `Past Strategy 실패: ${result.error}`, { pipelineId });
      throw new Error(result.error);
    }
    if (!result.data) {
      throw new Error("Past Strategy 응답 data 누락");
    }

    const { suggestions, savedCount } = result.data;

    // Cross-run: 다음 실행 past_diagnosis 가 "이행도" 맥락 반영. 제안 상위 N개 유지.
    const topSuggestions = suggestions.slice(0, 10).map((s) => ({
      priority: s.priority,
      area: s.area,
      action: s.action,
    }));

    return {
      preview: `Past Strategy ${savedCount}건 영속화 (제안 ${suggestions.length}건, ${studentGrade}학년 ${currentSemester}학기 기준)`,
      result: {
        savedCount,
        suggestionCount: suggestions.length,
        suggestions: topSuggestions,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, `A3 Past Strategy 실패: ${msg}`, { pipelineId });
    throw err;
  }
}
