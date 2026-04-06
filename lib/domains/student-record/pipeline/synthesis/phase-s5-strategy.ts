// ============================================
// S5: runActivitySummary + runAiStrategy
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../../pipeline-types";
import type { PersistedEdge } from "../../edge-repository";
import type { CrossRefEdge } from "../../cross-reference";
import * as competencyRepo from "../../competency-repository";
import * as diagnosisRepo from "../../diagnosis-repository";
import {
  fetchAllYearCompetencyScores,
  buildUniversityMatchPromptSection,
  competencyGradeToScore,
} from "./helpers";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

// ============================================
// 10. 활동 요약서
// ============================================

export async function runActivitySummary(
  ctx: PipelineContext,
  computedEdges: PersistedEdge[] | CrossRefEdge[],
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, studentGrade } = ctx;

  const { generateActivitySummary } = await import("../../llm/actions/generateActivitySummary");
  const grades = Array.from({ length: studentGrade }, (_, i) => i + 1);
  // Phase E2: 엣지 데이터 → 요약서 프롬프트에 투입
  let summaryEdgeSection: string | undefined;
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("../../edge-summary");
    summaryEdgeSection = buildEdgePromptSection(computedEdges, "summary");
  }
  // Phase 6: 가이드 배정 컨텍스트 → 요약서 프롬프트에 투입
  const { buildGuideContextSection } = await import("../../guide-context");
  const summaryContextSection = await buildGuideContextSection(studentId, "summary");

  // 진단 데이터 → 요약서에 강점/약점 맥락 투입
  let diagnosisSection: string | undefined;
  const summaryDiag = await diagnosisRepo.findDiagnosis(studentId, calculateSchoolYear(), tenantId, "ai");
  if (summaryDiag) {
    const parts: string[] = ["## 종합 진단 요약 (활동 서술에 반영)"];
    if (summaryDiag.strengths && (summaryDiag.strengths as string[]).length > 0) {
      parts.push(`강점: ${(summaryDiag.strengths as string[]).join("; ")}`);
    }
    if (summaryDiag.weaknesses && (summaryDiag.weaknesses as string[]).length > 0) {
      parts.push(`보완 필요: ${(summaryDiag.weaknesses as string[]).join("; ")}`);
    }
    if (Array.isArray(summaryDiag.improvements) && (summaryDiag.improvements as unknown[]).length > 0) {
      const imps = summaryDiag.improvements as Array<{ priority: string; area: string; action: string }>;
      parts.push(`개선 전략: ${imps.map((i) => `[${i.priority}] ${i.area}`).join(", ")}`);
    }
    if (parts.length > 1) diagnosisSection = parts.join("\n");
  }

  // 비NEIS 학년의 수강계획 컨텍스트 (레코드 없는 학년 보강)
  let summaryCoursePlanSection: string | undefined;
  if (ctx.consultingGrades && ctx.consultingGrades.length > 0 && ctx.coursePlanData?.plans) {
    const plans = ctx.coursePlanData.plans.filter(
      (p) => (p.plan_status === "confirmed" || p.plan_status === "recommended")
        && ctx.consultingGrades!.includes(p.grade),
    );
    if (plans.length > 0) {
      const byGrade = new Map<number, string[]>();
      for (const p of plans) {
        if (!byGrade.has(p.grade)) byGrade.set(p.grade, []);
        const name = (p.subject as { name?: string } | null)?.name ?? "과목 미정";
        byGrade.get(p.grade)!.push(name);
      }
      const lines = [...byGrade.entries()]
        .sort(([a], [b]) => a - b)
        .map(([g, subs]) => `- ${g}학년 수강 예정: ${subs.join(", ")}`);
      summaryCoursePlanSection = `## 수강 계획 (기록 없는 학년)\n${lines.join("\n")}\n위 학년은 아직 기록이 없습니다. 수강 예정 교과를 고려하여 해당 학년의 활동 방향을 서술하세요.`;
    }
  }

  const extraSections = [summaryEdgeSection, summaryContextSection, diagnosisSection, summaryCoursePlanSection].filter(Boolean).join("\n") || undefined;
  const result = await generateActivitySummary(studentId, grades, extraSections);
  if (!result.success) throw new Error(result.error);
  return "활동 요약서 생성 완료";
}

// ============================================
// 11. 보완전략 자동 제안
// ============================================

