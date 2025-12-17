import type { 
  InternalScoreWithRelations, 
  MockScoreWithRelations,
  EnrichedInternalScore,
  EnrichedMockScore 
} from "@/lib/types/scoreAnalysis";

/**
 * 내신 성적에 과목명 및 교과군명 추가
 * Supabase 조인 결과의 단수형 키(subject, subject_group)를 올바르게 처리
 */
export function enrichInternalScore(
  score: InternalScoreWithRelations
): EnrichedInternalScore {
  return {
    ...score,
    subject_name: score.subject?.name ?? "알 수 없음",
    subject_group_name: score.subject_group?.name ?? "기타",
  };
}

/**
 * 모의고사 성적에 과목명 및 교과군명 추가
 */
export function enrichMockScore(
  score: MockScoreWithRelations
): EnrichedMockScore {
  return {
    ...score,
    subject_name: score.subject?.name ?? "알 수 없음",
    subject_group_name: score.subject_group?.name,
  };
}

/**
 * 내신 성적 배열 일괄 변환
 */
export function enrichInternalScores(
  scores: InternalScoreWithRelations[]
): EnrichedInternalScore[] {
  return scores.map(enrichInternalScore);
}

/**
 * 모의고사 성적 배열 일괄 변환
 */
export function enrichMockScores(
  scores: MockScoreWithRelations[]
): EnrichedMockScore[] {
  return scores.map(enrichMockScore);
}

