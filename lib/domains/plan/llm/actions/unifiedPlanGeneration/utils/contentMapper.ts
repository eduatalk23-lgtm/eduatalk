/**
 * Content Mapper Utilities
 *
 * 콘텐츠 ID 생성 및 타입 변환 유틸리티입니다.
 */

import type { ContentType, ResolvedContentItem, SubjectType } from "../types";
import type { ContentInfo } from "@/lib/plan/scheduler";

/**
 * 콘텐츠 제목과 타입으로 고유 ID를 생성합니다.
 *
 * @param title - 콘텐츠 제목
 * @param contentType - 콘텐츠 타입 (book/lecture)
 * @returns 고유 ID
 */
export function generateContentId(
  title: string,
  contentType: ContentType
): string {
  // 제목에서 특수문자 제거하고 소문자로 변환
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50);

  // 타입 접두사 + 정규화된 제목
  const prefix = contentType === "book" ? "bk" : "lec";
  return `${prefix}_${normalizedTitle}`;
}

/**
 * ResolvedContentItem을 SchedulerEngine의 ContentInfo로 변환합니다.
 *
 * @param item - 해결된 콘텐츠 아이템
 * @returns ContentInfo
 */
export function toContentInfo(item: ResolvedContentItem): ContentInfo {
  return {
    content_type: item.contentType,
    content_id: item.id,
    start_range: item.startRange,
    end_range: item.endRange + 1, // ContentInfo는 end_range가 exclusive
    total_amount: item.endRange - item.startRange + 1,
    subject: item.subject ?? null,
    subject_category: item.subjectCategory ?? null,
    chapter: item.chapters?.[0]?.title ?? null,
  };
}

/**
 * 여러 ResolvedContentItem을 ContentInfo 배열로 변환합니다.
 *
 * @param items - 해결된 콘텐츠 아이템 배열
 * @returns ContentInfo 배열
 */
export function toContentInfoArray(items: ResolvedContentItem[]): ContentInfo[] {
  return items.map(toContentInfo);
}

/**
 * 콘텐츠별 subject_type 맵을 생성합니다.
 *
 * @param items - 해결된 콘텐츠 아이템 배열
 * @param subjectType - 기본 subject_type
 * @returns content_id -> subject_type 맵
 */
export function createSubjectTypeMap(
  items: ResolvedContentItem[],
  subjectType: SubjectType
): Map<string, SubjectType> {
  const map = new Map<string, SubjectType>();
  for (const item of items) {
    map.set(item.id, subjectType);
  }
  return map;
}

/**
 * 콘텐츠별 과목 정보 맵을 생성합니다.
 *
 * @param items - 해결된 콘텐츠 아이템 배열
 * @returns content_id -> { subject, subject_category } 맵
 */
export function createContentSubjectsMap(
  items: ResolvedContentItem[]
): Map<string, { subject?: string | null; subject_category?: string | null }> {
  const map = new Map<
    string,
    { subject?: string | null; subject_category?: string | null }
  >();
  for (const item of items) {
    map.set(item.id, {
      subject: item.subject ?? null,
      subject_category: item.subjectCategory ?? null,
    });
  }
  return map;
}
