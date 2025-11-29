"use server";

/**
 * 추천 마스터 콘텐츠 조회 액션
 * 
 * 학생 ID와 과목별 개수를 기반으로 추천 콘텐츠를 반환합니다.
 */

type RecommendedContent = {
  id: string;
  title: string;
  content_type: "book" | "lecture";
  subject_category: string;
  total_range: number;
  description?: string;
};

export async function getRecommendedMasterContentsAction(
  studentId: string,
  subjects: string[],
  counts: Record<string, number>
): Promise<RecommendedContent[]> {
  // TODO: 실제 추천 로직 구현
  // 현재는 빈 배열 반환 (Phase 5.8 빌드 에러 수정용)
  
  console.log("getRecommendedMasterContentsAction called", {
    studentId,
    subjects,
    counts,
  });
  
  return [];
}

