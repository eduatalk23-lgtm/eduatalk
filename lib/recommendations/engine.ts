import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSubjectRecommendations } from "./subjectRecommendation";
import { getGoalRecommendations } from "./goalRecommendation";
import { getStudyPlanRecommendations } from "./studyPlanRecommendation";
import { getContentRecommendations } from "./contentRecommendation";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 최종 추천 결과 타입
 */
export type Recommendations = {
  subjects: string[];
  goals: string[];
  studyPlan: string[];
  contents: string[];
};

/**
 * 중복 문장 제거 (유사도 기반)
 */
function removeDuplicates(recommendations: string[]): string[] {
  const unique: string[] = [];

  for (const rec of recommendations) {
    // 이미 추가된 추천과 유사한지 확인
    const isDuplicate = unique.some((existing) => {
      // 간단한 유사도 체크: 같은 키워드가 많이 포함되어 있으면 중복으로 간주
      const recWords = rec.split(/\s+/);
      const existingWords = existing.split(/\s+/);
      const commonWords = recWords.filter((w) => existingWords.includes(w));
      const similarity = commonWords.length / Math.max(recWords.length, existingWords.length);
      return similarity > 0.6; // 60% 이상 유사하면 중복
    });

    if (!isDuplicate) {
      unique.push(rec);
    }
  }

  return unique;
}

/**
 * 빈 배열 제거 및 중복 제거
 */
function cleanRecommendations(recs: Recommendations): Recommendations {
  return {
    subjects: removeDuplicates(recs.subjects),
    goals: removeDuplicates(recs.goals),
    studyPlan: removeDuplicates(recs.studyPlan),
    contents: removeDuplicates(recs.contents),
  };
}

/**
 * 최종 추천 엔진 - 모든 추천을 통합
 */
export async function getRecommendations(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Recommendations> {
  try {
    // 모든 추천 모듈 병렬 실행
    const [subjects, goals, studyPlan, contents] = await Promise.all([
      getSubjectRecommendations(supabase, studentId),
      getGoalRecommendations(supabase, studentId),
      getStudyPlanRecommendations(supabase, studentId),
      getContentRecommendations(supabase, studentId),
    ]);

    const recommendations: Recommendations = {
      subjects,
      goals,
      studyPlan,
      contents,
    };

    // 정리 및 반환
    return cleanRecommendations(recommendations);
  } catch (error) {
    console.error("[recommendations/engine] 추천 생성 실패", error);
    return {
      subjects: [],
      goals: [],
      studyPlan: [],
      contents: [],
    };
  }
}

/**
 * 모든 추천을 하나의 배열로 합치기 (우선순위 정렬)
 */
export function getAllRecommendations(recs: Recommendations): string[] {
  // 우선순위: goals > subjects > studyPlan > contents
  return [
    ...recs.goals,
    ...recs.subjects,
    ...recs.studyPlan,
    ...recs.contents,
  ];
}

/**
 * 상위 N개 추천만 반환
 */
export function getTopRecommendations(recs: Recommendations, limit: number = 5): string[] {
  const all = getAllRecommendations(recs);
  return all.slice(0, limit);
}

