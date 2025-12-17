/**
 * 성적 상세 데이터 페칭 함수
 * 
 * 내신 및 모의고사 성적의 상세 정보를 조회합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import type { InternalScoreWithRelations, MockScoreWithRelations } from "@/lib/types/scoreAnalysis";

type InternalScore = Tables<"student_internal_scores">;
type MockScore = Tables<"student_mock_scores">;

/**
 * 학기별 내신 성적 조회
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param grade - 학년 (선택사항)
 * @param semester - 학기 (선택사항)
 * @returns 내신 성적 배열
 */
export async function getInternalScoresByTerm(
  studentId: string,
  tenantId: string,
  grade?: number,
  semester?: number
): Promise<InternalScoreWithRelations[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("student_internal_scores")
    .select(`
      *,
      subject_group:subject_groups(name),
      subject:subjects(name),
      subject_type:subject_types(name)
    `)
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (grade !== undefined) {
    query = query.eq("grade", grade);
  }

  if (semester !== undefined) {
    query = query.eq("semester", semester);
  }

  const { data, error } = await query.order("grade", { ascending: true })
    .order("semester", { ascending: true })
    .order("created_at", { ascending: true });

  if (handleQueryError(error, {
    context: "[data/scoreDetails] 내신 성적 조회 실패",
    logError: true,
  })) {
    // 에러 상세 정보 추가 로깅
    if (error) {
      const errorDetails: Record<string, unknown> = {
        studentId,
        tenantId,
        grade,
        semester,
      };
      
      // 에러 정보 안전하게 추출
      if (error.message) errorDetails.errorMessage = error.message;
      if (error.code) errorDetails.errorCode = error.code;
      if ("details" in error && error.details) errorDetails.errorDetails = error.details;
      if ("hint" in error && error.hint) errorDetails.errorHint = error.hint;
      if ("statusCode" in error) {
        errorDetails.errorStatusCode = (error as { statusCode?: unknown }).statusCode;
      }
      
      // JSON 직렬화 시도
      try {
        errorDetails.errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch (e) {
        errorDetails.errorString = String(error);
      }
      
      console.error("[data/scoreDetails] 내신 성적 조회 상세 정보", errorDetails);
    }
    return [];
  }

  return ((data as any[]) || []).map((item: any) => ({
    ...item,
    subject_group: item.subject_group?.[0] || null,
    subject: item.subject?.[0] || null,
    subject_type: item.subject_type?.[0] || null,
  })) as MockScoreWithRelations[];
}

/**
 * 기간별 모의고사 성적 조회
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param startDate - 시작일 (YYYY-MM-DD, 선택사항)
 * @param endDate - 종료일 (YYYY-MM-DD, 선택사항)
 * @param grade - 학년 (선택사항)
 * @returns 모의고사 성적 배열
 */
export async function getMockScoresByPeriod(
  studentId: string,
  tenantId: string,
  startDate?: string,
  endDate?: string,
  grade?: number
): Promise<MockScoreWithRelations[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("student_mock_scores")
    .select(`
      *,
      subject_group:subject_groups(name),
      subject:subjects(name)
    `)
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (startDate) {
    query = query.gte("exam_date", startDate);
  }

  if (endDate) {
    query = query.lte("exam_date", endDate);
  }

  if (grade !== undefined) {
    query = query.eq("grade", grade);
  }

  const { data, error } = await query.order("exam_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (handleQueryError(error, {
    context: "[data/scoreDetails] 모의고사 성적 조회 실패",
    logError: true,
  })) {
    // 에러 상세 정보 추가 로깅
    if (error) {
      const errorDetails: Record<string, unknown> = {
        studentId,
        tenantId,
        startDate,
        endDate,
        grade,
      };
      
      // 에러 정보 안전하게 추출
      if (error.message) errorDetails.errorMessage = error.message;
      if (error.code) errorDetails.errorCode = error.code;
      if ("details" in error && error.details) errorDetails.errorDetails = error.details;
      if ("hint" in error && error.hint) errorDetails.errorHint = error.hint;
      if ("statusCode" in error) {
        errorDetails.errorStatusCode = (error as { statusCode?: unknown }).statusCode;
      }
      
      // JSON 직렬화 시도
      try {
        errorDetails.errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch (e) {
        errorDetails.errorString = String(error);
      }
      
      console.error("[data/scoreDetails] 모의고사 성적 조회 상세 정보", errorDetails);
    }
    return [];
  }

  return ((data as any[]) || []).map((item: any) => ({
    ...item,
    subject_group: item.subject_group?.[0] || null,
    subject: item.subject?.[0] || null,
    subject_type: item.subject_type?.[0] || null,
  })) as MockScoreWithRelations[];
}

