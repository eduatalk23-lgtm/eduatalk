/**
 * Score 도메인 Repository
 *
 * 이 파일은 순수한 데이터 접근만을 담당합니다.
 * - Supabase 쿼리만 수행
 * - 비즈니스 로직 없음
 * - 에러는 상위 레이어에서 처리
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateStudentTerm, calculateSchoolYear } from "@/lib/data/studentTerms";
import type {
  InternalScore,
  MockScore,
  GetSchoolScoresFilter,
  GetMockScoresFilter,
  CreateInternalScoreInput,
  UpdateInternalScoreInput,
  CreateMockScoreInput,
  UpdateMockScoreInput,
  // 레거시 타입 (하위 호환성)
  SchoolScore,
  CreateSchoolScoreInput,
  UpdateSchoolScoreInput,
} from "./types";

// ============================================
// 내신 성적 Repository
// ============================================

/**
 * 내신 성적 목록 조회 (정규화 버전)
 */
export async function findInternalScores(
  studentId: string,
  tenantId: string,
  filters?: GetSchoolScoresFilter
): Promise<InternalScore[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("student_internal_scores")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (filters?.grade) {
    query = query.eq("grade", filters.grade);
  }

  if (filters?.semester) {
    query = query.eq("semester", filters.semester);
  }

  if (filters?.subjectGroupId) {
    query = query.eq("subject_group_id", filters.subjectGroupId);
  }

  const { data, error } = await query
    .order("grade", { ascending: true })
    .order("semester", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as InternalScore[]) ?? [];
}

/**
 * 내신 성적 목록 조회 (레거시)
 * @deprecated findInternalScores를 사용하세요
 */
export async function findSchoolScores(
  studentId: string,
  tenantId?: string | null,
  filters?: GetSchoolScoresFilter
): Promise<SchoolScore[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("student_school_scores")
    .select("*")
    .eq("student_id", studentId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (filters?.grade) {
    query = query.eq("grade", filters.grade);
  }

  if (filters?.semester) {
    query = query.eq("semester", filters.semester);
  }

  if (filters?.subjectGroupId) {
    query = query.eq("subject_group_id", filters.subjectGroupId);
  } else if (filters?.subjectGroup) {
    query = query.eq("subject_group", filters.subjectGroup);
  }

  const { data, error } = await query
    .order("grade", { ascending: true })
    .order("semester", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as SchoolScore[]) ?? [];
}

/**
 * 내신 성적 단건 조회
 */
export async function findSchoolScoreById(
  scoreId: string,
  studentId: string
): Promise<SchoolScore | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_school_scores")
    .select("*")
    .eq("id", scoreId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data as SchoolScore | null;
}

/**
 * 내신 성적 생성 (정규화 버전)
 * 
 * student_terms를 조회/생성하여 student_term_id를 세팅합니다.
 */
export async function insertInternalScore(
  input: CreateInternalScoreInput & { school_year?: number }
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  // school_year 계산 (없으면 현재 날짜 기준)
  const school_year = input.school_year ?? calculateSchoolYear();

  // student_term 조회 또는 생성
  const student_term_id = await getOrCreateStudentTerm({
    tenant_id: input.tenant_id,
    student_id: input.student_id,
    school_year,
    grade: input.grade,
    semester: input.semester,
    curriculum_revision_id: input.curriculum_revision_id,
  });

  const payload = {
    tenant_id: input.tenant_id,
    student_id: input.student_id,
    student_term_id, // student_term_id 추가
    curriculum_revision_id: input.curriculum_revision_id,
    subject_group_id: input.subject_group_id,
    subject_type_id: input.subject_type_id,
    subject_id: input.subject_id,
    grade: input.grade,
    semester: input.semester,
    credit_hours: input.credit_hours,
    raw_score: input.raw_score ?? null,
    avg_score: input.avg_score ?? null,
    std_dev: input.std_dev ?? null,
    rank_grade: input.rank_grade ?? null,
    total_students: input.total_students ?? null,
  };

  const { data, error } = await supabase
    .from("student_internal_scores")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * 내신 성적 생성 (레거시)
 * @deprecated insertInternalScore를 사용하세요
 */
export async function insertSchoolScore(
  input: CreateSchoolScoreInput
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: input.tenant_id ?? null,
    student_id: input.student_id,
    grade: input.grade,
    semester: input.semester,
    subject_group_id: input.subject_group_id ?? null,
    subject_id: input.subject_id ?? null,
    subject_type_id: input.subject_type_id ?? null,
    subject_group: input.subject_group ?? null,
    subject_type: input.subject_type ?? null,
    subject_name: input.subject_name ?? null,
    credit_hours: input.credit_hours ?? null,
    raw_score: input.raw_score ?? null,
    subject_average: input.subject_average ?? null,
    standard_deviation: input.standard_deviation ?? null,
    grade_score: input.grade_score ?? null,
    total_students: input.total_students ?? null,
    rank_grade: input.rank_grade ?? null,
  };

  const { data, error } = await supabase
    .from("student_school_scores")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * 내신 성적 수정
 */
export async function updateSchoolScoreById(
  scoreId: string,
  studentId: string,
  updates: UpdateSchoolScoreInput
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};

  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.semester !== undefined) payload.semester = updates.semester;
  if (updates.subject_group_id !== undefined)
    payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_id !== undefined)
    payload.subject_id = updates.subject_id;
  if (updates.subject_type_id !== undefined)
    payload.subject_type_id = updates.subject_type_id;
  if (updates.subject_group !== undefined)
    payload.subject_group = updates.subject_group;
  if (updates.subject_type !== undefined)
    payload.subject_type = updates.subject_type;
  if (updates.subject_name !== undefined)
    payload.subject_name = updates.subject_name;
  if (updates.credit_hours !== undefined)
    payload.credit_hours = updates.credit_hours;
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.subject_average !== undefined)
    payload.subject_average = updates.subject_average;
  if (updates.standard_deviation !== undefined)
    payload.standard_deviation = updates.standard_deviation;
  if (updates.grade_score !== undefined)
    payload.grade_score = updates.grade_score;
  if (updates.total_students !== undefined)
    payload.total_students = updates.total_students;
  if (updates.rank_grade !== undefined)
    payload.rank_grade = updates.rank_grade;

  const { error } = await supabase
    .from("student_school_scores")
    .update(payload)
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error) throw error;
}

