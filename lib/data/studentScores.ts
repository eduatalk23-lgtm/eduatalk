import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrCreateStudentTerm,
  calculateSchoolYear,
} from "@/lib/data/studentTerms";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// 통합 성적 타입 (student_scores 테이블)
export type StudentScore = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  subject_type: string;
  semester?: string | null;
  course: string;
  course_detail: string;
  raw_score: number;
  grade: number;
  score_type_detail?: string | null;
  test_date?: string | null;
  created_at?: string | null;
};

// 내신 성적 타입 (정규화 버전)
export type InternalScore = {
  id: string;
  tenant_id: string;
  student_id: string;
  curriculum_revision_id: string;
  subject_group_id: string;
  subject_type_id: string;
  subject_id: string;
  grade: number;
  semester: number;
  credit_hours: number;
  raw_score: number | null;
  avg_score: number | null;
  std_dev: number | null;
  rank_grade: number | null;
  total_students: number | null;
  created_at: string;
  updated_at: string;
};

// 내신 성적 타입 (레거시 - 하위 호환성)
/** @deprecated InternalScore를 사용하세요 */
export type SchoolScore = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  grade: number;
  semester: number;
  // FK 필드 (새로운 방식)
  subject_group_id?: string | null;
  subject_id?: string | null;
  subject_type_id?: string | null;
  // Deprecated: 텍스트 필드 (하위 호환성 유지)
  /** @deprecated subject_group_id를 사용하세요 */
  subject_group?: string | null;
  /** @deprecated subject_type_id를 사용하세요 */
  subject_type?: string | null;
  /** @deprecated subject_id를 사용하세요 */
  subject_name?: string | null;
  credit_hours?: number | null;
  raw_score?: number | null;
  subject_average?: number | null;
  standard_deviation?: number | null;
  grade_score?: number | null;
  total_students?: number | null;
  rank_grade?: number | null;
  class_rank?: number | null;
  created_at?: string | null;
};

// 모의고사 성적 타입 (정규화 버전)
export type MockScore = {
  id: string;
  tenant_id: string;
  student_id: string;
  exam_date: string; // date 형식: YYYY-MM-DD
  exam_title: string;
  grade: number;
  subject_id: string;
  subject_group_id: string;
  standard_score: number | null;
  percentile: number | null;
  grade_score: number | null;
  raw_score: number | null;
  created_at: string;
  updated_at: string;
};

/**
 * 통합 성적 목록 조회 (레거시)
 *
 * ⚠️ 이 함수는 더 이상 존재하지 않는 student_scores 테이블을 참조합니다.
 * 
 * @deprecated getInternalScores와 getMockScores를 별도로 사용하거나, 
 * 통합 대시보드의 경우 fetchScoreDashboard API를 사용하세요.
 * 
 * 이 함수는 하위 호환성을 위해 유지되지만, student_internal_scores와 
 * student_mock_scores를 조합하여 반환합니다.
 */
export async function getStudentScores(
  studentId: string,
  tenantId?: string | null,
  filters?: {
    subjectType?: string;
    semester?: string;
    course?: string;
  }
): Promise<StudentScore[]> {
  console.warn(
    "[DEPRECATED] getStudentScores는 더 이상 사용되지 않습니다. getInternalScores, getMockScores 또는 fetchScoreDashboard API를 사용하세요."
  );

  // student_scores 테이블이 더 이상 존재하지 않으므로 빈 배열 반환
  // 실제로는 getInternalScores와 getMockScores를 조합하여 사용해야 함
  console.warn(
    "[DEPRECATED] student_scores 테이블은 student_internal_scores와 student_mock_scores로 분리되었습니다."
  );
  
  return [];
}

/**
 * 통합 성적 생성
 */
