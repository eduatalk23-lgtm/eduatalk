import { cn } from "@/lib/cn";

// cn 함수 re-export (다른 파일에서 darkMode.ts에서 import할 수 있도록)
export { cn };

/**
 * 다크모드 색상 클래스 유틸리티
 * 
 * 이 모듈은 프로젝트 전반에서 사용되는 다크모드 색상 클래스를 중앙 집중식으로 관리합니다.
 * 하드코딩된 색상 클래스를 이 유틸리티 함수로 교체하여 일관성과 유지보수성을 향상시킵니다.
 * 
 * @example
 * ```tsx
 * // 텍스트 색상 사용
 * import { textPrimary, textSecondary } from "@/lib/utils/darkMode";
 * <h1 className={textPrimary}>제목</h1>
 * <p className={textSecondary}>부제목</p>
 * 
 * // 카드 스타일 사용
 * import { cardStyle } from "@/lib/utils/darkMode";
 * <div className={cardStyle()}>카드 내용</div>
 * 
 * // 버튼 스타일 사용
 * import { inlineButtonPrimary } from "@/lib/utils/darkMode";
 * <button className={inlineButtonPrimary()}>버튼</button>
 * ```
 * 
 * @see {@link https://tailwindcss.com/docs/dark-mode Tailwind CSS Dark Mode}
 * @see {@link https://next-themes.vercel.app/ next-themes}
 */

// ============================================
// CSS 변수 기반 유틸리티 (Tailwind CSS 4 호환)
// ============================================

/**
 * CSS 변수 기반 유틸리티 (Tailwind CSS 4 호환)
 * 
 * globals.css에 정의된 CSS 변수를 활용하여 더 유연한 테마 관리
 * CSS 변수는 자동으로 다크 모드에 대응하므로 dark: 클래스가 필요 없습니다.
 * 
 * @note Tailwind CSS 4의 @theme 시스템과 연동
 * @note CSS 변수 기반 유틸리티는 런타임에 테마 변경이 가능하며, 더 유연한 테마 관리가 가능합니다.
 * @note 새로운 코드에서는 이 CSS 변수 기반 유틸리티를 우선 사용하세요.
 * 
 * @example
 * ```tsx
 * import { textPrimaryVar, bgSurfaceVar, borderDefaultVar } from "@/lib/utils/darkMode";
 * 
 * <div className={cn(bgSurfaceVar, borderDefaultVar)}>
 *   <h1 className={textPrimaryVar}>제목</h1>
 * </div>
 * ```
 */
// 텍스트 색상
export const textPrimaryVar = "text-[var(--text-primary)]";
export const textSecondaryVar = "text-[var(--text-secondary)]";
export const textTertiaryVar = "text-[var(--text-tertiary)]";
export const textPlaceholderVar = "text-[var(--text-placeholder)]";
export const textDisabledVar = "text-[var(--text-disabled)]";
export const textMutedVar = "text-[var(--text-tertiary)]"; // textMuted는 text-tertiary와 동일
export const textForegroundVar = "text-[var(--foreground)]";

// 배경색
export const bgSurfaceVar = "bg-[var(--background)]";
export const bgPageVar = "bg-[var(--background)]";

// Hover 배경색 (CSS 변수 기반 - secondary 색상 활용)
// hover는 상태이므로 다크 모드에 따라 다른 색상이 필요합니다.
// CSS 변수는 자동으로 다크 모드에 대응하지만, hover의 경우 명시적으로 처리합니다.
export const bgHoverVar = "hover:bg-[rgb(var(--color-secondary-100))]";
export const bgHoverStrongVar = "hover:bg-[rgb(var(--color-secondary-200))]";

// 테두리 색상 (CSS 변수만 사용, dark: 클래스 제거)
export const borderDefaultVar = "border-[rgb(var(--color-secondary-200))]";
export const borderInputVar = "border-[rgb(var(--color-secondary-300))]";

// Divide 색상
export const divideDefaultVar = "divide-[rgb(var(--color-secondary-200))]";

// ============================================
// 제네릭 색상 클래스 유틸리티
// ============================================

/**
 * 제네릭 색상 클래스 반환 함수
 * 중복된 색상 매핑 패턴을 통합하여 코드 중복을 제거
 * 
 * @param color 색상 값
 * @param colorMap 색상 매핑 객체
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 * 
 * @example
 * ```tsx
 * const statCardColors = {
 *   gray: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
 *   green: "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200",
 * } as const;
 * 
 * const classes = getColorClasses("gray", statCardColors);
 * ```
 */
export function getColorClasses<T extends string>(
  color: T,
  colorMap: Record<T, string>
): string {
  return colorMap[color] ?? "";
}

// ============================================
// 기본 색상 유틸리티
// ============================================

// 배경색 (CSS 변수로 리다이렉트 - 다크모드 자동 대응)
export const bgSurface = bgSurfaceVar;
export const bgPage = bgPageVar;
export const bgHover = bgHoverVar;
export const bgHoverStrong = bgHoverStrongVar;

// ============================================
// 상태별 색상 유틸리티 (Hover, Focus, Disabled)
// ============================================

/**
 * Hover 상태 색상 클래스 반환
 * 
 * @param variant hover 스타일 변형 (light, medium, strong)
 * @returns hover 상태 배경색 클래스
 * 
 * @example
 * ```tsx
 * import { getHoverColorClasses } from "@/lib/utils/darkMode";
 * 
 * <button className={cn("px-4 py-2", bgSurface, getHoverColorClasses("medium"))}>
 *   버튼
 * </button>
 * ```
 */
export function getHoverColorClasses(variant: "light" | "medium" | "strong" = "medium"): string {
  switch (variant) {
    case "light":
      return "hover:bg-[rgb(var(--color-secondary-50))]";
    case "medium":
      return "hover:bg-[rgb(var(--color-secondary-100))]";
    case "strong":
      return "hover:bg-[rgb(var(--color-secondary-200))]";
    default:
      return "hover:bg-[rgb(var(--color-secondary-100))]";
  }
}

/**
 * Focus 상태 색상 클래스 반환
 * 
 * @param variant focus 스타일 변형 (ring, outline, none)
 * @param color focus 색상 (primary, secondary, error, success)
 * @returns focus 상태 색상 클래스
 * 
 * @example
 * ```tsx
 * import { getFocusColorClasses } from "@/lib/utils/darkMode";
 * 
 * <input className={cn("px-4 py-2", borderInput, getFocusColorClasses("ring", "primary"))} />
 * ```
 */
export function getFocusColorClasses(
  variant: "ring" | "outline" | "none" = "ring",
  color: "primary" | "secondary" | "error" | "success" = "primary"
): string {
  if (variant === "none") {
    return "";
  }

  const colorMap: Record<string, string> = {
    primary: "focus:ring-[rgb(var(--color-primary-500))] focus:border-[rgb(var(--color-primary-500))]",
    secondary: "focus:ring-[rgb(var(--color-secondary-500))] focus:border-[rgb(var(--color-secondary-500))]",
    error: "focus:ring-[rgb(var(--color-error-500))] focus:border-[rgb(var(--color-error-500))]",
    success: "focus:ring-[rgb(var(--color-success-500))] focus:border-[rgb(var(--color-success-500))]",
  };

  if (variant === "ring") {
    return `${colorMap[color]} focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--background)]`;
  }

  // outline variant
  return colorMap[color];
}

/**
 * Disabled 상태 색상 클래스 반환
 * 
 * @param variant disabled 스타일 변형 (opacity, muted, full)
 * @returns disabled 상태 색상 클래스
 * 
 * @example
 * ```tsx
 * import { getDisabledColorClasses } from "@/lib/utils/darkMode";
 * 
 * <button disabled className={cn("px-4 py-2", getDisabledColorClasses("opacity"))}>
 *   버튼
 * </button>
 * ```
 */
