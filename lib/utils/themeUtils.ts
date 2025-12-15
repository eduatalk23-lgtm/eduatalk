/**
 * 테마 관련 유틸리티 클래스
 * 자주 사용되는 다크모드 클래스 조합을 제공합니다.
 * 
 * 주의: 3곳 이상에서 사용되는 패턴만 여기에 정의합니다.
 * 과도한 추상화를 지양합니다.
 */

/**
 * 카드 스타일 클래스 조합
 * 배경색과 테두리를 포함합니다.
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

