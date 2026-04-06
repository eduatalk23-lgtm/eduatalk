"use server";

// ============================================
// 진단 탭 Server Actions
// Phase 5 — 역량 평가 + 활동 태그 + 종합 진단 + 보완전략 + 이수적합도
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as competencyRepo from "../repository/competency-repository";
import * as diagnosisRepo from "../repository/diagnosis-repository";
import { calculateCourseAdequacy } from "../course-adequacy";
import type {
  CompetencyScoreInsert,
  CompetencyScoreUpdate,
  ActivityTagInsert,
  DiagnosisInsert,
  DiagnosisUpdate,
  StrategyInsert,
  StrategyUpdate,
  DiagnosisTabData,
  StudentRecordActionResult,
} from "../types";

const LOG_CTX = { domain: "student-record", action: "diagnosis" };

// ============================================
// 내부 헬퍼: 학교 컨텍스트 조회
// ============================================

/** 소분류 이름 + 학교 개설 과목 병렬 조회 */
async function fetchSchoolContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  targetSubClassificationId: string | null,
  schoolName: string | null,
): Promise<{ targetSubClassificationName: string | null; offeredSubjects: string[] | null }> {
  const [targetSubClassificationName, offeredSubjects] = await Promise.all([
    (async (): Promise<string | null> => {
      if (!targetSubClassificationId) return null;
      const { data: dc } = await supabase
        .from("department_classification")
        .select("sub_name")
        .eq("id", targetSubClassificationId)
        .single();
      return dc?.sub_name ?? null;
    })(),
    (async (): Promise<string[] | null> => {
      if (!schoolName) return null;
      const { data: profile } = await supabase
        .from("school_profiles")
        .select("id")
        .eq("school_name", schoolName)
        .maybeSingle();
      if (!profile) return null;
      const { data: offered } = await supabase
        .from("school_offered_subjects")
        .select("subject:subject_id(name)")
        .eq("school_profile_id", profile.id)
        .returns<Array<{ subject: { name: string } | null }>>();
      return (offered ?? [])
        .map((o) => o.subject?.name)
        .filter((n): n is string => !!n);
    })(),
  ]);
  return { targetSubClassificationName, offeredSubjects };
}

// ============================================
// 내부 헬퍼: Projected 데이터 조립
// ============================================

/** 설계 모드 projected 데이터(P8 가안 분석 결과) 조립 */
async function assembleProjectedData(
  studentId: string,
  schoolYear: number,
  tenantId: string,
  studentGrade: number,
): Promise<DiagnosisTabData["projectedData"]> {
  const projScores = await competencyRepo.findCompetencyScores(studentId, schoolYear, tenantId, "ai_projected");
  if (projScores.length === 0) return undefined;

  const edgeRepo = await import("../repository/edge-repository");
  const { computeLevelingForStudent } = await import("../leveling");

  const [projEdges, projContentQuality] = await Promise.all([
    edgeRepo.findEdges(studentId, tenantId, "projected"),
    competencyRepo.findContentQualityByStudent(studentId, tenantId, { source: "ai_projected", selectRecordId: false }),
  ]);

  const projSchoolYears = [...new Set(projScores.map((s) => s.school_year))];
  const designGrades = projSchoolYears
    .map((sy) => studentGrade - (schoolYear - sy))
    .filter((g) => g >= 1 && g <= 3)
    .sort();

  let leveling = null;
  try {
    leveling = await computeLevelingForStudent({
      studentId,
      tenantId,
      grade: designGrades.length > 0 ? Math.max(...designGrades) : studentGrade,
    });
  } catch { /* leveling 실패해도 계속 */ }

  return {
    competencyScores: projScores,
    edges: projEdges,
    leveling,
    designGrades,
    contentQuality: projContentQuality.map((cq) => ({
      record_type: cq.record_type as string,
      overall_score: (cq.overall_score as number) ?? 0,
      issues: ((cq.issues ?? []) as string[]),
      feedback: (cq.feedback as string) ?? null,
    })),
  };
}

// ============================================
// 진단 탭 데이터 조회
// ============================================

