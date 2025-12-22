/**
 * 소요 시간 계산 유틸리티
 *
 * 교재, 강의, 커스텀 콘텐츠의 소요 시간을 계산합니다.
 *
 * @module lib/plan/utils/duration
 */

/**
 * 난이도별 페이지당 소요 시간 (분)
 */
export const DIFFICULTY_MINUTES_PER_PAGE: Record<string, number> = {
  쉬움: 4,
  기본: 6,
  어려움: 8,
  // 영어 키 (fallback)
  easy: 4,
  normal: 6,
  hard: 8,
};

/**
 * 기본 페이지당 소요 시간 (분)
 */
export const DEFAULT_MINUTES_PER_PAGE = 6;

/**
 * 기본 에피소드당 소요 시간 (분)
 */
export const DEFAULT_EPISODE_DURATION = 30;

/**
 * 복습일 시간 비율 (학습일 대비)
 */
export const REVIEW_DAY_TIME_RATIO = 0.5;

/**
 * 난이도에 따른 페이지당 소요 시간 반환
 *
 * @param difficulty 난이도 문자열
 * @returns 페이지당 분
 */
export function getMinutesPerPage(difficulty: string | null | undefined): number {
  if (!difficulty) return DEFAULT_MINUTES_PER_PAGE;

  const normalized = difficulty.toLowerCase().trim();
  return DIFFICULTY_MINUTES_PER_PAGE[normalized] ?? DEFAULT_MINUTES_PER_PAGE;
}

/**
 * 교재 소요 시간 계산
 *
 * @param pages 페이지 수
 * @param difficulty 난이도
 * @param isReview 복습 여부
 * @returns 총 소요 시간 (분)
 */
export function calculateBookDuration(
  pages: number,
  difficulty?: string | null,
  isReview: boolean = false
): number {
  const minutesPerPage = getMinutesPerPage(difficulty);
  const baseDuration = pages * minutesPerPage;

  return isReview ? Math.ceil(baseDuration * REVIEW_DAY_TIME_RATIO) : baseDuration;
}

/**
 * 강의 소요 시간 계산 (에피소드 범위 기반)
 *
 * @param episodes 에피소드 정보 배열
 * @param startRange 시작 에피소드 번호
 * @param endRange 끝 에피소드 번호
 * @param isReview 복습 여부
 * @returns 총 소요 시간 (분)
 */
export function calculateLectureDuration(
  episodes: Array<{ episode_number: number; duration: number | null }>,
  startRange: number,
  endRange: number,
  isReview: boolean = false
): number {
  // 범위 내 에피소드 필터링
  const rangeEpisodes = episodes.filter(
    (ep) => ep.episode_number >= startRange && ep.episode_number <= endRange
  );

  // 에피소드 duration 합산
  const baseDuration = rangeEpisodes.reduce(
    (sum, ep) => sum + (ep.duration ?? DEFAULT_EPISODE_DURATION),
    0
  );

  // 에피소드 정보가 없으면 기본값 사용
  if (baseDuration === 0) {
    const episodeCount = endRange - startRange + 1;
    const fallbackDuration = episodeCount * DEFAULT_EPISODE_DURATION;
    return isReview
      ? Math.ceil(fallbackDuration * REVIEW_DAY_TIME_RATIO)
      : fallbackDuration;
  }

  return isReview ? Math.ceil(baseDuration * REVIEW_DAY_TIME_RATIO) : baseDuration;
}

/**
 * 총 강의 시간을 에피소드 수로 나누어 평균 계산
 *
 * @param totalDuration 전체 강의 시간 (분)
 * @param totalEpisodes 전체 에피소드 수
 * @returns 에피소드당 평균 시간 (분)
 */
export function calculateAverageEpisodeDuration(
  totalDuration: number,
  totalEpisodes: number
): number {
  if (totalEpisodes <= 0) return DEFAULT_EPISODE_DURATION;
  return Math.ceil(totalDuration / totalEpisodes);
}

/**
 * 커스텀 콘텐츠 소요 시간 (직접 지정된 값 사용)
 *
 * @param totalPageOrTime DB에 저장된 total_page_or_time
 * @param isReview 복습 여부
 * @returns 총 소요 시간 (분)
 */
export function calculateCustomDuration(
  totalPageOrTime: number | null | undefined,
  isReview: boolean = false
): number {
  const baseDuration = totalPageOrTime ?? 0;
  return isReview ? Math.ceil(baseDuration * REVIEW_DAY_TIME_RATIO) : baseDuration;
}

/**
 * 콘텐츠 유형에 따른 소요 시간 계산
 *
 * @param contentType 콘텐츠 유형
 * @param options 계산에 필요한 옵션
 * @returns 총 소요 시간 (분)
 */
export function calculateDuration(
  contentType: "book" | "lecture" | "custom",
  options: {
    pages?: number;
    difficulty?: string | null;
    episodes?: Array<{ episode_number: number; duration: number | null }>;
    startRange?: number;
    endRange?: number;
    totalPageOrTime?: number | null;
    isReview?: boolean;
  }
): number {
  const isReview = options.isReview ?? false;

  switch (contentType) {
    case "book":
      return calculateBookDuration(
        options.pages ?? 0,
        options.difficulty,
        isReview
      );

    case "lecture":
      return calculateLectureDuration(
        options.episodes ?? [],
        options.startRange ?? 1,
        options.endRange ?? 1,
        isReview
      );

    case "custom":
      return calculateCustomDuration(options.totalPageOrTime, isReview);

    default:
      return 0;
  }
}
