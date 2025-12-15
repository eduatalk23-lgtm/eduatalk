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
 * CSS 변수를 직접 사용하는 유틸리티 함수
 * globals.css에 정의된 CSS 변수를 활용하여 더 유연한 테마 관리
 * 
 * @note Tailwind CSS 4의 @theme 시스템과 연동
 * @note CSS 변수 기반 유틸리티는 런타임에 테마 변경이 가능하며, 더 유연한 테마 관리가 가능합니다.
 * 
 * @deprecated 새로운 코드에서는 CSS 변수 기반 유틸리티를 우선 사용하세요.
 * 기존 Tailwind 클래스 기반 유틸리티는 하위 호환성을 위해 유지됩니다.
 */
export const textPrimaryVar = "text-[var(--text-primary)]";
export const textSecondaryVar = "text-[var(--text-secondary)]";
export const textTertiaryVar = "text-[var(--text-tertiary)]";
export const textPlaceholderVar = "text-[var(--text-placeholder)]";
export const textDisabledVar = "text-[var(--text-disabled)]";
export const bgSurfaceVar = "bg-[var(--background)]";
export const bgPageVar = "bg-[var(--background)]";
export const textForegroundVar = "text-[var(--foreground)]";

/**
 * CSS 변수 기반 배경색 유틸리티
 * 
 * @note CSS 변수 기반 유틸리티는 런타임에 테마 변경이 가능하며, 더 유연한 테마 관리가 가능합니다.
 */
export const bgSurfaceVarNew = "bg-[var(--background)]";
export const bgPageVarNew = "bg-[var(--background)]";

/**
 * CSS 변수 기반 테두리 색상 유틸리티
 * 
 * @note CSS 변수 기반 유틸리티는 런타임에 테마 변경이 가능하며, 더 유연한 테마 관리가 가능합니다.
 */
export const borderDefaultVar = "border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]";
export const borderInputVar = "border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))]";

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

// 배경색
// @deprecated 새로운 코드에서는 bgSurfaceVar, bgPageVar 등을 사용하세요.
export const bgSurface = "bg-white dark:bg-gray-800";
export const bgPage = "bg-gray-50 dark:bg-gray-900";
export const bgHover = "hover:bg-gray-50 dark:hover:bg-gray-800";
export const bgHoverStrong = "hover:bg-gray-100 dark:hover:bg-gray-700";

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
      return "hover:bg-gray-50 dark:hover:bg-gray-800";
    case "medium":
      return "hover:bg-gray-100 dark:hover:bg-gray-700";
    case "strong":
      return "hover:bg-gray-200 dark:hover:bg-gray-600";
    default:
      return "hover:bg-gray-100 dark:hover:bg-gray-700";
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
    primary: "focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400",
    secondary: "focus:ring-gray-500 dark:focus:ring-gray-400 focus:border-gray-500 dark:focus:border-gray-400",
    error: "focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400",
    success: "focus:ring-green-500 dark:focus:ring-green-400 focus:border-green-500 dark:focus:border-green-400",
  };

  if (variant === "ring") {
    return `${colorMap[color]} focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800`;
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
      return "opacity-60 cursor-not-allowed text-gray-400 dark:text-gray-500";
    case "full":
      return "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500";
    default:
      return "opacity-50 cursor-not-allowed";
  }
}

// 텍스트 색상
// @deprecated 새로운 코드에서는 textPrimaryVar, textSecondaryVar 등을 사용하세요.
export const textPrimary = "text-gray-900 dark:text-gray-100";
export const textSecondary = "text-gray-700 dark:text-gray-200";
export const textTertiary = "text-gray-600 dark:text-gray-400";
export const textMuted = "text-gray-500 dark:text-gray-400";

// 테두리
// @deprecated 새로운 코드에서는 borderDefaultVar, borderInputVar 등을 사용하세요.
export const borderDefault = "border-gray-200 dark:border-gray-700";
export const borderInput = "border-gray-300 dark:border-gray-700";
export const divideDefault = "divide-gray-200 dark:divide-gray-700";

// 인라인 버튼 스타일 (가장 많이 사용되는 패턴)
/**
 * 인라인 버튼 기본 스타일
 * @param className 추가 클래스
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
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

/**
 * 인라인 버튼 보조 스타일
 * @param className 추가 클래스
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
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
  striped: "odd:bg-gray-50 dark:odd:bg-gray-900/50",
  selected: "bg-indigo-50 dark:bg-indigo-900/30 border-l-4 border-indigo-500 dark:border-indigo-400",
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
 * 통합 상태 배지 색상 객체
 * 다양한 상태에 대한 일관된 색상 제공
 */