export function getDisabledColorClasses(variant: "opacity" | "muted" | "full" = "opacity"): string {
  switch (variant) {
    case "opacity":
      return "opacity-50 cursor-not-allowed";
    case "muted":
      return "opacity-60 cursor-not-allowed text-[var(--text-disabled)]";
    case "full":
      return "opacity-50 cursor-not-allowed bg-[rgb(var(--color-secondary-100))] text-[var(--text-disabled)]";
    default:
      return "opacity-50 cursor-not-allowed";
  }
}

// 텍스트 색상 (CSS 변수로 리다이렉트 - 다크모드 자동 대응)
export const textPrimary = textPrimaryVar;
export const textSecondary = textSecondaryVar;
export const textTertiary = textTertiaryVar;
export const textMuted = textMutedVar;

// 테두리 (CSS 변수로 리다이렉트 - 다크모드 자동 대응)
export const borderDefault = borderDefaultVar;
export const borderInput = borderInputVar;
export const divideDefault = divideDefaultVar;

// 인라인 버튼 스타일 (가장 많이 사용되는 패턴)
/**
 * 인라인 버튼 기본 스타일
 * @param className 추가 클래스
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function inlineButtonBase(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-[rgb(var(--color-secondary-50))]",
    "text-[var(--text-secondary)]",
    "border-[rgb(var(--color-secondary-300))]",
    "hover:bg-[rgb(var(--color-secondary-100))]",
    className
  );
}

/**
 * 인라인 버튼 보조 스타일
 * @param className 추가 클래스
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function inlineButtonSecondary(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-[rgb(var(--color-secondary-100))]",
    "text-[var(--text-primary)]",
    "border-[rgb(var(--color-secondary-300))]",
    "hover:bg-[rgb(var(--color-secondary-200))]",
    className
  );
}

// 테이블 행 스타일
export const tableRowHover = "hover:bg-[rgb(var(--color-secondary-50))]";
export const tableRowBase = cn(tableRowHover, "transition-colors");

/**
 * 테이블 행 variant 타입
 */
export type TableRowVariant = "default" | "hover" | "striped" | "selected";

/**
 * 테이블 행 variant 스타일 매핑 (성능 최적화: 상수 객체로 변환)
 */
const tableRowVariantStyles: Record<TableRowVariant, string> = {
  default: "",
  hover: tableRowHover,
  striped: "odd:bg-[rgb(var(--color-secondary-50))]",
  selected: "bg-[rgb(var(--color-primary-50))] border-l-4 border-[rgb(var(--color-primary-500))]",
} as const;

/**
 * 테이블 행 스타일 통합 함수
 * @param variant 행 스타일 변형 (default, hover, striped, selected)
 * @param className 추가 클래스
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function tableRowStyles(
  variant: TableRowVariant = "default",
  className?: string
): string {
  return cn("transition-colors", tableRowVariantStyles[variant], className);
}

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
    "border-[rgb(var(--color-secondary-200))]",
    "bg-[rgb(var(--color-secondary-50))]"
  ),
  hover: "transition-shadow hover:shadow-md",
  padding: {
    sm: "p-4",
    md: "p-5 md:p-6",
    lg: "p-6 md:p-8",
  },
};

/**
 * 텍스트 색상 패턴 (CSS 변수 기반)
 */
export const textStyles = {
  primary: textPrimaryVar,
  secondary: textSecondaryVar,
  tertiary: textTertiaryVar,
  muted: textMutedVar,
};

/**
 * 보더 색상 패턴 (CSS 변수 기반)
 */
export const borderStyles = {
  default: "border-[rgb(var(--color-secondary-200))]",
  light: "border-[rgb(var(--color-secondary-100))]",
  medium: "border-[rgb(var(--color-secondary-300))]",
};

/**
 * 배경 색상 패턴 (CSS 변수 기반)
 */
export const bgStyles = {
  white: "bg-[rgb(var(--color-secondary-50))]",
  gray: "bg-[var(--background)]",
  card: "bg-[rgb(var(--color-secondary-50))]",
};

// 상태 색상 유틸리티

/**
 * 목표 상태 색상 (Goal Progress용)
 */
export const goalStatusColors: Record<string, string> = {
  scheduled: "bg-[rgb(var(--color-secondary-100))] text-[var(--text-primary)]",
  in_progress: "bg-[rgb(var(--color-info-100))] text-[rgb(var(--color-info-800))]",
  completed: "bg-[rgb(var(--color-success-100))] text-[rgb(var(--color-success-800))]",
  failed: "bg-[rgb(var(--color-error-100))] text-[rgb(var(--color-error-800))]",
};

/**
 * 플랜 상태 색상 (Plan Status용)
 */
export const planStatusColors: Record<string, string> = {
  active: "bg-[rgb(var(--color-success-100))] text-[rgb(var(--color-success-800))]",
  paused: "bg-[rgb(var(--color-warning-100))] text-[rgb(var(--color-warning-800))]",
  completed: "bg-purple-100 text-purple-800",
  cancelled: "bg-[rgb(var(--color-error-100))] text-[rgb(var(--color-error-800))]",
};

/**
 * 위험도 레벨 색상 (Admin Dashboard용)
 */
export const riskLevelColors: Record<string, string> = {
  high: "bg-[rgb(var(--color-error-500))] text-white",
  medium: "bg-[rgb(var(--color-warning-500))] text-white",
  low: "bg-[rgb(var(--color-success-500))] text-white",
};

/**
 * 통합 상태 배지 색상 객체
 * 다양한 상태에 대한 일관된 색상 제공
 */
export const statusBadgeColors: Record<string, string> = {
  // 기본 상태
  default: "bg-[rgb(var(--color-secondary-100))] text-[var(--text-primary)]",
  active: "bg-[rgb(var(--color-success-100))] text-[rgb(var(--color-success-800))]",
  inactive: "bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)]",
  pending: "bg-[rgb(var(--color-warning-100))] text-[rgb(var(--color-warning-800))]",

  // 목표 상태
  scheduled: "bg-[rgb(var(--color-secondary-100))] text-[var(--text-primary)]",
  in_progress: "bg-[rgb(var(--color-info-100))] text-[rgb(var(--color-info-800))]",
  completed: "bg-[rgb(var(--color-success-100))] text-[rgb(var(--color-success-800))]",
  failed: "bg-[rgb(var(--color-error-100))] text-[rgb(var(--color-error-800))]",

  // 플랜 상태
  paused: "bg-[rgb(var(--color-warning-100))] text-[rgb(var(--color-warning-800))]",
  cancelled: "bg-[rgb(var(--color-error-100))] text-[rgb(var(--color-error-800))]",

  // 위험도
  high: "bg-[rgb(var(--color-error-500))] text-white",
  medium: "bg-[rgb(var(--color-warning-500))] text-white",
  low: "bg-[rgb(var(--color-success-500))] text-white",

  // 기타 상태
  success: "bg-[rgb(var(--color-success-100))] text-[rgb(var(--color-success-800))]",
  warning: "bg-[rgb(var(--color-warning-100))] text-[rgb(var(--color-warning-800))]",
  error: "bg-[rgb(var(--color-error-100))] text-[rgb(var(--color-error-800))]",
  info: "bg-[rgb(var(--color-info-100))] text-[rgb(var(--color-info-800))]",
};

