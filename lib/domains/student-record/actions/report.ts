"use server";

// ============================================
// Phase 9.1: 수시 Report 데이터 수집 Server Action
// E-2: 3개 하위 함수로 분리 (기본정보/AI분석/보조데이터)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";
import type { InternalAnalysis } from "@/lib/scores/internalAnalysis";
import { getMockAnalysis } from "@/lib/scores/mockAnalysis";
import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import { getInternalScoresByTerm } from "@/lib/data/scoreDetails";
import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import * as service from "../service";
import { fetchDiagnosisTabData } from "./diagnosis";
import { fetchActivitySummaries, fetchSetekGuides, fetchChangcheGuides, fetchHaengteukGuide } from "./activitySummary";
import { fetchCoursePlanTabData } from "./coursePlan";
import * as edgeRepo from "../edge-repository";
import type { PersistedEdge } from "../edge-repository";
import { computeStudentPercentile } from "../cohort/percentile";
import { fetchLatestCohortBenchmark } from "../cohort/benchmark";
import type { StudentPercentile } from "../cohort/percentile";
import type { CohortBenchmark } from "../cohort/benchmark";
import type {
  RecordTabData,
  DiagnosisTabData,
  StorylineTabData,
  StrategyTabData,
} from "../types";
import type { CoursePlanWithSubject } from "../course-plan/types";
import type { ContentQualityRow } from "../warnings/engine";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type { CompetencyAnalysisContext } from "../pipeline-types";

const LOG_CTX = { domain: "student-record", action: "report" };

// ============================================
// Report 통합 데이터 타입
// ============================================

export interface ReportData {
  student: {
    name: string | null;
    schoolName: string | null;
    grade: number;
    className: string | null;
    targetMajor: string | null;
    targetSubClassificationName: string | null;
    targetMidName: string | null;
  };
  consultantName: string | null;
  generatedAt: string;
  internalAnalysis: InternalAnalysis;
  internalScores: InternalScoreWithRelations[];
  mockAnalysis: MockAnalysis;
  recordDataByGrade: Record<number, RecordTabData>;
  diagnosisData: DiagnosisTabData;
  storylineData: StorylineTabData;
  strategyData: StrategyTabData;
  edges: PersistedEdge[];
  setekGuides: Array<{
    id: string;
    school_year: number;
    subject_id: string;
    source: string;
    status: string;
    direction: string;
    keywords: string[];
    overall_direction: string | null;
    created_at: string;
  }>;
  changcheGuides: Array<{
    id: string;
    school_year: number;
    activity_type: string;
    source: string;
    status: string;
    direction: string;
    keywords: string[];
    competency_focus: string[];
    cautions: string | null;
    teacher_points: string[];
    overall_direction: string | null;
    created_at: string;
  }>;
  haengteukGuides: Array<{
    id: string;
    school_year: number;
    source: string;
    status: string;
    direction: string;
    keywords: string[];
    competency_focus: string[];
    cautions: string | null;
    teacher_points: string[];
    evaluation_items: unknown;
    overall_direction: string | null;
    created_at: string;
  }>;
  coursePlans: CoursePlanWithSubject[];
  plannedSubjects: string[];
  univStrategies: Array<{
    university_name: string;
    admission_type: string;
    admission_name: string;
    ideal_student: string | null;
    evaluation_factors: Record<string, number> | null;
    interview_format: string | null;
    interview_details: string | null;
    min_score_criteria: string | null;
    key_tips: string[] | null;
  }>;
  /** E-3: 가이드 배정 건수 */
  guideAssignmentCount: number;
  bypassCandidates: Array<{
    candidateDept: string;
    candidateUniv: string;
    compositeScore: number | null;
    rationale: string | null;
    curriculumSimilarity: number | null;
    competencyFit: number | null;
    competencyRationale: string | null;
    curriculumRationale: string | null;
    placementRationale: string | null;
  }>;
  interviewQuestions: Array<{
    question: string;
    question_type: string;
    difficulty: string;
    suggested_answer: string | null;
  }>;
  pipelineMeta: {
    startedAt: string | null;
    status: string | null;
    hasStaleEdges: boolean;
    mode: "analysis" | "prospective" | null;
  } | null;
  cohortBenchmark: {
    percentile: StudentPercentile | null;
    cohortStats: CohortBenchmark | null;
  } | null;
  activitySummaries: Array<{
    id: string;
    summary_title: string;
    summary_sections: unknown;
    summary_text: string;
    status: string;
    target_grades: number[];
    edited_text: string | null;
    created_at: string;
  }>;
  /**
   * D단계: 콘텐츠 품질 점수 (student_record_content_quality).
   * issues/feedback 포함. 가이드 프롬프트에 약점 맥락 주입에 활용.
   */
  contentQuality: ContentQualityRow[];
  /**
   * D단계: B- 이하 역량 항목의 rubric_scores 포함 맥락.
   * 가이드 프롬프트에서 약점 역량 reasoning 주입에 활용.
   */
  weakCompetencyContexts: CompetencyAnalysisContext[];
}

