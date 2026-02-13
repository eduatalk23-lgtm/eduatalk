/**
 * 학생 성적 데이터 접근 레이어
 * 
 * 내신 성적(student_internal_scores)과 모의고사 성적(student_mock_scores)을 관리합니다.
 * typedQueryBuilder 패턴을 사용하여 타입 안전성과 에러 처리를 표준화합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrCreateStudentTerm,
  calculateSchoolYear,
} from "@/lib/data/studentTerms";
import { createTypedQuery } from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * 에러를 PostgrestError로 변환하는 헬퍼 함수
 */
function toPostgrestError(error: unknown): PostgrestError | null {
  if (!error) return null;
  if (typeof error === 'object' && 'code' in error) {
    return {
      message: (error as { message?: string }).message || 'Unknown error',
      details: (error as { details?: string }).details || null,
      hint: (error as { hint?: string }).hint || null,
      code: (error as { code?: string }).code || '',
    } as unknown as PostgrestError;
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      details: null,
      hint: null,
      code: '',
    } as unknown as PostgrestError;
  }
  return null;
}
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/data/core/types";

// Database 타입에서 테이블 타입 추출
type InternalScoreRow = Database["public"]["Tables"]["student_internal_scores"]["Row"];
type InternalScoreInsert = Database["public"]["Tables"]["student_internal_scores"]["Insert"];
type InternalScoreUpdate = Database["public"]["Tables"]["student_internal_scores"]["Update"];

type MockScoreRow = Database["public"]["Tables"]["student_mock_scores"]["Row"];
type MockScoreInsert = Database["public"]["Tables"]["student_mock_scores"]["Insert"];
type MockScoreUpdate = Database["public"]["Tables"]["student_mock_scores"]["Update"];

// 내신 성적 타입 (Database 타입과 동일)
export type InternalScore = InternalScoreRow;

// 모의고사 성적 타입 (Database 타입과 동일)
export type MockScore = MockScoreRow;

// ============================================
// 레거시 타입 (Deprecated - 하위 호환성 유지)
// ============================================

/**
 * @deprecated InternalScore를 사용하세요
 * 
 * 이 타입은 하위 호환성을 위해 유지되지만, 새로운 코드에서는 사용하지 마세요.
 * 대신 `InternalScore` 타입을 사용하세요.
 * 
 * @see InternalScore
 */
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

