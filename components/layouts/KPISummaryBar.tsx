"use client";

import { type ReactNode, memo } from "react";
import { cn } from "@/lib/cn";
import { useDensityOptional, type DensityLevel } from "@/lib/contexts";

// ============================================================================
// Types
// ============================================================================

export type KPITrend = "up" | "down" | "neutral";
export type KPIStatus = "success" | "warning" | "error" | "info" | "default";

export interface KPIItem {
  /** 고유 ID */
  id: string;
  /** 라벨 */
  label: string;
  /** 값 */
  value: string | number;
  /** 단위 (선택적) */
  unit?: string;
  /** 변화 추세 */
  trend?: KPITrend;
  /** 변화율 */
  changePercent?: number;
  /** 상태 */
  status?: KPIStatus;
  /** 아이콘 */
  icon?: ReactNode;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 툴팁 */
  tooltip?: string;
  /** 보조 텍스트 */
  subtext?: string;
}

export interface KPISummaryBarProps {
  /** KPI 아이템 목록 */
  items: KPIItem[];
  /** 레이아웃 스타일 */
  variant?: "card" | "inline" | "compact";
  /** 컨테이너 클래스 */
  className?: string;
  /** 밀도 오버라이드 */
  density?: DensityLevel;
  /** 고정 여부 */
  sticky?: boolean;
  /** 배경색 스타일 */
  background?: "white" | "gray" | "transparent";
  /** 구분선 표시 */
  showDividers?: boolean;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 아이템 최대 개수 (넘으면 더보기) */
  maxVisible?: number;
}

export interface KPICardProps {
  item: KPIItem;
  variant: KPISummaryBarProps["variant"];
  showDivider?: boolean;
  isLast?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const statusColors: Record<KPIStatus, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
  default: "text-gray-900 dark:text-gray-100",
};

const statusBgColors: Record<KPIStatus, string> = {
  success: "bg-emerald-50 dark:bg-emerald-900/20",
  warning: "bg-amber-50 dark:bg-amber-900/20",
  error: "bg-red-50 dark:bg-red-900/20",
  info: "bg-blue-50 dark:bg-blue-900/20",
  default: "bg-gray-50 dark:bg-gray-800/50",
};

const trendIcons: Record<KPITrend, { icon: ReactNode; color: string }> = {
  up: {
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    color: "text-emerald-500",
  },
  down: {
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    color: "text-red-500",
  },
  neutral: {
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    ),
    color: "text-gray-400",
  },
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 개별 KPI 카드
 */
