"use server";

/**
 * Score 도메인 Server Actions
 *
 * 이 파일은 Server Actions만 담당합니다.
 * - 권한 검사
 * - FormData 파싱
 * - Service 호출
 * - Cache 무효화
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { calculateSchoolYear } from "@/lib/data/studentTerms";
import {
  createInternalScore as createInternalScoreData,
  updateInternalScore as updateInternalScoreData,
  deleteInternalScore as deleteInternalScoreData,
  deleteMockScore as deleteMockScoreData,
  createInternalScoresBatch as createInternalScoresBatchData,
  createMockScoresBatch as createMockScoresBatchData,
} from "@/lib/data/studentScores";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import * as service from "../service";
import { getFormString, getFormInt, getFormUuid } from "@/lib/utils/formDataHelpers";
import type {
  InternalScore,
  MockScore,
  GetMockScoresFilter,
  ScoreActionResult,
} from "../types";

// ============================================
// 내신 성적 Actions
// ============================================

/**
 * 내신 성적 생성
 */
async function _createInternalScore(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const student_id = formData.get("student_id") as string;
  const tenant_id = formData.get("tenant_id") as string;
  const school_year = formData.get("school_year") ? parseInt(formData.get("school_year") as string) : calculateSchoolYear();
  const grade = parseInt(formData.get("grade") as string);
  const semester = parseInt(formData.get("semester") as string);
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string;
  const subject_group_id = formData.get("subject_group_id") as string;
  const subject_type_id = formData.get("subject_type_id") as string;
  const subject_id = formData.get("subject_id") as string;
  const credit_hours = parseFloat(formData.get("credit_hours") as string);
  const raw_score = formData.get("raw_score") ? parseFloat(formData.get("raw_score") as string) : null;
  const avg_score = formData.get("avg_score") ? parseFloat(formData.get("avg_score") as string) : null;
  const std_dev = formData.get("std_dev") ? parseFloat(formData.get("std_dev") as string) : null;
  const rank_grade = formData.get("rank_grade") ? parseInt(formData.get("rank_grade") as string) : null;
  const total_students = formData.get("total_students") ? parseInt(formData.get("total_students") as string) : null;

  // 필수 필드 검증
  if (!tenant_id) {
    throw new AppError("기관 정보를 찾을 수 없습니다. 학생 설정을 완료해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }
  if (!curriculum_revision_id || !subject_group_id || !subject_type_id || !subject_id) {
    throw new AppError("필수 필드가 누락되었습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!grade || !semester || !credit_hours) {
    throw new AppError("학년, 학기, 이수단위는 필수입니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // lib/data/studentScores.ts의 createInternalScore 사용
  const result = await createInternalScoreData({
    tenant_id,
    student_id,
    curriculum_revision_id,
    subject_group_id,
    subject_type_id,
    subject_id,
    grade,
    semester,
    credit_hours,
    raw_score,
    avg_score,
    std_dev,
    rank_grade,
    total_students,
    school_year,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "내신 성적 등록에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/scores");
  return { success: true, scoreId: result.scoreId };
}

export const createInternalScore = withActionResponse(_createInternalScore);

/**
 * 내신 성적 수정
 */
async function _updateInternalScore(scoreId: string, formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const tenant_id = user.tenantId || (formData.get("tenant_id") as string);
  const grade = formData.get("grade") ? parseInt(formData.get("grade") as string) : undefined;
  const semester = formData.get("semester") ? parseInt(formData.get("semester") as string) : undefined;
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string | undefined;
  const subject_group_id = formData.get("subject_group_id") as string | undefined;
  const subject_type_id = formData.get("subject_type_id") as string | undefined;
  const subject_id = formData.get("subject_id") as string | undefined;
  const credit_hours = formData.get("credit_hours") ? parseFloat(formData.get("credit_hours") as string) : undefined;
  const raw_score = formData.get("raw_score") ? parseFloat(formData.get("raw_score") as string) : undefined;
  const avg_score = formData.get("avg_score") ? parseFloat(formData.get("avg_score") as string) : undefined;
  const std_dev = formData.get("std_dev") ? parseFloat(formData.get("std_dev") as string) : undefined;
  const rank_grade = formData.get("rank_grade") ? parseInt(formData.get("rank_grade") as string) : undefined;
  const total_students = formData.get("total_students") ? parseInt(formData.get("total_students") as string) : undefined;

  if (!tenant_id) {
    throw new AppError("기관 정보를 찾을 수 없습니다. 학생 설정을 완료해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 업데이트할 필드만 구성
  const updates: Record<string, unknown> = {};
  if (grade !== undefined) updates.grade = grade;
  if (semester !== undefined) updates.semester = semester;
  if (curriculum_revision_id) updates.curriculum_revision_id = curriculum_revision_id;
  if (subject_group_id) updates.subject_group_id = subject_group_id;
  if (subject_type_id) updates.subject_type_id = subject_type_id;
  if (subject_id) updates.subject_id = subject_id;
  if (credit_hours !== undefined) updates.credit_hours = credit_hours;
  if (raw_score !== undefined) updates.raw_score = raw_score;
  if (avg_score !== undefined) updates.avg_score = avg_score;
  if (std_dev !== undefined) updates.std_dev = std_dev;
  if (rank_grade !== undefined) updates.rank_grade = rank_grade;
  if (total_students !== undefined) updates.total_students = total_students;

  // lib/data/studentScores.ts의 updateInternalScore 사용
  const result = await updateInternalScoreData(scoreId, user.userId, tenant_id, updates);

  if (!result.success) {
    throw new AppError(
      result.error || "내신 성적 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/scores");
  revalidatePath(`/scores/${scoreId}/edit`);
  return { success: true };
}

export const updateInternalScore = withActionResponse(_updateInternalScore);

/**
 * 내신 성적 삭제
 */
async function _deleteInternalScore(scoreId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!user.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // lib/data/studentScores.ts의 deleteInternalScore 사용
  const result = await deleteInternalScoreData(scoreId, user.userId, user.tenantId);

  if (!result.success) {
    throw new AppError(
      result.error || "내신 성적 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/scores");
  return { success: true };
}

export const deleteInternalScore = withActionResponse(_deleteInternalScore);

/**
 * 성적 삭제 (타입 자동 감지)
 */
async function _deleteScore(scoreId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 성적 타입 확인
  const { detectScoreType } = await import("@/lib/utils/scoreTypeDetector");
  const scoreType = await detectScoreType(scoreId, user.userId);

  if (!scoreType) {
    throw new AppError("성적을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 타입에 따라 적절한 삭제 함수 호출
  if (scoreType === "internal") {
    await _deleteInternalScore(scoreId);
  } else {
    if (!user.tenantId) {
      throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
    const result = await deleteMockScoreData(scoreId, user.userId, user.tenantId);
    if (!result.success) {
      throw new AppError(
        result.error || "모의고사 성적 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  return { success: true };
}

export const deleteScore = withActionResponse(_deleteScore);

/**
 * 내신 성적 일괄 생성
 */
async function _createInternalScoresBatch(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const student_id = formData.get("student_id") as string;
  const tenant_id = formData.get("tenant_id") as string;
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string;
  const school_year = formData.get("school_year")
    ? parseInt(formData.get("school_year") as string)
    : calculateSchoolYear();

  // scores 배열 파싱 (JSON 문자열)
  const scoresJson = formData.get("scores") as string;
  if (!scoresJson) {
    throw new AppError("성적 데이터가 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const scores: Array<{
    subject_group_id: string;
    subject_id: string;
    subject_type_id: string;
    grade: number;
    semester: number;
    credit_hours: number;
    rank_grade: number;
    raw_score?: number | null;
    avg_score?: number | null;
    std_dev?: number | null;
    total_students?: number | null;
  }> = JSON.parse(scoresJson);

  // 필수 필드 검증
  if (!student_id || !tenant_id || !curriculum_revision_id) {
    throw new AppError("필수 필드가 누락되었습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // lib/data/studentScores.ts의 createInternalScoresBatch 사용
  const result = await createInternalScoresBatchData(scores, {
    tenant_id,
    student_id,
    curriculum_revision_id,
    school_year,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "내신 성적 등록에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/scores");
  return { success: true, scores: result.scores };
}

export const createInternalScoresBatch = withActionResponse(_createInternalScoresBatch);

/**
 * 모의고사 성적 일괄 생성
 */
async function _createMockScoresBatch(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const student_id = formData.get("student_id") as string;
  const tenant_id = formData.get("tenant_id") as string;
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string;

  // scores 배열 파싱 (JSON 문자열)
  const scoresJson = formData.get("scores") as string;
  if (!scoresJson) {
    throw new AppError("성적 데이터가 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const scores: Array<{
    exam_date: string;
    exam_title: string;
    grade: number;
    subject_id: string;
    subject_group_id: string;
    grade_score: number;
    standard_score?: number | null;
    percentile?: number | null;
    raw_score?: number | null;
  }> = JSON.parse(scoresJson);

  // 필수 필드 검증
  if (!student_id || !tenant_id || !curriculum_revision_id) {
    throw new AppError("필수 필드가 누락되었습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // lib/data/studentScores.ts의 createMockScoresBatch 사용
  const result = await createMockScoresBatchData(scores, {
    tenant_id,
    student_id,
    curriculum_revision_id,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "모의고사 성적 등록에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/scores");
  return { success: true, scores: result.scores };
}

export const createMockScoresBatch = withActionResponse(_createMockScoresBatch);

// ============================================
// 모의고사 성적 Actions
// ============================================

/**
 * 모의고사 성적 목록 조회
 */
export async function getMockScoresAction(
  studentId: string,
  tenantId?: string | null,
  filters?: GetMockScoresFilter
): Promise<MockScore[]> {
  return service.getMockScores(studentId, tenantId, filters);
}

/**
 * 모의고사 성적 단건 조회
 */
export async function getMockScoreByIdAction(
  scoreId: string,
  studentId: string
): Promise<MockScore | null> {
  return service.getMockScoreById(scoreId, studentId);
}

/**
 * 모의고사 성적 생성
 */
export async function createMockScoreAction(
  formData: FormData
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // exam_date와 exam_title 가져오기
  const examDate =
    getFormString(formData, "exam_date") ||
    new Date().toISOString().split("T")[0];
  const examTitle =
    getFormString(formData, "exam_title") ||
    getFormString(formData, "exam_type") ||
    "모의고사";

  // curriculum_revision_id 가져오기
  const { getActiveCurriculumRevision } = await import("@/lib/data/subjects");
  const curriculumRevision = await getActiveCurriculumRevision();
  if (!curriculumRevision) {
    return {
      success: false,
      error: "개정교육과정을 찾을 수 없습니다. 관리자에게 문의해주세요.",
    };
  }

  const input = {
    tenant_id: getFormString(formData, "tenant_id") || user.tenantId || "",
    student_id: getFormString(formData, "student_id") || user.userId,
    exam_date: examDate,
    exam_title: examTitle,
    grade: getFormInt(formData, "grade") || 1,
    subject_id: getFormUuid(formData, "subject_id") || "",
    subject_group_id: getFormUuid(formData, "subject_group_id") || "",
    curriculum_revision_id: curriculumRevision.id,
    raw_score: getFormInt(formData, "raw_score"),
    standard_score: getFormInt(formData, "standard_score"),
    percentile: getFormInt(formData, "percentile"),
    grade_score: getFormInt(formData, "grade_score"),
    semester: getFormInt(formData, "semester") ?? undefined,
  };

  const result = await service.createMockScore(input);

  if (result.success) {
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

/**
 * 모의고사 성적 수정
 */
export async function updateMockScoreAction(
  formData: FormData
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const scoreId = getFormString(formData, "id");
  const studentId = getFormString(formData, "student_id") || user.userId;

  if (!scoreId) {
    return { success: false, error: "성적 ID가 필요합니다." };
  }

  const updates = {
    grade: getFormInt(formData, "grade") ?? undefined,
    exam_type: getFormString(formData, "exam_type") ?? undefined,
    subject_group_id: getFormUuid(formData, "subject_group_id") ?? undefined,
    subject_id: getFormUuid(formData, "subject_id") ?? undefined,
    subject_type_id: getFormUuid(formData, "subject_type_id") ?? undefined,
    subject_group: getFormString(formData, "subject_group") ?? undefined,
    subject_name: getFormString(formData, "subject_name") ?? undefined,
    raw_score: getFormInt(formData, "raw_score") ?? undefined,
    standard_score: getFormInt(formData, "standard_score") ?? undefined,
    percentile: getFormInt(formData, "percentile") ?? undefined,
    grade_score: getFormInt(formData, "grade_score") ?? undefined,
    exam_round: getFormString(formData, "exam_round") ?? undefined,
  };

  const result = await service.updateMockScore(scoreId, studentId, updates);

  if (result.success) {
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

/**
 * 모의고사 성적 삭제
 */
export async function deleteMockScoreAction(
  scoreId: string,
  studentId?: string
): Promise<ScoreActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const targetStudentId = studentId || user.userId;
  const result = await service.deleteMockScore(scoreId, targetStudentId);

  if (result.success) {
    revalidatePath("/scores");
    revalidatePath("/dashboard");
  }

  return result;
}

// ============================================
// 비즈니스 로직 Actions
// ============================================

/**
 * 평균 등급 조회
 */
export async function getAverageGradeAction(
  studentId: string,
  tenantId?: string | null
): Promise<{ schoolAvg: number | null; mockAvg: number | null }> {
  return service.calculateAverageGrade(studentId, tenantId);
}

/**
 * 과목별 성적 추이 조회
 */
export async function getScoreTrendAction(
  studentId: string,
  subjectGroupId: string,
  tenantId?: string | null
): Promise<{
  school: InternalScore[];
  mock: MockScore[];
}> {
  return service.getScoreTrendBySubject(studentId, subjectGroupId, tenantId);
}
