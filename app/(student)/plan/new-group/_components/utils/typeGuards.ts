/**
 * Plan Wizard 타입 가드 유틸리티
 *
 * any 타입 사용을 제거하고 타입 안전성을 보장하기 위한 타입 가드 함수들
 */

import type { z } from "zod";
import type {
  studentContentSchema,
  recommendedContentSchema,
} from "@/lib/schemas/planWizardSchema";
import type { SelectedContent } from "@/lib/types/content-selection";

// ============================================
// 콘텐츠 타입 정의
// ============================================

/** 학생 콘텐츠 타입 (스키마 기반) */
export type StudentContent = z.infer<typeof studentContentSchema>;

/** 추천 콘텐츠 타입 (스키마 기반) */
export type RecommendedContent = z.infer<typeof recommendedContentSchema>;

/** 콘텐츠 타입 유니온 (SelectedContent 또는 스키마 기반 타입) */
export type AnyContent = SelectedContent | StudentContent | RecommendedContent;

/** 마스터 콘텐츠 ID를 가진 콘텐츠 (SelectedContent 확장) */
export type ContentWithMasterId = SelectedContent & {
  master_content_id: string;
};

/** Book detail 타입 */
export interface BookDetail {
  id: string;
  page_number: number;
  chapter_title?: string;
}

/** Lecture episode 타입 */
export interface LectureEpisode {
  id: string;
  episode_number: number;
  title?: string;
  duration_minutes?: number;
}

/** Content detail (Book 또는 Lecture) */
export type ContentDetail = BookDetail | LectureEpisode;

// ============================================
// 타입 가드 함수
// ============================================

/**
 * 콘텐츠가 master_content_id를 가지고 있는지 확인
 * MasterContentsPanel, StudentContentsPanel에서 사용
 */
export function hasMasterContentId(
  content: AnyContent | unknown
): content is ContentWithMasterId {
  return (
    typeof content === "object" &&
    content !== null &&
    "master_content_id" in content &&
    typeof (content as { master_content_id?: unknown }).master_content_id === "string" &&
    ((content as { master_content_id?: string }).master_content_id ?? "").length > 0
  );
}

/**
 * Book detail인지 확인
 * RangeSettingModal에서 사용
 */
export function isBookDetail(detail: ContentDetail | unknown): detail is BookDetail {
  return (
    typeof detail === "object" &&
    detail !== null &&
    "page_number" in detail &&
    typeof (detail as BookDetail).page_number === "number"
  );
}

/**
 * Lecture episode인지 확인
 * RangeSettingModal에서 사용
 */
export function isLectureEpisode(detail: ContentDetail | unknown): detail is LectureEpisode {
  return (
    typeof detail === "object" &&
    detail !== null &&
    "episode_number" in detail &&
    typeof (detail as LectureEpisode).episode_number === "number"
  );
}

/**
 * Content detail에서 범위 표시 문자열 생성
 * RangeSettingModal에서 사용
 */
export function getDetailRangeLabel(
  detail: ContentDetail | null | undefined,
  contentType: "book" | "lecture"
): string {
  if (!detail) return "";

  if (contentType === "book" && isBookDetail(detail)) {
    return `p.${detail.page_number}`;
  }

  if (contentType === "lecture" && isLectureEpisode(detail)) {
    return `${detail.episode_number}강`;
  }

  return "";
}

// ============================================
// NonStudyTimeBlock 타입
// ============================================

/** 비학습 시간 블록 타입 */
export type NonStudyTimeBlockType = "아침식사" | "저녁식사" | "수면" | "기타";

/**
 * NonStudyTimeBlock 타입 검증
 */
export function isValidNonStudyTimeBlockType(
  value: string
): value is NonStudyTimeBlockType {
  return ["아침식사", "저녁식사", "수면", "기타"].includes(value);
}

// ============================================
// WizardStep 타입
// ============================================

/** Wizard 단계 타입 */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * 유효한 WizardStep인지 확인
 */
export function isValidWizardStep(step: number): step is WizardStep {
  return step >= 1 && step <= 7 && Number.isInteger(step);
}

/**
 * 숫자를 WizardStep으로 안전하게 변환
 */
export function toWizardStep(step: number): WizardStep {
  if (isValidWizardStep(step)) {
    return step;
  }
  // 범위 벗어나면 가장 가까운 유효한 값으로 클램프
  if (step < 1) return 1;
  if (step > 7) return 7;
  return Math.round(step) as WizardStep;
}

// ============================================
// 콘텐츠 유틸리티
// ============================================

/**
 * 콘텐츠 배열에서 master_content_id 세트 추출
 */
export function extractMasterContentIds(
  contents: AnyContent[]
): Set<string> {
  const ids = new Set<string>();
  contents.forEach((c) => {
    if (hasMasterContentId(c)) {
      ids.add(c.master_content_id);
    }
  });
  return ids;
}

/**
 * 특정 master_content_id를 가진 콘텐츠 찾기
 */
export function findContentByMasterId<T extends AnyContent>(
  contents: T[],
  masterContentId: string
): T | undefined {
  return contents.find(
    (c) => hasMasterContentId(c) && c.master_content_id === masterContentId
  );
}

/**
 * master_content_id가 있는 콘텐츠만 필터링
 */
export function filterContentsWithMasterId<T extends AnyContent>(
  contents: T[]
): Array<T & { master_content_id: string }> {
  return contents.filter(
    (c): c is T & { master_content_id: string } => hasMasterContentId(c)
  );
}
