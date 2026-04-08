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
} from "./helpers";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

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

  const { generateAiDiagnosis } = await import("@/lib/domains/student-record/llm/actions/generateDiagnosis");
  // Phase E2: 엣지 데이터 → 진단 프롬프트에 투입
  let diagnosisEdgeSection: string | undefined;
  const edgeComputationFailed = tasks.edge_computation === "failed";
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("@/lib/domains/student-record/edge-summary");
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
      if (repeatingPatterns.length > 0) ctx.qualityPatterns = repeatingPatterns;
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
  }, edgeCompetencyFreq, coursePlanContext, diagQualityPatternSection);
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

  return {
    preview: `${diagLabel} 생성 (등급: ${result.data.overallGrade}, 방향: ${result.data.directionStrength})${warnSuffix}`,
    // 진단 상세(weaknesses/improvements)는 DB(student_record_diagnosis)에 저장됨 → ctx에는 카운트만 유지
    result: {
      overallGrade: result.data.overallGrade,
      weaknessCount: Array.isArray(result.data.weaknesses) ? result.data.weaknesses.length : 0,
      improvementCount: Array.isArray(result.data.improvements) ? (result.data.improvements as unknown[]).length : 0,
      coverageWarnings,
      // executive summary 생성을 위해 캐시 (Phase 6 완료 후 참조)
      ...(savedTsAnalysis ? { _timeSeriesAnalysis: savedTsAnalysis } : {}),
      // S6: qualityPatterns를 DB에 영속화하여 Phase 재시작 시 S5에서 복원 가능
      ...(ctx.qualityPatterns && ctx.qualityPatterns.length > 0 ? { qualityPatterns: ctx.qualityPatterns } : {}),
    },
  };
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
  const count = Array.isArray(result.data) ? result.data.length : 0;
  return `${count}개 과목 추천됨`;
}
