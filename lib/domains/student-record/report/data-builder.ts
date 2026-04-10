// ============================================
// Report 데이터 빌더 (fetchReportData 내부 헬퍼)
// report.ts에서 추출한 Group A/B/C/D 데이터 수집 함수들
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";
import type { InternalAnalysis } from "@/lib/scores/internalAnalysis";
import { getMockAnalysis } from "@/lib/scores/mockAnalysis";
import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import { getInternalScoresByTerm } from "@/lib/data/scoreDetails";
import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import * as service from "../service";
import { fetchDiagnosisTabData } from "../actions/diagnosis";
import { fetchActivitySummaries, fetchSetekGuides, fetchChangcheGuides, fetchHaengteukGuide } from "../actions/activitySummary";
import { fetchCoursePlanTabData } from "../actions/coursePlan";
import * as edgeRepo from "../repository/edge-repository";
import type { PersistedEdge } from "../repository/edge-repository";
import { computeStudentPercentile } from "../cohort/percentile";
import { fetchLatestCohortBenchmark } from "../cohort/benchmark";
import type { StudentPercentile } from "../cohort/percentile";
import type { CohortBenchmark } from "../cohort/benchmark";
import type {
  RecordTabData,
} from "../types";
import type { CoursePlanWithSubject } from "../course-plan/types";
import type { ContentQualityRow } from "../warnings/engine";
import type { CompetencyAnalysisContext } from "@/lib/domains/record-analysis/pipeline";

const LOG_CTX = { domain: "student-record", action: "report" };

// ============================================
// 내부 쿼리 결과 타입 (nested join용)
// ============================================

interface StudentWithProfile {
  id: string;
  grade: number | null;
  class: string | null;
  school_name: string | null;
  target_major: string | null;
  user_profiles: { name: string } | null;
}

// ============================================
// Group A: 학생 기본 정보 + 성적
// ============================================

const EMPTY_INTERNAL: InternalAnalysis = { totalGpa: null, adjustedGpa: null, zIndex: null, subjectStrength: {} };
const EMPTY_MOCK: MockAnalysis = { recentExam: null, avgPercentile: null, totalStdScore: null, best3GradeSum: null, trend: [] };

export async function fetchStudentInfoAndScores(
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
    .returns<StudentWithProfile>()
    .maybeSingle();

  if (studentError || !student) {
    throw new Error("학생 정보를 찾을 수 없습니다.");
  }

  const studentGrade = student.grade ?? 3;
  const studentName = student.user_profiles?.name ?? null;

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

  // 세특/개인세특 records의 subject_id(UUID) → 과목명 매핑
  // (ProgressStatusSection 등에서 슬롯 라벨이 UUID로 노출되는 것을 방지)
  const recordSubjectIds = new Set<string>();
  for (const tab of Object.values(recordDataByGrade)) {
    for (const s of tab?.seteks ?? []) {
      if (s.subject_id) recordSubjectIds.add(s.subject_id as string);
    }
    for (const s of tab?.personalSeteks ?? []) {
      if (s.subject_id) recordSubjectIds.add(s.subject_id as string);
    }
  }
  const subjectNamesById: Record<string, string> = {};
  if (recordSubjectIds.size > 0) {
    const { data: subjectsForRecords } = await supabase
      .from("subjects")
      .select("id, name")
      .in("id", [...recordSubjectIds]);
    for (const s of subjectsForRecords ?? []) {
      subjectNamesById[s.id as string] = s.name as string;
    }
  }

  return {
    student, studentName, studentGrade, consultantName: consultant?.name ?? null,
    yearGradePairs, initialSchoolYear,
    internalAnalysis, internalScores, mockAnalysis, recordDataByGrade,
    subjectNamesById,
  };
}

// ============================================
// Group B: AI 분석 데이터
// ============================================

// 약한 등급 기준 (B- 이하를 약점으로 판단)
const WEAK_GRADE_THRESHOLD = new Set(["B-", "C+", "C", "C-", "D+", "D", "D-"]);

