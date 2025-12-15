/**
 * 성적 조회 쿼리 예시
 * 
 * 한 학기의 내신 + 모의고사 리스트를 조회하는 예시 쿼리입니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 한 학기의 내신 + 모의고사 성적 조회
 * 
 * student_terms를 기준으로 해당 학기의 내신 성적과 모의고사 성적을 함께 조회합니다.
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @param schoolYear - 학년도 (예: 2024)
 * @param grade - 학년 (1~3)
 * @param semester - 학기 (1~2)
 * @returns 내신 성적과 모의고사 성적 리스트
 */
export async function getTermScores(
  studentId: string,
  tenantId: string,
  schoolYear: number,
  grade: number,
  semester: number
): Promise<{
  term: Tables<"student_terms"> | null;
  internalScores: Array<Tables<"student_internal_scores"> & {
    subject: Tables<"subjects"> | null;
    subject_group: Tables<"subject_groups"> | null;
  }>;
  mockScores: Array<Tables<"student_mock_scores"> & {
    subject: Tables<"subjects"> | null;
    subject_group: Tables<"subject_groups"> | null;
  }>;
}> {
  const supabase = await createSupabaseServerClient();

  // 1. student_term 조회
  const { data: term, error: termError } = await supabase
    .from("student_terms")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("grade", grade)
    .eq("semester", semester)
    .maybeSingle();

  if (termError) {
    console.error("[data/scoreQueries] student_term 조회 실패", termError);
  }

  // 2. 내신 성적 조회 (student_term_id로 연결)
  const { data: internalScores, error: internalError } = await supabase
    .from("student_internal_scores")
    .select(`
      *,
      subject:subjects(*),
      subject_group:subject_groups(*)
    `)
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("grade", grade)
    .eq("semester", semester)
    .order("created_at", { ascending: false });

  if (internalError) {
    console.error("[data/scoreQueries] 내신 성적 조회 실패", internalError);
  }

  // 3. 모의고사 성적 조회 (student_term_id로 연결, 또는 grade만으로 필터링)
  const { data: mockScores, error: mockError } = await supabase
    .from("student_mock_scores")
    .select(`
      *,
      subject:subjects(*),
      subject_group:subject_groups(*)
    `)
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("grade", grade)
    .order("exam_date", { ascending: false });

  if (mockError) {
    console.error("[data/scoreQueries] 모의고사 성적 조회 실패", mockError);
  }

  return {
    term: term as Tables<"student_terms"> | null,
    internalScores: (internalScores as any[]) ?? [],
    mockScores: (mockScores as any[]) ?? [],
  };
}

/**
 * 학생의 모든 학기 성적 조회 (최적화 버전)
 *
 * N+1 쿼리 문제를 해결하기 위해 3개의 쿼리만 실행합니다:
 * 1. 모든 student_terms 조회
 * 2. 모든 내신 성적 조회 (IN 조건)
 * 3. 모든 모의고사 성적 조회 (IN 조건)
 *
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @returns 학기별 성적 리스트
 */
export async function getAllTermScores(
  studentId: string,
  tenantId: string
): Promise<Array<{
  term: Tables<"student_terms">;
  internalScores: Array<Tables<"student_internal_scores">>;
  mockScores: Array<Tables<"student_mock_scores">>;
}>> {
  const supabase = await createSupabaseServerClient();

  // 1. 모든 student_terms 조회
  const { data: terms, error: termsError } = await supabase
    .from("student_terms")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .order("school_year", { ascending: false })
    .order("grade", { ascending: true })
    .order("semester", { ascending: true });

  if (termsError) {
    console.error("[data/scoreQueries] student_terms 조회 실패", termsError);
    return [];
  }

  if (!terms || terms.length === 0) {
    return [];
  }

  const termIds = terms.map((term) => term.id);

  // 2. 모든 내신 성적과 모의고사 성적을 병렬로 조회 (단 2개의 추가 쿼리)
  const [internalResult, mockResult] = await Promise.all([
    supabase
      .from("student_internal_scores")
      .select("*")
      .in("student_term_id", termIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_mock_scores")
      .select("*")
      .in("student_term_id", termIds)
      .order("exam_date", { ascending: false }),
  ]);

  if (internalResult.error) {
    console.error("[data/scoreQueries] 내신 성적 조회 실패", internalResult.error);
  }
  if (mockResult.error) {
    console.error("[data/scoreQueries] 모의고사 성적 조회 실패", mockResult.error);
  }

  const allInternalScores = (internalResult.data ?? []) as Tables<"student_internal_scores">[];
  const allMockScores = (mockResult.data ?? []) as Tables<"student_mock_scores">[];

  // 3. 학기별로 성적 그룹화 (JavaScript에서 O(n) 처리)
  const internalByTermId = new Map<string, Tables<"student_internal_scores">[]>();
  const mockByTermId = new Map<string, Tables<"student_mock_scores">[]>();

  for (const score of allInternalScores) {
    if (!score.student_term_id) continue;
    const existing = internalByTermId.get(score.student_term_id) ?? [];
    existing.push(score);
    internalByTermId.set(score.student_term_id, existing);
  }

  for (const score of allMockScores) {
    if (!score.student_term_id) continue;
    const existing = mockByTermId.get(score.student_term_id) ?? [];
    existing.push(score);
    mockByTermId.set(score.student_term_id, existing);
  }

  // 4. 결과 조합
  return terms.map((term) => ({
    term: term as Tables<"student_terms">,
    internalScores: internalByTermId.get(term.id) ?? [],
    mockScores: mockByTermId.get(term.id) ?? [],
  }));
}