export const statusBadgeColors: Record<string, string> = {
  // 기본 상태
  default: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  active: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  inactive: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  
  // 목표 상태 (goalStatusColors와 동일)
  scheduled: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  in_progress: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  
  // 플랜 상태 (planStatusColors와 동일)
  paused: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  cancelled: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  
  // 위험도 (riskLevelColors와 동일)
  high: "bg-red-500 dark:bg-red-600 text-white",
  medium: "bg-yellow-500 dark:bg-yellow-600 text-white",
  low: "bg-green-500 dark:bg-green-600 text-white",
  
  // 기타 상태
  success: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  warning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  error: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
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
    "border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/30 dark:to-indigo-800/20 hover:from-indigo-100 hover:to-indigo-200/50 dark:hover:from-indigo-800/40 dark:hover:to-indigo-700/30 text-indigo-900 dark:text-indigo-200 hover:shadow-lg",
  blue: "border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 hover:from-blue-100 hover:to-blue-200/50 dark:hover:from-blue-800/40 dark:hover:to-blue-700/30 text-blue-900 dark:text-blue-200 hover:shadow-lg",
  purple:
    "border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/30 dark:to-purple-800/20 hover:from-purple-100 hover:to-purple-200/50 dark:hover:from-purple-800/40 dark:hover:to-purple-700/30 text-purple-900 dark:text-purple-200 hover:shadow-lg",
  orange:
    "border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/30 dark:to-orange-800/20 hover:from-orange-100 hover:to-orange-200/50 dark:hover:from-orange-800/40 dark:hover:to-orange-700/30 text-orange-900 dark:text-orange-200 hover:shadow-lg",
  green:
    "border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/30 dark:to-green-800/20 hover:from-green-100 hover:to-green-200/50 dark:hover:from-green-800/40 dark:hover:to-green-700/30 text-green-900 dark:text-green-200 hover:shadow-lg",
  red: "border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/30 dark:to-red-800/20 hover:from-red-100 hover:to-red-200/50 dark:hover:from-red-800/40 dark:hover:to-red-700/30 text-red-900 dark:text-red-200 hover:shadow-lg",
  teal: "border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-900/30 dark:to-teal-800/20 hover:from-teal-100 hover:to-teal-200/50 dark:hover:from-teal-800/40 dark:hover:to-teal-700/30 text-teal-900 dark:text-teal-200 hover:shadow-lg",
  cyan: "border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-900/30 dark:to-cyan-800/20 hover:from-cyan-100 hover:to-cyan-200/50 dark:hover:from-cyan-800/40 dark:hover:to-cyan-700/30 text-cyan-900 dark:text-cyan-200 hover:shadow-lg",
  amber:
    "border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20 hover:from-amber-100 hover:to-amber-200/50 dark:hover:from-amber-800/40 dark:hover:to-amber-700/30 text-amber-900 dark:text-amber-200 hover:shadow-lg",
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
    red: "bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10",
    green:
      "bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10",
    yellow:
      "bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10",
    purple:
      "bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10",
    indigo:
      "bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-800/10",
  },
  medium: {
    red: "bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/30 dark:to-red-800/20",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20",
    green:
      "bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/30 dark:to-green-800/20",
    yellow:
      "bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/30 dark:to-yellow-800/20",
    purple:
      "bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/30 dark:to-purple-800/20",
    indigo:
      "bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/30 dark:to-indigo-800/20",
  },
  strong: {
    red: "bg-gradient-to-br from-red-100 to-red-200/50 dark:from-red-900/40 dark:to-red-800/30",
    blue: "bg-gradient-to-br from-blue-100 to-blue-200/50 dark:from-blue-900/40 dark:to-blue-800/30",
    green:
      "bg-gradient-to-br from-green-100 to-green-200/50 dark:from-green-900/40 dark:to-green-800/30",
    yellow:
      "bg-gradient-to-br from-yellow-100 to-yellow-200/50 dark:from-yellow-900/40 dark:to-yellow-800/30",
    purple:
      "bg-gradient-to-br from-purple-100 to-purple-200/50 dark:from-purple-900/40 dark:to-purple-800/30",
    indigo:
      "bg-gradient-to-br from-indigo-100 to-indigo-200/50 dark:from-indigo-900/40 dark:to-indigo-800/30",
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
  "bg-gray-50 dark:bg-gray-900/50"
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
    "bg-indigo-600 dark:bg-indigo-500",
    "text-white",
    "border-indigo-600 dark:border-indigo-500",
    "hover:bg-indigo-700 dark:hover:bg-indigo-600",
    className
  );
}

