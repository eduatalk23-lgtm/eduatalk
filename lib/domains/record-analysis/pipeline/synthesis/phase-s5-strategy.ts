// ============================================
// S5: runActivitySummary + runAiStrategy
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../pipeline-types";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import type { CrossRefEdge } from "@/lib/domains/student-record/cross-reference";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import * as diagnosisRepo from "@/lib/domains/student-record/repository/diagnosis-repository";
import {
  fetchAllYearCompetencyScores,
  buildUniversityMatchPromptSection,
  buildHyperedgeSummarySection,
  competencyGradeToScore,
} from "./helpers";
import { findHyperedges } from "@/lib/domains/student-record/repository/hyperedge-repository";

// M4: 가이드 배정 컨텍스트 캐시 — Phase 간 DB 재조회 방지
type GuideContextKey = "guide" | "summary" | "strategy";
async function getCachedGuideContext(
  ctx: PipelineContext,
  studentId: string,
  context: GuideContextKey,
): Promise<string> {
  if (!ctx.cachedGuideContexts) ctx.cachedGuideContexts = {};
  const cached = ctx.cachedGuideContexts[context];
  if (cached !== undefined) return cached;

  const { buildGuideContextSection } = await import("@/lib/domains/student-record/guide-context");
  const section = await buildGuideContextSection(studentId, context);
  ctx.cachedGuideContexts[context] = section;
  return section;
}

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

// ============================================
// 10. 활동 요약서
// ============================================

export async function runActivitySummary(
  ctx: PipelineContext,
  computedEdges: PersistedEdge[] | CrossRefEdge[],
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId } = ctx;

  const { generateActivitySummary } = await import("../../llm/actions/generateActivitySummary");
  // B13: 3년 통합 설계 원칙 — studentGrade 와 무관하게 [1,2,3] 전체를 처리한다.
  //   1학년 prospective 는 3년 계획, 2학년 hybrid 는 1학년 NEIS + 2학년 진행 + 3학년 설계,
  //   3학년 analysis 는 3년 회고. studentGrade 는 generateActivitySummary 내부의 mode 분기에만 쓰인다.
  const grades = [1, 2, 3];
  // Phase E2: 엣지 데이터 → 요약서 프롬프트에 투입
  let summaryEdgeSection: string | undefined;
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("@/lib/domains/student-record/edge-summary");
    summaryEdgeSection = buildEdgePromptSection(computedEdges, "summary");
  }
  // Phase 6: 가이드 배정 컨텍스트 → 요약서 프롬프트에 투입 (M4: ctx 캐시 활용)
  const summaryContextSection = await getCachedGuideContext(ctx, studentId, "summary");

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
        && ctx.consultingGrades.includes(p.grade),
    );
    if (plans.length > 0) {
      const byGrade = new Map<number, string[]>();
      for (const p of plans) {
        if (!byGrade.has(p.grade)) byGrade.set(p.grade, []);
        const name = (p.subject as { name?: string } | null)?.name ?? "과목 미정";
        byGrade.get(p.grade)?.push(name);
      }
      const lines = [...byGrade.entries()]
        .sort(([a], [b]) => a - b)
        .map(([g, subs]) => `- ${g}학년 수강 예정: ${subs.join(", ")}`);
      summaryCoursePlanSection = `## 수강 계획 (기록 없는 학년)\n${lines.join("\n")}\n위 학년은 아직 기록이 없습니다. 수강 예정 교과를 고려하여 해당 학년의 활동 방향을 서술하세요.`;
    }
  }

  // Cross-run: 직전 실행 interview_generation.topQuestions → "질문이 많이 나왔던 활동" 우선 요약.
  // manifest: interview_generation.writesForNextRun = ["activity_summary"].
  let priorInterviewSection: string | undefined;
  let priorInterviewCount = 0;
  let priorInterviewSectionChars = 0;
  const prevRun = ctx.belief.previousRunOutputs;
  if (prevRun?.runId) {
    const { getPreviousRunResult } = await import("../pipeline-previous-run");
    const prevInterview = getPreviousRunResult<{
      totalCount: number;
      byType: Record<string, number>;
      topQuestions: Array<{
        question: string;
        questionType: string;
        difficulty: string;
        sourceType: string;
      }>;
    }>(prevRun, "interview_generation");
    const qs = prevInterview?.topQuestions ?? [];
    if (qs.length > 0) {
      priorInterviewCount = qs.length;
      const lines = qs.map((q) => `- [${q.questionType}/${q.difficulty}] ${q.question}`);
      priorInterviewSection = [
        `## 직전 실행(${prevRun.completedAt?.slice(0, 10) ?? "이전"}) 면접 빈출 맥락`,
        "아래 질문이 쏠렸던 활동 축을 요약 서술에서 특히 **구체성/성장 서사**로 강화.",
        ...lines,
      ].join("\n");
      priorInterviewSectionChars = priorInterviewSection.length;
    }
  }

  const extraSections = [summaryEdgeSection, summaryContextSection, diagnosisSection, summaryCoursePlanSection, priorInterviewSection].filter(Boolean).join("\n") || undefined;
  const result = await generateActivitySummary(studentId, grades, extraSections);
  if (!result.success) throw new Error(result.error);

  // Cross-run: 방금 저장된 + 최근 저장된 activity_summaries 를 task_results 에 스냅샷.
  // 다음 실행 storyline_generation 이 `ctx.previousRunOutputs.taskResults.activity_summary.summaries`
  // 로 즉시 읽을 수 있게 top 8건 유지.
  const { data: recentRows } = await ctx.supabase
    .from("student_record_activity_summaries")
    .select("school_year, target_grades, summary_title, summary_sections")
    .eq("student_id", studentId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(8);

  const summaries = (recentRows ?? []).map((r) => {
    // summary_sections 에서 **실질 주제 토큰** 만 추출.
    // 섹션 배열 구조: [{sectionType, title, content, relatedSubjects?, keywords?}]
    // 우선순위: (1) section.keywords (LLM이 명시 추출) > (2) relatedSubjects (교과명).
    // content 발췌는 사용하지 않음 — 문장 파편이 되어 LLM 재활용 불가.
    const collected: string[] = [];
    const s = r.summary_sections as unknown;
    if (Array.isArray(s)) {
      for (const row of s) {
        if (!row || typeof row !== "object") continue;
        const rec = row as Record<string, unknown>;
        if (Array.isArray(rec.keywords)) {
          for (const kw of rec.keywords) {
            if (typeof kw === "string" && kw.length > 0 && kw.length <= 20) collected.push(kw);
          }
        }
        if (Array.isArray(rec.relatedSubjects)) {
          for (const sub of rec.relatedSubjects) {
            if (typeof sub === "string" && sub.length > 0) collected.push(sub);
          }
        }
      }
    }
    const unique = Array.from(new Set(collected)).slice(0, 16);
    return {
      schoolYear: r.school_year as number,
      targetGrades: (r.target_grades as number[] | null) ?? [],
      title: (r.summary_title as string | null) ?? "",
      keywords: unique.length > 0 ? unique : undefined,
    };
  });

  return {
    preview: `활동 요약서 생성 완료 (스냅샷 ${summaries.length}건)`,
    result: {
      summaryCount: summaries.length,
      summaries,
      // Cross-run 소비 자기보고 (cross-run-consumer-diff [I] 측정용)
      priorInterviewCount,
      priorInterviewSectionChars,
    },
  };
}

