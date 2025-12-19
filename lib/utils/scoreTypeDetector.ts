/**
 * 성적 타입 확인 유틸리티
 * 
 * 성적 ID만으로는 내신인지 모의고사인지 알 수 없으므로,
 * 두 테이블을 모두 조회하여 타입을 확인합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ScoreType = "internal" | "mock" | null;

/**
 * 성적 ID로 타입 확인
 * 
 * @param scoreId 성적 ID
 * @param studentId 학생 ID (보안을 위해 필수)
 * @returns "internal" | "mock" | null
 */
export async function detectScoreType(
  scoreId: string,
  studentId: string
): Promise<ScoreType> {
  const supabase = await createSupabaseServerClient();

  // 내신 성적 확인
  const { data: internal } = await supabase
    .from("student_internal_scores")
    .select("id")
    .eq("id", scoreId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (internal) return "internal";

  // 모의고사 성적 확인
  const { data: mock } = await supabase
    .from("student_mock_scores")
    .select("id")
    .eq("id", scoreId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (mock) return "mock";

  return null;
}

/**
 * 성적 데이터 조회 (타입 자동 감지)
 * 
 * @param scoreId 성적 ID
 * @param studentId 학생 ID
 * @returns 성적 데이터 또는 null
 */
export async function getScoreById(
  scoreId: string,
  studentId: string
): Promise<{
  type: ScoreType;
  data: any;
} | null> {
  const supabase = await createSupabaseServerClient();
  const type = await detectScoreType(scoreId, studentId);

  if (!type) return null;

  if (type === "internal") {
    const { data, error } = await supabase
      .from("student_internal_scores")
      .select("*")
      .eq("id", scoreId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error || !data) return null;
    return { type: "internal", data };
  } else {
    const { data, error } = await supabase
      .from("student_mock_scores")
      .select("*")
      .eq("id", scoreId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error || !data) return null;
    return { type: "mock", data };
  }
}

