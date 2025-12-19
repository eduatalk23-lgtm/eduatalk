"use server";

/**
 * ⚠️ DEPRECATED: 이 파일은 레거시 student_scores 테이블을 사용합니다.
 * 
 * 이 파일의 모든 함수는 더 이상 사용되지 않습니다.
 * 새 구조로 완전히 마이그레이션되었습니다.
 * 
 * 새 구조:
 * - 내신 성적: student_internal_scores 테이블 사용
 * - 모의고사 성적: student_mock_scores 테이블 사용
 * 
 * 새 구조는 student_terms를 통해 학기 정보를 관리하며,
 * student_term_id FK를 통해 연결됩니다.
 * 
 * @deprecated 이 파일의 모든 함수는 사용하지 마세요.
 * @see app/actions/scores-internal.ts - createInternalScore, createMockScore, updateInternalScore, updateMockScore, deleteScore
 * @see lib/data/studentScores.ts - getInternalScores, getMockScores
 * @see lib/domains/score/repository.ts - insertInternalScore, insertMockScore
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordHistory } from "@/lib/history/record";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { validateFormData, studentScoreSchema } from "@/lib/validation/schemas";
import { safeQuery } from "@/lib/supabase/queryHelpers";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 성적 등록 (레거시)
 * @deprecated 사용하지 마세요. createInternalScore 또는 createMockScore를 사용하세요.
 */
async function _addStudentScore(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 입력 검증
  const validation = validateFormData(formData, studentScoreSchema);
  if (!validation.success) {
    const firstError = validation.errors.issues[0];
    throw new AppError(
      firstError?.message ?? "입력값을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const {
    subject_type,
    semester,
    course,
    course_detail,
    raw_score,
    grade,
    score_type_detail,
    test_date,
  } = validation.data;

  // student의 tenant_id 조회
  const selectStudent = async () => {
    const result = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    return { data: result.data, error: result.error };
  };

  const student = await safeQuery(selectStudent, selectStudent);

  if (!student || !student.tenant_id) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const insertPayload = {
    student_id: user.id,
    tenant_id: student.tenant_id,
    subject_type,
    semester,
    course,
    course_detail: course_detail ?? null,
    raw_score,
    grade,
    score_type_detail,
    test_date,
  };

  const insertQuery = async () => {
    const result = await supabase.from("student_scores").insert(insertPayload);
    return { data: result.data, error: result.error };
  };
  const fallbackInsertQuery = async () => {
    const { student_id: _studentId, ...fallbackPayload } = insertPayload;
    const result = await supabase.from("student_scores").insert(fallbackPayload);
    return { data: result.data, error: result.error };
  };

  const insertResult = await safeQuery(insertQuery, fallbackInsertQuery);

  if (insertResult === null) {
    throw new AppError(
      "성적 등록에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 히스토리 기록
  await recordHistory(supabase, user.id, "score_added", {
    subject_type,
    course,
    course_detail: course_detail ?? null,
    raw_score,
    grade,
    test_date,
  });

  revalidatePath("/scores");
  redirect("/scores");
}

/**
 * @deprecated 사용하지 마세요. createInternalScore 또는 createMockScore를 사용하세요.
 */
export const addStudentScore = withErrorHandling(_addStudentScore);

/**
 * 성적 수정 (레거시)
 * @deprecated 사용하지 마세요. updateInternalScore 또는 updateMockScore를 사용하세요.
 */
async function _updateStudentScore(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!id) {
    throw new AppError("성적 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 입력 검증
  const validation = validateFormData(formData, studentScoreSchema);
  if (!validation.success) {
    const firstError = validation.errors.issues[0];
    throw new AppError(
      firstError?.message ?? "입력값을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const {
    subject_type,
    semester,
    course,
    course_detail,
    raw_score,
    grade,
    score_type_detail,
    test_date,
  } = validation.data;

  const updatePayload = {
    subject_type,
    semester,
    course,
    course_detail: course_detail ?? null,
    raw_score,
    grade,
    score_type_detail,
    test_date,
  };

  const updateQuery = async () => {
    const result = await supabase
      .from("student_scores")
      .update(updatePayload)
      .eq("id", id)
      .eq("student_id", user.id);
    return { data: result.data, error: result.error };
  };

  const fallbackUpdateQuery = async () => {
    const result = await supabase
      .from("student_scores")
      .update(updatePayload)
      .eq("id", id);
    return { data: result.data, error: result.error };
  };

  const updateResult = await safeQuery(updateQuery, fallbackUpdateQuery);

  if (updateResult === null) {
    throw new AppError(
      "성적 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 히스토리 기록
  await recordHistory(supabase, user.id, "score_updated", {
    score_id: id,
    subject_type,
    course,
    course_detail: course_detail ?? null,
    raw_score,
    grade,
    test_date,
  });

  revalidatePath("/scores");
  revalidatePath(`/scores/${id}/edit`);
  redirect("/scores");
}

/**
 * @deprecated 사용하지 마세요. updateInternalScore 또는 updateMockScore를 사용하세요.
 */
export const updateStudentScore = withErrorHandling(_updateStudentScore);

/**
 * 성적 삭제 (레거시)
 * @deprecated 사용하지 마세요. deleteScore를 사용하세요.
 */
async function _deleteStudentScore(id: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  if (!id) {
    throw new AppError("성적 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const deleteQuery = async () => {
    const result = await supabase
      .from("student_scores")
      .delete()
      .eq("id", id)
      .eq("student_id", user.id);
    return { data: result.data, error: result.error };
  };

  const fallbackDeleteQuery = async () => {
    const result = await supabase
      .from("student_scores")
      .delete()
      .eq("id", id);
    return { data: result.data, error: result.error };
  };

  const deleteResult = await safeQuery(deleteQuery, fallbackDeleteQuery);

  if (deleteResult === null) {
    throw new AppError(
      "성적 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/scores");
  redirect("/scores");
}

/**
 * @deprecated 사용하지 마세요. deleteScore를 사용하세요.
 */
export const deleteStudentScore = withErrorHandling(_deleteStudentScore);

