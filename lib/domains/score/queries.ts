/**
 * Score 도메인 데이터 조회 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  SchoolScore,
  MockScore,
  GetSchoolScoresFilter,
  GetMockScoresFilter,
  CreateSchoolScoreInput,
  UpdateSchoolScoreInput,
  CreateMockScoreInput,
  UpdateMockScoreInput,
  ScoreActionResult,
} from "./types";

// ============================================
// 내신 성적 조회
// ============================================

/**
 * 내신 성적 목록 조회
 */
export async function getSchoolScores(
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

  if (error) {
    console.error("[domains/score] 내신 성적 조회 실패:", error.message);
    return [];
  }

  return (data as SchoolScore[]) ?? [];
}

/**
 * 내신 성적 단건 조회
 */
export async function getSchoolScoreById(
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

  if (error) {
    console.error("[domains/score] 내신 성적 조회 실패:", error.message);
    return null;
  }

  return data as SchoolScore | null;
}

// ============================================
// 모의고사 성적 조회
// ============================================

/**
 * 모의고사 성적 목록 조회
 */
export async function getMockScores(
  studentId: string,
  tenantId?: string | null,
  filters?: GetMockScoresFilter
): Promise<MockScore[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("student_mock_scores")
    .select("*")
    .eq("student_id", studentId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (filters?.grade) {
    query = query.eq("grade", filters.grade);
  }

  if (filters?.examType) {
    query = query.eq("exam_type", filters.examType);
  }

  if (filters?.examRound) {
    query = query.eq("exam_round", filters.examRound);
  }

  if (filters?.subjectGroupId) {
    query = query.eq("subject_group_id", filters.subjectGroupId);
  } else if (filters?.subjectGroup) {
    query = query.eq("subject_group", filters.subjectGroup);
  }

  const { data, error } = await query
    .order("grade", { ascending: true })
    .order("exam_round", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[domains/score] 모의고사 성적 조회 실패:", error.message);
    return [];
  }

  return (data as MockScore[]) ?? [];
}

/**
 * 모의고사 성적 단건 조회
 */
export async function getMockScoreById(
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

  if (error) {
    console.error("[domains/score] 모의고사 성적 조회 실패:", error.message);
    return null;
  }

  return data as MockScore | null;
}

// ============================================
// 내신 성적 CUD
// ============================================

/**
 * 내신 성적 생성
 */
export async function createSchoolScore(
  input: CreateSchoolScoreInput
): Promise<ScoreActionResult> {
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

  if (error) {
    console.error("[domains/score] 내신 성적 생성 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, scoreId: data?.id };
}

/**
 * 내신 성적 수정
 */
export async function updateSchoolScore(
  scoreId: string,
  studentId: string,
  updates: UpdateSchoolScoreInput
): Promise<ScoreActionResult> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};
  
  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.semester !== undefined) payload.semester = updates.semester;
  if (updates.subject_group_id !== undefined) payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_id !== undefined) payload.subject_id = updates.subject_id;
  if (updates.subject_type_id !== undefined) payload.subject_type_id = updates.subject_type_id;
  if (updates.subject_group !== undefined) payload.subject_group = updates.subject_group;
  if (updates.subject_type !== undefined) payload.subject_type = updates.subject_type;
  if (updates.subject_name !== undefined) payload.subject_name = updates.subject_name;
  if (updates.credit_hours !== undefined) payload.credit_hours = updates.credit_hours;
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.subject_average !== undefined) payload.subject_average = updates.subject_average;
  if (updates.standard_deviation !== undefined) payload.standard_deviation = updates.standard_deviation;
  if (updates.grade_score !== undefined) payload.grade_score = updates.grade_score;
  if (updates.total_students !== undefined) payload.total_students = updates.total_students;
  if (updates.rank_grade !== undefined) payload.rank_grade = updates.rank_grade;

  const { error } = await supabase
    .from("student_school_scores")
    .update(payload)
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error) {
    console.error("[domains/score] 내신 성적 수정 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, scoreId };
}

/**
 * 내신 성적 삭제
 */
export async function deleteSchoolScore(
  scoreId: string,
  studentId: string
): Promise<ScoreActionResult> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_school_scores")
    .delete()
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error) {
    console.error("[domains/score] 내신 성적 삭제 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// 모의고사 성적 CUD
// ============================================

/**
 * 모의고사 성적 생성
 */
export async function createMockScore(
  input: CreateMockScoreInput
): Promise<ScoreActionResult> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: input.tenant_id ?? null,
    student_id: input.student_id,
    grade: input.grade,
    exam_type: input.exam_type,
    subject_group_id: input.subject_group_id ?? null,
    subject_id: input.subject_id ?? null,
    subject_type_id: input.subject_type_id ?? null,
    subject_group: input.subject_group ?? null,
    subject_name: input.subject_name ?? null,
    raw_score: input.raw_score ?? null,
    standard_score: input.standard_score ?? null,
    percentile: input.percentile ?? null,
    grade_score: input.grade_score ?? null,
    exam_round: input.exam_round ?? null,
  };

  const { data, error } = await supabase
    .from("student_mock_scores")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[domains/score] 모의고사 성적 생성 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, scoreId: data?.id };
}

/**
 * 모의고사 성적 수정
 */
export async function updateMockScore(
  scoreId: string,
  studentId: string,
  updates: UpdateMockScoreInput
): Promise<ScoreActionResult> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};
  
  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.exam_type !== undefined) payload.exam_type = updates.exam_type;
  if (updates.subject_group_id !== undefined) payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_id !== undefined) payload.subject_id = updates.subject_id;
  if (updates.subject_type_id !== undefined) payload.subject_type_id = updates.subject_type_id;
  if (updates.subject_group !== undefined) payload.subject_group = updates.subject_group;
  if (updates.subject_name !== undefined) payload.subject_name = updates.subject_name;
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.standard_score !== undefined) payload.standard_score = updates.standard_score;
  if (updates.percentile !== undefined) payload.percentile = updates.percentile;
  if (updates.grade_score !== undefined) payload.grade_score = updates.grade_score;
  if (updates.exam_round !== undefined) payload.exam_round = updates.exam_round;

  const { error } = await supabase
    .from("student_mock_scores")
    .update(payload)
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error) {
    console.error("[domains/score] 모의고사 성적 수정 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, scoreId };
}

/**
 * 모의고사 성적 삭제
 */
export async function deleteMockScore(
  scoreId: string,
  studentId: string
): Promise<ScoreActionResult> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_mock_scores")
    .delete()
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error) {
    console.error("[domains/score] 모의고사 성적 삭제 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