export async function fetchAnalysisData(
  studentId: string,
  tenantId: string,
  initialSchoolYear: number,
  supabase: SupabaseServerClient,
  diagnosisTargetSubClassificationId?: number | null,
) {
  // Tier 1: 필수 — 실패 시 전체 에러 (이것 없으면 리포트 렌더링 불가)
  const [diagnosisData, strategyData, edges] = await Promise.all([
    fetchDiagnosisTabData(studentId, initialSchoolYear, tenantId),
    service.getStrategyTabData(studentId, initialSchoolYear, tenantId),
    edgeRepo.findEdges(studentId, tenantId),
  ]);

  // Tier 2: 부가 — 실패 시 빈 값 fallback (있으면 풍부해지지만 없어도 렌더 가능)
  const [
    storylineResult,
    setekGuidesResult,
    changcheGuidesResult,
    haengteukGuidesResult,
    coursePlanResult,
    actSummariesResult,
  ] = await Promise.allSettled([
    service.getStorylineTabData(studentId, initialSchoolYear, tenantId),
    fetchSetekGuides(studentId),
    fetchChangcheGuides(studentId),
    fetchHaengteukGuide(studentId),
    fetchCoursePlanTabData(studentId),
    fetchActivitySummaries(studentId),
  ]);

  const storylineData = storylineResult.status === "fulfilled"
    ? storylineResult.value
    : ({ storylines: [], roadmapItems: [] } as Awaited<ReturnType<typeof service.getStorylineTabData>>);

  const setekGuidesRes = setekGuidesResult.status === "fulfilled"
    ? setekGuidesResult.value
    : ({ success: false as const, error: "" });

  const changcheGuidesRes = changcheGuidesResult.status === "fulfilled"
    ? changcheGuidesResult.value
    : ({ success: false as const, data: [] as Awaited<ReturnType<typeof fetchChangcheGuides>>["data"] });

  const haengteukGuidesRes = haengteukGuidesResult.status === "fulfilled"
    ? haengteukGuidesResult.value
    : ({ success: false as const, data: [] as Awaited<ReturnType<typeof fetchHaengteukGuide>>["data"] });

  const coursePlanRes = coursePlanResult.status === "fulfilled"
    ? coursePlanResult.value
    : ({ success: false as const, error: "" });

  const actSummariesRes = actSummariesResult.status === "fulfilled"
    ? actSummariesResult.value
    : ({ success: false as const, error: "" });

  for (const [i, r] of [storylineResult, setekGuidesResult, changcheGuidesResult, haengteukGuidesResult, coursePlanResult, actSummariesResult].entries()) {
    if (r.status === "rejected") {
      logActionError({ ...LOG_CTX, action: `report.tier2[${i}]` }, r.reason, { studentId });
    }
  }

  // Tier 3: 선택 — 실패 시 null (없어도 리포트 기본 구조에 영향 없음)
  const [contentQualityResult, competencyScoresResult] = await Promise.allSettled([
    // D단계: 콘텐츠 품질 점수 (issues/feedback 포함)
    supabase
      .from("student_record_content_quality")
      .select("record_type, record_id, overall_score, issues, feedback, specificity, coherence, depth, grammar, scientific_validity, source")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .in("source", ["ai", "ai_projected"])
      .order("overall_score", { ascending: true }),
    // D단계: 역량 등급 (rubric_scores 포함 — B- 이하 항목만 가이드 프롬프트에 주입)
    supabase
      .from("student_record_competency_scores")
      .select("competency_item, grade_value, narrative, rubric_scores")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", initialSchoolYear)
      .eq("source", "ai"),
  ]);

  const contentQualityRes = contentQualityResult.status === "fulfilled"
    ? contentQualityResult.value
    : { data: null, error: null };

  const competencyScoresRes = competencyScoresResult.status === "fulfilled"
    ? competencyScoresResult.value
    : { data: null, error: null };

  for (const [i, r] of [contentQualityResult, competencyScoresResult].entries()) {
    if (r.status === "rejected") {
      logActionError({ ...LOG_CTX, action: `report.tier3[${i}]` }, r.reason, { studentId });
    }
  }

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

  // 세특 가이드의 subject_id(UUID) → 과목명 매핑
  // (가이드 카드 타이틀이 UUID 그대로 노출되는 것을 방지)
  const setekGuidesRaw = setekGuidesRes.success && setekGuidesRes.data ? setekGuidesRes.data : [];
  const setekSubjectIds = [...new Set(setekGuidesRaw.map((g) => g.subject_id))];
  const setekSubjectNameMap = new Map<string, string>();
  if (setekSubjectIds.length > 0) {
    const { data: subjectsForGuides } = await supabase
      .from("subjects")
      .select("id, name")
      .in("id", setekSubjectIds);
    for (const s of subjectsForGuides ?? []) {
      setekSubjectNameMap.set(s.id as string, s.name as string);
    }
  }

  // D단계: 콘텐츠 품질 점수 정규화
  const contentQualityRaw = (contentQualityRes as { data: Array<Record<string, unknown>> | null }).data ?? [];
  // 경고 엔진용: source='ai'만 (설계 모드 ai_projected는 미확정이므로 경고 대상 아님)
  const contentQuality: ContentQualityRow[] = contentQualityRaw
    .filter((r) => r.source === "ai")
    .map((r) => ({
      record_type: r.record_type as ContentQualityRow["record_type"],
      record_id: r.record_id as string,
      overall_score: r.overall_score as number,
      issues: Array.isArray(r.issues) ? (r.issues as string[]) : [],
      feedback: typeof r.feedback === "string" ? r.feedback : null,
    }));

  // 차트용: ai + ai_projected 전체 (학기별 Box Plot에 설계 모드 포함)
  const contentQualityDetailed = contentQualityRaw.map((r) => ({
    record_id: r.record_id as string,
    record_type: r.record_type as string,
    overall_score: r.overall_score as number,
    specificity: (r.specificity as number) ?? 0,
    coherence: (r.coherence as number) ?? 0,
    depth: (r.depth as number) ?? 0,
    grammar: (r.grammar as number) ?? 0,
    scientific_validity: typeof r.scientific_validity === "number" ? r.scientific_validity : null,
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
    setekGuides: setekGuidesRaw
      .filter((g) => g.school_year >= initialSchoolYear && g.school_year < initialSchoolYear + 3)
      .map((g) => ({
        id: g.id, school_year: g.school_year, subject_id: g.subject_id,
        subject_name: setekSubjectNameMap.get(g.subject_id) ?? null,
        source: g.source,
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
    contentQualityDetailed,
    weakCompetencyContexts,
  };
}

// ============================================
// Group C: 보조 데이터 (면접/우회학과/파이프라인/가이드)
// ============================================

export async function fetchSupplementaryData(
  studentId: string,
  tenantId: string,
  supabase: SupabaseServerClient,
  edges: PersistedEdge[],
) {
  const [bypassRes, interviewRes, pipelineRes, guideCountRes, univStrategiesRes, placementRes, pipelineSnapshotsRes] = await Promise.allSettled([
    // 우회학과 상위 5개
    supabase
      .from("bypass_major_candidates")
      .select("composite_score, rationale, curriculum_similarity_score, competency_fit_score, competency_rationale, curriculum_rationale, placement_rationale, candidate_department:candidate_department_id(department_name, university_name)")
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
    // 파이프라인 메타 + eval 출력 (synthesis의 task_results에서 추출)
    supabase
      .from("student_record_analysis_pipelines")
      .select("started_at, status, mode, task_results")
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
    // Phase 1.1: 정시 배치 스냅샷 (auto-placement 또는 수동 분석 결과, 최신 1건)
    supabase
      .from("student_placement_snapshots")
      .select("exam_date, exam_type, result, summary")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Phase 1.3: 파이프라인 재실행 히스토리 스냅샷 (시점별 역량 비교용, 최대 10건)
    supabase
      .from("student_record_analysis_pipeline_snapshots")
      .select("id, pipeline_id, snapshot, created_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // 우회학과
  const bypassRaw = bypassRes.status === "fulfilled" ? bypassRes.value.data ?? [] : [];
  const bypassCandidates = bypassRaw.map((c: Record<string, unknown>) => {
    const dept = c.candidate_department as { department_name: string; university_name: string } | null;
    return {
      candidateDept: dept?.department_name ?? "",
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

  // 파이프라인 메타 + eval 출력 추출
  const pipelineRaw = pipelineRes.status === "fulfilled" ? pipelineRes.value.data : null;
  const pipelineMeta = pipelineRaw ? {
    startedAt: pipelineRaw.started_at as string | null,
    status: pipelineRaw.status as string | null,
    hasStaleEdges: edges.some((e) => e.is_stale),
    mode: (pipelineRaw.mode as "analysis" | "prospective" | null) ?? null,
  } : null;

  // M4~M6: synthesis task_results에서 eval 데이터 추출
  const taskResults = (pipelineRaw?.task_results ?? null) as Record<string, unknown> | null;
  const executiveSummary = (taskResults?.["_executiveSummary"] ?? null) as
    import("@/lib/domains/record-analysis/eval/executive-summary").ExecutiveSummary | null;
  const diagTaskResult = (taskResults?.["ai_diagnosis"] ?? null) as Record<string, unknown> | null;
  const timeSeriesAnalysis = (diagTaskResult?.["_timeSeriesAnalysis"] ?? null) as
    import("@/lib/domains/record-analysis/eval/timeseries-analyzer").TimeSeriesAnalysis | null;
  const stratTaskResult = (taskResults?.["ai_strategy"] ?? null) as Record<string, unknown> | null;
  const universityMatch = (stratTaskResult?.["_universityMatch"] ?? null) as
    import("@/lib/domains/record-analysis/eval/university-profile-matcher").UniversityMatchAnalysis | null;

  // Phase 1.1: 배치 스냅샷 추출 (정시 합격 예측)
  const placementRaw = placementRes.status === "fulfilled" ? placementRes.value.data : null;
  const placementSnapshot = placementRaw
    ? {
        examDate: (placementRaw.exam_date as string | null) ?? null,
        examType: (placementRaw.exam_type as string | null) ?? null,
        result: placementRaw.result as import("@/lib/domains/admission").PlacementAnalysisResult,
      }
    : null;

  // Phase 1.3: 파이프라인 재실행 히스토리 스냅샷 추출 (시점별 역량 비교용)
  // 각 스냅샷은 재실행 직전의 task_results 전체를 포함. _executiveSummary 존재 여부는
  // 스냅샷 작성 시점의 파이프라인 버전에 따라 다름 (F0-1 이전 실행은 미포함).
  const pipelineSnapshotsRaw = pipelineSnapshotsRes.status === "fulfilled"
    ? pipelineSnapshotsRes.value.data ?? []
    : [];
  const pipelineSnapshots = (pipelineSnapshotsRaw as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    pipelineId: row.pipeline_id as string,
    createdAt: row.created_at as string,
    executiveSummary: ((row.snapshot as Record<string, unknown> | null)?.["_executiveSummary"] ?? null) as
      import("@/lib/domains/record-analysis/eval/executive-summary").ExecutiveSummary | null,
  }));

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

  return { bypassCandidates, interviewQuestions, pipelineMeta, guideAssignmentCount, univStrategies, executiveSummary, timeSeriesAnalysis, universityMatch, placementSnapshot, pipelineSnapshots };
}

// ============================================
// Group D: 코호트 벤치마크
// ============================================

/**
 * Promise에 타임아웃을 걸어 ms 경과 시 null 반환.
 * 코호트 계산이 느릴 경우 Report 전체 렌더를 막지 않도록 보호.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function fetchCohortData(
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