export async function createStudentScore(score: {
  tenant_id?: string | null;
  student_id: string;
  subject_type: string;
  semester?: string | null;
  course: string;
  course_detail: string;
  raw_score: number;
  grade: number;
  score_type_detail?: string | null;
  test_date?: string | null;
}): Promise<{ success: boolean; scoreId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: score.tenant_id || null,
    student_id: score.student_id,
    subject_type: score.subject_type,
    semester: score.semester || null,
    course: score.course,
    course_detail: score.course_detail,
    raw_score: score.raw_score,
    grade: score.grade,
    score_type_detail: score.score_type_detail || null,
    test_date: score.test_date || null,
  };

  let { data, error } = await supabase
    .from("student_scores")
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === "42703") {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const {
      tenant_id: _tenantId,
      student_id: _studentId,
      ...fallbackPayload
    } = payload;
    ({ data, error } = await supabase
      .from("student_scores")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[data/studentScores] 통합 성적 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, scoreId: data?.id };
}

/**
 * 통합 성적 업데이트
 */
export async function updateStudentScore(
  scoreId: string,
  studentId: string,
  updates: Partial<Omit<StudentScore, "id" | "student_id" | "created_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.subject_type !== undefined)
    payload.subject_type = updates.subject_type;
  if (updates.semester !== undefined) payload.semester = updates.semester;
  if (updates.course !== undefined) payload.course = updates.course;
  if (updates.course_detail !== undefined)
    payload.course_detail = updates.course_detail;
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.score_type_detail !== undefined)
    payload.score_type_detail = updates.score_type_detail;
  if (updates.test_date !== undefined) payload.test_date = updates.test_date;

  let { error } = await supabase
    .from("student_scores")
    .update(payload)
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase
      .from("student_scores")
      .update(payload)
      .eq("id", scoreId));
  }

  if (error) {
    console.error("[data/studentScores] 통합 성적 업데이트 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 통합 성적 삭제
 */
export async function deleteStudentScore(
  scoreId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  let { error } = await supabase
    .from("student_scores")
    .delete()
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase
      .from("student_scores")
      .delete()
      .eq("id", scoreId));
  }

  if (error) {
    console.error("[data/studentScores] 통합 성적 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 내신 성적 목록 조회 (정규화 버전)
 */
export async function getInternalScores(
  studentId: string,
  tenantId: string,
  filters?: {
    grade?: number;
    semester?: number;
    subjectGroupId?: string;
  }
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

  if (error) {
    console.error("[data/studentScores] 내신 성적 조회 실패", error);
    return [];
  }

  return (data as InternalScore[] | null) ?? [];
}

/**
 * 내신 성적 목록 조회 (레거시)
 *
 * ⚠️ 이 함수는 더 이상 존재하지 않는 student_school_scores 테이블을 참조합니다.
 *
 * @deprecated getInternalScores를 사용하거나, 통합 대시보드의 경우 fetchScoreDashboard API를 사용하세요.
 */
export async function getSchoolScores(
  studentId: string,
  tenantId?: string | null,
  filters?: {
    grade?: number;
    semester?: number;
    subjectGroup?: string;
  }
): Promise<SchoolScore[]> {
  console.warn(
    "[DEPRECATED] getSchoolScores는 더 이상 사용되지 않습니다. getInternalScores 또는 fetchScoreDashboard API를 사용하세요."
  );

  const supabase = await createSupabaseServerClient();

  const selectScores = () =>
    supabase
      .from("student_internal_scores") // student_school_scores -> student_internal_scores
      .select("*")
      .eq("student_id", studentId);

  let query = selectScores();

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (filters?.grade) {
    query = query.eq("grade", filters.grade);
  }

  if (filters?.semester) {
    query = query.eq("semester", filters.semester);
  }

  if (filters?.subjectGroup) {
    query = query.eq("subject_group", filters.subjectGroup);
  }

  query = query
    .order("grade", { ascending: true })
    .order("semester", { ascending: true })
    .order("created_at", { ascending: false });

  let { data, error } = await query;

  if (error && error.code === "42703") {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    // ⚠️ student_school_scores는 student_internal_scores로 변경되었습니다.
    const fallbackQuery = supabase.from("student_internal_scores").select("*");

    if (filters?.grade) {
      fallbackQuery.eq("grade", filters.grade);
    }

    if (filters?.semester) {
      fallbackQuery.eq("semester", filters.semester);
    }

    if (filters?.subjectGroup) {
      fallbackQuery.eq("subject_group", filters.subjectGroup);
    }

    ({ data, error } = await fallbackQuery
      .order("grade", { ascending: true })
      .order("semester", { ascending: true })
      .order("created_at", { ascending: false }));
  }

  if (error) {
    console.error("[data/studentScores] 내신 성적 조회 실패", error);
    return [];
  }

  return (data as SchoolScore[] | null) ?? [];
}

/**
 * 모의고사 성적 목록 조회 (정규화 버전)
 */
export async function getMockScores(
  studentId: string,
  tenantId: string,
  filters?: {
    grade?: number;
    examTitle?: string;
    examDate?: string;
    subjectGroupId?: string;
  }
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

  if (error) {
    console.error("[data/studentScores] 모의고사 성적 조회 실패", error);
    return [];
  }

  return (data as MockScore[] | null) ?? [];
}

/**
 * 내신 성적 생성 (정규화 버전)
 *
 * student_terms를 조회/생성하여 student_term_id를 세팅합니다.
 */
export async function createInternalScore(score: {
  tenant_id: string;
  student_id: string;
  curriculum_revision_id: string;
  subject_group_id: string;
  subject_type_id: string;
  subject_id: string;
  grade: number;
  semester: number;
  credit_hours: number;
  raw_score?: number | null;
  avg_score?: number | null;
  std_dev?: number | null;
  rank_grade?: number | null;
  total_students?: number | null;
  school_year?: number; // 학년도 (선택사항, 없으면 현재 날짜 기준 계산)
}): Promise<{ success: boolean; scoreId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // school_year 계산 (없으면 현재 날짜 기준)
  const school_year = score.school_year ?? calculateSchoolYear();

  // student_term 조회 또는 생성
  let student_term_id: string;
  try {
    student_term_id = await getOrCreateStudentTerm({
      tenant_id: score.tenant_id,
      student_id: score.student_id,
      school_year,
      grade: score.grade,
      semester: score.semester,
      curriculum_revision_id: score.curriculum_revision_id,
    });
  } catch (error) {
    console.error("[data/studentScores] student_term 조회/생성 실패", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "student_term 조회/생성 실패",
    };
  }

  const payload = {
    tenant_id: score.tenant_id,
    student_id: score.student_id,
    student_term_id, // student_term_id 추가
    curriculum_revision_id: score.curriculum_revision_id,
    subject_group_id: score.subject_group_id,
    subject_type_id: score.subject_type_id,
    subject_id: score.subject_id,
    grade: score.grade,
    semester: score.semester,
    credit_hours: score.credit_hours,
    raw_score: score.raw_score ?? null,
    avg_score: score.avg_score ?? null,
    std_dev: score.std_dev ?? null,
    rank_grade: score.rank_grade ?? null,
    total_students: score.total_students ?? null,
  };

  const { data, error } = await supabase
    .from("student_internal_scores")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[data/studentScores] 내신 성적 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, scoreId: data?.id };
}

/**
 * 내신 성적 생성 (레거시)
 * @deprecated createInternalScore를 사용하세요
 */
export async function createSchoolScore(score: {
  tenant_id?: string | null;
  student_id: string;
  grade: number;
  semester: number;
  // FK 필드 (우선 사용)
  subject_group_id?: string | null;
  subject_id?: string | null;
  subject_type_id?: string | null;
  // 하위 호환성을 위한 텍스트 필드 (deprecated)
  subject_group?: string | null;
  subject_type?: string | null;
  subject_name?: string | null;
  credit_hours?: number | null;
  raw_score?: number | null;
  subject_average?: number | null;
  standard_deviation?: number | null;
  grade_score?: number | null;
  total_students?: number | null;
  rank_grade?: number | null;
}): Promise<{ success: boolean; scoreId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {
    tenant_id: score.tenant_id || null,
    student_id: score.student_id,
    grade: score.grade,
    semester: score.semester,
    // FK 필드 (우선 사용)
    subject_group_id: score.subject_group_id || null,
    subject_id: score.subject_id || null,
    subject_type_id: score.subject_type_id || null,
    // 하위 호환성을 위한 텍스트 필드 (deprecated)
    subject_group: score.subject_group || null,
    subject_type: score.subject_type || null,
    subject_name: score.subject_name || null,
    credit_hours: score.credit_hours || null,
    raw_score: score.raw_score || null,
    subject_average: score.subject_average || null,
    standard_deviation: score.standard_deviation || null,
    grade_score: score.grade_score || null,
    total_students: score.total_students || null,
    rank_grade: score.rank_grade || null,
  };

  let { data, error } = await supabase
    .from("student_school_scores")
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === "42703") {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const {
      tenant_id: _tenantId,
      student_id: _studentId,
      ...fallbackPayload
    } = payload;
    ({ data, error } = await supabase
      .from("student_school_scores")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[data/studentScores] 내신 성적 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, scoreId: data?.id };
}

/**
 * 내신 성적 업데이트 (정규화 버전)
 */
export async function updateInternalScore(
  scoreId: string,
  studentId: string,
  tenantId: string,
  updates: Partial<Omit<InternalScore, "id" | "student_id" | "tenant_id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};
  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.semester !== undefined) payload.semester = updates.semester;
  if (updates.curriculum_revision_id !== undefined) payload.curriculum_revision_id = updates.curriculum_revision_id;
  if (updates.subject_group_id !== undefined) payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_type_id !== undefined) payload.subject_type_id = updates.subject_type_id;
  if (updates.subject_id !== undefined) payload.subject_id = updates.subject_id;
  if (updates.credit_hours !== undefined) payload.credit_hours = updates.credit_hours;
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.avg_score !== undefined) payload.avg_score = updates.avg_score;
  if (updates.std_dev !== undefined) payload.std_dev = updates.std_dev;
  if (updates.rank_grade !== undefined) payload.rank_grade = updates.rank_grade;
  if (updates.total_students !== undefined) payload.total_students = updates.total_students;

  const { error } = await supabase
    .from("student_internal_scores")
    .update(payload)
    .eq("id", scoreId)
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[data/studentScores] 내신 성적 업데이트 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 내신 성적 삭제 (정규화 버전)
 */
