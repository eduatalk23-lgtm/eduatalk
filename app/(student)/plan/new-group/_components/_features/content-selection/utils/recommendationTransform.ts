import type { RecommendedContent } from "@/lib/types/content-selection";

/**
 * API 응답 타입 (추천 콘텐츠)
 */
type RecommendationApiResponse = {
  id: string;
  contentType?: "book" | "lecture";
  content_type?: "book" | "lecture";
  title: string;
  subject_category?: string | null;
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  publisher?: string | null;
  platform?: string | null;
  difficulty_level?: string | null;
  reason?: string;
  priority?: number;
  scoreDetails?: {
    schoolGrade?: number | null;
    schoolAverageGrade?: number | null;
    mockPercentile?: number | null;
    mockGrade?: number | null;
    riskScore?: number;
  };
};

/**
 * API 응답을 RecommendedContent 타입으로 변환
 *
 * contentType 자동 추정:
 * - publisher가 있으면 book
 * - platform이 있으면 lecture
 * - 둘 다 없으면 book (기본값)
 */
export function transformRecommendation(r: RecommendationApiResponse): RecommendedContent {
  // contentType 결정: camelCase 우선, 없으면 snake_case, 없으면 추정
  let contentType = r.contentType || r.content_type;

  if (!contentType) {
    // publisher가 있으면 book, platform이 있으면 lecture로 추정
    if (r.publisher) {
      contentType = "book";
    } else if (r.platform) {
      contentType = "lecture";
    } else {
      // 기본값: book
      contentType = "book";
    }

    console.warn(
      "[transformRecommendation] contentType이 없어 추정값 사용:",
      {
        id: r.id,
        title: r.title,
        estimatedContentType: contentType,
        publisher: r.publisher,
        platform: r.platform,
        allKeys: Object.keys(r),
      }
    );
  }

  // 타입 검증
  if (contentType !== "book" && contentType !== "lecture") {
    console.error("[transformRecommendation] 잘못된 contentType:", {
      id: r.id,
      title: r.title,
      contentType,
      rawData: r,
    });
    // 잘못된 타입은 기본값으로 변경
    contentType = "book";
  }

  return {
    id: r.id,
    contentType: contentType as "book" | "lecture",
    title: r.title,
    subject_category: r.subject_category,
    subject: r.subject,
    semester: r.semester,
    revision: r.revision,
    publisher: r.publisher,
    platform: r.platform,
    difficulty_level: r.difficulty_level,
    reason: r.reason || "",
    priority: r.priority || 0,
    scoreDetails: r.scoreDetails,
  };
}

/**
 * 추천 콘텐츠 배열 변환
 */
export function transformRecommendations(
  rawRecommendations: RecommendationApiResponse[]
): RecommendedContent[] {
  return rawRecommendations.map(transformRecommendation);
}

/**
 * 성적 데이터 유무 확인
 */
export function hasScoreDataInRecommendations(
  recommendations: RecommendedContent[]
): boolean {
  return recommendations.some(
    (r) =>
      r.reason?.includes("내신") ||
      r.reason?.includes("모의고사") ||
      r.reason?.includes("위험도") ||
      r.scoreDetails
  );
}
