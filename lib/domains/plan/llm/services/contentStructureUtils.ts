/**
 * 콘텐츠 구조 정보 공유 유틸리티
 *
 * WebSearchContentService와 Cold Start Persistence에서
 * 공통으로 사용하는 챕터/구조 정보 처리 함수입니다.
 */

import type { Json } from "@/lib/supabase/database.types";

// ============================================
// 타입 정의
// ============================================

/**
 * 챕터/에피소드 정보
 */
export interface ChapterInfo {
  /** 챕터/에피소드 제목 */
  title: string;
  /** 시작 범위 (페이지 번호 또는 에피소드 번호) */
  startRange: number;
  /** 종료 범위 */
  endRange: number;
  /** 소요시간 (분 단위, 선택) */
  duration?: number;
}

/**
 * 콘텐츠 분석 데이터 (page_analysis / episode_analysis 저장용)
 * index signature를 추가하여 Supabase JSON 타입과 호환
 */
export interface ContentAnalysisData {
  /** 챕터/에피소드 목록 */
  chapters: ChapterInfo[];
  /** 데이터 출처 */
  source: "web_search" | "cold_start";
  /** 생성 일시 */
  createdAt: string;
  /** Supabase JSON 타입 호환용 */
  [key: string]: unknown;
}

// ============================================
// 빌더 함수
// ============================================

/**
 * 챕터 정보를 JSON 분석 데이터로 변환
 *
 * @param chapters - 챕터 정보 배열
 * @param source - 데이터 출처 ("web_search" | "cold_start")
 * @returns ContentAnalysisData 객체
 *
 * @example
 * ```typescript
 * const analysisData = buildContentAnalysisData(
 *   [{ title: "1장", startRange: 1, endRange: 50 }],
 *   "web_search"
 * );
 * ```
 */
export function buildContentAnalysisData(
  chapters: ChapterInfo[],
  source: "web_search" | "cold_start"
): ContentAnalysisData {
  return {
    chapters: chapters.map((ch) => ({
      title: ch.title,
      startRange: ch.startRange,
      endRange: ch.endRange,
      // duration이 있으면 포함
      ...(ch.duration !== undefined && { duration: ch.duration }),
    })),
    source,
    createdAt: new Date().toISOString(),
  };
}

/**
 * ContentAnalysisData를 Supabase JSON 필드로 변환
 *
 * @param data - 분석 데이터 또는 null
 * @returns Supabase Json 타입 또는 null
 */
export function toJsonField(data: ContentAnalysisData | null): Json | null {
  if (!data) return null;
  return data as unknown as Json;
}

/**
 * 챕터 정보가 있는지 확인
 *
 * @param chapters - 챕터 배열 또는 undefined
 * @returns 유효한 챕터가 있으면 true
 */
export function hasValidChapters(chapters?: ChapterInfo[]): boolean {
  return Array.isArray(chapters) && chapters.length > 0;
}