/**
 * 최근 N개의 모의고사 시험 목록 조회
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param limit - 조회할 시험 개수 (기본값: 3)
 * @returns 시험 목록 (시험일, 시험명, 학년)
 */
export async function getRecentMockExams(
  studentId: string,
  tenantId: string,
  limit: number = 3
): Promise<Array<{
  exam_date: string;
  exam_title: string;
  grade: number;
}>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_mock_scores")
    .select("exam_date, exam_title, grade")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("exam_date", { ascending: false })
    .limit(limit);

  if (handleQueryError(error, {
    context: "[data/scoreDetails] 최근 모의고사 시험 목록 조회 실패",
    logError: true,
  })) {
    return [];
  }

  // 중복 제거 (같은 시험일, 시험명, 학년)
  const uniqueExams = Array.from(
    new Map(
      (data || []).map((exam) => [
        `${exam.exam_date}-${exam.exam_title}-${exam.grade}`,
        exam,
      ])
    ).values()
  );

  return uniqueExams;
}

/**
 * 특정 시험의 과목별 성적 조회
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param examDate - 시험일
 * @param examTitle - 시험명
 * @returns 과목별 성적 배열
 */
export async function getMockScoresByExam(
  studentId: string,
  tenantId: string,
  examDate: string,
  examTitle: string
): Promise<MockScoreWithRelations[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_mock_scores")
    .select(`
      *,
      subject_group:subject_groups(name),
      subject:subjects(name)
    `)
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("exam_date", examDate)
    .eq("exam_title", examTitle)
    .order("subject_group_id", { ascending: true });

  if (handleQueryError(error, {
    context: "[data/scoreDetails] 특정 시험 성적 조회 실패",
    logError: true,
  })) {
    return [];
  }

  return ((data as any[]) || []).map((item: any) => ({
    ...item,
    subject_group: item.subject_group?.[0] || null,
    subject: item.subject?.[0] || null,
    subject_type: item.subject_type?.[0] || null,
  })) as MockScoreWithRelations[];
}

/**
 * 교과군별 내신 성적 평균 계산
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param grade - 학년 (선택사항)
 * @param semester - 학기 (선택사항)
 * @returns 교과군별 평균 등급
 */
export async function getInternalAverageBySubjectGroup(
  studentId: string,
  tenantId: string,
  grade?: number,
  semester?: number
): Promise<Array<{
  subject_group_id: string;
  subject_group_name: string;
  average_grade: number;
  count: number;
}>> {
  const scores = await getInternalScoresByTerm(studentId, tenantId, grade, semester);

  // 교과군별로 그룹화
  const grouped = scores.reduce((acc, score) => {
    const groupId = score.subject_group_id;
    const groupName = score.subject_group?.name || "기타";

    if (!acc[groupId]) {
      acc[groupId] = {
        subject_group_id: groupId,
        subject_group_name: groupName,
        grades: [],
      };
    }

    if (score.rank_grade) {
      acc[groupId].grades.push(score.rank_grade);
    }

    return acc;
  }, {} as Record<string, { subject_group_id: string; subject_group_name: string; grades: number[] }>);

  // 평균 계산
  return Object.values(grouped).map((group) => ({
    subject_group_id: group.subject_group_id,
    subject_group_name: group.subject_group_name,
    average_grade: group.grades.reduce((sum, g) => sum + g, 0) / group.grades.length,
    count: group.grades.length,
  }));
}

/**
 * 과목별 모의고사 성적 추이
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param subjectId - 과목 ID
 * @param limit - 조회할 최근 시험 개수 (기본값: 5)
 * @returns 시험별 성적 배열
 */
export async function getMockTrendBySubject(
  studentId: string,
  tenantId: string,
  subjectId: string,
  limit: number = 5
): Promise<Array<{
  exam_date: string;
  exam_title: string;
  grade_score: number | null;
  standard_score: number | null;
  percentile: number | null;
}>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_mock_scores")
    .select("exam_date, exam_title, grade_score, standard_score, percentile")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("subject_id", subjectId)
    .order("exam_date", { ascending: false })
    .limit(limit);

  if (handleQueryError(error, {
    context: "[data/scoreDetails] 과목별 모의고사 추이 조회 실패",
    logError: true,
  })) {
    return [];
  }

  return (data || []).reverse(); // 시간순 정렬
}