export async function deleteInternalScore(
  scoreId: string,
  studentId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("student_internal_scores")
    .delete()
    .eq("id", scoreId)
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[data/studentScores] 내신 성적 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 모의고사 성적 생성 (정규화 버전)
 *
 * student_terms를 조회/생성하여 student_term_id를 세팅합니다.
 * exam_date를 기준으로 학년도와 학기를 계산합니다.
 */
export async function createMockScore(score: {
  tenant_id: string;
  student_id: string;
  exam_date: string; // date 형식: YYYY-MM-DD
  exam_title: string;
  grade: number;
  subject_id: string;
  subject_group_id: string;
  curriculum_revision_id: string; // student_term 생성에 필요
  raw_score?: number | null;
  standard_score?: number | null;
  percentile?: number | null;
  grade_score?: number | null;
  semester?: number; // 학기 (선택사항, 없으면 exam_date 기준으로 추정)
}): Promise<{ success: boolean; scoreId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // exam_date를 기준으로 학년도 계산
  const examDate = new Date(score.exam_date);
  const school_year = calculateSchoolYear(examDate);

  // 학기 계산 (없으면 exam_date 기준으로 추정: 3~8월 = 1학기, 9~2월 = 2학기)
  const semester =
    score.semester ??
    (examDate.getMonth() + 1 >= 3 && examDate.getMonth() + 1 <= 8 ? 1 : 2);

  // student_term 조회 또는 생성 (실패 시 NULL 허용)
  let student_term_id: string | null = null;
  try {
    student_term_id = await getOrCreateStudentTerm({
      tenant_id: score.tenant_id,
      student_id: score.student_id,
      school_year,
      grade: score.grade,
      semester,
      curriculum_revision_id: score.curriculum_revision_id,
    });
  } catch (error) {
    // 모의고사 성적의 경우 student_term_id가 없어도 저장 가능
    console.warn(
      "[data/studentScores] student_term 조회/생성 실패 (NULL로 저장)",
      error
    );
    // student_term_id는 null로 유지
  }

  const payload = {
    tenant_id: score.tenant_id,
    student_id: score.student_id,
    student_term_id: student_term_id ?? null, // student_term_id (nullable)
    exam_date: score.exam_date,
    exam_title: score.exam_title,
    grade: score.grade,
    subject_id: score.subject_id,
    subject_group_id: score.subject_group_id,
    raw_score: score.raw_score ?? null,
    standard_score: score.standard_score ?? null,
    percentile: score.percentile ?? null,
    grade_score: score.grade_score ?? null,
  };

  const { data, error } = await supabase
    .from("student_mock_scores")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[data/studentScores] 모의고사 성적 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, scoreId: data?.id };
}

