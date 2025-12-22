/**
 * 플랜 생성 유틸리티 모듈
 *
 * 플랜 생성 관련 공통 유틸리티 함수를 제공합니다.
 *
 * @module lib/plan/utils
 */

// 소요 시간 계산
export {
  DIFFICULTY_MINUTES_PER_PAGE,
  DEFAULT_MINUTES_PER_PAGE,
  DEFAULT_EPISODE_DURATION,
  REVIEW_DAY_TIME_RATIO,
  getMinutesPerPage,
  calculateBookDuration,
  calculateLectureDuration,
  calculateAverageEpisodeDuration,
  calculateCustomDuration,
  calculateDuration,
} from "./duration";

// 챕터/에피소드 포맷팅
export {
  formatPageRange,
  formatUnitName,
  formatEpisodeRange,
  formatEpisodeWithTitle,
  formatChapterInfo,
  createBookChapterInfo,
  createLectureChapterInfo,
  createDefaultChapterInfo,
} from "./chapter";
