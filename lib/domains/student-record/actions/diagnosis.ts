"use server";

// ============================================
// 진단 탭 Server Actions
// Phase 5 — 역량 평가 + 활동 태그 + 종합 진단 + 보완전략 + 이수적합도
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
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
  options?: {
    targetMajor?: string | null;
    takenSubjects?: string[];
    offeredSubjects?: string[] | null;
  },
): Promise<DiagnosisTabData> {
  try {
    await requireAdminOrConsultant();

    const [competencyScores, activityTags, diagnosis, strategies] =
      await Promise.all([
        competencyRepo.findCompetencyScores(studentId, schoolYear, tenantId),
        competencyRepo.findActivityTags(studentId, tenantId),
        diagnosisRepo.findDiagnosis(studentId, schoolYear, tenantId),
        diagnosisRepo.findStrategies(studentId, schoolYear, tenantId),
      ]);

    const courseAdequacy =
      options?.targetMajor && options.takenSubjects
        ? calculateCourseAdequacy(
            options.targetMajor,
            options.takenSubjects,
            options.offeredSubjects ?? null,
          )
        : null;

    return { competencyScores, activityTags, diagnosis, strategies, courseAdequacy };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchDiagnosisTabData" }, error, { studentId, schoolYear });
    return {
      competencyScores: [],
      activityTags: [],
      diagnosis: null,
      strategies: [],
      courseAdequacy: null,
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
