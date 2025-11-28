"use server";

/**
 * 내신 성적 입력 API
 * 
 * student_terms를 조회/생성하여 student_term_id를 연결합니다.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getOrCreateStudentTerm, calculateSchoolYear } from "@/lib/data/studentTerms";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 내신 성적 생성
 */
async function _createInternalScore(formData: FormData) {
  const supabase = await createSupabaseServerClient();
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
  const class_name = formData.get("class_name") as string | null;
  const homeroom_teacher = formData.get("homeroom_teacher") as string | null;
  const notes = formData.get("notes") as string | null;

  // 필수 필드 검증
  if (!student_id || !tenant_id || !curriculum_revision_id || !subject_group_id || !subject_type_id || !subject_id) {
    throw new AppError("필수 필드가 누락되었습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!grade || !semester || !credit_hours) {
    throw new AppError("학년, 학기, 이수단위는 필수입니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // student_term 조회 또는 생성
  const student_term_id = await getOrCreateStudentTerm({
    tenant_id,
    student_id,
    school_year,
    grade,
    semester,
    curriculum_revision_id,
    class_name: class_name || null,
    homeroom_teacher: homeroom_teacher || null,
    notes: notes || null,
  });

  // 내신 성적 생성
  const { data, error } = await supabase
    .from("student_internal_scores")
    .insert({
      tenant_id,
      student_id,
      student_term_id,
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
    })
    .select("id")
    .single();

  if (error) {
    console.error("[actions/scores-internal] 내신 성적 생성 실패", error);
    throw new AppError("내신 성적 등록에 실패했습니다.", ErrorCode.DATABASE_ERROR, 500, true);
  }

  revalidatePath("/scores");
  return { success: true, scoreId: data.id };
}

export const createInternalScore = withErrorHandling(_createInternalScore);

/**
 * 모의고사 성적 생성
 */
async function _createMockScore(formData: FormData) {
  const supabase = await createSupabaseServerClient();
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

  // exam_date를 기준으로 학년도 계산
  const examDate = new Date(exam_date);
  const school_year = calculateSchoolYear(examDate);

  // 학기 계산 (없으면 exam_date 기준으로 추정: 3~8월 = 1학기, 9~2월 = 2학기)
  const calculatedSemester = semester ?? (examDate.getMonth() + 1 >= 3 && examDate.getMonth() + 1 <= 8 ? 1 : 2);

  // student_term 조회 또는 생성 (실패 시 NULL 허용)
  let student_term_id: string | null = null;
  try {
    student_term_id = await getOrCreateStudentTerm({
      tenant_id,
      student_id,
      school_year,
      grade,
      semester: calculatedSemester,
      curriculum_revision_id,
    });
  } catch (error) {
    // 모의고사 성적의 경우 student_term_id가 없어도 저장 가능
    console.warn("[actions/scores-internal] student_term 조회/생성 실패 (NULL로 저장)", error);
  }

  // 모의고사 성적 생성
  const { data, error } = await supabase
    .from("student_mock_scores")
    .insert({
      tenant_id,
      student_id,
      student_term_id: student_term_id ?? null, // nullable
      exam_date,
      exam_title,
      grade,
      subject_id,
      subject_group_id,
      raw_score,
      standard_score,
      percentile,
      grade_score,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[actions/scores-internal] 모의고사 성적 생성 실패", error);
    throw new AppError("모의고사 성적 등록에 실패했습니다.", ErrorCode.DATABASE_ERROR, 500, true);
  }

  revalidatePath("/scores");
  return { success: true, scoreId: data.id };
}

export const createMockScore = withErrorHandling(_createMockScore);

