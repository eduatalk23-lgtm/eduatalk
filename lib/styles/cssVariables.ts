/**
 * CSS Variables Reference & Utilities
 *
 * 이 파일은 globals.css에 정의된 CSS 변수들의 TypeScript 참조를 제공합니다.
 * CSS 변수 기반 스타일링으로 다크 모드가 자동으로 지원됩니다.
 *
 * @see globals.css - CSS 변수 정의
 * @see lib/utils/darkMode.ts - 다크모드 유틸리티
 * @see lib/styles/tokens.ts - 디자인 토큰
 *
 * ## 사용 방법
 *
 * 1. CSS 변수 직접 사용 (Tailwind)
 * ```tsx
 * <div className="text-[var(--text-primary)] bg-[var(--background)]">
 *   내용
 * </div>
 * ```
 *
 * 2. CSS 변수 유틸리티 사용
 * ```tsx
 * import { cssVar, semanticColorVar } from "@/lib/styles/cssVariables";
 *
 * <div style={{ color: cssVar("--text-primary") }}>내용</div>
 * ```
 *
 * 3. darkMode 유틸리티 사용 (권장)
 * ```tsx
 * import { textPrimaryVar, bgSurfaceVar } from "@/lib/utils/darkMode";
 *
 * <div className={cn(bgSurfaceVar, textPrimaryVar)}>내용</div>
 * ```
 */

// ============================================================================
// CSS Variable Names
// ============================================================================

/**
 * 기본 색상 CSS 변수 이름
 */
export const baseCssVars = {
  /** 배경색 */
  background: "--background",
  /** 전경색 (기본 텍스트) */
  foreground: "--foreground",
} as const;

/**
 * 텍스트 색상 CSS 변수 이름
 */
export const textCssVars = {
  /** 주요 텍스트 색상 */
  primary: "--text-primary",
  /** 보조 텍스트 색상 */
  secondary: "--text-secondary",
  /** 3차 텍스트 색상 */
  tertiary: "--text-tertiary",
  /** 플레이스홀더 색상 */
  placeholder: "--text-placeholder",
  /** 비활성화 텍스트 색상 */
  disabled: "--text-disabled",
} as const;

/**
 * 시맨틱 색상 CSS 변수 이름 (RGB 채널)
 * 투명도 지원을 위해 RGB 값으로 저장됨
 *
 * 사용 예: rgb(var(--color-primary-500))
 * 투명도 사용: rgb(var(--color-primary-500) / 0.5)
 */
export const semanticColorCssVars = {
  primary: {
    50: "--color-primary-50",
    100: "--color-primary-100",
    200: "--color-primary-200",
    300: "--color-primary-300",
    400: "--color-primary-400",
    500: "--color-primary-500",
    600: "--color-primary-600",
    700: "--color-primary-700",
    800: "--color-primary-800",
    900: "--color-primary-900",
  },
  secondary: {
    50: "--color-secondary-50",
    100: "--color-secondary-100",
    200: "--color-secondary-200",
    300: "--color-secondary-300",
    400: "--color-secondary-400",
    500: "--color-secondary-500",
    600: "--color-secondary-600",
    700: "--color-secondary-700",
    800: "--color-secondary-800",
    900: "--color-secondary-900",
  },
  success: {
    50: "--color-success-50",
    100: "--color-success-100",
    200: "--color-success-200",
    300: "--color-success-300",
    400: "--color-success-400",
    500: "--color-success-500",
    600: "--color-success-600",
    700: "--color-success-700",
    800: "--color-success-800",
    900: "--color-success-900",
  },
  warning: {
    50: "--color-warning-50",
    100: "--color-warning-100",
    200: "--color-warning-200",
    300: "--color-warning-300",
    400: "--color-warning-400",
    500: "--color-warning-500",
    600: "--color-warning-600",
    700: "--color-warning-700",
    800: "--color-warning-800",
    900: "--color-warning-900",
  },
  error: {
    50: "--color-error-50",
    100: "--color-error-100",
    200: "--color-error-200",
    300: "--color-error-300",
    400: "--color-error-400",
    500: "--color-error-500",
    600: "--color-error-600",
    700: "--color-error-700",
    800: "--color-error-800",
    900: "--color-error-900",
  },
  info: {
    50: "--color-info-50",
    100: "--color-info-100",
    200: "--color-info-200",
    300: "--color-info-300",
    400: "--color-info-400",
    500: "--color-info-500",
    600: "--color-info-600",
    700: "--color-info-700",
    800: "--color-info-800",
    900: "--color-info-900",
  },
} as const;

