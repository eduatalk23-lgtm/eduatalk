"use server";

// ============================================
// Phase 9.1: 수시 Report 데이터 수집 Server Action
// E-2: 3개 하위 함수로 분리 (기본정보/AI분석/보조데이터)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";
import type { InternalAnalysis } from "@/lib/scores/internalAnalysis";
import { getMockAnalysis } from "@/lib/scores/mockAnalysis";
import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import { getInternalScoresByTerm } from "@/lib/data/scoreDetails";
import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import * as service from "../service";
import { fetchDiagnosisTabData } from "./diagnosis";
import { fetchActivitySummaries, fetchSetekGuides } from "./activitySummary";
import { fetchCoursePlanTabData } from "./coursePlan";
import * as edgeRepo from "../edge-repository";
import type { PersistedEdge } from "../edge-repository";
import type {
  RecordTabData,
  DiagnosisTabData,
  StorylineTabData,
  StrategyTabData,
} from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";

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
    summary_title: string;
    summary_sections: unknown;
    status: string;
    created_at: string;
  }>;
  plannedSubjects: string[];
  /** E-3: 가이드 배정 건수 */
  guideAssignmentCount: number;
  bypassCandidates: Array<{
    candidateDept: string;
    candidateUniv: string;
    compositeScore: number | null;
    rationale: string | null;
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
}

// ============================================
// Group A: 학생 기본 정보 + 성적
// ============================================

const EMPTY_INTERNAL: InternalAnalysis = { totalGpa: null, adjustedGpa: null, zIndex: null, subjectStrength: {} };
const EMPTY_MOCK: MockAnalysis = { recentExam: null, avgPercentile: null, totalStdScore: null, best3GradeSum: null };

async function fetchStudentInfoAndScores(
  studentId: string,
  tenantId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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

async function fetchAnalysisData(
  studentId: string,
  tenantId: string,
  initialSchoolYear: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  diagnosisTargetSubClassificationId?: number | null,
) {
  const [diagnosisData, storylineData, strategyData, edges, setekGuidesRes, actSummariesRes, coursePlanRes] = await Promise.all([
    fetchDiagnosisTabData(studentId, initialSchoolYear, tenantId),
    service.getStorylineTabData(studentId, initialSchoolYear, tenantId),
    service.getStrategyTabData(studentId, initialSchoolYear, tenantId),
    edgeRepo.findEdges(studentId, tenantId).catch(() => [] as PersistedEdge[]),
    fetchSetekGuides(studentId).catch(() => ({ success: false as const, error: "" })),
    fetchActivitySummaries(studentId).catch(() => ({ success: false as const, error: "" })),
    fetchCoursePlanTabData(studentId).catch(() => ({ success: false as const, error: "" })),
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

  return {
    diagnosisData, storylineData, strategyData, edges,
    targetSubClassificationName, targetMidName,
    setekGuides: (setekGuidesRes.success && setekGuidesRes.data ? setekGuidesRes.data : []).map((g) => ({
      id: g.id, summary_title: g.summary_title, summary_sections: g.summary_sections,
      status: g.status, created_at: g.created_at,
    })),
    plannedSubjects: (coursePlanRes.success && coursePlanRes.data
      ? coursePlanRes.data.plans.map((p) => p.subject.name) : []),
    activitySummaries: (actSummariesRes.success && actSummariesRes.data ? actSummariesRes.data : []).map((s) => ({
      id: s.id, summary_title: s.summary_title, summary_sections: s.summary_sections,
      summary_text: s.summary_text, status: s.status, target_grades: s.target_grades,
      edited_text: s.edited_text, created_at: s.created_at,
    })),
  };
}

// ============================================
// Group C: 보조 데이터 (면접/우회학과/파이프라인/가이드)
// ============================================

async function fetchSupplementaryData(
  studentId: string,
  tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  edges: PersistedEdge[],
) {
  const [bypassRes, interviewRes, pipelineRes, guideCountRes] = await Promise.allSettled([
    // 우회학과 상위 5개
    supabase
      .from("bypass_major_candidates")
      .select("composite_score, rationale, candidate_department:candidate_department_id(name, university_name)")
      .eq("student_id", studentId)
      .order("composite_score", { ascending: false })
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
      .select("started_at, status")
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
  } : null;

  // 가이드 배정 건수
  const guideAssignmentCount = guideCountRes.status === "fulfilled"
    ? (guideCountRes.value.count as number) ?? 0
    : 0;

  return { bypassCandidates, interviewQuestions, pipelineMeta, guideAssignmentCount };
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

    // E-6: 감사 로그 (fire-and-forget)
    void supabase.from("audit_logs").insert({
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
      plannedSubjects: analysis.plannedSubjects,
      activitySummaries: analysis.activitySummaries,
      guideAssignmentCount: supplementary.guideAssignmentCount,
      bypassCandidates: supplementary.bypassCandidates,
      interviewQuestions: supplementary.interviewQuestions,
      pipelineMeta: supplementary.pipelineMeta,
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
