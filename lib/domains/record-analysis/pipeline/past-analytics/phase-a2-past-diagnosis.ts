// ============================================
// A2: Past Diagnosis — 현상 진단 (scope='past')
//
// 4축×3층 통합 아키텍처 A층. 2026-04-16 D.
//
// 입력: NEIS 역량/태그 + Past Storyline(A1, DB scope='past' 조회).
// 출력: scope='past' diagnosis 1건 영속화.
// 톤: "3학년 가안"/Blueprint/exemplar 언급 금지. 현재 상태만 평가.
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { PipelineContext, TaskRunnerOutput } from "../pipeline-types";
import { assertPastAnalyticsCtx } from "./phase-a1-past-storyline";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

export async function runPastDiagnosis(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertPastAnalyticsCtx(ctx);
  const { pipelineId, studentId, tenantId, neisGrades } = ctx;

  const neisYears = neisGrades ?? [];
  if (neisYears.length === 0) {
    return "NEIS 학년 없음 — Past Diagnosis 건너뜀";
  }

  logActionDebug(LOG_CTX, "A2 Past Diagnosis 시작", { pipelineId, neisGrades: neisYears });

  try {
    // A1 산출물(scope='past' storylines)을 DB에서 조회 → 섹션 조립
    const { findStorylinesByScope } = await import(
      "@/lib/domains/student-record/repository/storyline-repository"
    );
    const pastStorylines = await findStorylinesByScope(studentId, tenantId, "past");

    let pastStorylineSection: string | undefined;
    if (pastStorylines.length > 0) {
      const lines = pastStorylines.map((s) => {
        const themes: string[] = [];
        if (s.grade_1_theme) themes.push(`1학년: ${s.grade_1_theme}`);
        if (s.grade_2_theme) themes.push(`2학년: ${s.grade_2_theme}`);
        if (s.grade_3_theme) themes.push(`3학년: ${s.grade_3_theme}`);
        return `- **${s.title}** (${s.career_field ?? ""}): ${s.narrative ?? ""}\n  ${themes.join(" / ")}`;
      });
      pastStorylineSection = lines.join("\n");
    }

    const { generatePastDiagnosis } = await import(
      "../../llm/actions/generatePastDiagnosis"
    );
    const result = await generatePastDiagnosis(
      studentId,
      tenantId,
      neisYears,
      pastStorylineSection,
    );

    if (!result.success) {
      logActionError(LOG_CTX, `Past Diagnosis 실패: ${result.error}`, { pipelineId });
      throw new Error(result.error);
    }

    const { overallGrade, directionStrength, weaknesses, strengths } = result.data;

    return {
      preview: `Past Diagnosis 생성 (등급: ${overallGrade}, 방향: ${directionStrength}, 강점 ${strengths.length} · 약점 ${weaknesses.length})`,
      result: {
        overallGrade,
        directionStrength,
        strengthCount: strengths.length,
        weaknessCount: weaknesses.length,
        schoolYears: neisYears,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, `A2 Past Diagnosis 실패: ${msg}`, { pipelineId });
    throw err;
  }
}
