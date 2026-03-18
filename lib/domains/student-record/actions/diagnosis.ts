"use server";

// ============================================
// 진단 탭 Server Actions
// Phase 5 — 역량 평가 + 활동 태그 + 종합 진단 + 보완전략 + 이수적합도
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as competencyRepo from "../competency-repository";
import * as diagnosisRepo from "../diagnosis-repository";
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

    // 병렬 조회: 역량(AI+컨설턴트)/태그/진단(AI+컨설턴트)/전략 + 학생정보 + 이수과목
    const [aiScores, consultantScores, activityTags, diagnosisPair, strategies, studentResult, scoresResult] =
      await Promise.all([
        competencyRepo.findCompetencyScores(studentId, schoolYear, tenantId, "ai"),
        competencyRepo.findCompetencyScores(studentId, schoolYear, tenantId, "manual"),
        competencyRepo.findActivityTags(studentId, tenantId),
        diagnosisRepo.findDiagnosisPair(studentId, schoolYear, tenantId),
        diagnosisRepo.findStrategies(studentId, schoolYear, tenantId),
        supabase.from("students").select("target_major, school_name").eq("id", studentId).maybeSingle(),
        supabase.from("student_internal_scores")
          .select("subject:subject_id(name)")
          .eq("student_id", studentId),
      ]);

    const targetMajor = studentResult.data?.target_major ?? null;
    const schoolName = studentResult.data?.school_name ?? null;

    // 이수 과목명 추출 (중복 제거)
    const takenSubjects = [
      ...new Set(
        (scoresResult.data ?? [])
          .map((s) => {
            const subj = s.subject as unknown as { name: string } | null;
            return subj?.name;
          })
          .filter((n): n is string => !!n),
      ),
    ];

    // 학교 개설 과목 조회 (school_name → school_profiles → school_offered_subjects)
    let offeredSubjects: string[] | null = null;
    if (schoolName) {
      const { data: profile } = await supabase
        .from("school_profiles")
        .select("id")
        .eq("school_name", schoolName)
        .maybeSingle();

      if (profile) {
        const { data: offered } = await supabase
          .from("school_offered_subjects")
          .select("subject:subject_id(name)")
          .eq("school_profile_id", profile.id);

        offeredSubjects = (offered ?? [])
          .map((o) => {
            const subj = o.subject as unknown as { name: string } | null;
            return subj?.name;
          })
          .filter((n): n is string => !!n);
      }
    }

    const courseAdequacy = targetMajor
      ? calculateCourseAdequacy(targetMajor, takenSubjects, offeredSubjects)
      : null;

    return {
      competencyScores: { ai: aiScores, consultant: consultantScores },
      activityTags,
      aiDiagnosis: diagnosisPair.ai,
      consultantDiagnosis: diagnosisPair.consultant,
      strategies, courseAdequacy, takenSubjects, offeredSubjects, targetMajor,
    };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchDiagnosisTabData" }, error, { studentId, schoolYear });
    return {
      competencyScores: { ai: [], consultant: [] },
      activityTags: [],
      aiDiagnosis: null, consultantDiagnosis: null,
      strategies: [], courseAdequacy: null,
      takenSubjects: [], offeredSubjects: null, targetMajor: null,
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
