/**
 * 공통 유틸리티 함수 모음
 *
 * 이 파일은 프로젝트 전체에서 사용하는 공통 유틸리티 함수를 내보냅니다.
 */

// FormData 관련 유틸리티
export {
  parseFormString,
  parseFormStringOrNull,
  parseFormNumber,
  parseFormNumberOrNull,
  parseFormBoolean,
  parseFormArray,
} from "./formDataHelpers";

// 날짜 관련 유틸리티
export {
  getTodayParts,
  parseDateString,
  formatDateString,
  formatDateFromDate,
  getDaysInMonth,
  getDaysDifference,
  getWeeksDifference,
  calculateEndDate,
  calculateDday,
  isValidDateString,
  isValidDateRange,
  isFutureDate,
  getDayOfWeekName,
  getDayOfWeek,
} from "./date";

// 숫자 포맷팅
export { formatNumber, formatNumberClean } from "./formatNumber";

// 캐시 관련
export { setCache, getCache, clearCache, createCacheKey, type CacheEntry } from "./cache";

// BASE_URL 관련
export { getBaseUrl, getBaseUrlClient } from "./getBaseUrl";
export { getEmailRedirectUrl } from "./getEmailRedirectUrl";

