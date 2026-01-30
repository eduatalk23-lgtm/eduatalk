/**
 * RecommendationItem → DB 레코드 변환
 *
 * 콜드 스타트 파이프라인에서 생성된 추천 결과를
 * master_books / master_lectures 테이블에 저장할 수 있는 형태로 변환합니다.
 */

import type { RecommendationItem, RecommendationMetadata } from "../types";
import type { Json } from "@/lib/supabase/database.types";
import type {
  SaveRecommendationOptions,
  ColdStartBookInsert,
  ColdStartLectureInsert,
} from "./types";
import {
  buildContentAnalysisData,
  toJsonField,
} from "@/lib/domains/plan/llm/services/contentStructureUtils";

/**
 * RecommendationMetadata를 JSON으로 변환
 */
function toRecommendationMetadataJson(
  metadata: RecommendationMetadata | undefined
): Json | null {
  if (!metadata) {
    return null;
  }
  // RecommendationMetadata는 순수 객체이므로 직접 Json으로 캐스팅
  return metadata as unknown as Json;
}

/**
 * 추천 아이템에서 리뷰 점수 추출
 */
function extractReviewScore(item: RecommendationItem): number | null {
  // recommendationMetadata에서 먼저 확인 (0도 유효한 값)
  if (item.recommendationMetadata?.reviews?.averageRating !== undefined) {
    return item.recommendationMetadata.reviews.averageRating;
  }
  // reviewSummary에서 확인 (파싱된 원본 데이터)
  if (item.reviewSummary?.averageRating !== undefined) {
    return item.reviewSummary.averageRating;
  }
  return null;
}

/**
 * 추천 아이템에서 리뷰 수 추출
 */
function extractReviewCount(item: RecommendationItem): number {
  // recommendationMetadata에서 먼저 확인 (0도 유효한 값)
  if (item.recommendationMetadata?.reviews?.reviewCount !== undefined) {
    return item.recommendationMetadata.reviews.reviewCount;
  }
  // reviewSummary에서 확인 (파싱된 원본 데이터)
  if (item.reviewSummary?.reviewCount !== undefined) {
    return item.reviewSummary.reviewCount;
  }
  return 0;
}

/**
 * 추천 아이템에서 대상 학생 목록 추출
 */
function extractTargetStudents(item: RecommendationItem): string[] {
  // recommendationMetadata에서 먼저 확인
  if (
    item.recommendationMetadata?.recommendation?.targetStudents &&
    item.recommendationMetadata.recommendation.targetStudents.length > 0
  ) {
    return item.recommendationMetadata.recommendation.targetStudents;
  }
  // targetStudents에서 확인 (파싱된 원본 데이터)
  if (item.targetStudents && item.targetStudents.length > 0) {
    return item.targetStudents;
  }
  return [];
}

/**
 * 총 소요시간(분) 계산
 * - 강의: averageEpisodeDuration이 있으면 사용, 없으면 에피소드당 30분
 */
function calculateTotalDurationMinutes(item: RecommendationItem): number | null {
  if (item.contentType !== "lecture") {
    return null;
  }

  // 방식 1: 회차별 duration 합계 (가장 정확)
  if (item.chapters && item.chapters.length > 0) {
    const sum = item.chapters.reduce((acc, ch) => {
      return acc + (ch.duration ?? 0);
    }, 0);
    if (sum > 0) {
      return sum;
    }
  }

  // 방식 2: 평균 에피소드 길이 × 강의 수
  if (item.averageEpisodeDuration && item.averageEpisodeDuration > 0) {
    return item.averageEpisodeDuration * item.totalRange;
  }

  // 방식 3: estimatedHours 사용
  if (item.estimatedHours && item.estimatedHours > 0) {
    return Math.round(item.estimatedHours * 60);
  }

  // 방식 4: 기본값 (에피소드당 30분)
  return item.totalRange * 30;
}

/**
 * 추천 이유 + 일치도를 notes 필드로 포맷팅
 */
function buildNotesFromRecommendation(item: RecommendationItem): string {
  const parts: string[] = [];

  if (item.reason) {
    parts.push(`[추천 이유] ${item.reason}`);
  }

  if (item.matchScore !== undefined) {
    parts.push(`[일치도] ${item.matchScore}%`);
  }

  parts.push(`[출처] 콜드 스타트 추천 시스템`);

  return parts.join("\n");
}

/**
 * RecommendationItem → master_books Insert 데이터
 */
export function mapToBookInsert(
  item: RecommendationItem,
  options: SaveRecommendationOptions = {}
): ColdStartBookInsert {
  const hasChapters = item.chapters.length > 0;

  return {
    tenant_id: options.tenantId ?? null,
    title: item.title,
    total_pages: item.totalRange > 0 ? item.totalRange : null,
    author: item.author ?? null,
    publisher_name: item.publisher ?? null,
    subject_category: options.subjectCategory ?? null,
    subject: options.subject ?? null,
    difficulty_level: options.difficultyLevel ?? null,
    notes: buildNotesFromRecommendation(item),
    source: "cold_start",
    page_analysis: hasChapters
      ? (toJsonField(buildContentAnalysisData(item.chapters, "cold_start")) as Json)
      : null,
    is_active: true,
    // estimated_hours는 GENERATED 컬럼이므로 삽입하지 않음

    // 추천 근거 메타데이터
    recommendation_metadata: toRecommendationMetadataJson(item.recommendationMetadata),
    review_score: extractReviewScore(item),
    review_count: extractReviewCount(item),
    target_students: extractTargetStudents(item),
  };
}