export async function fetchDiagnosisTabData(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<DiagnosisTabData> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 병렬 조회: 역량(AI+컨설턴트)/태그/진단(AI+컨설턴트)/전략 + 학생정보 + 이수과목 + 파이프라인
    const [aiScores, consultantScores, activityTags, diagnosisPair, strategies, studentResult, scoresResult, pipelineResult] =
      await Promise.all([
        competencyRepo.findCompetencyScores(studentId, schoolYear, tenantId, "ai"),
        competencyRepo.findCompetencyScores(studentId, schoolYear, tenantId, "manual"),
        competencyRepo.findActivityTags(studentId, tenantId),
        diagnosisRepo.findDiagnosisPair(studentId, schoolYear, tenantId),
        diagnosisRepo.findStrategies(studentId, schoolYear, tenantId),
        supabase.from("students").select("target_major, school_name, target_sub_classification_id, grade").eq("id", studentId).maybeSingle(),
        supabase.from("student_internal_scores")
          .select("subject:subject_id(name)")
          .eq("student_id", studentId)
          .returns<Array<{ subject: { name: string } | null }>>(),
        // 최신 completed synthesis 파이프라인 조회
        supabase
          .from("student_record_analysis_pipelines")
          .select("task_results")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .eq("pipeline_type", "synthesis")
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const fourAxisDiagnosis =
      (pipelineResult.data?.task_results as Record<string, unknown> | null)?._fourAxisDiagnosis ?? null;

    const targetMajor = studentResult.data?.target_major ?? null;
    const schoolName = studentResult.data?.school_name ?? null;
    const targetSubClassificationId = studentResult.data?.target_sub_classification_id ?? null;

    // 이수 과목명 추출 (중복 제거)
    const takenSubjects = [
      ...new Set(
        (scoresResult.data ?? [])
          .map((s) => s.subject?.name)
          .filter((n): n is string => !!n),
      ),
    ];

    // 소분류 이름 + 학교 개설 과목 병렬 조회
    const { targetSubClassificationName, offeredSubjects } = await fetchSchoolContext(
      supabase, targetSubClassificationId, schoolName,
    );

    // 교육과정 연도 판별
    const studentGrade = studentResult.data?.grade ?? 1;
    const enrollmentYear = schoolYear - studentGrade + 1;
    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const curriculumYear = getCurriculumYear(enrollmentYear);

    const courseAdequacy = targetMajor
      ? calculateCourseAdequacy(targetMajor, takenSubjects, offeredSubjects, curriculumYear)
      : null;

    // 콘텐츠 품질 점수 조회 (경고 엔진용)
    const { data: qualityRows } = await supabase
      .from("student_record_content_quality")
      .select("record_type, record_id, overall_score, issues, feedback")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);

    const qualityScores = (qualityRows ?? []).map((r) => ({
      record_type: r.record_type as "setek" | "changche" | "haengteuk" | "personal_setek",
      record_id: r.record_id as string,
      overall_score: r.overall_score as number,
      issues: (r.issues ?? []) as string[],
      feedback: (r.feedback as string) ?? null,
    }));

    // ─── 설계 모드 projected 데이터 (P8 가안 분석 결과) ───
    const projectedData = await assembleProjectedData(studentId, schoolYear, tenantId, studentGrade);

    return {
      competencyScores: { ai: aiScores, consultant: consultantScores },
      activityTags,
      aiDiagnosis: diagnosisPair.ai,
      consultantDiagnosis: diagnosisPair.consultant,
      strategies, courseAdequacy, takenSubjects, offeredSubjects, targetMajor,
      targetSubClassificationId, targetSubClassificationName,
      qualityScores,
      fourAxisDiagnosis: fourAxisDiagnosis as import("@/lib/domains/admission/prediction/profile-diagnosis").FourAxisDiagnosis | null,
      projectedData,
    };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchDiagnosisTabData" }, error, { studentId, schoolYear });
    return {
      competencyScores: { ai: [], consultant: [] },
      activityTags: [],
      aiDiagnosis: null, consultantDiagnosis: null,
      strategies: [], courseAdequacy: null,
      takenSubjects: [], offeredSubjects: null, targetMajor: null,
      targetSubClassificationId: null, targetSubClassificationName: null,
      qualityScores: [],
      fourAxisDiagnosis: null,
      projectedData: undefined,
    };
  }
}

// ============================================
// 역량 평가 CRUD
// ============================================

export async function upsertCompetencyScoreAction(
  input: CompetencyScoreInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await competencyRepo.upsertCompetencyScore(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "upsertCompetencyScore" }, error);
    return { success: false, error: "역량 평가 저장 중 오류가 발생했습니다." };
  }
}

export async function updateCompetencyScoreAction(
  id: string,
  updates: CompetencyScoreUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.updateCompetencyScore(id, updates);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateCompetencyScore" }, error);
    return { success: false, error: "역량 평가 수정 중 오류가 발생했습니다." };
  }
}