/**
 * 위험도 점수에 따른 색상 클래스 반환
 * @param riskScore 위험도 점수 (0-100)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getRiskColorClasses(riskScore: number): string {
  if (riskScore >= 70) {
    return "text-[rgb(var(--color-error-600))] bg-[rgb(var(--color-error-50))] border-[rgb(var(--color-error-200))]";
  }
  if (riskScore >= 50) {
    return "text-[rgb(var(--color-warning-600))] bg-[rgb(var(--color-warning-50))] border-[rgb(var(--color-warning-200))]";
  }
  return "text-[rgb(var(--color-warning-500))] bg-[rgb(var(--color-warning-50))] border-[rgb(var(--color-warning-200))]";
}

/**
 * 위험도 섹션용 그라디언트 배경 (Admin Dashboard용)
 */
export const riskSectionGradient = cn(
  "rounded-xl border border-[rgb(var(--color-error-200))]",
  "bg-gradient-to-br from-[rgb(var(--color-error-50))] to-[rgb(var(--color-error-100))]/50",
  "p-5 md:p-6 shadow-sm"
);

// ============================================
// 그라디언트 배경 유틸리티
// ============================================

/**
 * 색상별 그라디언트 카드 스타일 생성
 * QuickActionCard 등에서 사용하는 패턴
 */
export type GradientColor =
  | "indigo"
  | "blue"
  | "purple"
  | "orange"
  | "green"
  | "red"
  | "teal"
  | "cyan"
  | "amber"
  | "pink"
  | "violet"
  | "emerald"
  | "sky";

/**
 * 그라디언트 카드 색상 매핑 (제네릭 함수 사용)
 */
const gradientCardColorMap: Record<GradientColor, string> = {
  indigo:
    "border-[rgb(var(--color-primary-200))] bg-gradient-to-br from-[rgb(var(--color-primary-50))] to-[rgb(var(--color-primary-100))]/50 hover:from-[rgb(var(--color-primary-100))] hover:to-[rgb(var(--color-primary-200))]/50 text-[rgb(var(--color-primary-900))] hover:shadow-lg",
  blue: "border-[rgb(var(--color-info-200))] bg-gradient-to-br from-[rgb(var(--color-info-50))] to-[rgb(var(--color-info-100))]/50 hover:from-[rgb(var(--color-info-100))] hover:to-[rgb(var(--color-info-200))]/50 text-[rgb(var(--color-info-900))] hover:shadow-lg",
  purple:
    "border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/30 dark:to-purple-800/20 hover:from-purple-100 hover:to-purple-200/50 dark:hover:from-purple-800/40 dark:hover:to-purple-700/30 text-purple-900 dark:text-purple-200 hover:shadow-lg",
  orange:
    "border-[rgb(var(--color-warning-200))] bg-gradient-to-br from-[rgb(var(--color-warning-50))] to-[rgb(var(--color-warning-100))]/50 hover:from-[rgb(var(--color-warning-100))] hover:to-[rgb(var(--color-warning-200))]/50 text-[rgb(var(--color-warning-900))] hover:shadow-lg",
  green:
    "border-[rgb(var(--color-success-200))] bg-gradient-to-br from-[rgb(var(--color-success-50))] to-[rgb(var(--color-success-100))]/50 hover:from-[rgb(var(--color-success-100))] hover:to-[rgb(var(--color-success-200))]/50 text-[rgb(var(--color-success-900))] hover:shadow-lg",
  red: "border-[rgb(var(--color-error-200))] bg-gradient-to-br from-[rgb(var(--color-error-50))] to-[rgb(var(--color-error-100))]/50 hover:from-[rgb(var(--color-error-100))] hover:to-[rgb(var(--color-error-200))]/50 text-[rgb(var(--color-error-900))] hover:shadow-lg",
  teal: "border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-900/30 dark:to-teal-800/20 hover:from-teal-100 hover:to-teal-200/50 dark:hover:from-teal-800/40 dark:hover:to-teal-700/30 text-teal-900 dark:text-teal-200 hover:shadow-lg",
  cyan: "border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-900/30 dark:to-cyan-800/20 hover:from-cyan-100 hover:to-cyan-200/50 dark:hover:from-cyan-800/40 dark:hover:to-cyan-700/30 text-cyan-900 dark:text-cyan-200 hover:shadow-lg",
  amber:
    "border-[rgb(var(--color-warning-200))] bg-gradient-to-br from-[rgb(var(--color-warning-50))] to-[rgb(var(--color-warning-100))]/50 hover:from-[rgb(var(--color-warning-100))] hover:to-[rgb(var(--color-warning-200))]/50 text-[rgb(var(--color-warning-900))] hover:shadow-lg",
  pink: "border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-900/30 dark:to-pink-800/20 hover:from-pink-100 hover:to-pink-200/50 dark:hover:from-pink-800/40 dark:hover:to-pink-700/30 text-pink-900 dark:text-pink-200 hover:shadow-lg",
  violet:
    "border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/30 dark:to-violet-800/20 hover:from-violet-100 hover:to-violet-200/50 dark:hover:from-violet-800/40 dark:hover:to-violet-700/30 text-violet-900 dark:text-violet-200 hover:shadow-lg",
  emerald:
    "border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-800/20 hover:from-emerald-100 hover:to-emerald-200/50 dark:hover:from-emerald-800/40 dark:hover:to-emerald-700/30 text-emerald-900 dark:text-emerald-200 hover:shadow-lg",
  sky: "border-sky-200 dark:border-sky-800 bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-900/30 dark:to-sky-800/20 hover:from-sky-100 hover:to-sky-200/50 dark:hover:from-sky-800/40 dark:hover:to-sky-700/30 text-sky-900 dark:text-sky-200 hover:shadow-lg",
} as const;

/**
 * 색상별 그라디언트 카드 클래스 반환
 * @param color 그라디언트 색상
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getGradientCardClasses(color: GradientColor): string {
  return getColorClasses(color, gradientCardColorMap);
}

/**
 * 그라디언트 배경 색상 타입
 */
export type GradientBackgroundColor = "red" | "blue" | "green" | "yellow" | "purple" | "indigo";

/**
 * 그라디언트 배경 variant 타입
 */
export type GradientBackgroundVariant = "subtle" | "medium" | "strong";

/**
 * 그라디언트 배경 색상 매핑 (성능 최적화: 상수 객체로 변환)
 */
const gradientBackgroundMap: Record<
  GradientBackgroundVariant,
  Record<GradientBackgroundColor, string>
> = {
  subtle: {
    red: "bg-gradient-to-br from-[rgb(var(--color-error-50))] to-[rgb(var(--color-error-100))]/50",
    blue: "bg-gradient-to-br from-[rgb(var(--color-info-50))] to-[rgb(var(--color-info-100))]/50",
    green: "bg-gradient-to-br from-[rgb(var(--color-success-50))] to-[rgb(var(--color-success-100))]/50",
    yellow: "bg-gradient-to-br from-[rgb(var(--color-warning-50))] to-[rgb(var(--color-warning-100))]/50",
    purple: "bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10",
    indigo: "bg-gradient-to-br from-[rgb(var(--color-primary-50))] to-[rgb(var(--color-primary-100))]/50",
  },
  medium: {
    red: "bg-gradient-to-br from-[rgb(var(--color-error-50))] to-[rgb(var(--color-error-100))]/50",
    blue: "bg-gradient-to-br from-[rgb(var(--color-info-50))] to-[rgb(var(--color-info-100))]/50",
    green: "bg-gradient-to-br from-[rgb(var(--color-success-50))] to-[rgb(var(--color-success-100))]/50",
    yellow: "bg-gradient-to-br from-[rgb(var(--color-warning-50))] to-[rgb(var(--color-warning-100))]/50",
    purple: "bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/30 dark:to-purple-800/20",
    indigo: "bg-gradient-to-br from-[rgb(var(--color-primary-50))] to-[rgb(var(--color-primary-100))]/50",
  },
  strong: {
    red: "bg-gradient-to-br from-[rgb(var(--color-error-100))] to-[rgb(var(--color-error-200))]/50",
    blue: "bg-gradient-to-br from-[rgb(var(--color-info-100))] to-[rgb(var(--color-info-200))]/50",
    green: "bg-gradient-to-br from-[rgb(var(--color-success-100))] to-[rgb(var(--color-success-200))]/50",
    yellow: "bg-gradient-to-br from-[rgb(var(--color-warning-100))] to-[rgb(var(--color-warning-200))]/50",
    purple: "bg-gradient-to-br from-purple-100 to-purple-200/50 dark:from-purple-900/40 dark:to-purple-800/30",
    indigo: "bg-gradient-to-br from-[rgb(var(--color-primary-100))] to-[rgb(var(--color-primary-200))]/50",
  },
} as const;

