// ============================================
// 성적 조회 헬퍼 — 파이프라인 전반에서 반복되는 인라인 쿼리 통합
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoreRowWithSubject } from "@/lib/domains/record-analysis/pipeline";
import type { HighlightAnalysisInput } from "@/lib/domains/record-analysis/llm/types";

/**
 * student_internal_scores + subject join 조회.
 * 파이프라인/진단/역량분석에서 공통 사용.
 */
export async function fetchScoresWithSubject(
  supabase: SupabaseClient,
  studentId: string,
): Promise<ScoreRowWithSubject[]> {
  const { data } = await supabase
    .from("student_internal_scores")
    .select("subject:subject_id(name), rank_grade, grade, semester")
    .eq("student_id", studentId)
    .order("grade")
    .order("semester")
    .returns<ScoreRowWithSubject[]>();
  return data ?? [];
}

/** fetchCareerContext 반환 타입 */
export interface CareerContextResult {
  careerContext: NonNullable<HighlightAnalysisInput["careerContext"]>;
  careerScoreRows: ScoreRowWithSubject[];
}

/**
 * 진로 역량 평가용 이수/성적 컨텍스트 빌드.
 * targetMajor가 null이면 null 반환 (진로 평가 불필요).
 */
export async function fetchCareerContext(
  supabase: SupabaseClient,
  studentId: string,
  targetMajor: string | null,
): Promise<CareerContextResult | null> {
  if (!targetMajor) return null;

  const scoreRows = await fetchScoresWithSubject(supabase, studentId);
  const subjectScores = scoreRows
    .map((s) => ({ subjectName: s.subject?.name ?? "", rankGrade: s.rank_grade ?? 5 }))
    .filter((s) => s.subjectName);
  const takenNames = [...new Set(subjectScores.map((s) => s.subjectName))];
  const gradeTrend = scoreRows
    .filter((s) => s.rank_grade != null)
    .map((s) => ({
      grade: s.grade ?? 1,
      semester: s.semester ?? 1,
      subjectName: s.subject?.name ?? "",
      rankGrade: s.rank_grade as number,
    }));

  return {
    careerContext: {
      targetMajor,
      takenSubjects: takenNames,
      relevantScores: subjectScores,
      gradeTrend,
    },
    careerScoreRows: scoreRows,
  };
}