/**
 * 내신 성적 목록 조회 (정규화 버전)
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param filters - 필터 옵션
 * @returns 내신 성적 목록
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

  const result = await createTypedQuery<InternalScore[]>(
    async () => {
      let query = supabase
        .from("student_internal_scores")
        .select("*")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId);

      if (filters?.grade !== undefined) {
        query = query.eq("grade", filters.grade);
      }

      if (filters?.semester !== undefined) {
        query = query.eq("semester", filters.semester);
      }

      if (filters?.subjectGroupId) {
        query = query.eq("subject_group_id", filters.subjectGroupId);
      }

      return await query
        .order("grade", { ascending: true })
        .order("semester", { ascending: true })
        .order("created_at", { ascending: false });
    },
    {
      context: "[data/studentScores] getInternalScores",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 모의고사 성적 목록 조회 (정규화 버전)
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param filters - 필터 옵션
 * @returns 모의고사 성적 목록
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

  const result = await createTypedQuery<MockScore[]>(
    async () => {
      let query = supabase
        .from("student_mock_scores")
        .select("*")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId);

      if (filters?.grade !== undefined) {
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

      return await query
        .order("exam_date", { ascending: false })
        .order("created_at", { ascending: false });
    },
    {
      context: "[data/studentScores] getMockScores",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 내신 성적 생성 (정규화 버전)
 *
 * student_terms를 조회/생성하여 student_term_id를 세팅합니다.
 * 
 * @param score - 내신 성적 데이터
 * @returns 생성 결과
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
  achievement_level?: string | null;
  achievement_ratio_a?: number | null;
  achievement_ratio_b?: number | null;
  achievement_ratio_c?: number | null;
  achievement_ratio_d?: number | null;
  achievement_ratio_e?: number | null;
  class_rank?: number | null;
  school_year?: number;
  estimated_percentile?: number | null;
  estimated_std_dev?: number | null;
  converted_grade_9?: number | null;
  adjusted_grade?: number | null;
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
    const errorMessage =
      error instanceof Error ? error.message : "student_term 조회/생성 실패";
    handleQueryError(toPostgrestError(error), {
      context: "[data/studentScores] createInternalScore - student_term",
    });
    return {
      success: false,
      error: errorMessage,
    };
  }

  const payload: InternalScoreInsert = {
    tenant_id: score.tenant_id,
    student_id: score.student_id,
    student_term_id,
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
    achievement_level: score.achievement_level ?? null,
    achievement_ratio_a: score.achievement_ratio_a ?? null,
    achievement_ratio_b: score.achievement_ratio_b ?? null,
    achievement_ratio_c: score.achievement_ratio_c ?? null,
    achievement_ratio_d: score.achievement_ratio_d ?? null,
    achievement_ratio_e: score.achievement_ratio_e ?? null,
    class_rank: score.class_rank ?? null,
    estimated_percentile: score.estimated_percentile ?? null,
    estimated_std_dev: score.estimated_std_dev ?? null,
    converted_grade_9: score.converted_grade_9 ?? null,
    adjusted_grade: score.adjusted_grade ?? null,
  };

  const result = await createTypedQuery<{ id: string }>(
    async () => {
      return await supabase
        .from("student_internal_scores")
        .insert(payload)
        .select("id")
        .single();
    },
    {
      context: "[data/studentScores] createInternalScore",
      defaultValue: null,
    }
  );

  if (!result) {
    return {
      success: false,
      error: "내신 성적 생성에 실패했습니다.",
    };
  }

  return { success: true, scoreId: result.id };
}

/**
 * 내신 성적 업데이트 (정규화 버전)
 * 
 * @param scoreId - 성적 ID
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param updates - 업데이트할 필드
 * @returns 업데이트 결과
 */
export async function updateInternalScore(
  scoreId: string,
  studentId: string,
  tenantId: string,
  updates: Partial<
    Omit<
      InternalScore,
      "id" | "student_id" | "tenant_id" | "created_at" | "updated_at"
    >
  >
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: InternalScoreUpdate = {};
  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.semester !== undefined) payload.semester = updates.semester;
  if (updates.student_term_id !== undefined)
    payload.student_term_id = updates.student_term_id;
  if (updates.curriculum_revision_id !== undefined)
    payload.curriculum_revision_id = updates.curriculum_revision_id;
  if (updates.subject_group_id !== undefined)
    payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_type_id !== undefined)
    payload.subject_type_id = updates.subject_type_id;
  if (updates.subject_id !== undefined) payload.subject_id = updates.subject_id;
  if (updates.credit_hours !== undefined)
    payload.credit_hours = updates.credit_hours;
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.avg_score !== undefined) payload.avg_score = updates.avg_score;
  if (updates.std_dev !== undefined) payload.std_dev = updates.std_dev;
  if (updates.rank_grade !== undefined)
    payload.rank_grade = updates.rank_grade;
  if (updates.total_students !== undefined)
    payload.total_students = updates.total_students;
  if (updates.achievement_level !== undefined)
    payload.achievement_level = updates.achievement_level;
  if (updates.achievement_ratio_a !== undefined)
    payload.achievement_ratio_a = updates.achievement_ratio_a;
  if (updates.achievement_ratio_b !== undefined)
    payload.achievement_ratio_b = updates.achievement_ratio_b;
  if (updates.achievement_ratio_c !== undefined)
    payload.achievement_ratio_c = updates.achievement_ratio_c;
  if (updates.achievement_ratio_d !== undefined)
    payload.achievement_ratio_d = updates.achievement_ratio_d;
  if (updates.achievement_ratio_e !== undefined)
    payload.achievement_ratio_e = updates.achievement_ratio_e;
  if (updates.class_rank !== undefined)
    payload.class_rank = updates.class_rank;
  if (updates.estimated_percentile !== undefined)
    payload.estimated_percentile = updates.estimated_percentile;
  if (updates.estimated_std_dev !== undefined)
    payload.estimated_std_dev = updates.estimated_std_dev;
  if (updates.converted_grade_9 !== undefined)
    payload.converted_grade_9 = updates.converted_grade_9;
  if (updates.adjusted_grade !== undefined)
    payload.adjusted_grade = updates.adjusted_grade;

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("student_internal_scores")
        .update(payload)
        .eq("id", scoreId)
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId);
    },
    {
      context: "[data/studentScores] updateInternalScore",
      defaultValue: null,
    }
  );

  // update 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
  return { success: true };
}