/**
 * 내신 성적 업데이트
 */
export async function updateSchoolScore(
  scoreId: string,
  studentId: string,
  updates: Partial<Omit<SchoolScore, "id" | "student_id" | "created_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.semester !== undefined) payload.semester = updates.semester;
  // FK 필드 (우선 사용)
  if (updates.subject_group_id !== undefined)
    payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_id !== undefined) payload.subject_id = updates.subject_id;
  if (updates.subject_type_id !== undefined)
    payload.subject_type_id = updates.subject_type_id;
  // 하위 호환성을 위한 텍스트 필드 (deprecated)
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
  if (updates.rank_grade !== undefined) payload.rank_grade = updates.rank_grade;

  let { error } = await supabase
    .from("student_school_scores")
    .update(payload)
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase
      .from("student_school_scores")
      .update(payload)
      .eq("id", scoreId));
  }

  if (error) {
    console.error("[data/studentScores] 내신 성적 업데이트 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 모의고사 성적 업데이트
 */
export async function updateMockScore(
  scoreId: string,
  studentId: string,
  updates: Partial<Omit<MockScore, "id" | "student_id" | "created_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.grade !== undefined) payload.grade = updates.grade;
  // FK 필드 (우선 사용)
  if (updates.subject_group_id !== undefined)
    payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_id !== undefined) payload.subject_id = updates.subject_id;
  // 하위 호환성을 위한 텍스트 필드 (deprecated) - 제거됨
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.standard_score !== undefined)
    payload.standard_score = updates.standard_score;
  if (updates.percentile !== undefined) payload.percentile = updates.percentile;
  if (updates.grade_score !== undefined)
    payload.grade_score = updates.grade_score;

  let { error } = await supabase
    .from("student_mock_scores")
    .update(payload)
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase
      .from("student_mock_scores")
      .update(payload)
      .eq("id", scoreId));
  }

  if (error) {
    console.error("[data/studentScores] 모의고사 성적 업데이트 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 내신 성적 삭제
 */
export async function deleteSchoolScore(
  scoreId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  let { error } = await supabase
    .from("student_school_scores")
    .delete()
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase
      .from("student_school_scores")
      .delete()
      .eq("id", scoreId));
  }

  if (error) {
    console.error("[data/studentScores] 내신 성적 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 모의고사 성적 삭제
 */
export async function deleteMockScore(
  scoreId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  let { error } = await supabase
    .from("student_mock_scores")
    .delete()
    .eq("id", scoreId)
    .eq("student_id", studentId);

  if (error && error.code === "42703") {
    ({ error } = await supabase
      .from("student_mock_scores")
      .delete()
      .eq("id", scoreId));
  }

  if (error) {
    console.error("[data/studentScores] 모의고사 성적 삭제 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
