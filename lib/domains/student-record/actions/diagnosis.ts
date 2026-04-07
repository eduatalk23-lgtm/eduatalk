"use server";

// ============================================
// 종합 진단 Server Actions
// 진단 탭 데이터 + 진단 CRUD + 스냅샷
// 역량/태그/전략/헬퍼는 competency.ts, record-strategy.ts, diagnosis-helpers.ts로 분리
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as competencyRepo from "../repository/competency-repository";
import * as diagnosisRepo from "../repository/diagnosis-repository";
import { calculateCourseAdequacy } from "../course-adequacy";
import type {
  DiagnosisInsert,
  DiagnosisUpdate,
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

    const takenSubjects = [
      ...new Set(
        (scoresResult.data ?? [])
          .map((s) => s.subject?.name)
          .filter((n): n is string => !!n),
      ),
    ];

    const { targetSubClassificationName, offeredSubjects } = await fetchSchoolContext(
      supabase, targetSubClassificationId, schoolName,
    );

    const studentGrade = studentResult.data?.grade ?? 1;
    const enrollmentYear = schoolYear - studentGrade + 1;
    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const curriculumYear = getCurriculumYear(enrollmentYear);

    const courseAdequacy = targetMajor
      ? calculateCourseAdequacy(targetMajor, takenSubjects, offeredSubjects, curriculumYear)
      : null;

    const { data: qualityRows } = await supabase
      .from("student_record_content_quality")
      .select("record_type, record_id, overall_score, issues, feedback, specificity, coherence, depth, grammar, scientific_validity")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);

    const qualityScores = (qualityRows ?? []).map((r) => ({
      record_type: r.record_type as "setek" | "changche" | "haengteuk" | "personal_setek",
      record_id: r.record_id as string,
      overall_score: r.overall_score as number,
      issues: (r.issues ?? []) as string[],
      feedback: (r.feedback as string) ?? null,
      specificity: (r.specificity as number) ?? 0,
      coherence: (r.coherence as number) ?? 0,
      depth: (r.depth as number) ?? 0,
      grammar: (r.grammar as number) ?? 0,
      scientific_validity: (r.scientific_validity as number | null) ?? null,
    }));

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
// 종합 진단 CRUD
// ============================================

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
