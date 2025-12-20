"use server";

/**
 * 내신 성적 입력 API
 * 
 * student_terms를 조회/생성하여 student_term_id를 연결합니다.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { calculateSchoolYear } from "@/lib/data/studentTerms";
import {
  createInternalScore,
  updateInternalScore,
  deleteInternalScore,
  createMockScore,
  updateMockScore,
  deleteMockScore,
  createInternalScoresBatch,
  createMockScoresBatch,
} from "@/lib/data/studentScores";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";

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
  const result = await createInternalScore({
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
 * 모의고사 성적 생성
 */
async function _createMockScore(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const student_id = formData.get("student_id") as string;
  const tenant_id = formData.get("tenant_id") as string;
  const exam_date = formData.get("exam_date") as string; // YYYY-MM-DD
  const exam_title = formData.get("exam_title") as string;
  const grade = parseInt(formData.get("grade") as string);
  const subject_id = formData.get("subject_id") as string;
  const subject_group_id = formData.get("subject_group_id") as string;
  const curriculum_revision_id = formData.get("curriculum_revision_id") as string;
  const raw_score = formData.get("raw_score") ? parseFloat(formData.get("raw_score") as string) : null;
  const standard_score = formData.get("standard_score") ? parseFloat(formData.get("standard_score") as string) : null;
  const percentile = formData.get("percentile") ? parseFloat(formData.get("percentile") as string) : null;
  const grade_score = formData.get("grade_score") ? parseInt(formData.get("grade_score") as string) : null;
  const semester = formData.get("semester") ? parseInt(formData.get("semester") as string) : null;

  // 필수 필드 검증
  if (!student_id || !tenant_id || !exam_date || !exam_title || !grade || !subject_id || !subject_group_id || !curriculum_revision_id) {
    throw new AppError("필수 필드가 누락되었습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 학기 계산 (없으면 exam_date 기준으로 추정: 3~8월 = 1학기, 9~2월 = 2학기)
  const examDate = new Date(exam_date);
  const calculatedSemester = semester ?? (examDate.getMonth() + 1 >= 3 && examDate.getMonth() + 1 <= 8 ? 1 : 2);

  // lib/data/studentScores.ts의 createMockScore 사용
  const result = await createMockScore({
    tenant_id,
    student_id,
    exam_date,
    exam_title,
    grade,
    subject_id,
    subject_group_id,
    curriculum_revision_id,
    raw_score,
    standard_score,
    percentile,
    grade_score,
    semester: calculatedSemester,
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
  return { success: true, scoreId: result.scoreId };
}

export const createMockScore = withActionResponse(_createMockScore);

/**
 * 내신 성적 수정
 */
async function _updateInternalScore(scoreId: string, formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const tenant_id = user.tenantId || (formData.get("tenant_id") as string); // getCurrentUser에서 가져온 tenantId 우선 사용
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
  const result = await updateInternalScore(scoreId, user.userId, tenant_id, updates);

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
 * 모의고사 성적 수정
 */
async function _updateMockScore(scoreId: string, formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // FormData에서 값 추출
  const tenant_id = formData.get("tenant_id") as string;
  const exam_date = formData.get("exam_date") as string | undefined;
  const exam_title = formData.get("exam_title") as string | undefined;
  const grade = formData.get("grade") ? parseInt(formData.get("grade") as string) : undefined;
  const subject_id = formData.get("subject_id") as string | undefined;
  const subject_group_id = formData.get("subject_group_id") as string | undefined;
  const raw_score = formData.get("raw_score") ? parseFloat(formData.get("raw_score") as string) : undefined;
  const standard_score = formData.get("standard_score") ? parseFloat(formData.get("standard_score") as string) : undefined;
  const percentile = formData.get("percentile") ? parseFloat(formData.get("percentile") as string) : undefined;
  const grade_score = formData.get("grade_score") ? parseInt(formData.get("grade_score") as string) : undefined;

  if (!tenant_id) {
    throw new AppError("기관 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 업데이트할 필드만 구성
  const updates: Record<string, unknown> = {};
  if (exam_date) updates.exam_date = exam_date;
  if (exam_title) updates.exam_title = exam_title;
  if (grade !== undefined) updates.grade = grade;
  if (subject_id) updates.subject_id = subject_id;
  if (subject_group_id) updates.subject_group_id = subject_group_id;
  if (raw_score !== undefined) updates.raw_score = raw_score;
  if (standard_score !== undefined) updates.standard_score = standard_score;
  if (percentile !== undefined) updates.percentile = percentile;
  if (grade_score !== undefined) updates.grade_score = grade_score;

  // lib/data/studentScores.ts의 updateMockScore 사용
  const result = await updateMockScore(scoreId, user.userId, tenant_id, updates);

  if (!result.success) {
    throw new AppError(
      result.error || "모의고사 성적 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/scores");
  revalidatePath(`/scores/${scoreId}/edit`);
  return { success: true };
}

export const updateMockScore = withActionResponse(_updateMockScore);

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
  const result = await deleteInternalScore(scoreId, user.userId, user.tenantId);

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
 * 모의고사 성적 삭제
 */
async function _deleteMockScore(scoreId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!user.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // lib/data/studentScores.ts의 deleteMockScore 사용
  const result = await deleteMockScore(scoreId, user.userId, user.tenantId);

  if (!result.success) {
    throw new AppError(
      result.error || "모의고사 성적 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/scores");
  return { success: true };
}

export const deleteMockScore = withActionResponse(_deleteMockScore);

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
    await _deleteMockScore(scoreId);
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
  const result = await createInternalScoresBatch(scores, {
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
  const result = await createMockScoresBatch(scores, {
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

