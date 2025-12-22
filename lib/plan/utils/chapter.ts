/**
 * 챕터/에피소드 정보 포맷팅 유틸리티
 *
 * 교재 단원명, 강의 에피소드 제목 등을 문자열로 포맷팅합니다.
 *
 * @module lib/plan/utils/chapter
 */

import type { ChapterInfo } from "@/lib/types/plan-generation";

/**
 * 교재 페이지 범위를 챕터 문자열로 변환
 *
 * @param startPage 시작 페이지
 * @param endPage 끝 페이지
 * @returns 챕터 정보 문자열 (예: "p.1 ~ p.50")
 */
export function formatPageRange(startPage: number, endPage: number): string {
  if (startPage === endPage) {
    return `p.${startPage}`;
  }
  return `p.${startPage} ~ p.${endPage}`;
}

/**
 * 교재 단원명으로 챕터 문자열 생성
 *
 * @param majorUnit 대단원
 * @param minorUnit 소단원
 * @returns 단원명 문자열 (예: "1장 함수의 극한")
 */
export function formatUnitName(
  majorUnit: string | null | undefined,
  minorUnit: string | null | undefined
): string {
  const parts: string[] = [];

  if (majorUnit) parts.push(majorUnit);
  if (minorUnit) parts.push(minorUnit);

  return parts.join(" ");
}

/**
 * 강의 에피소드 범위를 챕터 문자열로 변환
 *
 * @param startEpisode 시작 에피소드 번호
 * @param endEpisode 끝 에피소드 번호
 * @returns 챕터 정보 문자열 (예: "1강 ~ 5강")
 */
export function formatEpisodeRange(
  startEpisode: number,
  endEpisode: number
): string {
  if (startEpisode === endEpisode) {
    return `${startEpisode}강`;
  }
  return `${startEpisode}강 ~ ${endEpisode}강`;
}

/**
 * 에피소드 번호와 제목을 결합하여 문자열 생성
 *
 * @param episodeNumber 에피소드 번호
 * @param episodeTitle 에피소드 제목
 * @returns 에피소드 문자열 (예: "1강 함수의 기초" 또는 "1강")
 */
export function formatEpisodeWithTitle(
  episodeNumber: number,
  episodeTitle: string | null | undefined
): string {
  if (episodeTitle) {
    return `${episodeNumber}강 ${episodeTitle}`;
  }
  return `${episodeNumber}강`;
}

/**
 * ChapterInfo 객체를 사람이 읽을 수 있는 문자열로 변환
 *
 * @param chapterInfo 챕터 정보 객체
 * @returns 챕터 정보 문자열
 */
export function formatChapterInfo(chapterInfo: ChapterInfo): string {
  const { start_chapter, end_chapter, episode_title } = chapterInfo;

  // 에피소드 제목이 있으면 우선 표시
  if (episode_title) {
    return episode_title;
  }

  // 시작과 끝이 같으면 하나만 표시
  if (start_chapter === end_chapter) {
    return start_chapter;
  }

  return `${start_chapter} ~ ${end_chapter}`;
}

/**
 * 교재 상세 정보로 ChapterInfo 생성
 *
 * @param startDetail 시작 상세 정보
 * @param endDetail 끝 상세 정보
 * @returns ChapterInfo 객체
 */
export function createBookChapterInfo(
  startDetail: {
    page_number: number;
    major_unit?: string | null;
    minor_unit?: string | null;
  } | null,
  endDetail: {
    page_number: number;
    major_unit?: string | null;
    minor_unit?: string | null;
  } | null
): ChapterInfo {
  // 상세 정보가 있으면 단원명 사용
  if (startDetail?.major_unit || startDetail?.minor_unit) {
    return {
      start_chapter: formatUnitName(
        startDetail.major_unit,
        startDetail.minor_unit
      ),
      end_chapter: endDetail
        ? formatUnitName(endDetail.major_unit, endDetail.minor_unit)
        : formatUnitName(startDetail.major_unit, startDetail.minor_unit),
    };
  }

  // 상세 정보가 없으면 페이지 번호 사용
  const startPage = startDetail?.page_number ?? 1;
  const endPage = endDetail?.page_number ?? startPage;

  return {
    start_chapter: `p.${startPage}`,
    end_chapter: `p.${endPage}`,
  };
}

/**
 * 강의 에피소드 정보로 ChapterInfo 생성
 *
 * @param startEpisode 시작 에피소드 정보
 * @param endEpisode 끝 에피소드 정보
 * @returns ChapterInfo 객체
 */
export function createLectureChapterInfo(
  startEpisode: {
    episode_number: number;
    episode_title?: string | null;
  } | null,
  endEpisode: {
    episode_number: number;
    episode_title?: string | null;
  } | null
): ChapterInfo {
  const startNum = startEpisode?.episode_number ?? 1;
  const endNum = endEpisode?.episode_number ?? startNum;

  return {
    start_chapter: `${startNum}강`,
    end_chapter: `${endNum}강`,
    episode_title: startEpisode?.episode_title ?? null,
  };
}

/**
 * 범위 번호로 기본 ChapterInfo 생성 (상세 정보 없을 때)
 *
 * @param contentType 콘텐츠 유형
 * @param startRange 시작 범위
 * @param endRange 끝 범위
 * @returns ChapterInfo 객체
 */
export function createDefaultChapterInfo(
  contentType: "book" | "lecture" | "custom",
  startRange: number,
  endRange: number
): ChapterInfo {
  switch (contentType) {
    case "book":
      return {
        start_chapter: `p.${startRange}`,
        end_chapter: `p.${endRange}`,
      };

    case "lecture":
      return {
        start_chapter: `${startRange}강`,
        end_chapter: `${endRange}강`,
      };

    case "custom":
      return {
        start_chapter: `${startRange}`,
        end_chapter: `${endRange}`,
      };

    default:
      return {
        start_chapter: String(startRange),
        end_chapter: String(endRange),
      };
  }
}