export async function runAiStrategy(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, studentGrade, snapshot, pipelineId, results } = ctx;

  const currentSchoolYear = calculateSchoolYear();

  // 1~3. 진단 + 역량 + 기존 전략 + 가이드 컨텍스트 병렬 조회
  const [diagnosis, aiScores, existingStrategies, guideContextSection] = await Promise.all([
    diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai"),
    competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai"),
    diagnosisRepo.findStrategies(studentId, currentSchoolYear, tenantId),
    import("../../guide-context").then(({ buildGuideContextSection: build }) =>
      build(studentId, "strategy"),
    ).catch((err) => {
      logActionError({ ...LOG_CTX, action: "pipeline.guideContext" }, err, { pipelineId });
      return "";
    }),
  ]);
  const weaknesses = (diagnosis?.weaknesses as string[]) ?? [];

  const { COMPETENCY_ITEMS: CI } = await import("../../constants");
  const weakCompetencies = aiScores
    .filter((s) => ["B", "B-", "C"].includes(s.grade_value))
    .map((s) => ({
      item: s.competency_item as import("../../types").CompetencyItemCode,
      grade: s.grade_value as import("../../types").CompetencyGrade,
      label: CI.find((i) => i.code === s.competency_item)?.label ?? s.competency_item,
    }));

  // 루브릭 질문별 약점 추출 (B- 이하)
  const { COMPETENCY_RUBRIC_QUESTIONS: CRQ } = await import("../../constants");
  const rubricWeaknesses: string[] = [];
  for (const score of aiScores) {
    const rubrics = Array.isArray(score.rubric_scores) ? score.rubric_scores as Array<{ questionIndex: number; grade: string; reasoning: string }> : [];
    const questions = CRQ[score.competency_item as import("../../types").CompetencyItemCode] ?? [];
    for (const r of rubrics) {
      if (["B-", "C"].includes(r.grade) && questions[r.questionIndex]) {
        const itemLabel = CI.find((i) => i.code === score.competency_item)?.label ?? score.competency_item;
        rubricWeaknesses.push(`${itemLabel} — "${questions[r.questionIndex]}" (${r.grade}): ${r.reasoning.slice(0, 50)}`);
      }
    }
  }

  if (weaknesses.length === 0 && weakCompetencies.length === 0 && rubricWeaknesses.length === 0) {
    return "약점/부족역량 없음 — 건너뜀";
  }

  // 재실행 안전성: 기존 planned 전략 삭제 (in_progress/done은 보존)
  const plannedStrategies = existingStrategies.filter((s) => s.status === "planned");
  if (plannedStrategies.length > 0) {
    await Promise.allSettled(
      plannedStrategies.map((s) => diagnosisRepo.deleteStrategy(s.id)),
    );
  }

  // 삭제 후 남은 전략만으로 중복 체크
  const keptStrategies = existingStrategies.filter((s) => s.status !== "planned");
  const existingContents = keptStrategies.map((s) => s.strategy_content.slice(0, 60));

  // 4. AI 보완전략 제안
  // P2-1: 진단의 improvements를 시드 데이터로 전달
  const diagnosisImprovements = Array.isArray(diagnosis?.improvements)
    ? (diagnosis.improvements as Array<{ priority: string; area: string; gap: string; action: string; outcome: string }>)
    : [];

  // eval 대학 계열 적합도 분석 주입 (실패해도 전략 생성 계속)
  let universityMatchContext: string | undefined;
  let savedMatchAnalysis: import("../../eval/university-profile-matcher").UniversityMatchAnalysis | undefined;
  try {
    const allYearScores = await fetchAllYearCompetencyScores(
      ctx.supabase, studentId, tenantId,
    );
    if (allYearScores.length > 0) {
      const { matchUniversityProfiles } = await import("../../eval/university-profile-matcher");
      const scoreMap: Record<string, number> = {};
      // 가장 최근 학년(가장 큰 gradeYear)의 점수를 사용
      const sorted = [...allYearScores].sort((a, b) => b.gradeYear - a.gradeYear);
      for (const s of sorted) {
        if (!(s.competencyItem in scoreMap)) {
          scoreMap[s.competencyItem] = competencyGradeToScore(s.gradeValue);
        }
      }
      const matchAnalysis = matchUniversityProfiles(studentId, scoreMap);
      if (matchAnalysis.matches.length > 0) {
        savedMatchAnalysis = matchAnalysis;
        universityMatchContext = buildUniversityMatchPromptSection(matchAnalysis);
      }
    }
  } catch (umErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.universityMatch" }, umErr, { pipelineId });
  }

  // Phase 재시작 시 ctx.qualityPatterns가 유실된 경우 DB에서 재집계
  if (!ctx.qualityPatterns) {
    try {
      const { aggregateQualityPatterns } = await import("./helpers");
      const { repeatingPatterns } = await aggregateQualityPatterns(ctx);
      if (repeatingPatterns.length > 0) ctx.qualityPatterns = repeatingPatterns;
    } catch { /* 재집계 실패해도 전략 생성은 계속 */ }
  }

  const { suggestStrategies } = await import("../../llm/actions/suggestStrategies");
  const result = await suggestStrategies({
    weaknesses,
    weakCompetencies,
    rubricWeaknesses,
    diagnosisImprovements,
    grade: studentGrade,
    targetMajor: (snapshot?.target_major as string) ?? undefined,
    existingStrategies: existingContents,
    universityMatchContext,
    guideContextSection: guideContextSection || undefined,
    qualityPatterns: ctx.qualityPatterns,
  });
  if (!result.success) throw new Error(result.error);

  // 5. DB 저장 — 병렬
  const strategyResults = await Promise.allSettled(
    result.data.suggestions.map((suggestion) =>
      diagnosisRepo.insertStrategy({
        student_id: studentId,
        tenant_id: tenantId,
        school_year: currentSchoolYear,
        grade: studentGrade,
        target_area: suggestion.targetArea,
        strategy_content: suggestion.strategyContent,
        priority: suggestion.priority,
        status: "planned",
        reasoning: suggestion.reasoning || null,
        source_urls: suggestion.sourceUrls ?? null,
      }),
    ),
  );
  const saved = strategyResults.filter((r) => r.status === "fulfilled").length;
  const strategyFailed = strategyResults.filter((r) => r.status === "rejected");
  if (strategyFailed.length > 0) {
    logActionError({ ...LOG_CTX, action: "pipeline.ai_strategy.save" }, new Error(`${strategyFailed.length}건 저장 실패`), {
      pipelineId,
      reasons: strategyFailed.map((r) => r.status === "rejected" ? String(r.reason) : "").filter(Boolean).slice(0, 3),
    });
  }

  // results는 컨텍스트에서 참조하므로 사용됨을 명시
  void results;

  return {
    preview: `${saved}건 보완전략 제안됨`,
    result: {
      savedCount: saved,
      // executive summary 생성을 위해 캐시 (Phase 6 완료 후 참조)
      ...(savedMatchAnalysis ? { _universityMatch: savedMatchAnalysis } : {}),
    },
  };
}