/**
 * RecommendationItem → master_lectures Insert 데이터
 */
export function mapToLectureInsert(
  item: RecommendationItem,
  options: SaveRecommendationOptions = {}
): ColdStartLectureInsert {
  const hasChapters = item.chapters.length > 0;

  return {
    tenant_id: options.tenantId ?? null,
    title: item.title,
    total_episodes: item.totalRange > 0 ? item.totalRange : 1,
    instructor_name: item.author ?? null,
    platform: item.publisher ?? null,
    subject_category: options.subjectCategory ?? null,
    subject: options.subject ?? null,
    difficulty_level: options.difficultyLevel ?? null,
    notes: buildNotesFromRecommendation(item),
    episode_analysis: hasChapters
      ? (toJsonField(buildContentAnalysisData(item.chapters, "cold_start")) as Json)
      : null,
    // estimated_hours는 GENERATED 컬럼이므로 삽입하지 않음
    total_duration: calculateTotalDurationMinutes(item),

    // 추천 근거 메타데이터
    recommendation_metadata: toRecommendationMetadataJson(item.recommendationMetadata),
    review_score: extractReviewScore(item),
    review_count: extractReviewCount(item),
    target_students: extractTargetStudents(item),
  };
}

// ============================================================================
// 품질 점수 계산
// ============================================================================

/**
 * 콘텐츠 품질 점수 계산 (0-100)
 *
 * 점수 구성:
 * - 목차 완성도 (2개 이상): 25점
 * - 리뷰 점수 존재: 20점
 * - 리뷰 수 100개 이상: 15점
 * - 추천 이유 2개 이상: 15점
 * - 대상 학생 1개 이상: 10점
 * - 장점 1개 이상: 10점
 * - 설명 존재: 5점
 *
 * @param item - 추천 아이템
 * @returns 품질 점수 (0-100)
 */
export function calculateQualityScore(item: RecommendationItem): number {
  let score = 0;

  // 목차 완성도 (25점)
  if (item.chapters && item.chapters.length >= 2) {
    score += 25;
  } else if (item.chapters && item.chapters.length === 1) {
    score += 10;
  }

  // 리뷰 점수 존재 (20점)
  const reviewScore = extractReviewScore(item);
  if (reviewScore !== null && reviewScore > 0) {
    score += 20;
  }

  // 리뷰 수 (15점)
  const reviewCount = extractReviewCount(item);
  if (reviewCount >= 100) {
    score += 15;
  } else if (reviewCount >= 10) {
    score += 8;
  }

  // 추천 이유 (15점)
  const reasons = item.recommendationMetadata?.recommendation?.reasons ?? [];
  if (reasons.length >= 2) {
    score += 15;
  } else if (reasons.length === 1) {
    score += 8;
  }

  // 대상 학생 (10점)
  const targetStudents = extractTargetStudents(item);
  if (targetStudents.length >= 1) {
    score += 10;
  }

  // 장점 (10점)
  const strengths = item.recommendationMetadata?.characteristics?.strengths ?? item.strengths ?? [];
  if (strengths.length >= 1) {
    score += 10;
  }

  // 설명 존재 (5점)
  if (item.description && item.description.length > 10) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * DB 레코드에서 품질 점수 계산
 *
 * 기존 저장된 데이터의 품질을 평가할 때 사용
 */
export function calculateQualityScoreFromDbRecord(record: {
  page_analysis?: { chapters?: unknown[] } | null;
  episode_analysis?: { chapters?: unknown[] } | null;
  review_score?: number | null;
  review_count?: number | null;
  recommendation_metadata?: {
    recommendation?: {
      reasons?: unknown[];
      targetStudents?: string[];
    };
    characteristics?: {
      strengths?: string[];
    };
  } | null;
  target_students?: string[] | null;
  notes?: string | null;
}): number {
  let score = 0;

  // 목차 완성도 (25점)
  const chapters = record.page_analysis?.chapters ?? record.episode_analysis?.chapters ?? [];
  if (Array.isArray(chapters) && chapters.length >= 2) {
    score += 25;
  } else if (Array.isArray(chapters) && chapters.length === 1) {
    score += 10;
  }

  // 리뷰 점수 존재 (20점)
  if (record.review_score !== null && record.review_score !== undefined && record.review_score > 0) {
    score += 20;
  }

  // 리뷰 수 (15점)
  const reviewCount = record.review_count ?? 0;
  if (reviewCount >= 100) {
    score += 15;
  } else if (reviewCount >= 10) {
    score += 8;
  }

  // 추천 이유 (15점)
  const reasons = record.recommendation_metadata?.recommendation?.reasons ?? [];
  if (Array.isArray(reasons) && reasons.length >= 2) {
    score += 15;
  } else if (Array.isArray(reasons) && reasons.length === 1) {
    score += 8;
  }

  // 대상 학생 (10점)
  const targetStudents = record.target_students ?? record.recommendation_metadata?.recommendation?.targetStudents ?? [];
  if (Array.isArray(targetStudents) && targetStudents.length >= 1) {
    score += 10;
  }

  // 장점 (10점)
  const strengths = record.recommendation_metadata?.characteristics?.strengths ?? [];
  if (Array.isArray(strengths) && strengths.length >= 1) {
    score += 10;
  }

  // 설명/노트 존재 (5점)
  if (record.notes && record.notes.length > 10) {
    score += 5;
  }

  return Math.min(score, 100);
}