/**
 * 일반적인 그라디언트 배경 유틸리티 (색상별)
 * @param color 그라디언트 색상
 * @param variant 그라디언트 강도 (subtle, medium, strong)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getGradientBackground(
  color: GradientBackgroundColor,
  variant: GradientBackgroundVariant = "medium"
): string {
  return gradientBackgroundMap[variant][color];
}

// ============================================
// 테이블 스타일 통합
// ============================================

/**
 * 테이블 헤더 스타일
 */
export const tableHeaderBase = cn(
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider",
  textMuted,
  "bg-[rgb(var(--color-secondary-50))]"
);

/**
 * 테이블 셀 기본 스타일
 */
export const tableCellBase = cn("px-4 py-3 text-sm");

/**
 * 테이블 컨테이너 스타일
 */
export const tableContainer = cn(
  "overflow-hidden rounded-lg border",
  borderDefault,
  bgSurface
);

// ============================================
// 카드 스타일 개선
// ============================================

/**
 * 카드 variant 타입
 */
export type CardVariant = "default" | "hover" | "interactive";

/**
 * 카드 padding 타입
 */
export type CardPadding = "sm" | "md" | "lg";

/**
 * 카드 스타일 상수 객체 (성능 최적화: 함수 호출 오버헤드 제거)
 */
export const cardStyleVariants: Record<CardVariant, string> = {
  default: "",
  hover: cardStyles.hover,
  interactive: cn(cardStyles.hover, "cursor-pointer"),
} as const;

/**
 * 카드 스타일 통합 함수
 * @param variant 카드 변형 (default, hover, interactive)
 * @param padding 패딩 크기 (sm, md, lg)
 * @param className 추가 클래스
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function cardStyle(
  variant: CardVariant = "default",
  padding: CardPadding = "md",
  className?: string
): string {
  return cn(
    cardStyles.base,
    cardStyles.padding[padding],
    cardStyleVariants[variant],
    className
  );
}

// ============================================
// 인라인 버튼 스타일 확장
// ============================================

/**
 * 인라인 버튼 스타일 (primary variant)
 */
export function inlineButtonPrimary(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-[rgb(var(--color-primary-600))]",
    "text-white",
    "border-[rgb(var(--color-primary-600))]",
    "hover:bg-[rgb(var(--color-primary-700))]",
    className
  );
}

/**
 * 인라인 버튼 스타일 (danger variant)
 */
export function inlineButtonDanger(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-[rgb(var(--color-error-600))]",
    "text-white",
    "border-[rgb(var(--color-error-600))]",
    "hover:bg-[rgb(var(--color-error-700))]",
    className
  );
}

/**
 * 인라인 버튼 스타일 (success variant)
 */
export function inlineButtonSuccess(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-[rgb(var(--color-success-600))]",
    "text-white",
    "border-[rgb(var(--color-success-600))]",
    "hover:bg-[rgb(var(--color-success-700))]",
    className
  );
}

/**
 * 인라인 버튼 스타일 (outline variant)
 * Button 컴포넌트를 사용할 수 없는 경우에만 사용
 */
export function inlineButtonOutline(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-body-2 font-semibold transition-colors",
    bgSurfaceVar,
    borderInputVar,
    textSecondaryVar,
    bgHoverVar,
    className
  );
}

// ============================================
// 입력 필드 기본 스타일
// ============================================

/**
 * 기본 입력 필드 스타일 (Input 컴포넌트를 사용할 수 없는 경우)
 * CSS 변수 기반으로 다크모드 자동 지원
 */
export function inputBaseStyle(className?: string): string {
  return cn(
    "w-full rounded-md border px-3 py-2 text-body-2",
    bgSurfaceVar,
    borderInputVar,
    textPrimaryVar,
    "focus:border-[rgb(var(--color-primary-500))]",
    "focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary-500))]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className
  );
}

// ============================================
// 입력 그룹 스타일
// ============================================

/**
 * 입력 그룹 컨테이너 스타일
 * 여러 입력 필드를 그룹화할 때 사용
 */
export const inputGroupStyles = cn(
  "flex flex-col gap-2",
  "p-4 rounded-lg border",
  borderDefault,
  bgSurface
);

/**
 * 입력 그룹 레이블 스타일
 */
export const inputGroupLabelStyles = cn(
  "text-sm font-medium",
  textPrimary
);

/**
 * 입력 그룹 설명 스타일
 */
export const inputGroupDescriptionStyles = cn(
  "text-xs",
  textSecondary
);

/**
 * 입력 그룹 에러 스타일
 */
export const inputGroupErrorStyles = cn(
  "text-xs font-medium",
  "text-[rgb(var(--color-error-600))]"
);

// ============================================
// 섹션 헤더 스타일
// ============================================

/**
 * 섹션 헤더 컨테이너 스타일
 */
export const sectionHeaderContainerStyles = cn(
  "flex items-start justify-between gap-4"
);

/**
 * 섹션 헤더 제목 스타일
 * @param size 헤더 크기 (sm, md, lg)
 */
export function sectionHeaderTitleStyles(size: "sm" | "md" | "lg" = "md"): string {
  const sizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };
  
  return cn(
    "font-semibold",
    textPrimary,
    sizeClasses[size]
  );
}

/**
 * 섹션 헤더 설명 스타일
 * @param size 설명 크기 (sm, md, lg)
 */
export function sectionHeaderDescriptionStyles(size: "sm" | "md" | "lg" = "md"): string {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };
  
  return cn(
    textSecondary,
    sizeClasses[size]
  );
}

// ============================================
// Parent 페이지용 유틸리티
// ============================================

/**
 * Parent 페이지용 위험 신호 스타일
 */
export const riskSignalStyles = {
  container: cn(
    "rounded-xl border-2 border-[rgb(var(--color-error-300))]",
    "bg-[rgb(var(--color-error-50))]",
    "p-6 shadow-sm"
  ),
  title: "text-lg font-semibold text-[rgb(var(--color-error-900))]",
  description: "text-sm text-[rgb(var(--color-error-700))]",
  card: cn(
    "rounded-lg border-2 border-[rgb(var(--color-error-300))]",
    bgSurfaceVar,
    "p-4"
  ),
  cardTitle: "text-base font-semibold text-[rgb(var(--color-error-900))]",
  cardValue: "text-lg font-bold text-[rgb(var(--color-error-600))]",
  cardText: "text-xs text-[var(--text-secondary)]",
};

// ============================================
// Admin 페이지용 유틸리티
// ============================================

/**
 * Admin 대시보드용 레벨 색상
 * riskLevelColors와 동일하지만 명시적으로 Admin용으로 제공
 */
