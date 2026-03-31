/**
 * 리포트 전용 디자인 토큰
 * globals.css의 CSS 변수(--text-primary, --color-chart-* 등)를 Tailwind 클래스로 래핑.
 * 모든 리포트 섹션에서 하드코딩 대신 이 토큰을 사용.
 */

// ─── 배지 색상 (stage/status/area 공용) ──

export const BADGE = {
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
} as const;

export type BadgeColor = keyof typeof BADGE;

// ─── 카드 스타일 (방향 가이드, 대학 전략 등) ──

export const CARD = {
  default: "rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4 dark:border-[var(--border-primary)] dark:bg-[var(--surface-primary)]",
  violet: "rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/20",
  blue: "rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20",
  emerald: "rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20",
  amber: "rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20",
  indigo: "rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20",
} as const;

// ─── 테이블 ──

export const TABLE = {
  wrapper: "w-full border-collapse text-sm",
  thead: "border-b border-[var(--border-secondary)] bg-[var(--surface-secondary)]",
  th: "px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)]",
  td: "px-3 py-2 text-sm text-[var(--text-primary)]",
  tr: "border-b border-[var(--border-primary)] last:border-0",
  trHover: "border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--surface-hover)]",
} as const;

// ─── 간격 스케일 ──

export const SPACING = {
  /** 섹션 내 블록 간 */
  sectionGap: "space-y-4",
  /** 카드 내 요소 간 */
  cardGap: "space-y-3",
  /** 아이템 목록 간 */
  itemGap: "space-y-2",
  /** 인라인 요소 간 */
  inlineGap: "gap-2",
  /** 배지 목록 간 */
  badgeGap: "gap-1.5",
} as const;

// ─── 타이포그래피 ──

export const TYPO = {
  /** 섹션 최상단 제목 */
  sectionTitle: "text-lg font-bold text-[var(--text-primary)]",
  /** 카드/블록 제목 */
  subsectionTitle: "text-sm font-semibold text-[var(--text-primary)]",
  /** 본문 텍스트 */
  body: "text-sm leading-relaxed text-[var(--text-primary)]",
  /** 부가 설명 */
  caption: "text-xs text-[var(--text-tertiary)]",
  /** KPI/지표 숫자 */
  metric: "text-2xl font-bold tabular-nums text-[var(--text-primary)]",
  /** 빈 상태 메시지 */
  empty: "text-sm text-[var(--text-placeholder)]",
  /** 레이블 (뱃지 내부 등) */
  label: "text-xs font-medium",
} as const;

// ─── 차트 팔레트 ──

/** CSS 변수 참조 (CSS-in-JS, SVG fill 등) */
export const CHART_COLORS = [
  "var(--color-chart-1)", // indigo
  "var(--color-chart-2)", // purple
  "var(--color-chart-3)", // pink
  "var(--color-chart-4)", // amber
  "var(--color-chart-5)", // emerald
  "var(--color-chart-6)", // blue
  "var(--color-chart-7)", // red
  "var(--color-chart-8)", // teal
] as const;

/** Recharts용 hex 폴백 (CSS 변수 미지원) */
export const CHART_HEX = [
  "#4f46e5", // indigo
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#059669", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#14b8a6", // teal
] as const;

/** 이름 → hex 매핑 */
export const CHART_NAMED = {
  indigo: "#4f46e5",
  purple: "#8b5cf6",
  pink: "#ec4899",
  amber: "#f59e0b",
  emerald: "#059669",
  blue: "#3b82f6",
  red: "#ef4444",
  teal: "#14b8a6",
} as const;

// ─── 프로그레스 바 ──

export const PROGRESS = {
  track: "h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700",
  bar: "h-full rounded-full transition-all",
  /** 비율에 따른 바 색상 */
  barColor: (percent: number) =>
    percent >= 70
      ? "bg-emerald-500 dark:bg-emerald-400"
      : percent >= 40
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-red-500 dark:bg-red-400",
} as const;

// ─── 영역 배지 매핑 (로드맵, 액션아이템 등) ──

export const AREA_BADGE: Record<string, string> = {
  setek: BADGE.indigo,
  personal_setek: BADGE.blue,
  changche: BADGE.violet,
  autonomy: BADGE.violet,
  club: BADGE.blue,
  career: BADGE.emerald,
  reading: BADGE.amber,
  course_selection: BADGE.gray,
  haengteuk: BADGE.emerald,
  competition: BADGE.red,
  external: BADGE.gray,
  volunteer: BADGE.amber,
  general: BADGE.gray,
};

// ─── 상태 배지 매핑 ──

export const STATUS_BADGE: Record<string, string> = {
  planning: BADGE.gray,
  confirmed: BADGE.blue,
  in_progress: BADGE.amber,
  completed: BADGE.emerald,
  recommended: BADGE.violet,
};
