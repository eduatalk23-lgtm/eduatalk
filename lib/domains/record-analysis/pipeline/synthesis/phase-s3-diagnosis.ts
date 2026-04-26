// ============================================
// S3: runAiDiagnosis + runCourseRecommendation
// ============================================

import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
  type ScoreRowWithSubject,
} from "../pipeline-types";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import type { CrossRefEdge } from "@/lib/domains/student-record/cross-reference";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import * as diagnosisRepo from "@/lib/domains/student-record/repository/diagnosis-repository";
import type { DiagnosisInsert } from "@/lib/domains/student-record/types";
import {
  aggregateQualityPatterns,
  fetchAllYearCompetencyScores,
  buildTimeseriesPromptSection,
  aggregateGradeThemes,
  buildCrossSubjectThemesDiagnosisSection,
} from "./helpers";
import { resolveMidPlan } from "../orient/resolve-mid-plan";
import { parseSnapshotHakjongScore } from "./snapshot-helpers";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

// ============================================
// 4. AI 종합 진단
// ============================================

export async function runAiDiagnosis(
  ctx: PipelineContext,
  computedEdges: PersistedEdge[] | CrossRefEdge[],
  sharedCourseAdequacy: import("@/lib/domains/student-record/types").CourseAdequacyResult | null,
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId, pipelineId, studentGrade, snapshot, tasks, coursePlanData, neisGrades } = ctx;

  const currentSchoolYear = calculateSchoolYear();

  const [scores, tags] = await Promise.all([
    competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId),
    competencyRepo.findActivityTags(studentId, tenantId, { excludeTagContext: "draft_analysis" }),
  ]);

  // NEIS 학년이 없어 역량 데이터가 0건이면 수강계획 기반 예비 진단으로 전환.
  const hasNeisData = neisGrades && neisGrades.length > 0;
  const hasConsultingGrades = ctx.consultingGrades && ctx.consultingGrades.length > 0;

  // NEIS가 있는데 역량 데이터까지 0건이면 역량 분석이 아직 실행되지 않은 것 → 건너뜀
  if (hasNeisData && scores.length === 0 && tags.length === 0) {
    return "역량 데이터 없음 — 건너뜀";
  }

  // 하이브리드 모드: NEIS 학년이 있어도 컨설팅 학년이 있으면 수강계획 컨텍스트 전달
  const coursePlanContext = (!hasNeisData || hasConsultingGrades)
    ? { studentId, tenantId, coursePlanData: coursePlanData ?? null, snapshot }
    : undefined;

  const { generateAiDiagnosis } = await import("../../llm/actions/generateDiagnosis");
  // Phase E2: 엣지 데이터 → 진단 프롬프트에 투입
  let diagnosisEdgeSection: string | undefined;
  const edgeComputationFailed = tasks.edge_computation === "failed";
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("@/lib/domains/record-analysis/llm/edge-summary");
    diagnosisEdgeSection = buildEdgePromptSection(computedEdges, "diagnosis");
  } else if (edgeComputationFailed) {
    logActionDebug(LOG_CTX, "엣지 계산 실패 → 진단에 연결 분석 미포함", { pipelineId });
  }

  // 보강 컨텍스트: 성적 추이 + 교과이수적합도
  const { fetchScoresWithSubject } = await import("@/lib/domains/student-record/repository/score-query");
  const trendRows = await fetchScoresWithSubject(supabase, studentId);
  const gradeTrend = trendRows
    .filter((s) => s.rank_grade != null)
    .map((s) => ({
      grade: s.grade ?? 1,
      semester: s.semester ?? 1,
      subjectName: s.subject?.name ?? "",
      rankGrade: s.rank_grade as number,
    }));

  // edge_computation에서 계산한 courseAdequacy 재사용, 없으면 fallback 계산
  let diagCourseAdequacy = sharedCourseAdequacy;
  if (!diagCourseAdequacy && (snapshot?.target_major as string)) {
    try {
      const { calculateCourseAdequacy: calcAdequacyFallback } = await import("@/lib/domains/student-record/course-adequacy");
      const { getCurriculumYear: getCurrYearFallback } = await import("@/lib/utils/schoolYear");
      const fbEnrollmentYear = calculateSchoolYear() - studentGrade + 1;
      const fbCurriculumYear = getCurrYearFallback(fbEnrollmentYear);
      const fbTargetMajor = snapshot?.target_major as string;

      // 이수과목 조회
      const fbScoreRows = await fetchScoresWithSubject(supabase, studentId);
      const fbTakenSubjects = [...new Set(
        fbScoreRows
          .map((s) => s.subject?.name)
          .filter((n): n is string => !!n),
      )];

      diagCourseAdequacy = calcAdequacyFallback(fbTargetMajor, fbTakenSubjects, null, fbCurriculumYear);
      logActionDebug(LOG_CTX, "courseAdequacy fallback 계산 완료 (edge_computation 미실행)", { pipelineId });
    } catch (fbErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.diagCourseAdequacyFallback" }, fbErr, { pipelineId });
    }
  }

  // P2-1: 엣지의 shared_competencies에서 역량 연결 빈도 집계
  const edgeCompetencyFreq = new Map<string, number>();
  for (const e of computedEdges) {
    const comps = "shared_competencies" in e ? e.shared_competencies : ("sharedCompetencies" in e ? (e as { sharedCompetencies?: string[] }).sharedCompetencies : null);
    for (const c of comps ?? []) {
      edgeCompetencyFreq.set(c, (edgeCompetencyFreq.get(c) ?? 0) + 1);
    }
  }

  // 전 학년 품질 패턴 집계 (NEIS 데이터가 있는 경우에만 의미 있음)
  let diagQualityPatternSection: string | undefined;
  if (hasNeisData) {
    try {
      const { qualityPatternSection, repeatingPatterns } = await aggregateQualityPatterns(ctx);
      if (qualityPatternSection) diagQualityPatternSection = qualityPatternSection;
      if (repeatingPatterns.length > 0) {
        ctx.belief.qualityPatterns = repeatingPatterns;
      }
      // 집계 실패 또는 빈 결과: belief.qualityPatterns 는 undefined 유지 (graceful)
    } catch (qpErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.aggregateQualityPatterns" }, qpErr, { pipelineId });
    }
  }

  // eval 시계열 분석 주입 (실패해도 진단 생성 계속)
  let savedTsAnalysis: import("../../eval/timeseries-analyzer").TimeSeriesAnalysis | undefined;
  if (hasNeisData) {
    try {
      const allYearScores = await fetchAllYearCompetencyScores(supabase, studentId, tenantId);
      if (allYearScores.length > 0) {
        const { analyzeTimeSeries } = await import("../../eval/timeseries-analyzer");
        const { competencyGradeToScore } = await import("./helpers");
        const tsPoints = allYearScores.map((s) => ({
          gradeYear: s.gradeYear as 1 | 2 | 3,
          competencyId: s.competencyItem,
          competencyName: s.competencyLabel,
          score: competencyGradeToScore(s.gradeValue),
        }));
        const tsAnalysis = analyzeTimeSeries(studentId, tsPoints);
        if (tsAnalysis.trends.length > 0) {
          savedTsAnalysis = tsAnalysis;
          const tsSection = buildTimeseriesPromptSection(tsAnalysis);
          diagQualityPatternSection = diagQualityPatternSection
            ? `${diagQualityPatternSection}\n${tsSection}`
            : tsSection;
        }
      }
    } catch (tsErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.timeseriesAnalysis" }, tsErr, { pipelineId });
    }
  }

  // L5: 설계 모드 projected 데이터 별도 섹션 (ai_projected scores + projected edges)
  if (ctx.consultingGrades && ctx.consultingGrades.length > 0) {
    try {
      const projectedScores = await competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai_projected");
      const edgeRepo = await import("@/lib/domains/student-record/repository/edge-repository");
      const projectedEdges = await edgeRepo.findEdges(studentId, tenantId, "projected");

      if (projectedScores.length > 0 || projectedEdges.length > 0) {
        const lines: string[] = ["## 설계 모드 예상 데이터 (참고용)"];
        lines.push("⚠ 아래는 NEIS 기록이 없는 학년의 AI 가안 분석 결과입니다. 확정 데이터가 아닌 예상치입니다.");

        if (projectedScores.length > 0) {
          lines.push("\n### 예상 역량 등급");
          for (const s of projectedScores) {
            lines.push(`- ${s.competency_area} > ${s.competency_item}: ${s.grade_value}`);
          }
        }

        if (projectedEdges.length > 0) {
          lines.push(`\n### 예상 연결 (${projectedEdges.length}건)`);
          for (const e of projectedEdges.slice(0, 10)) {
            lines.push(`- ${e.source_label} → ${e.target_label} (${e.edge_type}): ${e.reason}`);
          }
          if (projectedEdges.length > 10) {
            lines.push(`  ... 외 ${projectedEdges.length - 10}건`);
          }
        }

        const projectedSection = lines.join("\n");
        diagQualityPatternSection = diagQualityPatternSection
          ? `${diagQualityPatternSection}\n\n${projectedSection}`
          : projectedSection;
      }
    } catch (projErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.projectedDataSection" }, projErr, { pipelineId });
    }
  }

  // H1 후속: 전 학년 cross-subject theme 집계 → 진단 프롬프트 섹션.
  // Phase D2: belief.gradeThemesByGrade 가 시딩된 경우 재사용 (DB 재조회 생략).
  //   없으면 직접 aggregateGradeThemes() 호출 (폴백 — Grade 파이프라인에서 호출 시, 또는 시딩 실패 시).
  // 실패해도 진단 생성은 계속 (graceful degradation, 기존 qualityPattern과 동일).
  let crossSubjectThemesSection: string | undefined;
  if (hasNeisData) {
    try {
      const byGrade = ctx.belief.gradeThemesByGrade ?? await aggregateGradeThemes(ctx);
      const section = buildCrossSubjectThemesDiagnosisSection(byGrade);
      if (section) crossSubjectThemesSection = section;
    } catch (gtErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.aggregateGradeThemes" }, gtErr, { pipelineId });
    }
  }

  // Phase δ-6: 활성 메인 탐구 섹션 (best-effort)
  const { fetchActiveMainExplorationSection, buildBlueprintContextSection } = await import("./helpers");
  const mainExplorationSection = await fetchActiveMainExplorationSection(studentId, tenantId);

  // narrative_arc 8단계 서사 완성도 섹션 (best-effort: 실패 시 undefined → 진단 계속)
  let narrativeArcSection: string | undefined;
  try {
    const { buildNarrativeArcDiagnosisSection } = await import(
      "@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section"
    );
    narrativeArcSection = await buildNarrativeArcDiagnosisSection(studentId, tenantId, supabase);
  } catch (narErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.narrativeArcDiagnosisSection" }, narErr, { pipelineId });
  }

  // Blueprint-Axis: blueprint 설계 기준 섹션 (best-effort)
  const blueprintSection = buildBlueprintContextSection(ctx);
  if (blueprintSection) {
    diagQualityPatternSection = diagQualityPatternSection
      ? `${diagQualityPatternSection}\n\n${blueprintSection}`
      : blueprintSection;
  }

  // Cross-run: 직전 실행 course_recommendation → "수강 궤적" 맥락 주입.
  // manifest: course_recommendation.writesForNextRun = ["ai_diagnosis"].
  let priorCourseRecCount = 0;
  let priorCourseSectionChars = 0;
  const prevRun = ctx.belief.previousRunOutputs;
  if (prevRun?.runId) {
    const { getPreviousRunResult } = await import("../pipeline-previous-run");
    const prevCourse = getPreviousRunResult<{
      totalCount: number;
      recommendations: Array<{
        grade: number;
        semester: number | null;
        subjectName: string;
        priority: string | null;
      }>;
    }>(prevRun, "course_recommendation");
    const recs = prevCourse?.recommendations ?? [];
    if (recs.length > 0) {
      priorCourseRecCount = recs.length;
      const byGrade = new Map<number, string[]>();
      for (const r of recs) {
        const key = r.grade;
        const sem = r.semester != null ? `${r.semester}학기 ` : "";
        const arr = byGrade.get(key) ?? [];
        arr.push(`${sem}${r.subjectName}`);
        byGrade.set(key, arr);
      }
      const lines = [...byGrade.entries()]
        .sort(([a], [b]) => a - b)
        .map(([g, subs]) => `- ${g}학년: ${subs.join(", ")}`);
      const section = [
        `## 직전 실행(${prevRun.completedAt?.slice(0, 10) ?? "이전"}) 수강 궤적`,
        "이전 실행에서 권장한 수강 계획. 현재 확정/변경 여부와 대조하여 학생 의사결정의 일관성을 평가.",
        ...lines,
      ].join("\n");
      priorCourseSectionChars = section.length;
      diagQualityPatternSection = diagQualityPatternSection
        ? `${diagQualityPatternSection}\n\n${section}`
        : section;
    }
  }

  // β 격차 1: MidPlan 핵심 탐구 축 가설 → 진단 프롬프트 주입 (best-effort)
  let midPlanSynthesisSection: string | undefined;
  try {
    const midPlan = resolveMidPlan(ctx);
    if (midPlan) {
      const { buildMidPlanSynthesisSection } = await import("@/lib/domains/record-analysis/llm/mid-plan-guide-section");
      midPlanSynthesisSection = buildMidPlanSynthesisSection(midPlan);
    }
  } catch (mpErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.midPlanSynthesisSection.diagnosis" }, mpErr, { pipelineId });
  }

  // 격차 4: 설계 모드 AI 가안 품질(source='ai_projected') → 진단 프롬프트 주입 (best-effort)
  if (ctx.consultingGrades && ctx.consultingGrades.length > 0) {
    try {
      const { fetchProjectedQualitySummary, buildProjectedQualitySection } = await import(
        "@/lib/domains/record-analysis/llm/projected-quality-section"
      );
      const projQuality = await fetchProjectedQualitySummary(supabase, studentId, tenantId);
      const projQualitySection = buildProjectedQualitySection(projQuality);
      if (projQualitySection) {
        diagQualityPatternSection = diagQualityPatternSection
          ? `${diagQualityPatternSection}\n\n${projQualitySection}`
          : projQualitySection;
      }
    } catch (pqErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.projectedQualitySection.diagnosis" }, pqErr, { pipelineId });
    }
  }

  // 격차 6: 학종 3요소 통합 점수(hakjongScore) → 진단 프롬프트 주입 (best-effort)
  let hakjongScoreSection: string | undefined;
  try {
    const { findLatestSnapshot } = await import(
      "@/lib/domains/student-record/repository/student-state-repository"
    );
    const { buildHakjongScoreSection } = await import(
      "@/lib/domains/record-analysis/llm/hakjong-score-section"
    );
    const snap = await findLatestSnapshot(studentId, tenantId, supabase);
    if (snap?.snapshot_data) {
      const built = buildHakjongScoreSection(parseSnapshotHakjongScore(snap.snapshot_data) ?? null);
      if (built) hakjongScoreSection = built;
    }
  } catch (hkErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.hakjongScoreSection.diagnosis" }, hkErr, { pipelineId });
  }

  // Phase B G3 / Phase D2: 학년 지배 교과 교차 테마 → 진단 프롬프트 주입.
  // Synthesis: belief.gradeThemesByGrade (Phase D2 시딩) 우선 사용 → buildGradeThemesByGradeSection.
  // Grade 파이프라인(단일 학년): belief.gradeThemes → buildGradeThemesSection 폴백.
  let gradeThemesSection: string | undefined;
  try {
    if (ctx.belief.gradeThemesByGrade) {
      const { buildGradeThemesByGradeSection } = await import("./helpers");
      const built = buildGradeThemesByGradeSection(ctx.belief.gradeThemesByGrade);
      if (built) gradeThemesSection = built;
    } else {
      const { buildGradeThemesSection } = await import("@/lib/domains/record-analysis/llm/grade-themes-section");
      gradeThemesSection = buildGradeThemesSection(ctx.belief.gradeThemes);
    }
  } catch (gtErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.gradeThemesSection.diagnosis" }, gtErr, { pipelineId });
  }

  // Phase B G2: hyperedge(N-ary 수렴 테마) → 진단 프롬프트 주입 (best-effort)
  let hyperedgeSummarySection: string | undefined;
  try {
    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    const { buildHyperedgeSummarySection } = await import("./helpers");
    const hyperedges = await findHyperedges(studentId, tenantId, { contexts: ["analysis"] });
    if (hyperedges.length > 0) {
      const built = buildHyperedgeSummarySection(hyperedges);
      if (built) hyperedgeSummarySection = built;
    }
  } catch (heErr) {
    logActionError({ ...LOG_CTX, action: "pipeline.hyperedgeSummarySection.diagnosis" }, heErr, { pipelineId });
  }

  // Phase B G5: 학생 정체성 프로필 카드 (ctx.belief.profileCard) → 진단 프롬프트 주입
  const profileCardSection: string | undefined =
    ctx.belief.profileCard && ctx.belief.profileCard.trim().length > 0
      ? ctx.belief.profileCard
      : undefined;

  const result = await generateAiDiagnosis(scores, tags, {
    targetMajor: (snapshot?.target_major as string) ?? undefined,
    schoolName: (snapshot?.school_name as string) ?? undefined,
  }, diagnosisEdgeSection, {
    gradeTrend,
    courseAdequacy: diagCourseAdequacy ? {
      score: diagCourseAdequacy.score,
      majorCategory: diagCourseAdequacy.majorCategory,
      taken: diagCourseAdequacy.taken,
      notTaken: diagCourseAdequacy.notTaken,
      notOffered: diagCourseAdequacy.notOffered,
      generalRate: diagCourseAdequacy.generalRate,
      careerRate: diagCourseAdequacy.careerRate,
      fusionRate: diagCourseAdequacy.fusionRate,
    } : null,
  }, edgeCompetencyFreq, coursePlanContext, diagQualityPatternSection, crossSubjectThemesSection, mainExplorationSection || undefined, narrativeArcSection, midPlanSynthesisSection, hakjongScoreSection, gradeThemesSection, hyperedgeSummarySection, profileCardSection);
  if (!result.success) throw new Error(result.error);

  await diagnosisRepo.upsertDiagnosis({
    tenant_id: tenantId,
    student_id: studentId,
    school_year: currentSchoolYear,
    overall_grade: result.data.overallGrade,
    record_direction: result.data.recordDirection,
    direction_strength: result.data.directionStrength as "strong" | "moderate" | "weak",
    direction_reasoning: result.data.directionReasoning || null,
    strengths: result.data.strengths,
    weaknesses: result.data.weaknesses,
    improvements: (await import("@/lib/domains/student-record/types")).toDbJson(result.data.improvements),
    recommended_majors: result.data.recommendedMajors,
    strategy_notes: result.data.strategyNotes,
    source: "ai",
    status: "draft",
  } as DiagnosisInsert);

  // L3-C: 진단이 추론한 inferredEdges → synthesis_inferred로 저장 (non-fatal)
  let inferredEdgesInserted = 0;
  if (result.data.inferredEdges && result.data.inferredEdges.length > 0) {
    try {
      const edgeRepo = await import("@/lib/domains/student-record/repository/edge-repository");
      const resolved = resolveInferredEdges(
        result.data.inferredEdges,
        computedEdges,
      );
      if (resolved.length > 0) {
        inferredEdgesInserted = await edgeRepo.insertEdges(
          studentId,
          tenantId,
          pipelineId,
          resolved,
          "synthesis_inferred",
        );
        logActionDebug(LOG_CTX, "synthesis_inferred edges 저장", {
          pipelineId,
          llmProposed: result.data.inferredEdges.length,
          resolved: resolved.length,
          inserted: inferredEdgesInserted,
        });
      }
    } catch (infErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.insertInferredEdges" }, infErr, { pipelineId });
    }
  }

  const warnSuffix = result.data.warnings?.length ? ` ⚠️ ${result.data.warnings.join(", ")}` : "";
  const diagLabel = !hasNeisData
    ? "예비진단(수강계획 기반)"
    : hasConsultingGrades
      ? "종합진단(NEIS+수강계획)"
      : "종합진단";
  // 커버리지 경고
  let coverageWarnings: import("../pipeline-types").DataCoverageWarning[] | undefined;
  if (ctx.unifiedInput) {
    const { checkCoverageForTask } = await import("../pipeline-unified-input");
    const warnings = checkCoverageForTask(ctx.unifiedInput, "ai_diagnosis");
    if (warnings.length > 0) coverageWarnings = warnings;
  }

  const inferredSuffix = inferredEdgesInserted > 0 ? ` + 추론연결 ${inferredEdgesInserted}건` : "";

  return {
    preview: `${diagLabel} 생성 (등급: ${result.data.overallGrade}, 방향: ${result.data.directionStrength})${inferredSuffix}${warnSuffix}`,
    // 진단 상세(weaknesses/improvements)는 DB(student_record_diagnosis)에 저장됨 → ctx에는 카운트만 유지
    result: {
      overallGrade: result.data.overallGrade,
      weaknessCount: Array.isArray(result.data.weaknesses) ? result.data.weaknesses.length : 0,
      improvementCount: Array.isArray(result.data.improvements) ? (result.data.improvements as unknown[]).length : 0,
      inferredEdgesInserted,
      coverageWarnings,
      // Cross-run 소비 자기보고 (cross-run-consumer-diff [H] 측정용)
      priorCourseRecCount,
      priorCourseSectionChars,
      // executive summary 생성을 위해 캐시 (Phase 6 완료 후 참조)
      ...(savedTsAnalysis ? { _timeSeriesAnalysis: savedTsAnalysis } : {}),
      // S6: qualityPatterns를 DB에 영속화하여 Phase 재시작 시 S5에서 복원 가능
      ...(ctx.belief.qualityPatterns && ctx.belief.qualityPatterns.length > 0 ? { qualityPatterns: ctx.belief.qualityPatterns } : {}),
    },
  };
}

