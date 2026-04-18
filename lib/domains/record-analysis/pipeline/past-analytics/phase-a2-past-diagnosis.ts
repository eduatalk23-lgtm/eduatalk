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
  const { pipelineId, studentId, tenantId, neisGrades, studentGrade } = ctx;

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

    // Cross-run: 직전 실행 past_strategy.suggestions → "전 번 권고 이행도" 맥락.
    // manifest: past_strategy.writesForNextRun = ["past_diagnosis"].
    // buildPastDiagnosisUserPrompt 가 단일 섹션만 받으므로 pastStorylineSection 에 헤더로 구분해 병합.
    const prevRun = ctx.previousRunOutputs;
    if (prevRun?.runId) {
      const { getPreviousRunResult } = await import("../pipeline-previous-run");
      const prevPast = getPreviousRunResult<{
        savedCount: number;
        suggestionCount: number;
        suggestions: Array<{ priority: string; area: string; action: string }>;
      }>(prevRun, "past_strategy");
      const sugs = prevPast?.suggestions ?? [];
      if (sugs.length > 0) {
        const lines = sugs.map((s) => `- [${s.priority}] ${s.area}: ${s.action}`);
        const priorSection = [
          `## 직전 실행(${prevRun.completedAt?.slice(0, 10) ?? "이전"}) 권고 — 이행도 평가 대상`,
          "아래 권고를 현재 기록(신규 세특/창체/행특)에서 이행했는지 진단에 반영.",
          ...lines,
        ].join("\n");
        pastStorylineSection = pastStorylineSection
          ? `${pastStorylineSection}\n\n${priorSection}`
          : priorSection;
      }
    }

    const { generatePastDiagnosis } = await import(
      "../../llm/actions/generatePastDiagnosis"
    );
    const result = await generatePastDiagnosis(
      studentId,
      tenantId,
      neisYears,
      studentGrade,
      pastStorylineSection,
    );

    if (!result.success) {
      logActionError(LOG_CTX, `Past Diagnosis 실패: ${result.error}`, { pipelineId });
      throw new Error(result.error);
    }
    if (!result.data) {
      throw new Error("Past Diagnosis 응답 data 누락");
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
