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

// 레거시 타입 (하위 호환성 유지 - 필요시에만 사용)
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
    const errorMessage =
      error instanceof Error ? error.message : "student_term 조회/생성 실패";
    handleQueryError(error as unknown, {
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
    handleQueryError(error as unknown, {
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