export const adminLevelColors: Record<string, string> = {
  high: "bg-[rgb(var(--color-error-500))] text-white",
  medium: "bg-[rgb(var(--color-warning-500))] text-white",
  low: "bg-[rgb(var(--color-success-500))] text-white",
};

// ============================================
// 모달 및 폼 스타일 유틸리티
// ============================================

/**
 * 모달 섹션 컨테이너 스타일
 * 모달 내부의 섹션 구분에 사용
 */
export const modalSectionContainer = cn(
  "rounded-lg border p-4",
  borderDefault,
  bgSurface
);

/**
 * 모달 섹션 헤더 스타일
 */
export const modalSectionHeader = cn(
  "text-sm font-semibold",
  textPrimary
);

/**
 * 모달 섹션 설명 스타일
 */
export const modalSectionDescription = cn(
  "text-xs",
  textMuted
);

/**
 * 입력 필드 기본 스타일
 * 다크모드를 포함한 일관된 입력 필드 스타일
 */
export const inputFieldBase = cn(
  "w-full rounded-lg border px-3 py-2 text-sm",
  "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
  borderInput,
  textPrimary
);

/**
 * 폼 라벨 텍스트 스타일
 * CSS 변수 기반으로 다크 모드를 자동 지원
 */
export function getFormLabelClasses(className?: string): string {
  return cn("text-sm font-medium", textSecondaryVar, className);
}

/**
 * 폼 입력 필드 스타일
 * 에러 상태, 초기 설정 하이라이트 등을 지원
 * @param hasError 에러 상태 여부
 * @param isInitialHighlight 초기 설정 하이라이트 여부 (기본값: false)
 * @param disabled 비활성화 여부 (기본값: false)
 * @param className 추가 클래스
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getFormInputClasses(
  hasError: boolean = false,
  isInitialHighlight: boolean = false,
  disabled: boolean = false,
  className?: string
): string {
  const baseClasses = cn(
    "rounded-lg border px-3 py-2",
    textPrimaryVar,
    "placeholder:" + textPlaceholderVar,
    "focus:outline-none focus:ring-2"
  );

  if (hasError) {
    return cn(
      baseClasses,
      "border-[rgb(var(--color-error-500))]",
      "focus:border-[rgb(var(--color-error-500))]",
      "focus:ring-[rgb(var(--color-error-200))]",
      className
    );
  }

  if (isInitialHighlight) {
    return cn(
      baseClasses,
      "border-[rgb(var(--color-primary-400))]",
      "bg-[rgb(var(--color-primary-50))]",
      "focus:border-[rgb(var(--color-primary-500))]",
      "focus:ring-[rgb(var(--color-primary-200))]",
      className
    );
  }

  if (disabled) {
    return cn(
      baseClasses,
      "border-[rgb(var(--color-secondary-300))]",
      "bg-[rgb(var(--color-secondary-100))]",
      "text-[rgb(var(--color-secondary-500))]",
      "cursor-not-allowed",
      className
    );
  }

  return cn(
    baseClasses,
    "border-[rgb(var(--color-secondary-300))]",
    "focus:border-[rgb(var(--color-primary-500))]",
    "focus:ring-[rgb(var(--color-primary-200))]",
    className
  );
}

/**
 * 폼 에러 메시지 스타일
 * 다크 모드를 포함한 에러 메시지 텍스트 색상
 */
export function getFormErrorClasses(className?: string): string {
  return cn("text-sm text-[rgb(var(--color-error-500))]", className);
}

/**
 * 빠른 조정 버튼 스타일
 * 모달 내부의 빠른 액션 버튼에 사용
 */
export const quickActionButton = cn(
  "flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition",
  borderInput,
  bgSurface,
  textSecondary,
  "hover:bg-[rgb(var(--color-secondary-50))]"
);

/**
 * 미리보기 카드 스타일
 * 정보 미리보기 섹션에 사용
 */
export const previewCardStyles = cn(
  "rounded-lg border p-4 flex flex-col gap-3",
  "border-[rgb(var(--color-info-200))]",
  "bg-[rgb(var(--color-info-50))]"
);

/**
 * 상태별 카드 스타일
 * 완료/진행중/대기 상태에 따른 카드 스타일
 */
export const statusCardStyles = {
  completed: cn(
    "border-[rgb(var(--color-success-200))]",
    "bg-[rgb(var(--color-success-50))]/50"
  ),
  inProgress: cn(
    "border-[rgb(var(--color-primary-300))]",
    "bg-[rgb(var(--color-primary-50))]",
    "shadow-md"
  ),
  pending: cn(
    borderDefault,
    bgSurface
  ),
};

/**
 * 상태별 텍스트 색상
 */
export const statusTextStyles = {
  completed: "text-[rgb(var(--color-success-900))]",
  inProgress: "text-[rgb(var(--color-primary-900))]",
  pending: textPrimary,
  completedSubtext: "text-[rgb(var(--color-success-700))]",
  inProgressSubtext: "text-[rgb(var(--color-primary-700))]",
  pendingSubtext: textSecondary,
};

/**
 * 상태별 배지 색상
 */
export const statusBadgeStyles = {
  completed: "bg-[rgb(var(--color-success-100))] text-[rgb(var(--color-success-700))]",
  inProgress: "bg-[rgb(var(--color-primary-100))] text-[rgb(var(--color-primary-700))]",
  pending: "bg-[rgb(var(--color-secondary-100))] text-[rgb(var(--color-secondary-600))]",
};

// ============================================
// 완료된 플랜 스타일 유틸리티
// ============================================

/**
 * 완료된 플랜에 적용할 시각적 스타일
 * 투명도, 배경색, 테두리, 텍스트 스타일을 포함
 *
 * @example
 * ```tsx
 * import { completedPlanStyles } from "@/lib/utils/darkMode";
 *
 * <div className={cn(isCompleted && completedPlanStyles.container)}>
 *   <h3 className={cn(isCompleted && completedPlanStyles.title)}>제목</h3>
 * </div>
 * ```
 */
export const completedPlanStyles = {
  /** 컨테이너 투명도 */
  container: "opacity-60",
  /** 회색 배경 */
  bgSubtle: "bg-[rgb(var(--color-secondary-50))]",
  /** 녹색 성공 배경 */
  bgSuccess: "bg-[rgb(var(--color-success-50))]/50",
  /** 제목 취소선 + 회색 텍스트 */
  title: "line-through text-[rgb(var(--color-secondary-500))]",
  /** 녹색 테두리 */
  borderSuccess: "border-[rgb(var(--color-success-200))]",
  /** 기본 회색 테두리 */
  borderSubtle: "border-[rgb(var(--color-secondary-200))]",
} as const;

/**
 * 완료된 플랜 컨테이너 클래스 조합
 *
 * @param variant - 'default' | 'success' | 'subtle'
 * @returns Tailwind 클래스 문자열
 */
export function getCompletedPlanClasses(
  variant: "default" | "success" | "subtle" = "default"
): string {
  switch (variant) {
    case "success":
      return cn(
        completedPlanStyles.container,
        completedPlanStyles.bgSuccess,
        completedPlanStyles.borderSuccess
      );
    case "subtle":
      return cn(
        completedPlanStyles.container,
        completedPlanStyles.bgSubtle,
        completedPlanStyles.borderSubtle
      );
    default:
      return completedPlanStyles.container;
  }
}

/**
 * 모달 내부 구분선 스타일
 */
export const modalDivider = cn(
  "border-t",
  "border-[rgb(var(--color-secondary-300))]"
);

/**
 * 모달 내부 라벨 스타일
 */
export const modalLabel = cn(
  "block text-xs font-medium",
  textSecondary
);

/**
 * 모달 취소 버튼 스타일
 */
