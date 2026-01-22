/**
 * RecommendationItem → DB 레코드 변환
 *
 * 콜드 스타트 파이프라인에서 생성된 추천 결과를
 * master_books / master_lectures 테이블에 저장할 수 있는 형태로 변환합니다.
 */

import type { RecommendationItem } from "../types";
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
 * 총 소요시간(분) 계산
 * - 강의: averageEpisodeDuration이 있으면 사용, 없으면 에피소드당 30분
 */
function calculateTotalDurationMinutes(item: RecommendationItem): number | null {
  if (item.contentType !== "lecture") {
    return null;
  }

  if (item.averageEpisodeDuration && item.averageEpisodeDuration > 0) {
    return item.averageEpisodeDuration * item.totalRange;
  }

  // 기본값: 에피소드당 30분
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
  };
}
