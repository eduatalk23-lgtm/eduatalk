"use server";

// ============================================
// Phase 9.1: 수시 Report 데이터 수집 Server Action
// E-2: 데이터 빌더 → report-data-builder.ts 분리
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import * as service from "../service";
import { fetchDiagnosisTabData } from "./diagnosis";
import { computeWarnings } from "../warnings/engine";
import type { ContentQualityRow } from "../warnings/engine";
import type { RecordWarning } from "../warnings/types";
import type { RecordTabData } from "../types";
import type { InternalAnalysis } from "@/lib/scores/internalAnalysis";
import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";
import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import type { PersistedEdge } from "../repository/edge-repository";
import type { CoursePlanWithSubject } from "../course-plan/types";
import type { StudentPercentile } from "../cohort/percentile";
import type { CohortBenchmark } from "../cohort/benchmark";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type { CompetencyAnalysisContext } from "../pipeline";
import {
  fetchStudentInfoAndScores,
  fetchAnalysisData,
  fetchSupplementaryData,
  fetchCohortData,
} from "./report-data-builder";

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
  diagnosisData: import("../types").DiagnosisTabData;
  storylineData: import("../types").StorylineTabData;
  strategyData: import("../types").StrategyTabData;
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
  /** Synthesis pipeline eval 출력 (task_results에서 추출) */
  executiveSummary?: import("../eval/executive-summary").ExecutiveSummary | null;
  timeSeriesAnalysis?: import("../eval/timeseries-analyzer").TimeSeriesAnalysis | null;
  universityMatch?: import("../eval/university-profile-matcher").UniversityMatchAnalysis | null;
  /**
   * L6: 설계 모드 예상 데이터.
   * NEIS 없는 학년의 P8 분석 결과 (ai_projected scores + projected edges + leveling).
   */
  projectedData?: {
    competencyScores: import("../types").CompetencyScore[];
    edges: PersistedEdge[];
    leveling: import("../leveling/types").LevelingResult | null;
    /** 설계 모드 학년 번호 목록 */
    designGrades: number[];
    /** 가안 품질 점수 (ai_projected) */
    contentQuality: ContentQualityRow[];
  };
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
    const { error: auditErr } = await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      resource_type: "student_record_report",
      resource_id: studentId,
      action: "generate",
      metadata: { generatedAt: new Date().toISOString() },
    });
    if (auditErr) logActionWarn({ ...LOG_CTX, action: "report-audit-log" }, `감사 로그 저장 실패: ${auditErr.message}`, { studentId });

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
      executiveSummary: supplementary.executiveSummary,
      timeSeriesAnalysis: supplementary.timeSeriesAnalysis,
      universityMatch: supplementary.universityMatch,
    };

    // L6: projected 데이터 조회 (설계 모드 학년이 있을 때만)
    try {
      const consultingGrades = Object.entries(info.recordDataByGrade)
        .filter(([, rd]) => {
          const hasNeis = rd.seteks?.some((s) => s.imported_content?.trim()) ||
            rd.changche?.some((c) => c.imported_content?.trim());
          return !hasNeis;
        })
        .map(([g]) => Number(g));

      if (consultingGrades.length > 0) {
        const competencyRepo = await import("../repository/competency-repository");
        const edgeRepoMod = await import("../repository/edge-repository");
        const { computeLevelingForStudent } = await import("../leveling");
        const { calculateSchoolYear: calcYear } = await import("@/lib/utils/schoolYear");
        const currentSchoolYear = calcYear();

        const [projScores, projEdges, projContentQuality] = await Promise.all([
          competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai_projected"),
          edgeRepoMod.findEdges(studentId, tenantId, "projected"),
          competencyRepo.findContentQualityByStudent(studentId, tenantId, { source: "ai_projected", selectRecordId: false }),
        ]);

        let leveling = null;
        try {
          leveling = await computeLevelingForStudent({
            studentId,
            tenantId,
            grade: Math.max(...consultingGrades),
          });
        } catch { /* leveling 실패해도 계속 */ }

        if (projScores.length > 0 || projEdges.length > 0 || leveling) {
          reportData.projectedData = {
            competencyScores: projScores,
            edges: projEdges,
            leveling,
            designGrades: consultingGrades,
            contentQuality: projContentQuality,
          };
        }
      }
    } catch {
      // projected 데이터 실패해도 리포트 정상 반환
    }

    return { success: true, data: reportData };
  } catch (error) {
    logActionError(LOG_CTX, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Report 데이터 수집 실패",
    };
  }
}

// ============================================
// S6-4: 에이전트용 경량 경고 조회
// 전체 Report 조회 없이 핵심 데이터만으로 computeWarnings 실행
// ============================================

/**
 * 특정 학생의 활성 경고를 서버에서 계산하여 반환.
 * 에이전트 시스템 프롬프트 주입에 사용. 인증 포함.
 */
export async function fetchActiveWarnings(
  studentId: string,
): Promise<RecordWarning[]> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 학생 학년 조회
    const { data: student } = await supabase
      .from("students")
      .select("grade")
      .eq("id", studentId)
      .eq("tenant_id", tenantId!)
      .maybeSingle();
    if (!student) return [];

    const studentGrade = student.grade ?? 3;
    const currentSchoolYear = calculateSchoolYear();

    // 학년별 기록 데이터 (병렬 조회)
    const grades = [1, 2, 3].filter((g) => g <= studentGrade);
    const recordResults = await Promise.allSettled(
      grades.map((g) =>
        service.getRecordTabData(studentId, currentSchoolYear - (studentGrade - g), tenantId!),
      ),
    );

    const recordsByGrade = new Map<number, RecordTabData>();
    for (const [i, r] of recordResults.entries()) {
      if (r.status === "fulfilled") {
        recordsByGrade.set(grades[i], r.value as RecordTabData);
      }
    }

    // 진단/전략 데이터 (경고 계산에 필요한 핵심 데이터)
    const [diagnosisData, strategyData, storylineData, contentQualityRes] = await Promise.allSettled([
      fetchDiagnosisTabData(studentId, currentSchoolYear, tenantId!),
      service.getStrategyTabData(studentId, currentSchoolYear, tenantId!),
      service.getStorylineTabData(studentId, currentSchoolYear, tenantId!),
      supabase
        .from("student_record_content_quality")
        .select("record_type, record_id, overall_score, issues, feedback")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId!)
        .eq("source", "ai"),
    ]);

    const contentQuality =
      contentQualityRes.status === "fulfilled"
        ? (contentQualityRes.value.data ?? [])
        : [];

    return computeWarnings({
      recordsByGrade,
      storylineData: storylineData.status === "fulfilled" ? storylineData.value : null,
      diagnosisData: diagnosisData.status === "fulfilled" ? diagnosisData.value : null,
      strategyData: strategyData.status === "fulfilled" ? strategyData.value : null,
      currentGrade: studentGrade,
      qualityScores: contentQuality as ContentQualityRow[],
    });
  } catch {
    // graceful degradation — 경고 조회 실패 시 빈 배열 반환
    return [];
  }
}