const KPICard = memo(function KPICard({
  item,
  variant = "card",
  showDivider = false,
  isLast = false,
}: KPICardProps) {
  const { getDensityClasses } = useDensityOptional();
  const trend = item.trend ? trendIcons[item.trend] : null;
  const isClickable = !!item.onClick;

  const content = (
    <>
      {/* Icon */}
      {item.icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-lg",
            variant === "compact" ? "size-8" : "size-10",
            statusBgColors[item.status ?? "default"]
          )}
        >
          <span className={cn("size-5", statusColors[item.status ?? "default"])}>{item.icon}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col min-w-0">
        {/* Label */}
        <span
          className={cn(
            "text-gray-500 dark:text-gray-400 truncate",
            variant === "compact" ? "text-xs" : "text-sm"
          )}
        >
          {item.label}
        </span>

        {/* Value */}
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "font-semibold tabular-nums",
              statusColors[item.status ?? "default"],
              variant === "compact" ? "text-lg" : "text-xl md:text-2xl"
            )}
          >
            {item.value}
          </span>
          {item.unit && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{item.unit}</span>
          )}
        </div>

        {/* Subtext or Trend */}
        {(item.subtext || trend) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {trend && (
              <span className={cn("flex items-center gap-0.5", trend.color)}>
                {trend.icon}
                {item.changePercent !== undefined && (
                  <span className="text-xs font-medium">
                    {item.changePercent > 0 ? "+" : ""}
                    {item.changePercent}%
                  </span>
                )}
              </span>
            )}
            {item.subtext && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{item.subtext}</span>
            )}
          </div>
        )}
      </div>
    </>
  );

  const cardClasses = cn(
    "flex items-center gap-3",
    variant === "card" && [
      "rounded-xl bg-white dark:bg-gray-900",
      "border border-gray-200 dark:border-gray-800",
      "shadow-sm",
      getDensityClasses("cardPadding"),
    ],
    variant === "inline" && [
      getDensityClasses("padding"),
      !isLast && showDivider && "border-r border-gray-200 dark:border-gray-700",
    ],
    variant === "compact" && [
      "py-2 px-3",
      !isLast && showDivider && "border-r border-gray-200 dark:border-gray-700",
    ],
    isClickable && [
      "cursor-pointer transition-colors",
      variant === "card"
        ? "hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md"
        : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
    ]
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        className={cardClasses}
        title={item.tooltip}
        aria-label={`${item.label}: ${item.value}${item.unit ?? ""}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cardClasses} title={item.tooltip}>
      {content}
    </div>
  );
});

/**
 * KPI 스켈레톤
 */
function KPISkeleton({ variant }: { variant: KPISummaryBarProps["variant"] }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 animate-pulse",
        variant === "card" && "p-4 rounded-xl bg-gray-100 dark:bg-gray-800",
        variant === "inline" && "p-4",
        variant === "compact" && "py-2 px-3"
      )}
    >
      <div
        className={cn(
          "rounded-lg bg-gray-200 dark:bg-gray-700",
          variant === "compact" ? "size-8" : "size-10"
        )}
      />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * KPI Summary Bar
 *
 * 대시보드 상단에 주요 지표를 표시하는 요약 바입니다.
 *
 * @example
 * // 기본 카드 스타일
 * <KPISummaryBar
 *   items={[
 *     { id: "1", label: "총 학생", value: 150, icon: <UsersIcon />, status: "info" },
 *     { id: "2", label: "오늘 출석률", value: 94, unit: "%", trend: "up", changePercent: 2 },
 *     { id: "3", label: "평균 학습 시간", value: "2.5", unit: "시간", status: "success" },
 *   ]}
 * />
 *
 * @example
 * // 인라인 스타일
 * <KPISummaryBar
 *   variant="inline"
 *   background="gray"
 *   showDividers
 *   items={kpiItems}
 * />
 */
function KPISummaryBarComponent({
  items,
  variant = "card",
  className,
  density,
  sticky = false,
  background = "transparent",
  showDividers = false,
  isLoading = false,
  maxVisible,
}: KPISummaryBarProps) {
  const { getDensityClasses } = useDensityOptional();

  const visibleItems = maxVisible ? items.slice(0, maxVisible) : items;
  const hiddenCount = maxVisible ? Math.max(0, items.length - maxVisible) : 0;

  const backgroundClasses = {
    white: "bg-white dark:bg-gray-900",
    gray: "bg-gray-50 dark:bg-gray-900/50",
    transparent: "bg-transparent",
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "w-full",
          sticky && "sticky top-0 z-10",
          backgroundClasses[background],
          variant === "card" && "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          (variant === "inline" || variant === "compact") && "flex flex-wrap",
          className
        )}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <KPISkeleton key={i} variant={variant} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full",
        sticky && "sticky top-0 z-10",
        backgroundClasses[background],
        variant === "card" && [
          "grid gap-4",
          "grid-cols-1 sm:grid-cols-2",
          visibleItems.length >= 4 && "lg:grid-cols-4",
          visibleItems.length === 3 && "lg:grid-cols-3",
          visibleItems.length === 2 && "lg:grid-cols-2",
        ],
        (variant === "inline" || variant === "compact") && [
          "flex flex-wrap items-center",
          "rounded-xl",
          background !== "transparent" && "border border-gray-200 dark:border-gray-800",
        ],
        className
      )}
    >
      {visibleItems.map((item, index) => (
        <KPICard
          key={item.id}
          item={item}
          variant={variant}
          showDivider={showDividers}
          isLast={index === visibleItems.length - 1 && hiddenCount === 0}
        />
      ))}

      {/* More indicator */}
      {hiddenCount > 0 && (
        <div
          className={cn(
            "flex items-center justify-center",
            variant === "card" && [
              "rounded-xl bg-gray-50 dark:bg-gray-800/50",
              "border border-dashed border-gray-300 dark:border-gray-700",
              getDensityClasses("cardPadding"),
            ],
            (variant === "inline" || variant === "compact") && "px-4"
          )}
        >
          <span className="text-sm text-gray-500 dark:text-gray-400">+{hiddenCount} 더보기</span>
        </div>
      )}
    </div>
  );
}

export const KPISummaryBar = memo(KPISummaryBarComponent);

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * 간단한 숫자 KPI 바
 */
export function SimpleKPIBar({
  items,
  className,
}: {
  items: { label: string; value: string | number; unit?: string }[];
  className?: string;
}) {
  const kpiItems: KPIItem[] = items.map((item, index) => ({
    id: String(index),
    label: item.label,
    value: item.value,
    unit: item.unit,
  }));

  return <KPISummaryBar items={kpiItems} variant="compact" showDividers className={className} />;
}

/**
 * 상태 기반 KPI 바
 */
export function StatusKPIBar({
  items,
  className,
}: {
  items: {
    label: string;
    value: string | number;
    status: KPIStatus;
    icon?: ReactNode;
  }[];
  className?: string;
}) {
  const kpiItems: KPIItem[] = items.map((item, index) => ({
    id: String(index),
    ...item,
  }));

  return <KPISummaryBar items={kpiItems} variant="card" className={className} />;
}

export default KPISummaryBar;