export async function deleteCompetencyScoreAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.deleteCompetencyScore(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteCompetencyScore" }, error);
    return { success: false, error: "역량 평가 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 활동 태그 CRUD
// ============================================

export async function addActivityTagAction(
  input: ActivityTagInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await competencyRepo.insertActivityTag(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addActivityTag" }, error);
    return { success: false, error: "활동 태그 추가 중 오류가 발생했습니다." };
  }
}

export async function deleteActivityTagAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.deleteActivityTag(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteActivityTag" }, error);
    return { success: false, error: "활동 태그 삭제 중 오류가 발생했습니다." };
  }
}

/** 활동 태그 배치 추가 */
export async function addActivityTagsBatchAction(
  inputs: import("../types").ActivityTagInsert[],
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const ids = await competencyRepo.insertActivityTags(inputs);
    return { success: true, id: ids[0] };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addActivityTagsBatch" }, error);
    return { success: false, error: "활동 태그 배치 추가 중 오류가 발생했습니다." };
  }
}

/** 특정 레코드의 AI 생성 태그 일괄 삭제 (재분석 전 정리) */
export async function deleteAiTagsForRecordAction(
  recordType: string,
  recordId: string,
  tenantId: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.deleteAiActivityTagsByRecord(recordType, recordId, tenantId);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteAiTagsForRecord" }, error);
    return { success: false, error: "AI 태그 정리 중 오류가 발생했습니다." };
  }
}

/** 분석 결과 캐시 저장 (UI에서 개별 분석 후 호출) + 증분 분석용 content_hash */
export async function saveAnalysisCacheAction(input: {
  tenant_id: string;
  student_id: string;
  record_type: string;
  record_id: string;
  source: "ai" | "consultant";
  analysis_result: unknown;
  content_hash?: string;
}): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.upsertAnalysisCache(input);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveAnalysisCache" }, error);
    return { success: false, error: "분석 캐시 저장 실패" };
  }
}

/** 학생의 AI 분석 캐시 조회 (하이라이트 복원 + 증분 분석) */
export async function fetchAnalysisCacheAction(
  studentId: string,
  tenantId: string,
): Promise<{ success: true; data: Array<{ record_type: string; record_id: string; source: string; analysis_result: unknown; content_hash: string | null }> } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();
    const data = await competencyRepo.findAnalysisCacheByStudent(studentId, tenantId, "ai");
    return { success: true, data };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchAnalysisCache" }, error, { studentId });
    return { success: false, error: "분석 캐시 조회 실패" };
  }
}

/** 배치 캐시+해시 조회 — 증분 분석에서 스킵 판별용 */
export async function fetchAnalysisCacheWithHashAction(
  recordIds: string[],
  tenantId: string,
): Promise<{ success: true; data: Array<{ record_id: string; analysis_result: unknown; content_hash: string | null }> } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();
    const data = await competencyRepo.findAnalysisCacheByRecordIds(recordIds, tenantId, "ai");
    return { success: true, data };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchAnalysisCacheWithHash" }, error);
    return { success: false, error: "캐시 조회 실패" };
  }
}

/** 결정론적 진로 등급 계산 (이수율+성적 기반) — 클라이언트에서 호출 */
export async function computeDeterministicCareerGradesAction(
  studentId: string,
): Promise<{ success: true; data: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: student } = await supabase
      .from("students")
      .select("target_major, grade")
      .eq("id", studentId)
      .maybeSingle();

    const tgtMajor = student?.target_major as string | null;
    if (!tgtMajor) return { success: true, data: [] };

    type ScoreRow = { subject: { name: string } | null; rank_grade: number | null; grade: number | null; semester: number | null };
    const { data: scoreRows } = await supabase
      .from("student_internal_scores")
      .select("subject:subject_id(name), rank_grade, grade, semester")
      .eq("student_id", studentId)
      .returns<ScoreRow[]>();

    const typedScoreRows = scoreRows ?? [];

    const subjectScores = typedScoreRows
      .map((s) => ({
        subjectName: s.subject?.name ?? "",
        rankGrade: s.rank_grade ?? 5,
      }))
      .filter((s: { subjectName: string }) => s.subjectName);
    const takenNames = [...new Set(subjectScores.map((s: { subjectName: string }) => s.subjectName))];

    // 학년별 이수 데이터 (Q2 학습단계 순서 검증용)
    const gradedSubjects = typedScoreRows
      .filter((s) => s.subject?.name && s.grade != null && s.semester != null)
      .map((s) => ({
        subjectName: s.subject!.name,
        grade: s.grade!,
        semester: s.semester!,
      }));

    const { calculateCourseAdequacy } = await import("../course-adequacy");
    const { computeCourseEffortGrades, computeCourseAchievementGrades } = await import("../rubric-matcher");
    const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");

    const studentGrade = (student?.grade as number) ?? 3;
    const enrollYear = calculateSchoolYear() - studentGrade + 1;
    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const curYear = getCurriculumYear(enrollYear);
    const adequacy = calculateCourseAdequacy(tgtMajor, takenNames, null, curYear);

    if (!adequacy) return { success: true, data: [] };

    const grades = [
      computeCourseEffortGrades(adequacy, gradedSubjects),
      computeCourseAchievementGrades(adequacy.taken, subjectScores, adequacy),
    ];

    return { success: true, data: grades };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "computeDeterministicCareerGrades" }, error, { studentId });
    return { success: false, error: "결정론적 등급 계산 실패" };
  }
}

