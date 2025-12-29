/**
 * Design Tokens - 중앙화된 디자인 시스템 상수
 *
 * 이 파일은 애플리케이션 전체에서 일관된 디자인을 위한 토큰을 정의합니다.
 * CSS 변수와 함께 사용되며, 타입 안전성을 제공합니다.
 */

// ============================================================================
// 색상 토큰 (Color Tokens)
// ============================================================================

/**
 * 시맨틱 색상 팔레트
 * CSS 변수: --color-{name}-{shade}
 */
export const semanticColors = {
  primary: "indigo",
  secondary: "gray",
  success: "emerald",
  warning: "amber",
  error: "red",
  info: "blue",
} as const;

export type SemanticColor = keyof typeof semanticColors;

/**
 * 상태 색상 매핑
 */
export const statusColors = {
  active: "success",
  inactive: "secondary",
  pending: "warning",
  completed: "success",
  failed: "error",
  inProgress: "info",
} as const;

export type StatusType = keyof typeof statusColors;

/**
 * 차트 색상 (8색 팔레트)
 */
export const chartColors = [
  "#6366f1", // indigo-500
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
] as const;

/**
 * 등급 색상 (1-9등급)
 */
export const gradeColors = {
  1: { text: "text-blue-600", bg: "bg-blue-100", border: "border-blue-300" },
  2: { text: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
  3: { text: "text-sky-500", bg: "bg-sky-50", border: "border-sky-200" },
  4: { text: "text-gray-600", bg: "bg-gray-100", border: "border-gray-300" },
  5: { text: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
  6: { text: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  7: { text: "text-red-400", bg: "bg-red-50", border: "border-red-200" },
  8: { text: "text-red-500", bg: "bg-red-100", border: "border-red-300" },
  9: { text: "text-red-600", bg: "bg-red-200", border: "border-red-400" },
} as const;

// ============================================================================
// 간격 토큰 (Spacing Tokens)
// ============================================================================

/**
 * 표준 간격 스케일 (Tailwind 기반)
 * 컴포넌트 간 일관된 간격을 위해 사용
 */
export const spacing = {
  "0": "0",
  "0.5": "0.125rem", // 2px
  "1": "0.25rem", // 4px
  "1.5": "0.375rem", // 6px
  "2": "0.5rem", // 8px
  "2.5": "0.625rem", // 10px
  "3": "0.75rem", // 12px
  "4": "1rem", // 16px
  "5": "1.25rem", // 20px
  "6": "1.5rem", // 24px
  "8": "2rem", // 32px
  "10": "2.5rem", // 40px
  "12": "3rem", // 48px
  "16": "4rem", // 64px
} as const;

/**
 * 컴포넌트별 권장 간격
 */
export const componentSpacing = {
  /** 카드 내부 패딩 */
  cardPadding: {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  },
  /** 섹션 간 간격 */
  sectionGap: {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
  },
  /** 인라인 아이템 간격 */
  inlineGap: {
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  },
  /** 스택 아이템 간격 */
  stackGap: {
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
  },
} as const;

// ============================================================================
// 애니메이션 토큰 (Animation Tokens)
// ============================================================================

/**
 * 애니메이션 지속 시간
 */
export const animationDuration = {
  instant: "0ms",
  fast: "150ms",
  normal: "200ms",
  slow: "300ms",
  slower: "500ms",
  slowest: "700ms",
} as const;

/**
 * 애니메이션 이징
 */
export const animationEasing = {
  linear: "linear",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/**
 * 미리 정의된 트랜지션 클래스
 */
export const transitions = {
  /** 빠른 트랜지션 (호버 효과 등) */
  fast: "transition-all duration-150 ease-out",
  /** 기본 트랜지션 */
  base: "transition-all duration-200 ease-out",
  /** 느린 트랜지션 (모달, 드로어 등) */
  slow: "transition-all duration-300 ease-out",
  /** 색상만 트랜지션 */
  colors: "transition-colors duration-200 ease-out",
  /** 변환만 트랜지션 */
  transform: "transition-transform duration-200 ease-out",
  /** 투명도만 트랜지션 */
  opacity: "transition-opacity duration-200 ease-out",
} as const;

/**
 * 키프레임 애니메이션 이름
 * globals.css에 정의된 애니메이션과 매핑
 */
export const animations = {
  /** 페이드 인 */
  fadeIn: "animate-in fade-in-0",
  /** 페이드 아웃 */
  fadeOut: "animate-out fade-out-0",
  /** 슬라이드 인 (아래에서) */
  slideInUp: "animate-in slide-in-from-bottom-4",
  /** 슬라이드 인 (위에서) */
  slideInDown: "animate-in slide-in-from-top-4",
  /** 슬라이드 인 (오른쪽에서) */
  slideInRight: "animate-in slide-in-from-right-4",
  /** 줌 인 */
  zoomIn: "animate-in zoom-in-95",
  /** 줌 아웃 */
  zoomOut: "animate-out zoom-out-95",
  /** 반복 펄스 */
  pulse: "animate-pulse",
  /** 반복 스핀 */
  spin: "animate-spin",
  /** 반복 바운스 */
  bounce: "animate-bounce",
  /** 커스텀: 떠다니는 효과 */
  float: "animate-float",
  /** 커스텀: 바운스 인 */
  bounceIn: "animate-bounce-in",
  /** 커스텀: 셔머 효과 */
  shimmer: "animate-shimmer",
} as const;

// ============================================================================
// 타이포그래피 토큰 (Typography Tokens)
// ============================================================================

/**
 * 텍스트 크기 스케일
 */
export const fontSize = {
  xs: "text-xs", // 12px
  sm: "text-sm", // 14px
  base: "text-base", // 16px
  lg: "text-lg", // 18px
  xl: "text-xl", // 20px
  "2xl": "text-2xl", // 24px
  "3xl": "text-3xl", // 30px
  "4xl": "text-4xl", // 36px
} as const;

/**
 * 폰트 두께
 */
export const fontWeight = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

/**
 * 텍스트 스타일 프리셋
 */
export const textStyles = {
  /** 페이지 제목 */
  pageTitle: "text-2xl font-bold",
  /** 섹션 제목 */
  sectionTitle: "text-xl font-semibold",
  /** 카드 제목 */
  cardTitle: "text-lg font-medium",
  /** 본문 텍스트 */
  body: "text-base font-normal",
  /** 작은 텍스트 */
  small: "text-sm font-normal",
  /** 캡션 */
  caption: "text-xs font-normal",
  /** 라벨 */
  label: "text-sm font-medium",
} as const;

// ============================================================================
// 그림자/엘리베이션 토큰 (Shadow/Elevation Tokens)
// ============================================================================

/**
 * 엘리베이션 레벨 (Material Design 기반)
 * CSS 변수: --elevation-{level}
 */
export const elevation = {
  0: "shadow-none",
  1: "shadow-[var(--elevation-1)]",
  2: "shadow-[var(--elevation-2)]",
  4: "shadow-[var(--elevation-4)]",
  8: "shadow-[var(--elevation-8)]",
  12: "shadow-[var(--elevation-12)]",
  16: "shadow-[var(--elevation-16)]",
  24: "shadow-[var(--elevation-24)]",
} as const;

/**
 * 컴포넌트별 권장 엘리베이션
 */
export const componentElevation = {
  card: "shadow-[var(--elevation-2)]",
  cardHover: "shadow-[var(--elevation-4)]",
  dropdown: "shadow-[var(--elevation-8)]",
  modal: "shadow-[var(--elevation-16)]",
  toast: "shadow-[var(--elevation-8)]",
  tooltip: "shadow-[var(--elevation-4)]",
} as const;

// ============================================================================
// 반경 토큰 (Border Radius Tokens)
// ============================================================================

/**
 * 보더 반경
 */
export const borderRadius = {
  none: "rounded-none",
  sm: "rounded-sm",
  base: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
} as const;

/**
 * 컴포넌트별 권장 반경
 */
export const componentRadius = {
  button: "rounded-lg",
  input: "rounded-lg",
  card: "rounded-xl",
  badge: "rounded-full",
  modal: "rounded-2xl",
  tooltip: "rounded-lg",
} as const;

// ============================================================================
// Z-Index 토큰
// ============================================================================

/**
 * Z-Index 레이어
 */
export const zIndex = {
  base: "z-0",
  dropdown: "z-10",
  sticky: "z-20",
  fixed: "z-30",
  modalBackdrop: "z-40",
  modal: "z-50",
  popover: "z-60",
  tooltip: "z-70",
  toast: "z-80",
} as const;

// ============================================================================
// 브레이크포인트 (Breakpoints)
// ============================================================================

/**
 * 반응형 브레이크포인트 (Tailwind 기본값)
 */
export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 차트 색상 가져오기
 */
export function getChartColor(index: number): string {
  return chartColors[index % chartColors.length];
}

/**
 * 등급 색상 가져오기
 */
export function getGradeColorTokens(grade: number) {
  const clampedGrade = Math.max(1, Math.min(9, Math.round(grade)));
  return gradeColors[clampedGrade as keyof typeof gradeColors];
}

/**
 * 상태에 따른 시맨틱 색상 가져오기
 */
export function getStatusSemanticColor(status: StatusType): SemanticColor {
  const colorName = statusColors[status];
  return colorName === "secondary" ? "secondary" : (colorName as SemanticColor);
}