/**
 * 내신 성적 삭제
 */
export async function deleteSchoolScoreById(
  scoreId: string,
  studentId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_school_scores")
    .delete()
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error) throw error;
}

// ============================================
// 모의고사 성적 Repository
// ============================================

/**
 * 모의고사 성적 목록 조회 (정규화 버전)
 */
export async function findMockScores(
  studentId: string,
  tenantId: string,
  filters?: GetMockScoresFilter
): Promise<MockScore[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("student_mock_scores")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (filters?.grade) {
    query = query.eq("grade", filters.grade);
  }

  if (filters?.examTitle) {
    query = query.eq("exam_title", filters.examTitle);
  }

  if (filters?.examDate) {
    query = query.eq("exam_date", filters.examDate);
  }

  if (filters?.subjectGroupId) {
    query = query.eq("subject_group_id", filters.subjectGroupId);
  }

  const { data, error } = await query
    .order("exam_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as MockScore[]) ?? [];
}

/**
 * 모의고사 성적 단건 조회
 */
export async function findMockScoreById(
  scoreId: string,
  studentId: string
): Promise<MockScore | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_mock_scores")
    .select("*")
    .eq("id", scoreId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data as MockScore | null;
}

/**
 * 모의고사 성적 생성 (정규화 버전)
 * 
 * student_terms를 조회/생성하여 student_term_id를 세팅합니다.
 * exam_date를 기준으로 학년도와 학기를 계산합니다.
 */
export async function insertMockScore(
  input: CreateMockScoreInput & { curriculum_revision_id: string; semester?: number }
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  // exam_date를 기준으로 학년도 계산
  const examDate = new Date(input.exam_date);
  const school_year = calculateSchoolYear(examDate);

  // 학기 계산 (없으면 exam_date 기준으로 추정: 3~8월 = 1학기, 9~2월 = 2학기)
  const semester = input.semester ?? (examDate.getMonth() + 1 >= 3 && examDate.getMonth() + 1 <= 8 ? 1 : 2);

  // student_term 조회 또는 생성 (실패 시 NULL 허용)
  let student_term_id: string | null = null;
  try {
    student_term_id = await getOrCreateStudentTerm({
      tenant_id: input.tenant_id,
      student_id: input.student_id,
      school_year,
      grade: input.grade,
      semester,
      curriculum_revision_id: input.curriculum_revision_id,
    });
  } catch (error) {
    // 모의고사 성적의 경우 student_term_id가 없어도 저장 가능
    console.warn("[domains/score/repository] student_term 조회/생성 실패 (NULL로 저장)", error);
    // student_term_id는 null로 유지
  }

  const payload = {
    tenant_id: input.tenant_id,
    student_id: input.student_id,
    student_term_id: student_term_id ?? null, // student_term_id (nullable)
    exam_date: input.exam_date,
    exam_title: input.exam_title,
    grade: input.grade,
    subject_id: input.subject_id,
    subject_group_id: input.subject_group_id,
    raw_score: input.raw_score ?? null,
    standard_score: input.standard_score ?? null,
    percentile: input.percentile ?? null,
    grade_score: input.grade_score ?? null,
  };

  const { data, error } = await supabase
    .from("student_mock_scores")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * 모의고사 성적 수정
 */
export async function updateMockScoreById(
  scoreId: string,
  studentId: string,
  updates: UpdateMockScoreInput
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};

  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.exam_type !== undefined) payload.exam_type = updates.exam_type;
  if (updates.subject_group_id !== undefined)
    payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_id !== undefined)
    payload.subject_id = updates.subject_id;
  if (updates.subject_type_id !== undefined)
    payload.subject_type_id = updates.subject_type_id;
  if (updates.subject_group !== undefined)
    payload.subject_group = updates.subject_group;
  if (updates.subject_name !== undefined)
    payload.subject_name = updates.subject_name;
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.standard_score !== undefined)
    payload.standard_score = updates.standard_score;
  if (updates.percentile !== undefined)
    payload.percentile = updates.percentile;
  if (updates.grade_score !== undefined)
    payload.grade_score = updates.grade_score;
  if (updates.exam_round !== undefined)
    payload.exam_round = updates.exam_round;

  const { error } = await supabase
    .from("student_mock_scores")
    .update(payload)
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error) throw error;
}

/**
 * 모의고사 성적 삭제
 */
export async function deleteMockScoreById(
  scoreId: string,
  studentId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_mock_scores")
    .delete()
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error) throw error;
}

