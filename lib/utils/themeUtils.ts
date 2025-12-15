/**
 * 테마 관련 유틸리티 클래스
 * 
 * @deprecated 이 파일은 기존 코드 호환성을 위해 유지됩니다.
 * 새로운 코드는 @/lib/utils/darkMode에서 직접 import하세요.
 * 
 * 이 파일은 darkMode.ts의 re-export와 기존 themeClasses 객체를 제공합니다.
 */

// darkMode.ts의 모든 export를 re-export
export * from "./darkMode";

/**
 * 카드 스타일 클래스 조합 (기존 코드 호환성 유지)
 * @deprecated darkMode.ts의 bgSurface, borderDefault, cardBase 등을 사용하세요.
 */
export const themeClasses = {
  /**
   * 기본 카드 스타일 (배경 + 테두리)
   * 예: bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700
   */
  card: "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  
  /**
   * 카드 배경만
   */
  cardBg: "bg-white dark:bg-gray-800",
  
  /**
   * 카드 테두리만
   */
  cardBorder: "border-gray-200 dark:border-gray-700",
  
  /**
   * 주요 텍스트 색상
   */
  textPrimary: "text-gray-900 dark:text-gray-100",
  
  /**
   * 보조 텍스트 색상
   */
  textSecondary: "text-gray-600 dark:text-gray-400",
  
  /**
   * 3차 텍스트 색상
   */
  textTertiary: "text-gray-500 dark:text-gray-500",
  
  /**
   * 네비게이션 배경
   */
  navBg: "bg-white dark:bg-gray-800",
  
  /**
   * 네비게이션 테두리
   */
  navBorder: "border-gray-200 dark:border-gray-700",
} as const;