export const modalCancelButton = cn(
  "rounded-lg border px-4 py-2 text-sm font-medium transition",
  borderInput,
  bgSurface,
  textSecondary,
  "hover:bg-[rgb(var(--color-secondary-50))]"
);

// ============================================
// StatCard 색상 유틸리티
// ============================================

/**
 * StatCard용 색상 타입
 */
export type StatCardColor = "gray" | "green" | "blue" | "indigo" | "red" | "amber" | "purple";

/**
 * StatCard용 색상 매핑 (제네릭 함수 사용)
 */
const statCardColorMap: Record<StatCardColor, string> = {
  gray: "bg-[rgb(var(--color-secondary-100))] text-[rgb(var(--color-secondary-900))]",
  green: "bg-[rgb(var(--color-success-100))] text-[rgb(var(--color-success-900))]",
  blue: "bg-[rgb(var(--color-info-100))] text-[rgb(var(--color-info-900))]",
  indigo: "bg-[rgb(var(--color-primary-100))] text-[rgb(var(--color-primary-900))]",
  red: "bg-[rgb(var(--color-error-100))] text-[rgb(var(--color-error-900))]",
  amber: "bg-[rgb(var(--color-warning-100))] text-[rgb(var(--color-warning-900))]",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200",
} as const;

/**
 * StatCard용 색상 클래스 반환
 * @param color StatCard 색상 타입
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getStatCardColorClasses(color: StatCardColor): string {
  return getColorClasses(color, statCardColorMap);
}

/**
 * 위험도 레벨 타입
 */
export type RiskLevel = "high" | "medium" | "low";

/**
 * 위험도 레벨별 카드 스타일 매핑 (제네릭 함수 사용)
 */
const riskLevelCardMap: Record<RiskLevel, string> = {
  high: "border-[rgb(var(--color-error-500))] bg-[rgb(var(--color-error-50))]",
  medium: "border-[rgb(var(--color-warning-500))] bg-[rgb(var(--color-warning-50))]",
  low: "border-[rgb(var(--color-success-500))] bg-[rgb(var(--color-success-50))]",
} as const;

/**
 * 위험도 레벨별 카드 스타일 (border + background)
 * RiskCard 등에서 사용하는 패턴
 * @param level 위험도 레벨
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getRiskLevelCardClasses(level: RiskLevel): string {
  return getColorClasses(level, riskLevelCardMap);
}

/**
 * MetricCard용 색상 타입
 */
export type MetricCardColor = "indigo" | "purple" | "blue" | "green" | "red" | "orange" | "yellow";

/**
 * MetricCard용 색상 매핑 (배경 + 텍스트)
 */
const metricCardColorMap: Record<MetricCardColor, string> = {
  indigo: "bg-[rgb(var(--color-primary-50))] text-[rgb(var(--color-primary-700))]",
  purple: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  blue: "bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-700))]",
  green: "bg-[rgb(var(--color-success-50))] text-[rgb(var(--color-success-700))]",
  red: "bg-[rgb(var(--color-error-50))] text-[rgb(var(--color-error-700))]",
  orange: "bg-[rgb(var(--color-warning-50))] text-[rgb(var(--color-warning-700))]",
  yellow: "bg-[rgb(var(--color-warning-50))] text-[rgb(var(--color-warning-700))]",
} as const;

/**
 * MetricCard용 값 텍스트 색상 매핑
 */
const metricCardValueColorMap: Record<MetricCardColor, string> = {
  indigo: "text-[rgb(var(--color-primary-900))]",
  purple: "text-purple-900 dark:text-purple-200",
  blue: "text-[rgb(var(--color-info-900))]",
  green: "text-[rgb(var(--color-success-900))]",
  red: "text-[rgb(var(--color-error-900))]",
  orange: "text-[rgb(var(--color-warning-900))]",
  yellow: "text-[rgb(var(--color-warning-900))]",
} as const;

/**
 * MetricCard용 색상 클래스 반환
 * @param color MetricCard 색상 타입
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열 (배경 + 텍스트)
 */
export function getMetricCardColorClasses(color: MetricCardColor): string {
  return getColorClasses(color, metricCardColorMap);
}

/**
 * MetricCard용 값 텍스트 색상 클래스 반환
 * @param color MetricCard 색상 타입
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getMetricCardValueColorClasses(color: MetricCardColor): string {
  return getColorClasses(color, metricCardValueColorMap);
}

/**
 * 배지 스타일 유틸리티 함수
 * @param variant 배지 변형 (default: 기본 배지, subtle: 반투명 배지)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getBadgeStyle(variant: "default" | "subtle" = "default"): string {
  if (variant === "subtle") {
    return "text-xs font-medium px-2 py-1 rounded bg-[var(--background)]/50 text-[var(--text-secondary)]";
  }
  return "text-xs font-medium px-2 py-1 rounded bg-[rgb(var(--color-secondary-100))] text-[var(--text-secondary)]";
}

// ============================================
// 타임슬롯 색상 유틸리티
// ============================================

/**
 * 타임슬롯 타입
 * 
 * 캘린더 타임라인에서 사용되는 시간 슬롯의 종류를 나타냅니다.
 */
export type TimeSlotType = "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";

/**
 * 타임슬롯 색상 매핑 (제네릭 함수 사용)
 */
const timeSlotColorMap: Record<TimeSlotType, string> = {
  "학습시간": "bg-[rgb(var(--color-info-50))] border-[rgb(var(--color-info-200))] text-[rgb(var(--color-info-800))]",
  "점심시간": "bg-[rgb(var(--color-warning-50))] border-[rgb(var(--color-warning-200))] text-[rgb(var(--color-warning-800))]",
  "학원일정": "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200",
  "이동시간": "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200",
  "자율학습": "bg-[rgb(var(--color-success-50))] border-[rgb(var(--color-success-200))] text-[rgb(var(--color-success-800))]",
} as const;

/**
 * 타임슬롯 색상 클래스 반환
 * 
 * 타임슬롯 타입에 따라 적절한 다크모드 색상 클래스를 반환합니다.
 * 
 * @param type 타임슬롯 타입
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열 (배경 + 테두리 + 텍스트)
 * 
 * @example
 * ```tsx
 * import { getTimeSlotColorClasses } from "@/lib/utils/darkMode";
 * 
 * <div className={getTimeSlotColorClasses("학습시간")}>
 *   학습 시간
 * </div>
 * ```
 */
export function getTimeSlotColorClasses(type: TimeSlotType): string {
  return getColorClasses(type, timeSlotColorMap);
}

// ============================================
// 날짜 타입 배지 색상 유틸리티
// ============================================

/**
 * 날짜 타입 타입
 * 
 * 플랜 그룹 스케줄에서 사용되는 날짜 유형을 나타냅니다.
 */
export type DayTypeBadge = "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | "기타";

/**
 * 날짜 타입 배지 색상 매핑 (제네릭 함수 사용)
 * 
 * 배지(badge) 형태로 사용되는 날짜 타입별 색상 클래스를 반환합니다.
 * 배경, 텍스트, 테두리 색상을 포함합니다.
 */
const dayTypeBadgeColorMap: Record<DayTypeBadge, string> = {
  "학습일": "bg-[rgb(var(--color-info-100))] text-[rgb(var(--color-info-800))] border-[rgb(var(--color-info-200))]",
  "복습일": "bg-[rgb(var(--color-success-100))] text-[rgb(var(--color-success-800))] border-[rgb(var(--color-success-200))]",
  "지정휴일": "bg-[rgb(var(--color-warning-100))] text-[rgb(var(--color-warning-800))] border-[rgb(var(--color-warning-200))]",
  "휴가": "bg-[rgb(var(--color-secondary-100))] text-[rgb(var(--color-secondary-800))] border-[rgb(var(--color-secondary-200))]",
  "개인일정": "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800",
  "기타": "bg-[rgb(var(--color-error-100))] text-[rgb(var(--color-error-800))] border-[rgb(var(--color-error-300))]",
} as const;