/**
 * 내신 성적 삭제 (정규화 버전)
 * 
 * @param scoreId - 성적 ID
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @returns 삭제 결과
 */
export async function deleteInternalScore(
  scoreId: string,
  studentId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("student_internal_scores")
        .delete()
        .eq("id", scoreId)
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId);
    },
    {
      context: "[data/studentScores] deleteInternalScore",
      defaultValue: null,
    }
  );

  // delete 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
  return { success: true };
}

/**
 * 모의고사 성적 생성 (정규화 버전)
 *
 * student_terms를 조회/생성하여 student_term_id를 세팅합니다.
 * exam_date를 기준으로 학년도와 학기를 계산합니다.
 * 
 * @param score - 모의고사 성적 데이터
 * @returns 생성 결과
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
    handleQueryError(toPostgrestError(error), {
      context: "[data/studentScores] createMockScore - student_term (nullable)",
      logError: false, // 경고만 표시
    });
    // student_term_id는 null로 유지
  }

  const payload: MockScoreInsert = {
    tenant_id: score.tenant_id,
    student_id: score.student_id,
    student_term_id: student_term_id ?? null,
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

  const result = await createTypedQuery<{ id: string }>(
    async () => {
      return await supabase
        .from("student_mock_scores")
        .insert(payload)
        .select("id")
        .single();
    },
    {
      context: "[data/studentScores] createMockScore",
      defaultValue: null,
    }
  );

  if (!result) {
    return {
      success: false,
      error: "모의고사 성적 생성에 실패했습니다.",
    };
  }

  return { success: true, scoreId: result.id };
}

/**
 * 모의고사 성적 업데이트
 * 
 * @param scoreId - 성적 ID
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param updates - 업데이트할 필드
 * @returns 업데이트 결과
 */
export async function updateMockScore(
  scoreId: string,
  studentId: string,
  tenantId: string,
  updates: Partial<
    Omit<MockScore, "id" | "student_id" | "tenant_id" | "created_at" | "updated_at">
  >
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: MockScoreUpdate = {};
  if (updates.grade !== undefined) payload.grade = updates.grade;
  if (updates.student_term_id !== undefined)
    payload.student_term_id = updates.student_term_id;
  if (updates.exam_date !== undefined) payload.exam_date = updates.exam_date;
  if (updates.exam_title !== undefined) payload.exam_title = updates.exam_title;
  if (updates.subject_group_id !== undefined)
    payload.subject_group_id = updates.subject_group_id;
  if (updates.subject_id !== undefined) payload.subject_id = updates.subject_id;
  if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
  if (updates.standard_score !== undefined)
    payload.standard_score = updates.standard_score;
  if (updates.percentile !== undefined) payload.percentile = updates.percentile;
  if (updates.grade_score !== undefined)
    payload.grade_score = updates.grade_score;

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("student_mock_scores")
        .update(payload)
        .eq("id", scoreId)
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId);
    },
    {
      context: "[data/studentScores] updateMockScore",
      defaultValue: null,
    }
  );

  // update 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
  return { success: true };
}