/**
 * 인라인 버튼 스타일 (danger variant)
 */
export function inlineButtonDanger(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-red-600 dark:bg-red-500",
    "text-white",
    "border-red-600 dark:border-red-500",
    "hover:bg-red-700 dark:hover:bg-red-600",
    className
  );
}

/**
 * 인라인 버튼 스타일 (success variant)
 */
export function inlineButtonSuccess(className?: string): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg border transition",
    "bg-green-600 dark:bg-green-500",
    "text-white",
    "border-green-600 dark:border-green-500",
    "hover:bg-green-700 dark:hover:bg-green-600",
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
  "text-red-600 dark:text-red-400"
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
    "rounded-xl border-2 border-red-300 dark:border-red-800",
    "bg-red-50 dark:bg-red-900/30",
    "p-6 shadow-sm"
  ),
  title: "text-lg font-semibold text-red-900 dark:text-red-200",
  description: "text-sm text-red-700 dark:text-red-300",
  card: cn(
    "rounded-lg border-2 border-red-300 dark:border-red-800",
    "bg-white dark:bg-gray-800",
    "p-4"
  ),
  cardTitle: "text-base font-semibold text-red-900 dark:text-red-200",
  cardValue: "text-lg font-bold text-red-600 dark:text-red-400",
  cardText: "text-xs text-gray-700 dark:text-gray-300",
};

// ============================================
// Admin 페이지용 유틸리티
// ============================================

/**
 * Admin 대시보드용 레벨 색상
 * riskLevelColors와 동일하지만 명시적으로 Admin용으로 제공
 */
export const adminLevelColors: Record<string, string> = {
  high: "bg-red-500 dark:bg-red-600 text-white",
  medium: "bg-yellow-500 dark:bg-yellow-600 text-white",
  low: "bg-green-500 dark:bg-green-600 text-white",
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
      "border-red-500 dark:border-red-600",
      "focus:border-red-500 dark:focus:border-red-600",
      "focus:ring-red-200 dark:focus:ring-red-800",
      className
    );
  }

  if (isInitialHighlight) {
    return cn(
      baseClasses,
      "border-indigo-400 dark:border-indigo-600",
      "bg-indigo-50 dark:bg-indigo-900/30",
      "focus:border-indigo-500 dark:focus:border-indigo-400",
      "focus:ring-indigo-200 dark:focus:ring-indigo-800",
      className
    );
  }

  if (disabled) {
    return cn(
      baseClasses,
      "border-gray-300 dark:border-gray-700",
      "bg-gray-100 dark:bg-gray-800",
      "text-gray-500 dark:text-gray-400",
      "cursor-not-allowed",
      className
    );
  }

  return cn(
    baseClasses,
    "border-gray-300 dark:border-gray-700",
    "focus:border-indigo-500 dark:focus:border-indigo-400",
    "focus:ring-indigo-200 dark:focus:ring-indigo-800",
    className
  );
}

/**
 * 폼 에러 메시지 스타일
 * 다크 모드를 포함한 에러 메시지 텍스트 색상
 */
export function getFormErrorClasses(className?: string): string {
  return cn("text-sm text-red-500 dark:text-red-400", className);
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
  "hover:bg-gray-50 dark:hover:bg-gray-700"
);

/**
 * 미리보기 카드 스타일
 * 정보 미리보기 섹션에 사용
 */
export const previewCardStyles = cn(
  "rounded-lg border p-4 flex flex-col gap-3",
  "border-blue-200 dark:border-blue-800",
  "bg-blue-50 dark:bg-blue-900/30"
);

/**
 * 상태별 카드 스타일
 * 완료/진행중/대기 상태에 따른 카드 스타일
 */
