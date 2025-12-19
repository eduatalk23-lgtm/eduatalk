/**
 * 공통 유틸리티 함수 모음
 *
 * 이 파일은 프로젝트 전체에서 사용하는 공통 유틸리티 함수를 내보냅니다.
 * 카테고리별로 그룹화되어 있어 필요한 유틸리티를 쉽게 찾을 수 있습니다.
 *
 * 카테고리:
 * - Form & Data: FormData 파싱, 데이터 포맷팅
 * - Date & Time: 날짜/시간 처리
 * - Cache & Performance: 캐싱 및 성능 최적화
 * - URL & Routing: URL 처리 및 라우팅
 *
 * 참고:
 * - 각 카테고리의 상세 기능은 해당 파일의 JSDoc을 참고하세요.
 * - 타임존 고려가 필요한 날짜 처리는 `dateUtils.ts`를 직접 import하세요.
 */

// ============================================
// Form & Data
// ============================================

/**
 * FormData 파싱 및 데이터 변환
 * 
 * Deprecated 함수들은 제거되었습니다. getFormString, getFormInt 등을 사용하세요.
 */
export {
  getFormString,
  getFormInt,
  getFormFloat,
  getFormUuid,
  getFormBoolean,
  getFormDate,
  getFormArray,
  getFormTags,
  getNumberFromFormData,
} from "./formDataHelpers";

/**
 * 숫자 포맷팅
 */
export { formatNumber, formatNumberClean } from "./formatNumber";

// ============================================
// Date & Time
// ============================================

/**
 * 날짜 처리 (UI 컴포넌트용)
 * 
 * 타임존을 고려하지 않는 기본적인 날짜 연산 및 포맷팅.
 * UI 표시, 날짜 선택기 등에서 사용.
 * 
 * 타임존 고려가 필요한 경우: lib/utils/dateUtils.ts를 직접 import하세요.
 */
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

// ============================================
// Cache & Performance
// ============================================

/**
 * 클라이언트 사이드 캐싱
 * 
 * 브라우저의 sessionStorage를 활용한 간단한 캐싱 유틸리티.
 */
export {
  setCache,
  getCache,
  clearCache,
  createCacheKey,
  type CacheEntry,
} from "./cache";

// ============================================
// URL & Routing
// ============================================

/**
 * BASE_URL 및 리다이렉트 URL 생성
 */
export { getBaseUrl, getBaseUrlClient } from "./getBaseUrl";
export { getEmailRedirectUrl } from "./getEmailRedirectUrl";

