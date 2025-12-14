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