/**
 * 등급 색상 CSS 변수 이름 (RGB 채널)
 */
export const gradeCssVars = {
  1: "--color-grade-1",
  2: "--color-grade-2",
  3: "--color-grade-3",
  4: "--color-grade-4",
  5: "--color-grade-5",
  6: "--color-grade-6",
  7: "--color-grade-7",
  8: "--color-grade-8",
  9: "--color-grade-9",
} as const;

/**
 * 차트 색상 CSS 변수 이름 (RGB 채널)
 */
export const chartCssVars = {
  0: "--color-chart-0",
  1: "--color-chart-1",
  2: "--color-chart-2",
  3: "--color-chart-3",
  4: "--color-chart-4",
  5: "--color-chart-5",
  6: "--color-chart-6",
  7: "--color-chart-7",
} as const;

/**
 * 날짜 타입 색상 CSS 변수 이름 (RGB 채널)
 */
export const dayTypeCssVars = {
  study: "--color-day-study",
  review: "--color-day-review",
  holiday: "--color-day-holiday",
  today: "--color-day-today",
  normal: "--color-day-normal",
} as const;

/**
 * 위험도 색상 CSS 변수 이름 (RGB 채널)
 */
export const riskCssVars = {
  low: "--color-risk-low",
  medium: "--color-risk-medium",
  high: "--color-risk-high",
  critical: "--color-risk-critical",
} as const;

/**
 * 엘리베이션(그림자) CSS 변수 이름
 */
export const elevationCssVars = {
  0: "--elevation-0",
  1: "--elevation-1",
  2: "--elevation-2",
  4: "--elevation-4",
  8: "--elevation-8",
  16: "--elevation-16",
  24: "--elevation-24",
} as const;

/**
 * 등급 티어 색상 CSS 변수 이름
 */
export const tierCssVars = {
  bronze: "--tier-bronze",
  silver: "--tier-silver",
  gold: "--tier-gold",
  platinum: "--tier-platinum",
  diamond: "--tier-diamond",
} as const;

// ============================================================================
// CSS Variable Utilities
// ============================================================================

/**
 * CSS 변수 값 반환
 *
 * @param varName CSS 변수 이름 (-- 포함)
 * @returns var() 래핑된 CSS 변수 값
 *
 * @example
 * ```tsx
 * import { cssVar } from "@/lib/styles/cssVariables";
 *
 * <div style={{ color: cssVar("--text-primary") }}>내용</div>
 * ```
 */
export function cssVar(varName: string): string {
  return `var(${varName})`;
}

/**
 * RGB CSS 변수를 rgb() 함수로 래핑
 *
 * @param varName RGB 채널 CSS 변수 이름
 * @param opacity 투명도 (0-1), 생략 시 1
 * @returns rgb() 또는 rgba() 래핑된 CSS 변수 값
 *
 * @example
 * ```tsx
 * import { rgbVar } from "@/lib/styles/cssVariables";
 *
 * // 기본 사용
 * <div style={{ backgroundColor: rgbVar("--color-primary-500") }}>내용</div>
 *
 * // 투명도 사용
 * <div style={{ backgroundColor: rgbVar("--color-primary-500", 0.5) }}>반투명</div>
 * ```
 */
export function rgbVar(varName: string, opacity?: number): string {
  if (opacity !== undefined && opacity < 1) {
    return `rgb(var(${varName}) / ${opacity})`;
  }
  return `rgb(var(${varName}))`;
}

/**
 * 시맨틱 색상 CSS 변수 반환
 *
 * @param color 시맨틱 색상 이름
 * @param shade 색상 밝기 (50-900)
 * @param opacity 투명도 (0-1)
 * @returns rgb() 래핑된 CSS 변수 값
 *
 * @example
 * ```tsx
 * import { semanticColorVar } from "@/lib/styles/cssVariables";
 *
 * <div style={{ backgroundColor: semanticColorVar("primary", 500) }}>Primary</div>
 * <div style={{ color: semanticColorVar("error", 600, 0.8) }}>Error 80%</div>
 * ```
 */
export function semanticColorVar(
  color: keyof typeof semanticColorCssVars,
  shade: 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900,
  opacity?: number
): string {
  const varName = semanticColorCssVars[color][shade];
  return rgbVar(varName, opacity);
}

/**
 * 등급 색상 CSS 변수 반환
 *
 * @param grade 등급 (1-9)
 * @param opacity 투명도 (0-1)
 * @returns rgb() 래핑된 CSS 변수 값
 *
 * @example
 * ```tsx
 * import { gradeColorVar } from "@/lib/styles/cssVariables";
 *
 * <span style={{ color: gradeColorVar(1) }}>1등급</span>
 * ```
 */