/**
 * 날짜 타입 배지 색상 클래스 반환
 * 
 * 날짜 타입에 따라 적절한 다크모드 색상 클래스를 반환합니다.
 * 배지 형태의 UI 요소에 사용됩니다.
 * 
 * @param type 날짜 타입
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열 (배경 + 텍스트 + 테두리)
 * 
 * @example
 * ```tsx
 * import { getDayTypeBadgeClasses } from "@/lib/utils/darkMode";
 * 
 * <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", getDayTypeBadgeClasses("학습일"))}>
 *   학습일
 * </span>
 * ```
 */
export function getDayTypeBadgeClasses(type: DayTypeBadge | string): string {
  if (type in dayTypeBadgeColorMap) {
    return getColorClasses(type as DayTypeBadge, dayTypeBadgeColorMap);
  }
  // 기본값: 학습일 색상
  return dayTypeBadgeColorMap["학습일"];
}

/**
 * 날짜 타입별 전체 색상 객체 반환
 * 
 * 날짜 타입에 따라 배경, 테두리, 텍스트, 배지 색상을 포함한 전체 색상 객체를 반환합니다.
 * 캘린더 뷰 등에서 사용됩니다.
 * 
 * @param type 날짜 타입
 * @param isToday 오늘 날짜 여부
 * @returns 색상 객체 (bg, border, text, boldText, badge)
 * 
 * @example
 * ```tsx
 * import { getDayTypeColorObject } from "@/lib/utils/darkMode";
 * 
 * const colors = getDayTypeColorObject("학습일", false);
 * <div className={cn("rounded-lg border p-4", colors.bg, colors.border)}>
 *   <h3 className={colors.boldText}>제목</h3>
 * </div>
 * ```
 */
export function getDayTypeColorObject(
  type: DayTypeBadge | string,
  isToday: boolean = false
): {
  bg: string;
  border: string;
  text: string;
  boldText: string;
  badge: string;
} {
  // 오늘 날짜는 최우선
  if (isToday) {
    return {
      bg: "bg-[rgb(var(--color-primary-50))]",
      border: "border-[rgb(var(--color-primary-300))]",
      text: "text-[rgb(var(--color-primary-600))]",
      boldText: "text-[rgb(var(--color-primary-900))]",
      badge: "bg-[rgb(var(--color-primary-100))] text-[rgb(var(--color-primary-800))]",
    };
  }

  // 날짜 타입별 색상 매핑
  const typeMap: Record<string, { bg: string; border: string; text: string; boldText: string }> = {
    "학습일": {
      bg: "bg-[rgb(var(--color-info-50))]",
      border: "border-[rgb(var(--color-info-300))]",
      text: "text-[rgb(var(--color-info-600))]",
      boldText: "text-[rgb(var(--color-info-900))]",
    },
    "복습일": {
      bg: "bg-[rgb(var(--color-warning-50))]",
      border: "border-[rgb(var(--color-warning-300))]",
      text: "text-[rgb(var(--color-warning-600))]",
      boldText: "text-[rgb(var(--color-warning-900))]",
    },
    "지정휴일": {
      bg: "bg-[rgb(var(--color-warning-50))]",
      border: "border-[rgb(var(--color-warning-300))]",
      text: "text-[rgb(var(--color-warning-600))]",
      boldText: "text-[rgb(var(--color-warning-900))]",
    },
    "휴가": {
      bg: "bg-[rgb(var(--color-secondary-100))]",
      border: "border-[rgb(var(--color-secondary-200))]",
      text: "text-[rgb(var(--color-secondary-600))]",
      boldText: "text-[rgb(var(--color-secondary-900))]",
    },
    "개인일정": {
      bg: "bg-purple-50 dark:bg-purple-900/30",
      border: "border-purple-300 dark:border-purple-700",
      text: "text-purple-600 dark:text-purple-400",
      boldText: "text-purple-900 dark:text-purple-100",
    },
    "기타": {
      bg: "bg-[rgb(var(--color-error-50))]",
      border: "border-[rgb(var(--color-error-300))]",
      text: "text-[rgb(var(--color-error-600))]",
      boldText: "text-[rgb(var(--color-error-900))]",
    },
  };

  const baseColors = typeMap[type] || {
    bg: bgSurface,
    border: borderDefault,
    text: textSecondary,
    boldText: textPrimary,
  };

  return {
    ...baseColors,
    badge: getDayTypeBadgeClasses(type),
  };
}

// ============================================
// Indigo 색상 유틸리티 (2025년 최적화)
// ============================================

/**
 * Indigo 텍스트 색상 타입
 */
export type IndigoTextVariant = "default" | "icon" | "link" | "heading";

/**
 * Indigo 텍스트 색상 매핑 (제네릭 함수 사용)
 */
const indigoTextColorMap: Record<IndigoTextVariant, string> = {
  default: "text-[rgb(var(--color-primary-600))]",
  icon: "text-[rgb(var(--color-primary-500))]",
  link: "text-[rgb(var(--color-primary-600))] hover:text-[rgb(var(--color-primary-700))]",
  heading: "text-[rgb(var(--color-primary-900))]",
} as const;

/**
 * Indigo 텍스트 색상 클래스 반환
 * @param variant Indigo 텍스트 변형 (default, icon, link, heading)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 * 
 * @example
 * ```tsx
 * import { getIndigoTextClasses } from "@/lib/utils/darkMode";
 * 
 * <span className={getIndigoTextClasses("heading")}>제목</span>
 * <a className={getIndigoTextClasses("link")}>링크</a>
 * ```
 */
export function getIndigoTextClasses(variant: IndigoTextVariant = "default"): string {
  return getColorClasses(variant, indigoTextColorMap);
}

/**
 * Indigo 배경 색상 타입
 */
export type IndigoBgVariant = "button" | "badge" | "card";

/**
 * Indigo 배경 색상 매핑 (제네릭 함수 사용)
 */
const indigoBgColorMap: Record<IndigoBgVariant, string> = {
  button: "bg-[rgb(var(--color-primary-600))] hover:bg-[rgb(var(--color-primary-700))] text-white",
  badge: "bg-[rgb(var(--color-primary-100))] text-[rgb(var(--color-primary-900))]",
  card: "bg-[rgb(var(--color-primary-50))] text-[rgb(var(--color-primary-900))]",
} as const;

/**
 * Indigo 배경 색상 클래스 반환
 * @param variant Indigo 배경 변형 (button, badge, card)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 * 
 * @example
 * ```tsx
 * import { getIndigoBgClasses } from "@/lib/utils/darkMode";
 * 
 * <button className={getIndigoBgClasses("button")}>버튼</button>
 * <span className={getIndigoBgClasses("badge")}>배지</span>
 * ```
 */
export function getIndigoBgClasses(variant: IndigoBgVariant = "button"): string {
  return getColorClasses(variant, indigoBgColorMap);
}

/**
 * Indigo 색상 클래스 통합 함수 (텍스트 + 배경)
 * @param textVariant 텍스트 변형
 * @param bgVariant 배경 변형 (선택사항)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getIndigoColorClasses(
  textVariant?: IndigoTextVariant,
  bgVariant?: IndigoBgVariant
): string {
  const classes: string[] = [];
  if (textVariant) {
    classes.push(getIndigoTextClasses(textVariant));
  }
  if (bgVariant) {
    classes.push(getIndigoBgClasses(bgVariant));
  }
  return classes.join(" ");
}

// ============================================
// 상태 배지 색상 유틸리티 함수 (2025년 최적화)
// ============================================

/**
 * 상태 배지 색상 타입
 */