// ============================================
// L3-C: LLM inferredEdges(라벨 기반) → InferredEdgeInput(ID 기반) 해소
// ============================================

/**
 * LLM이 출력한 라벨 쌍을 기존 computedEdges의 source_label/target_label과 매칭하여
 * 레코드 ID를 복원. 라벨 일치 없는 엣지는 폐기. 기존 엣지와 중복이면 제외 (DB 레벨에서도 UNIQUE).
 * 테스트 노출을 위해 export.
 */
export function resolveInferredEdges(
  inferred: import("../../llm/actions/generateDiagnosis").DiagnosisInferredEdge[],
  computedEdges: PersistedEdge[] | CrossRefEdge[],
): import("@/lib/domains/student-record/repository/edge-repository").InferredEdgeInput[] {
  // 라벨 → {recordType, recordId, grade} 맵 빌드
  // PersistedEdge만 라벨 + ID를 둘 다 가지므로, CrossRefEdge는 source 쪽만 라벨 매칭 가능
  type LabelEntry = { recordType: string; recordId: string; grade: number | null };
  const labelMap = new Map<string, LabelEntry>();
  // 기존 엣지 중복 검출용 키: "sourceId|targetId|edgeType"
  const existingKeys = new Set<string>();

  for (const e of computedEdges) {
    if ("source_label" in e) {
      // PersistedEdge
      if (e.source_label) {
        labelMap.set(e.source_label, {
          recordType: e.source_record_type,
          recordId: e.source_record_id,
          grade: e.source_grade,
        });
      }
      if (e.target_label && e.target_record_id) {
        labelMap.set(e.target_label, {
          recordType: e.target_record_type,
          recordId: e.target_record_id,
          grade: e.target_grade,
        });
        existingKeys.add(`${e.source_record_id}|${e.target_record_id}|${e.edge_type}`);
      }
    }
  }

  const resolved: import("@/lib/domains/student-record/repository/edge-repository").InferredEdgeInput[] = [];
  const seenInBatch = new Set<string>();

  for (const inf of inferred) {
    const src = labelMap.get(inf.sourceLabel);
    const tgt = labelMap.get(inf.targetLabel);
    if (!src || !tgt) continue;
    if (src.recordId === tgt.recordId) continue;

    const dedupKey = `${src.recordId}|${tgt.recordId}|${inf.edgeType}`;
    if (existingKeys.has(dedupKey) || seenInBatch.has(dedupKey)) continue;
    seenInBatch.add(dedupKey);

    resolved.push({
      sourceRecordType: src.recordType,
      sourceRecordId: src.recordId,
      sourceLabel: inf.sourceLabel,
      sourceGrade: src.grade,
      targetRecordType: tgt.recordType,
      targetRecordId: tgt.recordId,
      targetLabel: inf.targetLabel,
      targetGrade: tgt.grade,
      edgeType: inf.edgeType as import("@/lib/domains/student-record/cross-reference").CrossRefEdgeType,
      reason: inf.reason,
      sharedCompetencies: inf.sharedCompetencies ?? null,
      confidence: 0.55, // THEME_CONVERGENCE 기본값보다 약간 낮음 — LLM 추론이므로 보수적
    });
  }

  return resolved;
}

// ============================================
// 5. 수강 추천
// ============================================

export async function runCourseRecommendation(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId } = ctx;

  const { generateRecommendationsAction } = await import("@/lib/domains/student-record/actions/coursePlan");
  const result = await generateRecommendationsAction(studentId, tenantId);
  if (!result.success) throw new Error(result.error);
  const plans = Array.isArray(result.data) ? result.data : [];
  // Cross-run 소비자(ai_diagnosis)가 "수강 궤적" 섹션에 바로 주입할 수 있도록
  // 학년/학기 오름차순 정렬 후 최대 30건 유지.
  const sorted = [...plans].sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return (a.semester ?? 0) - (b.semester ?? 0);
  });
  const recommendations = sorted.slice(0, 30).map((p) => ({
    grade: p.grade,
    semester: p.semester ?? null,
    subjectName: p.subject?.name ?? "과목 미정",
    priority: p.plan_status ?? null,
  }));
  return {
    preview: `${plans.length}개 과목 추천됨`,
    result: {
      totalCount: plans.length,
      recommendations,
    },
  };
}