export function gradeColorVar(
  grade: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  opacity?: number
): string {
  const varName = gradeCssVars[grade];
  return rgbVar(varName, opacity);
}

/**
 * 차트 색상 CSS 변수 반환
 *
 * @param index 차트 색상 인덱스 (0-7)
 * @param opacity 투명도 (0-1)
 * @returns rgb() 래핑된 CSS 변수 값
 *
 * @example
 * ```tsx
 * import { chartColorVar } from "@/lib/styles/cssVariables";
 *
 * const colors = [0, 1, 2].map(i => chartColorVar(i as 0 | 1 | 2));
 * ```
 */
export function chartColorVar(
  index: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
  opacity?: number
): string {
  const varName = chartCssVars[index];
  return rgbVar(varName, opacity);
}

/**
 * 엘리베이션(그림자) CSS 변수 반환
 *
 * @param level 엘리베이션 레벨 (0, 1, 2, 4, 8, 16, 24)
 * @returns var() 래핑된 CSS 변수 값
 *
 * @example
 * ```tsx
 * import { elevationVar } from "@/lib/styles/cssVariables";
 *
 * <div style={{ boxShadow: elevationVar(4) }}>카드</div>
 * ```
 */
export function elevationVar(level: 0 | 1 | 2 | 4 | 8 | 16 | 24): string {
  const varName = elevationCssVars[level];
  return cssVar(varName);
}

// ============================================================================
// Tailwind 클래스 유틸리티
// ============================================================================

/**
 * 시맨틱 색상 Tailwind 클래스
 * globals.css의 @theme 설정과 연동
 */
export const tailwindSemanticColors = {
  // Primary
  "bg-primary-50": "bg-primary-50",
  "bg-primary-100": "bg-primary-100",
  "bg-primary-500": "bg-primary-500",
  "bg-primary-600": "bg-primary-600",
  "text-primary-500": "text-primary-500",
  "text-primary-600": "text-primary-600",
  "border-primary-500": "border-primary-500",

  // Success
  "bg-success-50": "bg-success-50",
  "bg-success-500": "bg-success-500",
  "text-success-500": "text-success-500",
  "text-success-600": "text-success-600",

  // Warning
  "bg-warning-50": "bg-warning-50",
  "bg-warning-500": "bg-warning-500",
  "text-warning-500": "text-warning-500",
  "text-warning-600": "text-warning-600",

  // Error
  "bg-error-50": "bg-error-50",
  "bg-error-500": "bg-error-500",
  "text-error-500": "text-error-500",
  "text-error-600": "text-error-600",

  // Info
  "bg-info-50": "bg-info-50",
  "bg-info-500": "bg-info-500",
  "text-info-500": "text-info-500",
  "text-info-600": "text-info-600",
} as const;

/**
 * CSS 변수 기반 Tailwind 클래스 (arbitrary values)
 *
 * 다크 모드가 자동으로 적용됩니다.
 */
export const cssVarTailwindClasses = {
  // 텍스트 색상
  textPrimary: "text-[var(--text-primary)]",
  textSecondary: "text-[var(--text-secondary)]",
  textTertiary: "text-[var(--text-tertiary)]",
  textPlaceholder: "text-[var(--text-placeholder)]",
  textDisabled: "text-[var(--text-disabled)]",

  // 배경색
  bgBackground: "bg-[var(--background)]",
  bgForeground: "bg-[var(--foreground)]",

  // 시맨틱 색상 (RGB 변수 사용)
  bgPrimary500: "bg-[rgb(var(--color-primary-500))]",
  bgSuccess500: "bg-[rgb(var(--color-success-500))]",
  bgWarning500: "bg-[rgb(var(--color-warning-500))]",
  bgError500: "bg-[rgb(var(--color-error-500))]",
  bgInfo500: "bg-[rgb(var(--color-info-500))]",

  // 테두리 색상
  borderSecondary200: "border-[rgb(var(--color-secondary-200))]",
  borderSecondary300: "border-[rgb(var(--color-secondary-300))]",
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type SemanticColorName = keyof typeof semanticColorCssVars;
export type ColorShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type GradeNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ChartColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ElevationLevel = 0 | 1 | 2 | 4 | 8 | 16 | 24;
export type DayType = keyof typeof dayTypeCssVars;
export type RiskLevel = keyof typeof riskCssVars;
export type TierLevel = keyof typeof tierCssVars;
