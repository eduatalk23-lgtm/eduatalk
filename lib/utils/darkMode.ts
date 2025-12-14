import { cn } from "@/lib/cn";

/**
 * 다크모드 색상 클래스 유틸리티
 * 하드코딩된 색상을 일관되게 관리하기 위한 헬퍼 함수들
 */

// 배경색
export const bgSurface = "bg-white dark:bg-gray-800";
export const bgPage = "bg-gray-50 dark:bg-gray-900";
export const bgHover = "hover:bg-gray-50 dark:hover:bg-gray-800";
export const bgHoverStrong = "hover:bg-gray-100 dark:hover:bg-gray-700";

// 텍스트 색상
export const textPrimary = "text-gray-900 dark:text-gray-100";
export const textSecondary = "text-gray-700 dark:text-gray-200";
export const textTertiary = "text-gray-600 dark:text-gray-400";
export const textMuted = "text-gray-500 dark:text-gray-400";

// 테두리
export const borderDefault = "border-gray-200 dark:border-gray-700";
export const borderInput = "border-gray-300 dark:border-gray-700";
export const divideDefault = "divide-gray-200 dark:divide-gray-700";

// 인라인 버튼 스타일 (가장 많이 사용되는 패턴)
export function inlineButtonBase(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-white dark:bg-gray-800",
    "text-gray-700 dark:text-gray-200",
    "border-gray-300 dark:border-gray-700",
    "hover:bg-gray-50 dark:hover:bg-gray-700",
    className
  );
}

export function inlineButtonSecondary(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-gray-100 dark:bg-gray-800",
    "text-gray-900 dark:text-gray-100",
    "border-gray-300 dark:border-gray-700",
    "hover:bg-gray-200 dark:hover:bg-gray-700",
    className
  );
}

// 테이블 행 스타일
export const tableRowHover = "hover:bg-gray-50 dark:hover:bg-gray-800";
export const tableRowBase = cn(tableRowHover, "transition-colors");

// 카드 스타일
export const cardBase = cn(
  "rounded-xl border shadow-sm",
  bgSurface,
  borderDefault
);

/**
 * 카드 스타일 패턴 (계획에 따른 추가 패턴)
 */
export const cardStyles = {
  base: cn(
    "rounded-xl border shadow-sm",
    "border-gray-200 dark:border-gray-700",
    "bg-white dark:bg-gray-800"
  ),
  hover: "transition-shadow hover:shadow-md",
  padding: {
    sm: "p-4",
    md: "p-5 md:p-6",
    lg: "p-6 md:p-8",
  },
};

/**
 * 텍스트 색상 패턴 (계획에 따른 추가 패턴)
 */
export const textStyles = {
  primary: "text-gray-900 dark:text-gray-100",
  secondary: "text-gray-600 dark:text-gray-400",
  tertiary: "text-gray-500 dark:text-gray-500",
  muted: "text-gray-400 dark:text-gray-500",
};

/**
 * 보더 색상 패턴 (계획에 따른 추가 패턴)
 */
export const borderStyles = {
  default: "border-gray-200 dark:border-gray-700",
  light: "border-gray-100 dark:border-gray-800",
  medium: "border-gray-300 dark:border-gray-600",
};

/**
 * 배경 색상 패턴 (계획에 따른 추가 패턴)
 */
export const bgStyles = {
  white: "bg-white dark:bg-gray-800",
  gray: "bg-gray-50 dark:bg-gray-900",
  card: "bg-white dark:bg-gray-800",
};

// 상태 색상 유틸리티

/**
 * 목표 상태 색상 (Goal Progress용)
 */
export const goalStatusColors: Record<string, string> = {
  scheduled: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  in_progress: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

/**
 * 플랜 상태 색상 (Plan Status용)
 */
export const planStatusColors: Record<string, string> = {
  active: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  paused: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  completed: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
  cancelled: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

/**
 * 위험도 레벨 색상 (Admin Dashboard용)
 */
export const riskLevelColors: Record<string, string> = {
  high: "bg-red-500 dark:bg-red-600 text-white",
  medium: "bg-yellow-500 dark:bg-yellow-600 text-white",
  low: "bg-green-500 dark:bg-green-600 text-white",
};

/**
 * 위험도 점수에 따른 색상 클래스 반환
 * @param riskScore 위험도 점수 (0-100)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getRiskColorClasses(riskScore: number): string {
  if (riskScore >= 70) {
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800";
  }
  if (riskScore >= 50) {
    return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800";
  }
  return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800";
}

/**
 * 위험도 섹션용 그라디언트 배경 (Admin Dashboard용)
 */
export const riskSectionGradient = cn(
  "rounded-xl border border-red-200 dark:border-red-800",
  "bg-gradient-to-br from-red-50 to-red-100/50",
  "dark:from-red-900/30 dark:to-red-800/20",
  "p-5 md:p-6 shadow-sm"
);