/**
 * 모의고사 성적 삭제
 * 
 * @param scoreId - 성적 ID
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @returns 삭제 결과
 */
export async function deleteMockScore(
  scoreId: string,
  studentId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<null>(
    async () => {
      return await supabase
        .from("student_mock_scores")
        .delete()
        .eq("id", scoreId)
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId);
    },
    {
      context: "[data/studentScores] deleteMockScore",
      defaultValue: null,
    }
  );

  // delete 쿼리는 data가 null이어도 성공일 수 있음
  // error가 없으면 성공으로 간주
  return { success: true };
}

/**
 * 내신 성적 일괄 생성
 * 
 * @param scores - 내신 성적 배열
 * @param commonFields - 공통 필드 (tenant_id, student_id, curriculum_revision_id, school_year)
 * @returns 생성 결과
 */
export async function createInternalScoresBatch(
  scores: Array<{
    subject_group_id: string;
    subject_id: string;
    subject_type_id: string;
    grade: number;
    semester: number;
    credit_hours: number;
    rank_grade: number | null;
    raw_score?: number | null;
    avg_score?: number | null;
    std_dev?: number | null;
    total_students?: number | null;
    achievement_level?: string | null;
    achievement_ratio_a?: number | null;
    achievement_ratio_b?: number | null;
    achievement_ratio_c?: number | null;
    achievement_ratio_d?: number | null;
    achievement_ratio_e?: number | null;
    class_rank?: number | null;
    estimated_percentile?: number | null;
    estimated_std_dev?: number | null;
    converted_grade_9?: number | null;
    adjusted_grade?: number | null;
  }>,
  commonFields: {
    tenant_id: string;
    student_id: string;
    curriculum_revision_id: string;
    school_year?: number;
  }
): Promise<{ success: boolean; scores?: InternalScore[]; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (scores.length === 0) {
    return {
      success: false,
      error: "성적 데이터가 없습니다.",
    };
  }

  const school_year = commonFields.school_year ?? calculateSchoolYear();

  // 각 성적별로 student_term_id 조회/생성 및 저장
  const insertedScores: InternalScoreInsert[] = [];

  for (const score of scores) {
    // student_term_id 조회/생성
    let student_term_id: string;
    try {
      student_term_id = await getOrCreateStudentTerm({
        tenant_id: commonFields.tenant_id,
        student_id: commonFields.student_id,
        school_year,
        grade: score.grade,
        semester: score.semester,
        curriculum_revision_id: commonFields.curriculum_revision_id,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "student_term 조회/생성 실패";
      handleQueryError(toPostgrestError(error), {
        context: "[data/studentScores] createInternalScoresBatch - student_term",
      });
      return {
        success: false,
        error: errorMessage,
      };
    }

    insertedScores.push({
      tenant_id: commonFields.tenant_id,
      student_id: commonFields.student_id,
      student_term_id,
      curriculum_revision_id: commonFields.curriculum_revision_id,
      subject_group_id: score.subject_group_id,
      subject_type_id: score.subject_type_id,
      subject_id: score.subject_id,
      grade: score.grade,
      semester: score.semester,
      credit_hours: score.credit_hours,
      rank_grade: score.rank_grade,
      raw_score: score.raw_score ?? null,
      avg_score: score.avg_score ?? null,
      std_dev: score.std_dev ?? null,
      total_students: score.total_students ?? null,
      achievement_level: score.achievement_level ?? null,
      achievement_ratio_a: score.achievement_ratio_a ?? null,
      achievement_ratio_b: score.achievement_ratio_b ?? null,
      achievement_ratio_c: score.achievement_ratio_c ?? null,
      achievement_ratio_d: score.achievement_ratio_d ?? null,
      achievement_ratio_e: score.achievement_ratio_e ?? null,
      class_rank: score.class_rank ?? null,
      estimated_percentile: score.estimated_percentile ?? null,
      estimated_std_dev: score.estimated_std_dev ?? null,
      converted_grade_9: score.converted_grade_9 ?? null,
      adjusted_grade: score.adjusted_grade ?? null,
    });
  }

  // 일괄 upsert — 동일 학기+과목 조합이 이미 존재하면 업데이트
  const { data: insertedData, error: insertError } = await supabase
    .from("student_internal_scores")
    .upsert(insertedScores, {
      onConflict: "tenant_id,student_id,grade,semester,subject_id",
    })
    .select();

  if (insertError) {
    console.error("[data/studentScores] createInternalScoresBatch 실패:", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    return {
      success: false,
      error: `내신 성적 등록 실패: ${insertError.message}`,
    };
  }

  if (!insertedData || insertedData.length === 0) {
    return {
      success: false,
      error: "내신 성적 등록에 실패했습니다 (데이터 반환 없음).",
    };
  }

  return { success: true, scores: insertedData as InternalScore[] };
}

/**
 * 모의고사 성적 일괄 생성
 * 
 * @param scores - 모의고사 성적 배열
 * @param commonFields - 공통 필드 (tenant_id, student_id, curriculum_revision_id)
 * @returns 생성 결과
 */
export async function createMockScoresBatch(
  scores: Array<{
    exam_date: string;
    exam_title: string;
    grade: number;
    subject_id: string;
    subject_group_id: string;
    grade_score: number;
    standard_score?: number | null;
    percentile?: number | null;
    raw_score?: number | null;
  }>,
  commonFields: {
    tenant_id: string;
    student_id: string;
    curriculum_revision_id: string;
  }
): Promise<{ success: boolean; scores?: MockScore[]; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (scores.length === 0) {
    return {
      success: false,
      error: "성적 데이터가 없습니다.",
    };
  }

  // 각 성적별로 student_term_id 조회 및 저장
  const insertedScores: MockScoreInsert[] = [];

  for (const score of scores) {
    // 시험일로부터 학년도 계산
    const examDate = new Date(score.exam_date);
    const school_year = calculateSchoolYear(examDate);

    // student_term_id 조회 (모의고사는 학기 정보가 없을 수 있으므로 nullable)
    let student_term_id: string | null = null;
    try {
      const { getStudentTerm } = await import("@/lib/data/studentTerms");
      const term = await getStudentTerm({
        tenant_id: commonFields.tenant_id,
        student_id: commonFields.student_id,
        school_year,
        grade: score.grade,
        semester: 1, // 기본값으로 1학기
      });
      if (term) {
        student_term_id = term.id;
      }
    } catch (error) {
      // 모의고사 성적의 경우 student_term_id가 없어도 저장 가능
      // 에러는 무시하고 계속 진행
    }

    insertedScores.push({
      tenant_id: commonFields.tenant_id,
      student_id: commonFields.student_id,
      student_term_id,
      exam_date: score.exam_date,
      exam_title: score.exam_title,
      grade: score.grade,
      subject_id: score.subject_id,
      subject_group_id: score.subject_group_id,
      grade_score: score.grade_score,
      standard_score: score.standard_score ?? null,
      percentile: score.percentile ?? null,
      raw_score: score.raw_score ?? null,
    });
  }

  // 일괄 삽입
  const result = await createTypedQuery<MockScore[]>(
    async () => {
      return await supabase
        .from("student_mock_scores")
        .insert(insertedScores)
        .select();
    },
    {
      context: "[data/studentScores] createMockScoresBatch",
      defaultValue: [],
    }
  );

  if (!result || result.length === 0) {
    return {
      success: false,
      error: "모의고사 성적 등록에 실패했습니다.",
    };
  }

  return { success: true, scores: result };
}
