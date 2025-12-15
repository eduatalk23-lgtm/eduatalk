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

/**
 * 테이블 행 스타일 통합 함수
 * @param variant 행 스타일 변형 (default, hover, striped, selected)
 * @param className 추가 클래스
 */
export function tableRowStyles(
  variant: "default" | "hover" | "striped" | "selected" = "default",
  className?: string
): string {
  const baseStyles = "transition-colors";
  
  const variantStyles = {
    default: "",
    hover: tableRowHover,
    striped: "odd:bg-gray-50 dark:odd:bg-gray-900/50",
    selected: "bg-indigo-50 dark:bg-indigo-900/30 border-l-4 border-indigo-500 dark:border-indigo-400",
  };

  return cn(baseStyles, variantStyles[variant], className);
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
 * 색상별 그라디언트 카드 클래스 반환
 */
export function getGradientCardClasses(color: GradientColor): string {
  const gradientMap: Record<GradientColor, string> = {
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
  };
  return gradientMap[color];
}

/**
 * 일반적인 그라디언트 배경 유틸리티 (색상별)
 */
export function getGradientBackground(
  color: "red" | "blue" | "green" | "yellow" | "purple" | "indigo",
  variant: "subtle" | "medium" | "strong" = "medium"
): string {
  const variants = {
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
  };
  return variants[variant][color];
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
 * 카드 스타일 통합 함수
 * @param variant 카드 변형 (default, hover, interactive)
 * @param padding 패딩 크기 (sm, md, lg)
 * @param className 추가 클래스
 */
export function cardStyle(
  variant: "default" | "hover" | "interactive" = "default",
  padding: "sm" | "md" | "lg" = "md",
  className?: string
): string {
  const base = cardStyles.base;
  const paddingClass = cardStyles.padding[padding];
  const variantClass =
    variant === "hover"
      ? cardStyles.hover
      : variant === "interactive"
        ? cn(cardStyles.hover, "cursor-pointer")
        : "";

  return cn(base, paddingClass, variantClass, className);
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
 * StatCard용 색상 클래스 반환
 * @param color StatCard 색상 타입
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getStatCardColorClasses(
  color: "gray" | "green" | "blue" | "indigo" | "red" | "amber" | "purple"
): string {
  const colorMap: Record<
    "gray" | "green" | "blue" | "indigo" | "red" | "amber" | "purple",
    string
  > = {
    gray: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
    green: "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200",
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200",
    red: "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200",
  };
  return colorMap[color];
}

/**
 * 위험도 레벨별 카드 스타일 (border + background)
 * RiskCard 등에서 사용하는 패턴
 * @param level 위험도 레벨
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getRiskLevelCardClasses(level: "high" | "medium" | "low"): string {
  const levelMap: Record<"high" | "medium" | "low", string> = {
    high: "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/30",
    medium: "border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/30",
    low: "border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/30",
  };
  return levelMap[level];
}

/**
 * MetricCard용 색상 클래스 반환
 * @param color MetricCard 색상 타입
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열 (배경 + 텍스트)
 */
export function getMetricCardColorClasses(
  color: "indigo" | "purple" | "blue" | "green" | "red" | "orange" | "yellow"
): string {
  const colorMap: Record<
    "indigo" | "purple" | "blue" | "green" | "red" | "orange" | "yellow",
    string
  > = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
    purple: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    green: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    red: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    orange: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    yellow: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  };
  return colorMap[color];
}

/**
 * MetricCard용 값 텍스트 색상 클래스 반환
 * @param color MetricCard 색상 타입
 * @returns 다크모드를 포함한 Tailwind 클래스 문자열
 */
export function getMetricCardValueColorClasses(
  color: "indigo" | "purple" | "blue" | "green" | "red" | "orange" | "yellow"
): string {
  const colorMap: Record<
    "indigo" | "purple" | "blue" | "green" | "red" | "orange" | "yellow",
    string
  > = {
    indigo: "text-indigo-900 dark:text-indigo-200",
    purple: "text-purple-900 dark:text-purple-200",
    blue: "text-blue-900 dark:text-blue-200",
    green: "text-green-900 dark:text-green-200",
    red: "text-red-900 dark:text-red-200",
    orange: "text-orange-900 dark:text-orange-200",
    yellow: "text-yellow-900 dark:text-yellow-200",
  };
  return colorMap[color];
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