// ============================================
// 11. 보완전략 자동 제안
// ============================================

export async function runAiStrategy(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, studentGrade, snapshot, pipelineId, results } = ctx;

  const currentSchoolYear = calculateSchoolYear();

  // 1~3. 진단 + 역량 + 기존 전략 + 가이드 컨텍스트 병렬 조회 (M4: ctx 캐시 활용)
  const [diagnosis, aiScores, existingStrategies, guideContextSection] = await Promise.all([
    diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai"),
    competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai")
      .then(async (scores) => {
        // 설계 모드 폴백: ai 점수 0건이고 consulting 학년이 있으면 ai_projected도 조회
        if (scores.length === 0 && ctx.consultingGrades && ctx.consultingGrades.length > 0) {
          return competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai_projected");
        }
        return scores;
      }),
    diagnosisRepo.findStrategies(studentId, currentSchoolYear, tenantId),
    getCachedGuideContext(ctx, studentId, "strategy").catch((err) => {
      logActionError({ ...LOG_CTX, action: "pipeline.guideContext" }, err, { pipelineId });
      return "";
    }),
  ]);
  const weaknesses = (diagnosis?.weaknesses as string[]) ?? [];

  const { COMPETENCY_ITEMS: CI } = await import("@/lib/domains/student-record/constants");
  const weakCompetencies = aiScores
    .filter((s) => s.grade_value === "B-" || s.grade_value === "C")
    .map((s) => ({
      item: s.competency_item as import("@/lib/domains/student-record/types").CompetencyItemCode,
      grade: s.grade_value as import("@/lib/domains/student-record/types").CompetencyGrade,
      label: CI.find((i) => i.code === s.competency_item)?.label ?? s.competency_item,
    }));

  // 루브릭 질문별 약점 추출 (B- 이하)
  const { COMPETENCY_RUBRIC_QUESTIONS: CRQ } = await import("@/lib/domains/student-record/constants");
  const rubricWeaknesses: string[] = [];
  for (const score of aiScores) {
    const rubrics = Array.isArray(score.rubric_scores) ? score.rubric_scores as Array<{ questionIndex: number; grade: string; reasoning: string }> : [];
    const questions = CRQ[score.competency_item as import("@/lib/domains/student-record/types").CompetencyItemCode] ?? [];
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
      const { matchUniversityProfiles, collectSubjectDirectionScores } = await import("../../eval/university-profile-matcher");
      const scoreMap: Record<string, number> = {};
      // 가장 최근 학년(가장 큰 gradeYear)의 점수를 사용
      const sorted = [...allYearScores].sort((a, b) => b.gradeYear - a.gradeYear);
      for (const s of sorted) {
        if (!(s.competencyItem in scoreMap)) {
          scoreMap[s.competencyItem] = competencyGradeToScore(s.gradeValue);
        }
      }
      // v2: 과목 방향 점수 수집 — 세특 content_quality 기반
      let directionScores: import("../../eval/university-profile-matcher").SubjectDirectionScores | undefined;
      try {
        const qualityRows = await ctx.supabase
          .from("student_record_content_quality")
          .select("record_id, depth, specificity, record_type")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .eq("source", "ai")
          .eq("record_type", "setek");
        if (qualityRows.data && qualityRows.data.length > 0) {
          // record_id → subject_name 매핑
          const recordIds = qualityRows.data.map(r => r.record_id);
          const setekRows = await ctx.supabase
            .from("student_record_seteks")
            .select("id, subject_id")
            .in("id", recordIds)
            .is("deleted_at", null);
          if (setekRows.data && setekRows.data.length > 0) {
            const subjectIds = [...new Set(setekRows.data.map(s => s.subject_id).filter(Boolean))];
            const subjectRows = await ctx.supabase
              .from("subjects")
              .select("id, name")
              .in("id", subjectIds);
            const subjectMap = new Map((subjectRows.data ?? []).map(s => [s.id, s.name]));
            const setekSubjectMap = new Map(
              (setekRows.data ?? []).map(s => [s.id, s.subject_id]),
            );

            const entries: import("../../eval/university-profile-matcher").SubjectQualityEntry[] = [];
            for (const q of qualityRows.data) {
              const subjId = setekSubjectMap.get(q.record_id);
              const subjName = subjId ? subjectMap.get(subjId) : undefined;
              if (subjName && q.depth != null && q.specificity != null) {
                entries.push({ subjectName: subjName, depth: q.depth, specificity: q.specificity });
              }
            }

            const currYear = (snapshot?.curriculum_revision as number) ?? 2015;
            directionScores = collectSubjectDirectionScores(entries, currYear);
          }
        }
      } catch (dirErr) {
        logActionError({ ...LOG_CTX, action: "pipeline.directionScores" }, dirErr, { pipelineId });
      }

      const matchAnalysis = matchUniversityProfiles(studentId, scoreMap, directionScores);
      if (matchAnalysis.matches.length > 0) {
        savedMatchAnalysis = matchAnalysis;
        universityMatchContext = buildUniversityMatchPromptSection(matchAnalysis);
      }
    }
  } catch (umErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.universityMatch" }, umErr, { pipelineId });
  }

  // Phase 재시작 시 belief.qualityPatterns 가 유실된 경우 DB에서 재집계
  if (!ctx.belief.qualityPatterns) {
    try {
      const { aggregateQualityPatterns } = await import("./helpers");
      const { repeatingPatterns } = await aggregateQualityPatterns(ctx);
      if (repeatingPatterns.length > 0) {
        ctx.belief.qualityPatterns = repeatingPatterns;
      }
    } catch { /* 재집계 실패해도 전략 생성은 계속 */ }
  }

  // Phase 1 Layer 2: 통합 테마(hyperedge) 주입 — 수렴 서사축을 전략 근거로 공급.
  // C2: 설계 모드 폴백 — analysis hyperedges가 없으면 projected도 조회.
  let hyperedgeSummarySection: string | undefined;
  try {
    let hyperedges = await findHyperedges(studentId, tenantId, {
      contexts: ["analysis"],
    });
    if (hyperedges.length === 0) {
      hyperedges = await findHyperedges(studentId, tenantId, {
        contexts: ["projected"],
      });
    }
    if (hyperedges.length > 0) {
      hyperedgeSummarySection = buildHyperedgeSummarySection(hyperedges);
    }
  } catch (hyperErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.hyperedges" }, hyperErr, { pipelineId });
  }

  // Phase δ-6: 활성 메인 탐구 섹션 (best-effort)
  const { fetchActiveMainExplorationSection, buildBlueprintContextSection, buildGapTrackerContextSection } = await import("./helpers");
  const mainExplorationSection = await fetchActiveMainExplorationSection(studentId, tenantId);

  // Blueprint-Axis: blueprint 설계 기준 + gap bridge 우선순위 (best-effort)
  const blueprintSection = buildBlueprintContextSection(ctx);
  const gapSection = buildGapTrackerContextSection(ctx);

  // Cross-run: 직전 실행 gap_tracking.topBridges → "미해결 gap 우선 공략" 맥락.
  // manifest: gap_tracking.writesForNextRun = ["ai_strategy"].
  let priorGapSection: string | undefined;
  let priorGapBridgeCount = 0;
  let priorGapSectionChars = 0;
  const prevRun = ctx.belief.previousRunOutputs;
  if (prevRun?.runId) {
    const { getPreviousRunResult } = await import("../pipeline-previous-run");
    const prevGap = getPreviousRunResult<{
      bridgeCount: number;
      topBridges: Array<{
        themeLabel: string;
        urgency: string;
        targetGrade: number | null;
        sharedCompetencies: string[];
      }>;
    }>(prevRun, "gap_tracking");
    const bridges = prevGap?.topBridges ?? [];
    if (bridges.length > 0) {
      priorGapBridgeCount = bridges.length;
      const lines = bridges.map((b) => {
        const grade = b.targetGrade ? `${b.targetGrade}학년` : "학년 미정";
        const comps = b.sharedCompetencies.slice(0, 3).join(", ");
        return `- [${b.urgency}] ${grade} "${b.themeLabel}" (역량: ${comps || "없음"})`;
      });
      priorGapSection = [
        `## 직전 실행(${prevRun.completedAt?.slice(0, 10) ?? "이전"}) 미해결 격차`,
        "아래 bridge 제안 중 아직 해결되지 않은 항목을 우선 공략 대상으로 반영.",
        ...lines,
      ].join("\n");
      priorGapSectionChars = priorGapSection.length;
    }
  }

  // hyperedge 요약에 blueprint/gap 컨텍스트 + 직전 실행 미해결 격차 병합
  const combinedHyperedgeSection = [hyperedgeSummarySection, blueprintSection, gapSection, priorGapSection]
    .filter(Boolean)
    .join("\n\n") || undefined;

  // β 격차 1: MidPlan 핵심 탐구 축 가설 → 전략 프롬프트 주입 (best-effort)
  let midPlanSynthesisSection: string | undefined;
  try {
    const midPlan = ctx.midPlan ?? (results["_midPlan"] as import("../orient/mid-pipeline-planner").MidPlan | null | undefined);
    if (midPlan) {
      const { buildMidPlanSynthesisSection } = await import("@/lib/domains/record-analysis/llm/mid-plan-guide-section");
      midPlanSynthesisSection = buildMidPlanSynthesisSection(midPlan);
    }
  } catch (mpErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.midPlanSynthesisSection.strategy" }, mpErr, { pipelineId });
  }

  // 격차 4: 설계 모드 AI 가안 품질(source='ai_projected') → 전략 프롬프트 주입 (best-effort)
  // collectSubjectDirectionScores() 는 source='ai' 만 읽으므로 별도 섹션으로 병행 주입한다.
  let projectedQualitySection: string | undefined;
  if (ctx.consultingGrades && ctx.consultingGrades.length > 0) {
    try {
      const { fetchProjectedQualitySummary, buildProjectedQualitySection } = await import(
        "@/lib/domains/record-analysis/llm/projected-quality-section"
      );
      const projQuality = await fetchProjectedQualitySummary(ctx.supabase, studentId, tenantId);
      projectedQualitySection = buildProjectedQualitySection(projQuality) ?? undefined;
    } catch (pqErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.projectedQualitySection.strategy" }, pqErr, { pipelineId });
    }
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
    hyperedgeSummarySection: combinedHyperedgeSection,
    qualityPatterns: ctx.belief.qualityPatterns,
    mainExplorationSection: mainExplorationSection || undefined,
    midPlanSynthesisSection,
    projectedQualitySection,
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
      // Cross-run 소비 자기보고 (cross-run-consumer-diff [J] 측정용)
      priorGapBridgeCount,
      priorGapSectionChars,
      // executive summary 생성을 위해 캐시 (Phase 6 완료 후 참조)
      ...(savedMatchAnalysis ? { _universityMatch: savedMatchAnalysis } : {}),
    },
  };
}