/** AI 제안 태그 → 확정 */
export async function confirmActivityTagAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await competencyRepo.updateActivityTag(id, { status: "confirmed" });
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmActivityTag" }, error);
    return { success: false, error: "태그 확정 중 오류가 발생했습니다." };
  }
}

/** 종합 진단 → 확정 */
export async function confirmDiagnosisAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.updateDiagnosis(id, { status: "confirmed" });
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmDiagnosis" }, error);
    return { success: false, error: "진단 확정 중 오류가 발생했습니다." };
  }
}

// ============================================
// 종합 진단 CRUD
// ============================================

export async function upsertDiagnosisAction(
  input: DiagnosisInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await diagnosisRepo.upsertDiagnosis(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "upsertDiagnosis" }, error);
    return { success: false, error: "종합 진단 저장 중 오류가 발생했습니다." };
  }
}

export async function updateDiagnosisAction(
  id: string,
  updates: DiagnosisUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.updateDiagnosis(id, updates);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateDiagnosis" }, error);
    return { success: false, error: "종합 진단 수정 중 오류가 발생했습니다." };
  }
}

export async function deleteDiagnosisAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.deleteDiagnosis(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteDiagnosis" }, error);
    return { success: false, error: "종합 진단 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// 보완전략 CRUD
// ============================================

export async function addStrategyAction(
  input: StrategyInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await diagnosisRepo.insertStrategy(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addStrategy" }, error);
    return { success: false, error: "보완전략 추가 중 오류가 발생했습니다." };
  }
}

export async function updateStrategyAction(
  id: string,
  updates: StrategyUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.updateStrategy(id, updates);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateStrategy" }, error);
    return { success: false, error: "보완전략 수정 중 오류가 발생했습니다." };
  }
}

export async function deleteStrategyAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.deleteStrategy(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteStrategy" }, error);
    return { success: false, error: "보완전략 삭제 중 오류가 발생했습니다." };
  }
}

// ============================================
// G2-1: 크로스레퍼런스 데이터 조회
// storyline_links + reading_links + reading labels
// ============================================

// fetchCrossRefData → cross-ref-data-builder.ts로 이동
// "use server" 파일에서 re-export 불가 — 호출부에서 직접 import 필요

// ============================================
// Phase E4: 영속화된 엣지 조회
// ============================================

import type { PersistedEdge } from "../repository/edge-repository";

/** 학생의 DB 영속화 엣지 목록 조회 */
export async function fetchPersistedEdges(
  studentId: string,
  tenantId: string,
): Promise<PersistedEdge[]> {
  try {
    await requireAdminOrConsultant();
    const { findEdges } = await import("../repository/edge-repository");
    return await findEdges(studentId, tenantId);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedEdges" }, error, { studentId });
    return [];
  }
}

/** 학생의 면접 예상 질문 조회 */
export async function fetchInterviewQuestions(
  studentId: string,
): Promise<Array<{ question: string; question_type: string; difficulty: string | null; suggested_answer: string | null }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("student_record_interview_questions")
      .select("question, question_type, difficulty, suggested_answer")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId!)
      .order("question_type")
      .order("difficulty")
      .limit(20);
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchInterviewQuestions" }, error, { studentId });
    return [];
  }
}

/** P2-4: 진단 변경 히스토리 (스냅샷) 조회 */
export async function findDiagnosisSnapshotsAction(
  studentId: string,
  schoolYear: number,
  source: "ai" | "manual",
): Promise<Array<{ id: string; snapshot: Record<string, unknown>; created_at: string }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return [];
    return await diagnosisRepo.findDiagnosisSnapshots(studentId, schoolYear, source, tenantId);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "findDiagnosisSnapshots" }, error, { studentId });
    return [];
  }
}