export const statusCardStyles = {
  completed: cn(
    "border-green-200 dark:border-green-800",
    "bg-green-50/50 dark:bg-green-900/30"
  ),
  inProgress: cn(
    "border-indigo-300 dark:border-indigo-700",
    "bg-indigo-50 dark:bg-indigo-900/30",
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
  completed: "text-green-900 dark:text-green-200",
  inProgress: "text-indigo-900 dark:text-indigo-200",
  pending: textPrimary,
  completedSubtext: "text-green-700 dark:text-green-300",
  inProgressSubtext: "text-indigo-700 dark:text-indigo-300",
  pendingSubtext: textSecondary,
};

/**
 * 상태별 배지 색상
 */
export const statusBadgeStyles = {
  completed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  inProgress: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  pending: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

/**
 * 모달 내부 구분선 스타일
 */
export const modalDivider = cn(
  "border-t",
  "border-gray-300 dark:border-gray-600"
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
  "hover:bg-gray-50 dark:hover:bg-gray-700"
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
  gray: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
  green: "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200",
  blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200",
  indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200",
  red: "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200",
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
  high: "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/30",
  medium: "border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/30",
  low: "border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/30",
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
  indigo: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  purple: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  green: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  red: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  orange: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  yellow: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
} as const;

/**
 * MetricCard용 값 텍스트 색상 매핑
 */
const metricCardValueColorMap: Record<MetricCardColor, string> = {
  indigo: "text-indigo-900 dark:text-indigo-200",
  purple: "text-purple-900 dark:text-purple-200",
  blue: "text-blue-900 dark:text-blue-200",
  green: "text-green-900 dark:text-green-200",
  red: "text-red-900 dark:text-red-200",
  orange: "text-orange-900 dark:text-orange-200",
  yellow: "text-yellow-900 dark:text-yellow-200",
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
    return "text-xs font-medium px-2 py-1 rounded bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300";
  }
  return "text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
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
  "학습시간": "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
  "점심시간": "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200",
  "학원일정": "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200",
  "이동시간": "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200",
  "자율학습": "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200",
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
export type DayTypeBadge = "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";

/**
 * 날짜 타입 배지 색상 매핑 (제네릭 함수 사용)
 * 
 * 배지(badge) 형태로 사용되는 날짜 타입별 색상 클래스를 반환합니다.
 * 배경, 텍스트, 테두리 색상을 포함합니다.
 */
const dayTypeBadgeColorMap: Record<DayTypeBadge, string> = {
  "학습일": "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  "복습일": "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  "지정휴일": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  "휴가": "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  "개인일정": "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800",
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
      bg: "bg-primary-50 dark:bg-primary-900/30",
      border: "border-primary-300 dark:border-primary-700",
      text: "text-primary-600 dark:text-primary-400",
      boldText: "text-primary-900 dark:text-primary-100",
      badge: "bg-primary-100 dark:bg-primary-800 text-primary-800 dark:text-primary-200",
    };
  }

  // 날짜 타입별 색상 매핑
  const typeMap: Record<string, { bg: string; border: string; text: string; boldText: string }> = {
    "학습일": {
      bg: "bg-info-50 dark:bg-info-900/30",
      border: "border-info-300 dark:border-info-700",
      text: "text-info-600 dark:text-info-400",
      boldText: "text-info-900 dark:text-info-100",
    },
    "복습일": {
      bg: "bg-warning-50 dark:bg-warning-900/30",
      border: "border-warning-300 dark:border-warning-700",
      text: "text-warning-600 dark:text-warning-400",
      boldText: "text-warning-900 dark:text-warning-100",
    },
    "지정휴일": {
      bg: "bg-yellow-50 dark:bg-yellow-900/30",
      border: "border-yellow-300 dark:border-yellow-700",
      text: "text-yellow-600 dark:text-yellow-400",
      boldText: "text-yellow-900 dark:text-yellow-100",
    },
    "휴가": {
      bg: "bg-gray-100 dark:bg-gray-800",
      border: "border-gray-200 dark:border-gray-700",
      text: "text-gray-600 dark:text-gray-400",
      boldText: "text-gray-900 dark:text-gray-100",
    },
    "개인일정": {
      bg: "bg-purple-50 dark:bg-purple-900/30",
      border: "border-purple-300 dark:border-purple-700",
      text: "text-purple-600 dark:text-purple-400",
      boldText: "text-purple-900 dark:text-purple-100",
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
  default: "text-indigo-600 dark:text-indigo-400",
  icon: "text-indigo-500 dark:text-indigo-400",
  link: "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300",
  heading: "text-indigo-900 dark:text-indigo-300",
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
  button: "bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white",
  badge: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-300",
  card: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200",
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
  surface: "bg-white/60 dark:bg-gray-800/60",
  card: "bg-white/80 dark:bg-gray-800/80",
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
  light: "bg-gray-50 dark:bg-gray-900",
  medium: "bg-gray-100 dark:bg-gray-800",
  dark: "bg-gray-200 dark:bg-gray-700",
  tableHeader: "bg-gray-50 dark:bg-gray-900/50",
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
  default: "text-red-600 dark:text-red-400",
  link: "text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300",
  error: "text-red-600 dark:text-red-400",
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
  button: "bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white",
  danger: "bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white",
} as const;

/**
 * Red 배경 색상 클래스 반환
 * @param variant Red 배경 변형 (button, danger)
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getRedBgClasses(variant: RedBgVariant = "button"): string {
  return getColorClasses(variant, redBgColorMap);
}