export type StatusBadgeVariant = 
  | "success" 
  | "error" 
  | "warning" 
  | "info" 
  | "active" 
  | "inactive" 
  | "pending"
  | "completed"
  | "failed"
  | "default";

/**
 * 상태 배지 색상 클래스 반환 함수
 * @param variant 상태 배지 변형
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 * 
 * @example
 * ```tsx
 * import { getStatusBadgeColorClasses } from "@/lib/utils/darkMode";
 * 
 * <span className={cn("rounded-full px-2 py-1", getStatusBadgeColorClasses("success"))}>
 *   성공
 * </span>
 * ```
 */
export function getStatusBadgeColorClasses(variant: StatusBadgeVariant): string {
  return statusBadgeColors[variant] ?? statusBadgeColors.default;
}

// ============================================
// 반투명 배경 유틸리티 (2025년 최적화)
// ============================================

/**
 * 반투명 배경 타입
 */
export type SemiTransparentBgVariant = "surface" | "card";

/**
 * 반투명 배경 색상 매핑
 */
const semiTransparentBgMap: Record<SemiTransparentBgVariant, string> = {
  surface: "bg-[var(--background)]/60",
  card: "bg-[var(--background)]/80",
} as const;

/**
 * 반투명 배경 색상 클래스 반환
 * @param variant 반투명 배경 변형 (surface, card)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 * 
 * @example
 * ```tsx
 * import { getSemiTransparentBgClasses } from "@/lib/utils/darkMode";
 * 
 * <div className={getSemiTransparentBgClasses("surface")}>내용</div>
 * ```
 */
export function getSemiTransparentBgClasses(variant: SemiTransparentBgVariant = "surface"): string {
  return getColorClasses(variant, semiTransparentBgMap);
}

// ============================================
// Gray 배경 유틸리티 확장 (2025년 최적화)
// ============================================

/**
 * Gray 배경 타입
 */
export type GrayBgVariant = "light" | "medium" | "dark" | "tableHeader";

/**
 * Gray 배경 색상 매핑
 */
const grayBgColorMap: Record<GrayBgVariant, string> = {
  light: "bg-[rgb(var(--color-secondary-50))]",
  medium: "bg-[rgb(var(--color-secondary-100))]",
  dark: "bg-[rgb(var(--color-secondary-200))]",
  tableHeader: "bg-[rgb(var(--color-secondary-50))]",
} as const;

/**
 * Gray 배경 색상 클래스 반환
 * @param variant Gray 배경 변형 (light, medium, dark, tableHeader)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 * 
 * @example
 * ```tsx
 * import { getGrayBgClasses } from "@/lib/utils/darkMode";
 * 
 * <div className={getGrayBgClasses("tableHeader")}>테이블 헤더</div>
 * ```
 */
export function getGrayBgClasses(variant: GrayBgVariant = "light"): string {
  return getColorClasses(variant, grayBgColorMap);
}

// ============================================
// Red 색상 유틸리티 (2025년 최적화)
// ============================================

/**
 * Red 텍스트 색상 타입
 */
export type RedTextVariant = "default" | "link" | "error";

/**
 * Red 텍스트 색상 매핑
 */
const redTextColorMap: Record<RedTextVariant, string> = {
  default: "text-[rgb(var(--color-error-600))]",
  link: "text-[rgb(var(--color-error-600))] hover:text-[rgb(var(--color-error-800))]",
  error: "text-[rgb(var(--color-error-600))]",
} as const;

/**
 * Red 텍스트 색상 클래스 반환
 * @param variant Red 텍스트 변형 (default, link, error)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getRedTextClasses(variant: RedTextVariant = "default"): string {
  return getColorClasses(variant, redTextColorMap);
}

/**
 * Red 배경 색상 타입
 */
export type RedBgVariant = "button" | "danger";

/**
 * Red 배경 색상 매핑
 */
const redBgColorMap: Record<RedBgVariant, string> = {
  button: "bg-[rgb(var(--color-error-600))] hover:bg-[rgb(var(--color-error-700))] disabled:bg-[rgb(var(--color-error-400))] text-white",
  danger: "bg-[rgb(var(--color-error-600))] hover:bg-[rgb(var(--color-error-700))] text-white",
} as const;

/**
 * Red 배경 색상 클래스 반환
 * @param variant Red 배경 변형 (button, danger)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getRedBgClasses(variant: RedBgVariant = "button"): string {
  return getColorClasses(variant, redBgColorMap);
}

// ============================================
// 탭 메뉴 스타일 유틸리티
// ============================================

/**
 * 탭 버튼 스타일
 * @param isActive 활성 상태 여부
 * @param className 추가 클래스
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function tabButtonStyles(isActive: boolean, className?: string): string {
  return cn(
    "border-b-2 px-1 pb-4 text-sm font-medium transition-colors",
    isActive
      ? "border-[rgb(var(--color-secondary-900))] text-[rgb(var(--color-secondary-900))]"
      : "border-transparent text-[rgb(var(--color-secondary-500))] hover:border-[rgb(var(--color-secondary-300))] hover:text-[rgb(var(--color-secondary-700))]",
    className
  );
}

/**
 * 탭 컨테이너 스타일
 */
export const tabContainerStyles = cn(
  "border-b border-[rgb(var(--color-secondary-200))]"
);

// ============================================
// 메시지 스타일 유틸리티
// ============================================

/**
 * 에러 메시지 스타일 객체
 */
export const errorMessageStyles = {
  container: "flex flex-col gap-3 p-4 bg-[rgb(var(--color-error-50))] border border-[rgb(var(--color-error-200))] rounded-lg",
  title: "text-sm font-semibold text-[rgb(var(--color-error-800))]",
  text: "text-sm text-[rgb(var(--color-error-700))]",
  link: "text-sm text-[rgb(var(--color-error-700))] hover:text-[rgb(var(--color-error-900))] underline font-medium",
} as const;

/**
 * 성공 메시지 스타일 객체
 */
export const successMessageStyles = {
  container: "flex flex-col gap-3 p-4 bg-[rgb(var(--color-success-50))] border border-[rgb(var(--color-success-200))] rounded-lg",
  title: "text-sm font-semibold text-[rgb(var(--color-success-800))]",
  text: "text-sm text-[rgb(var(--color-success-700))]",
  link: "text-sm text-[rgb(var(--color-success-700))] hover:text-[rgb(var(--color-success-900))] underline font-medium",
} as const;

/**
 * 경고 메시지 스타일 객체
 */
export const warningMessageStyles = {
  container: cn(
    "rounded-lg border p-4",
    "border-[rgb(var(--color-warning-300))]",
    "bg-[rgb(var(--color-warning-50))]"
  ),
  title: "text-sm font-semibold text-[rgb(var(--color-warning-800))]",
  text: "text-sm text-[rgb(var(--color-warning-700))]",
  link: "text-sm text-[rgb(var(--color-warning-700))] hover:text-[rgb(var(--color-warning-900))] underline font-medium",
} as const;

/**
 * 정보 메시지 스타일 객체
 */
export const infoMessageStyles = {
  container: cn(
    "rounded-lg border p-4",
    "border-[rgb(var(--color-info-300))]",
    "bg-[rgb(var(--color-info-50))]"
  ),
  title: "text-sm font-semibold text-[rgb(var(--color-info-800))]",
  text: "text-sm text-[rgb(var(--color-info-700))]",
  link: "text-sm text-[rgb(var(--color-info-700))] hover:text-[rgb(var(--color-info-900))] underline font-medium",
} as const;

