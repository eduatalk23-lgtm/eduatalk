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
    subject_category: r.subject_category ?? null,
    subject: r.subject ?? null,
    semester: r.semester ?? null,
    revision: r.revision ?? null,
    publisher: r.publisher ?? null,
    platform: r.platform ?? null,
    difficulty_level: r.difficulty_level ?? null,
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

/**
 * 통합 추천 API 결과 타입 (콜드 스타트/웹 검색)
 */
type UnifiedRecommendationResult = {
  id: string;
  title: string;
  contentType: "book" | "lecture";
  totalRange: number | null;
  chapters?: Array<{ title: string; startRange: number; endRange: number }>;
  author?: string;
  publisher?: string;
  difficultyLevel?: string;
  matchScore?: number;
  reason?: string;
  source: "cache" | "recommend" | "cold_start";
  // 콜드 스타트 추천 메타데이터
  reviewScore?: number | null;
  reviewCount?: number;
  targetStudents?: string[];
  recommendationReasons?: string[];
};

/**
 * 통합 추천 결과를 RecommendedContent 타입으로 변환
 *
 * 콜드 스타트/웹 검색 추천 결과를 기존 UI와 호환되는 형식으로 변환합니다.
 */
export function transformUnifiedRecommendation(
  r: UnifiedRecommendationResult,
  subjectCategory?: string
): RecommendedContent {
  // matchScore를 priority로 변환 (0-100 → 1-10)
  const priority = r.matchScore ? Math.ceil(r.matchScore / 10) : 5;

  return {
    id: r.id,
    contentType: r.contentType,
    title: r.title,
    subject_category: subjectCategory ?? null,
    subject: null, // 콜드 스타트에서는 세부 과목 정보 없음
    semester: null,
    revision: null,
    publisher: r.contentType === "book" ? (r.publisher ?? null) : null,
    platform: r.contentType === "lecture" ? (r.publisher ?? null) : null,
    difficulty_level: r.difficultyLevel ?? null,
    reason: r.reason || `AI가 추천한 ${r.contentType === "book" ? "교재" : "강의"}입니다.`,
    priority,
    // 콜드 스타트에서는 성적 기반 상세 정보 없음
    scoreDetails: undefined,
    // 콜드 스타트 추천 메타데이터
    reviewScore: r.reviewScore,
    reviewCount: r.reviewCount,
    targetStudents: r.targetStudents,
    recommendationReasons: r.recommendationReasons,
  };
}

/**
 * 통합 추천 결과 배열 변환
 */
export function transformUnifiedRecommendations(
  results: UnifiedRecommendationResult[],
  subjectCategory?: string
): RecommendedContent[] {
  return results.map((r) => transformUnifiedRecommendation(r, subjectCategory));
}