// ============================================
// Group A: 학생 기본 정보 + 성적
// ============================================

const EMPTY_INTERNAL: InternalAnalysis = { totalGpa: null, adjustedGpa: null, zIndex: null, subjectStrength: {} };
const EMPTY_MOCK: MockAnalysis = { recentExam: null, avgPercentile: null, totalStdScore: null, best3GradeSum: null, trend: [] };

async function fetchStudentInfoAndScores(
  studentId: string,
  tenantId: string,
  userId: string,
  supabase: SupabaseServerClient,
) {
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, grade, class, school_name, target_major, user_profiles(name)")
    .eq("id", studentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (studentError || !student) {
    throw new Error("학생 정보를 찾을 수 없습니다.");
  }

  const studentGrade = student.grade ?? 3;
  const studentName = (student.user_profiles as unknown as { name: string } | null)?.name ?? null;

  const { data: consultant } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();

  const currentSchoolYear = calculateSchoolYear();
  const yearGradePairs: { grade: number; schoolYear: number }[] = [];
  for (let g = 1; g <= studentGrade; g++) {
    yearGradePairs.push({ grade: g, schoolYear: currentSchoolYear - (studentGrade - g) });
  }
  const initialSchoolYear = yearGradePairs[yearGradePairs.length - 1]?.schoolYear ?? currentSchoolYear;

  const settled = await Promise.allSettled([
    getInternalAnalysis(tenantId, studentId),
    getInternalScoresByTerm(studentId, tenantId),
    getMockAnalysis(tenantId, studentId),
    ...yearGradePairs.map((p) => service.getRecordTabData(studentId, p.schoolYear, tenantId)),
  ]);

  const internalAnalysis = settled[0].status === "fulfilled" ? settled[0].value : EMPTY_INTERNAL;
  const internalScores = settled[1].status === "fulfilled" ? settled[1].value : ([] as InternalScoreWithRelations[]);
  const mockAnalysis = settled[2].status === "fulfilled" ? settled[2].value : EMPTY_MOCK;
  const recordResults = settled.slice(3).map((r) =>
    r.status === "fulfilled" ? r.value : { seteks: [], personalSeteks: [], changche: [], haengteuk: null, readings: [], schoolAttendance: null },
  );

  for (const [i, s] of settled.entries()) {
    if (s.status === "rejected") {
      logActionError({ ...LOG_CTX, action: `report.scores[${i}]` }, s.reason, { studentId });
    }
  }

  const recordDataByGrade: Record<number, RecordTabData> = {};
  yearGradePairs.forEach((p, i) => {
    recordDataByGrade[p.grade] = recordResults[i] as RecordTabData;
  });

  return {
    student, studentName, studentGrade, consultantName: consultant?.name ?? null,
    yearGradePairs, initialSchoolYear,
    internalAnalysis, internalScores, mockAnalysis, recordDataByGrade,
  };
}

// ============================================
// Group B: AI 분석 데이터
// ============================================

// 약한 등급 기준 (B- 이하를 약점으로 판단)
const WEAK_GRADE_THRESHOLD = new Set(["B-", "C+", "C", "C-", "D+", "D", "D-"]);

async function fetchAnalysisData(
  studentId: string,
  tenantId: string,
  initialSchoolYear: number,
  supabase: SupabaseServerClient,
  diagnosisTargetSubClassificationId?: number | null,
) {
  const [diagnosisData, storylineData, strategyData, edges, setekGuidesRes, actSummariesRes, coursePlanRes, changcheGuidesRes, haengteukGuidesRes, contentQualityRes, competencyScoresRes] = await Promise.all([
    fetchDiagnosisTabData(studentId, initialSchoolYear, tenantId),
    service.getStorylineTabData(studentId, initialSchoolYear, tenantId),
    service.getStrategyTabData(studentId, initialSchoolYear, tenantId),
    edgeRepo.findEdges(studentId, tenantId).catch(() => [] as PersistedEdge[]),
    fetchSetekGuides(studentId).catch(() => ({ success: false as const, error: "" })),
    fetchActivitySummaries(studentId).catch(() => ({ success: false as const, error: "" })),
    fetchCoursePlanTabData(studentId).catch(() => ({ success: false as const, error: "" })),
    fetchChangcheGuides(studentId).catch(() => ({ success: false as const, data: [] as Awaited<ReturnType<typeof fetchChangcheGuides>>["data"] })),
    fetchHaengteukGuide(studentId).catch(() => ({ success: false as const, data: [] as Awaited<ReturnType<typeof fetchHaengteukGuide>>["data"] })),
    // D단계: 콘텐츠 품질 점수 (issues/feedback 포함)
    supabase
      .from("student_record_content_quality")
      .select("record_type, record_id, overall_score, issues, feedback")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("source", "ai")
      .order("overall_score", { ascending: true })
      .catch(() => ({ data: null, error: null })),
    // D단계: 역량 등급 (rubric_scores 포함 — B- 이하 항목만 가이드 프롬프트에 주입)
    supabase
      .from("student_record_competency_scores")
      .select("competency_item, grade_value, narrative, rubric_scores")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", initialSchoolYear)
      .eq("source", "ai")
      .catch(() => ({ data: null, error: null })),
  ]);

  // 소분류/중분류 이름 조회
  const targetSubClassificationName = diagnosisData.targetSubClassificationName ?? null;
  let targetMidName: string | null = null;
  if (diagnosisData.targetSubClassificationId) {
    const { data: dc } = await supabase
      .from("department_classification")
      .select("mid_name")
      .eq("id", diagnosisData.targetSubClassificationId)
      .single();
    targetMidName = dc?.mid_name ?? null;
  }

  const coursePlansRaw = coursePlanRes.success && coursePlanRes.data ? coursePlanRes.data.plans : [];

  // D단계: 콘텐츠 품질 점수 정규화
  const contentQualityRaw = (contentQualityRes as { data: Array<Record<string, unknown>> | null }).data ?? [];
  const contentQuality: ContentQualityRow[] = contentQualityRaw.map((r) => ({
    record_type: r.record_type as ContentQualityRow["record_type"],
    record_id: r.record_id as string,
    overall_score: r.overall_score as number,
    issues: Array.isArray(r.issues) ? (r.issues as string[]) : [],
    feedback: typeof r.feedback === "string" ? r.feedback : null,
  }));

  // D단계: B- 이하 역량 항목만 추출 (rubric_scores 포함)
  const competencyScoresRaw = (competencyScoresRes as { data: Array<Record<string, unknown>> | null }).data ?? [];
  const weakCompetencyContexts: CompetencyAnalysisContext[] = competencyScoresRaw
    .filter((s) => WEAK_GRADE_THRESHOLD.has(s.grade_value as string))
    .map((s) => {
      const rubricScoresRaw = s.rubric_scores as Array<{ questionIndex: number; grade: string; reasoning: string }> | null;
      return {
        item: s.competency_item as string,
        grade: s.grade_value as string,
        reasoning: typeof s.narrative === "string" ? s.narrative : null,
        rubricScores: Array.isArray(rubricScoresRaw)
          ? rubricScoresRaw.filter((rs) => WEAK_GRADE_THRESHOLD.has(rs.grade))
          : undefined,
      };
    });

  return {
    diagnosisData, storylineData, strategyData, edges,
    targetSubClassificationName, targetMidName,
    setekGuides: (setekGuidesRes.success && setekGuidesRes.data ? setekGuidesRes.data : [])
      .filter((g) => g.school_year >= initialSchoolYear && g.school_year < initialSchoolYear + 3)
      .map((g) => ({
        id: g.id, school_year: g.school_year, subject_id: g.subject_id, source: g.source,
        status: g.status, direction: g.direction, keywords: g.keywords,
        overall_direction: g.overall_direction, created_at: g.created_at,
      })),
    changcheGuides: (changcheGuidesRes.success && changcheGuidesRes.data ? changcheGuidesRes.data : []).map((g) => ({
      id: g.id, school_year: g.school_year, activity_type: g.activity_type,
      source: g.source, status: g.status, direction: g.direction,
      keywords: g.keywords, competency_focus: g.competency_focus,
      cautions: g.cautions, teacher_points: g.teacher_points,
      overall_direction: g.overall_direction, created_at: g.created_at,
    })),
    haengteukGuides: (haengteukGuidesRes.success && haengteukGuidesRes.data ? haengteukGuidesRes.data : []).map((g) => ({
      id: g.id, school_year: g.school_year, source: g.source,
      status: g.status, direction: g.direction, keywords: g.keywords,
      competency_focus: g.competency_focus, cautions: g.cautions,
      teacher_points: g.teacher_points, evaluation_items: g.evaluation_items,
      overall_direction: g.overall_direction, created_at: g.created_at,
    })),
    coursePlans: coursePlansRaw,
    plannedSubjects: coursePlansRaw.map((p) => p.subject.name),
    activitySummaries: (actSummariesRes.success && actSummariesRes.data ? actSummariesRes.data : []).map((s) => ({
      id: s.id, summary_title: s.summary_title, summary_sections: s.summary_sections,
      summary_text: s.summary_text, status: s.status, target_grades: s.target_grades,
      edited_text: s.edited_text, created_at: s.created_at,
    })),
    contentQuality,
    weakCompetencyContexts,
  };
}

// ============================================
// Group C: 보조 데이터 (면접/우회학과/파이프라인/가이드)
// ============================================

async function fetchSupplementaryData(
  studentId: string,
  tenantId: string,
  supabase: SupabaseServerClient,
  edges: PersistedEdge[],
) {
  const [bypassRes, interviewRes, pipelineRes, guideCountRes, univStrategiesRes] = await Promise.allSettled([
    // 우회학과 상위 5개
    supabase
      .from("bypass_major_candidates")
      .select("composite_score, rationale, curriculum_similarity_score, competency_fit_score, competency_rationale, curriculum_rationale, placement_rationale, candidate_department:candidate_department_id(name, university_name)")
      .eq("student_id", studentId)
      .order("composite_score", { ascending: false, nullsFirst: false })
      .limit(5),
    // 면접 예상 질문
    supabase
      .from("student_record_interview_questions")
      .select("question, question_type, difficulty, suggested_answer")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("question_type")
      .order("difficulty")
      .limit(15),
    // 파이프라인 메타
    supabase
      .from("student_record_analysis_pipelines")
      .select("started_at, status, mode")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // E-3: 가이드 배정 건수
    supabase
      .from("exploration_guide_assignments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
    // 대학별 지원 전략 (university_eval_criteria — 전역 참조 테이블, tenant 무관)
    // limit: 대학 수 증가 대비 성능 보호 (상위 300개 충분)
    supabase
      .from("university_eval_criteria")
      .select("university_name, admission_type, admission_name, ideal_student, evaluation_factors, interview_format, interview_details, min_score_criteria, key_tips")
      .order("university_name")
      .limit(300),
  ]);

  // 우회학과
  const bypassRaw = bypassRes.status === "fulfilled" ? bypassRes.value.data ?? [] : [];
  const bypassCandidates = bypassRaw.map((c: Record<string, unknown>) => {
    const dept = c.candidate_department as { name: string; university_name: string } | null;
    return {
      candidateDept: dept?.name ?? "",
      candidateUniv: dept?.university_name ?? "",
      compositeScore: c.composite_score as number | null,
      rationale: c.rationale as string | null,
      curriculumSimilarity: c.curriculum_similarity_score as number | null,
      competencyFit: c.competency_fit_score as number | null,
      competencyRationale: c.competency_rationale as string | null,
      curriculumRationale: c.curriculum_rationale as string | null,
      placementRationale: c.placement_rationale as string | null,
    };
  });

  // 면접 질문
  const interviewRaw = interviewRes.status === "fulfilled" ? interviewRes.value.data ?? [] : [];
  const interviewQuestions = interviewRaw.map((q: Record<string, unknown>) => ({
    question: q.question as string,
    question_type: q.question_type as string,
    difficulty: q.difficulty as string,
    suggested_answer: q.suggested_answer as string | null,
  }));

  // 파이프라인 메타
  const pipelineRaw = pipelineRes.status === "fulfilled" ? pipelineRes.value.data : null;
  const pipelineMeta = pipelineRaw ? {
    startedAt: pipelineRaw.started_at as string | null,
    status: pipelineRaw.status as string | null,
    hasStaleEdges: edges.some((e) => e.is_stale),
    mode: (pipelineRaw.mode as "analysis" | "prospective" | null) ?? null,
  } : null;

  // 가이드 배정 건수
  const guideAssignmentCount = guideCountRes.status === "fulfilled"
    ? (guideCountRes.value.count as number) ?? 0
    : 0;

  // 대학별 지원 전략
  const univStrategiesRaw = univStrategiesRes.status === "fulfilled" ? univStrategiesRes.value.data ?? [] : [];
  const univStrategies = (univStrategiesRaw as Array<Record<string, unknown>>).map((u) => ({
    university_name: u.university_name as string,
    admission_type: u.admission_type as string,
    admission_name: u.admission_name as string,
    ideal_student: u.ideal_student as string | null,
    evaluation_factors: u.evaluation_factors as Record<string, number> | null,
    interview_format: u.interview_format as string | null,
    interview_details: u.interview_details as string | null,
    min_score_criteria: u.min_score_criteria as string | null,
    key_tips: u.key_tips as string[] | null,
  }));

  return { bypassCandidates, interviewQuestions, pipelineMeta, guideAssignmentCount, univStrategies };
}

// ============================================
// Group D: 코호트 벤치마크
// ============================================

/**
 * Promise에 타임아웃을 걸어 ms 경과 시 null 반환.
 * 코호트 계산이 느릴 경우 Report 전체 렌더를 막지 않도록 보호.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function fetchCohortData(
  studentId: string,
  tenantId: string,
  targetMajor: string | null,
  schoolYear: number,
): Promise<{ percentile: StudentPercentile | null; cohortStats: CohortBenchmark | null }> {
  if (!targetMajor) {
    return { percentile: null, cohortStats: null };
  }

  const [percentile, cohortStats] = await Promise.all([
    withTimeout(computeStudentPercentile(studentId, tenantId), 5000).catch(() => null),
    withTimeout(fetchLatestCohortBenchmark(tenantId, targetMajor, schoolYear), 5000).catch(() => null),
  ]);

  return { percentile, cohortStats };
}

// ============================================
// 메인: Report 데이터 수집
// ============================================

export async function fetchReportData(
  studentId: string,
): Promise<ActionResponse<ReportData>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // Group A: 기본 정보 + 성적
    const info = await fetchStudentInfoAndScores(studentId, tenantId, userId, supabase);

    // Group B: AI 분석
    const analysis = await fetchAnalysisData(
      studentId, tenantId, info.initialSchoolYear, supabase,
    );

    // Group C: 보조 데이터
    const supplementary = await fetchSupplementaryData(
      studentId, tenantId, supabase, analysis.edges,
    );

    // Group D: 코호트 벤치마크
    const cohortBenchmark = await fetchCohortData(
      studentId,
      tenantId,
      info.student.target_major ?? null,
      info.initialSchoolYear,
    ).catch(() => null);

    // E-6: 감사 로그
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      resource_type: "student_record_report",
      resource_id: studentId,
      action: "generate",
      metadata: { generatedAt: new Date().toISOString() },
    });

    const reportData: ReportData = {
      student: {
        name: info.studentName,
        schoolName: info.student.school_name ?? null,
        grade: info.studentGrade,
        className: info.student.class ?? null,
        targetMajor: info.student.target_major ?? null,
        targetSubClassificationName: analysis.targetSubClassificationName,
        targetMidName: analysis.targetMidName,
      },
      consultantName: info.consultantName,
      generatedAt: new Date().toISOString(),
      internalAnalysis: info.internalAnalysis,
      internalScores: info.internalScores,
      mockAnalysis: info.mockAnalysis,
      recordDataByGrade: info.recordDataByGrade,
      diagnosisData: analysis.diagnosisData,
      storylineData: analysis.storylineData,
      strategyData: analysis.strategyData,
      edges: analysis.edges,
      setekGuides: analysis.setekGuides,
      changcheGuides: analysis.changcheGuides,
      haengteukGuides: analysis.haengteukGuides,
      coursePlans: analysis.coursePlans,
      plannedSubjects: analysis.plannedSubjects,
      univStrategies: supplementary.univStrategies,
      activitySummaries: analysis.activitySummaries,
      guideAssignmentCount: supplementary.guideAssignmentCount,
      bypassCandidates: supplementary.bypassCandidates,
      interviewQuestions: supplementary.interviewQuestions,
      pipelineMeta: supplementary.pipelineMeta,
      cohortBenchmark: cohortBenchmark ?? null,
      contentQuality: analysis.contentQuality,
      weakCompetencyContexts: analysis.weakCompetencyContexts,
    };

    return { success: true, data: reportData };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Report 데이터 수집 실패",
    };
  }
}
