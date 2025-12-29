"use client";

import {
  type ReactNode,
  type CSSProperties,
  memo,
  Children,
  isValidElement,
  cloneElement,
} from "react";
import { cn } from "@/lib/cn";
import { useDensityOptional, type DensityLevel } from "@/lib/contexts";

// ============================================================================
// Types
// ============================================================================

export type GridColumns = 1 | 2 | 3 | 4 | 6 | 12;

export interface GridItemSpan {
  /** 기본 (모바일) 컬럼 스팬 */
  default?: number;
  /** sm 브레이크포인트 이상 */
  sm?: number;
  /** md 브레이크포인트 이상 */
  md?: number;
  /** lg 브레이크포인트 이상 */
  lg?: number;
  /** xl 브레이크포인트 이상 */
  xl?: number;
  /** 2xl 브레이크포인트 이상 */
  "2xl"?: number;
}

export interface DashboardGridProps {
  children: ReactNode;
  /** 최대 컬럼 수 (기본: 12) */
  columns?: GridColumns;
  /** 그리드 간격 */
  gap?: "none" | "sm" | "md" | "lg" | "xl";
  /** 밀도 오버라이드 */
  density?: DensityLevel;
  /** 컨테이너 클래스 */
  className?: string;
  /** 아이템들이 동일한 높이를 가짐 */
  equalHeight?: boolean;
  /** 자동 행 흐름 */
  autoRows?: "auto" | "min" | "fr" | "minmax";
  /** CSS 스타일 */
  style?: CSSProperties;
}

export interface GridItemProps {
  children: ReactNode;
  /** 컬럼 스팬 (숫자 또는 반응형 객체) */
  span?: number | GridItemSpan;
  /** 행 스팬 */
  rowSpan?: number;
  /** 클래스 */
  className?: string;
  /** 순서 (order) */
  order?: number | { default?: number; sm?: number; md?: number; lg?: number };
  /** 스타일 */
  style?: CSSProperties;
}

export interface WidgetCardProps {
  children: ReactNode;
  /** 카드 제목 */
  title?: ReactNode;
  /** 카드 부제목 */
  subtitle?: string;
  /** 헤더 우측 액션 */
  headerAction?: ReactNode;
  /** 컬럼 스팬 */
  span?: number | GridItemSpan;
  /** 행 스팬 */
  rowSpan?: number;
  /** 패딩 없음 */
  noPadding?: boolean;
  /** 클래스 */
  className?: string;
  /** 헤더 클래스 */
  headerClassName?: string;
  /** 바디 클래스 */
  bodyClassName?: string;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 에러 상태 */
  error?: string | null;
  /** 빈 상태 */
  isEmpty?: boolean;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

const gapClasses = {
  none: "gap-0",
  sm: "gap-2 md:gap-3",
  md: "gap-4 md:gap-5",
  lg: "gap-5 md:gap-6",
  xl: "gap-6 md:gap-8",
};

const densityGapMap: Record<DensityLevel, keyof typeof gapClasses> = {
  compact: "sm",
  normal: "md",
  comfortable: "lg",
};

const autoRowsClasses = {
  auto: "auto-rows-auto",
  min: "auto-rows-min",
  fr: "auto-rows-fr",
  minmax: "auto-rows-[minmax(0,1fr)]",
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * 반응형 컬럼 스팬 클래스 생성
 */
function getSpanClasses(span: number | GridItemSpan | undefined, maxColumns: GridColumns): string {
  if (!span) return "";

  if (typeof span === "number") {
    const clampedSpan = Math.min(span, maxColumns);
    return `col-span-${clampedSpan}`;
  }

  const classes: string[] = [];

  if (span.default) {
    classes.push(`col-span-${Math.min(span.default, maxColumns)}`);
  }
  if (span.sm) {
    classes.push(`sm:col-span-${Math.min(span.sm, maxColumns)}`);
  }
  if (span.md) {
    classes.push(`md:col-span-${Math.min(span.md, maxColumns)}`);
  }
  if (span.lg) {
    classes.push(`lg:col-span-${Math.min(span.lg, maxColumns)}`);
  }
  if (span.xl) {
    classes.push(`xl:col-span-${Math.min(span.xl, maxColumns)}`);
  }
  if (span["2xl"]) {
    classes.push(`2xl:col-span-${Math.min(span["2xl"], maxColumns)}`);
  }

  return classes.join(" ");
}

/**
 * 반응형 순서 클래스 생성
 */
function getOrderClasses(order: GridItemProps["order"]): string {
  if (order === undefined) return "";

  if (typeof order === "number") {
    return `order-${order}`;
  }

  const classes: string[] = [];
  if (order.default !== undefined) classes.push(`order-${order.default}`);
  if (order.sm !== undefined) classes.push(`sm:order-${order.sm}`);
  if (order.md !== undefined) classes.push(`md:order-${order.md}`);
  if (order.lg !== undefined) classes.push(`lg:order-${order.lg}`);

  return classes.join(" ");
}

// ============================================================================
// Components
// ============================================================================

/**
 * 대시보드 그리드 컨테이너
 *
 * 반응형 그리드 시스템으로 대시보드 위젯들을 배치합니다.
 *
 * @example
 * // 기본 사용
 * <DashboardGrid>
 *   <GridItem span={4}>Widget 1</GridItem>
 *   <GridItem span={8}>Widget 2</GridItem>
 * </DashboardGrid>
 *
 * @example
 * // 반응형 스팬
 * <DashboardGrid columns={12}>
 *   <GridItem span={{ default: 12, md: 6, lg: 4 }}>
 *     반응형 위젯
 *   </GridItem>
 * </DashboardGrid>
 */
function DashboardGridComponent({
  children,
  columns = 12,
  gap,
  density: densityOverride,
  className,
  equalHeight = false,
  autoRows = "auto",
  style,
}: DashboardGridProps) {
  const { density } = useDensityOptional();
  const effectiveDensity = densityOverride ?? density;
  const effectiveGap = gap ?? densityGapMap[effectiveDensity];

  // 자식 컴포넌트에 columns 전달 (span 계산용)
  const enhancedChildren = Children.map(children, (child) => {
    if (isValidElement(child) && (child.type === GridItem || child.type === WidgetCard)) {
      return cloneElement(child as React.ReactElement<{ _maxColumns?: GridColumns }>, {
        _maxColumns: columns,
      });
    }
    return child;
  });

  return (
    <div
      className={cn(
        "grid w-full",
        `grid-cols-${columns}`,
        // 반응형 그리드 컬럼
        columns === 12 && "grid-cols-4 sm:grid-cols-6 md:grid-cols-12",
        columns === 6 && "grid-cols-2 sm:grid-cols-3 md:grid-cols-6",
        columns === 4 && "grid-cols-2 md:grid-cols-4",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
        columns === 2 && "grid-cols-1 md:grid-cols-2",
        gapClasses[effectiveGap],
        autoRowsClasses[autoRows],
        equalHeight && "items-stretch",
        className
      )}
      style={style}
    >
      {enhancedChildren}
    </div>
  );
}

/**
 * 그리드 아이템
 *
 * DashboardGrid 내에서 개별 위젯의 위치와 크기를 제어합니다.
 */
function GridItemComponent({
  children,
  span,
  rowSpan,
  className,
  order,
  style,
  _maxColumns = 12,
}: GridItemProps & { _maxColumns?: GridColumns }) {
  return (
    <div
      className={cn(
        getSpanClasses(span, _maxColumns),
        rowSpan && `row-span-${rowSpan}`,
        getOrderClasses(order),
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * 위젯 카드
 *
 * 대시보드에서 사용되는 표준 위젯 카드 컴포넌트입니다.
 * 제목, 로딩, 에러, 빈 상태를 기본 지원합니다.
 *
 * @example
 * <DashboardGrid>
 *   <WidgetCard
 *     title="월간 통계"
 *     subtitle="2024년 1월"
 *     span={{ default: 12, md: 6 }}
 *     headerAction={<Button size="sm">더보기</Button>}
 *   >
 *     <Chart data={data} />
 *   </WidgetCard>
 * </DashboardGrid>
 */
function WidgetCardComponent({
  children,
  title,
  subtitle,
  headerAction,
  span,
  rowSpan,
  noPadding = false,
  className,
  headerClassName,
  bodyClassName,
  isLoading = false,
  error,
  isEmpty = false,
  emptyMessage = "데이터가 없습니다",
  _maxColumns = 12,
}: WidgetCardProps & { _maxColumns?: GridColumns }) {
  const { getDensityClasses } = useDensityOptional();

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            <span className="text-sm text-gray-500 dark:text-gray-400">로딩 중...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="size-5 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          </div>
        </div>
      );
    }

    if (isEmpty) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg
                className="size-5 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</span>
          </div>
        </div>
      );
    }

    return children;
  };

  return (
    <div
      className={cn(
        getSpanClasses(span, _maxColumns),
        rowSpan && `row-span-${rowSpan}`,
        "rounded-xl bg-white dark:bg-gray-900",
        "border border-gray-200 dark:border-gray-800",
        "shadow-sm",
        "flex flex-col",
        "overflow-hidden",
        className
      )}
    >
      {/* Header */}
      {(title || headerAction) && (
        <div
          className={cn(
            "flex items-center justify-between",
            "border-b border-gray-100 dark:border-gray-800",
            getDensityClasses("cardPadding"),
            "pb-3",
            headerClassName
          )}
        >
          <div className="flex flex-col">
            {typeof title === "string" ? (
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}

      {/* Body */}
      <div
        className={cn(
          "flex-1",
          !noPadding && getDensityClasses("cardPadding"),
          !noPadding && (title || headerAction) && "pt-3",
          bodyClassName
        )}
      >
        {renderContent()}
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export const DashboardGrid = memo(DashboardGridComponent);
export const GridItem = memo(GridItemComponent);
export const WidgetCard = memo(WidgetCardComponent);

// ============================================================================
// Preset Layouts
// ============================================================================

/**
 * 표준 대시보드 레이아웃
 *
 * 상단 KPI + 메인 그리드 구조
 */
export function StandardDashboardLayout({
  kpiSection,
  mainContent,
  sidePanel,
  bottomSection,
  className,
}: {
  kpiSection?: ReactNode;
  mainContent: ReactNode;
  sidePanel?: ReactNode;
  bottomSection?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* KPI Section */}
      {kpiSection && <div className="w-full">{kpiSection}</div>}

      {/* Main + Side */}
      {sidePanel ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 lg:w-2/3">{mainContent}</div>
          <div className="lg:w-1/3">{sidePanel}</div>
        </div>
      ) : (
        <div className="w-full">{mainContent}</div>
      )}

      {/* Bottom Section */}
      {bottomSection && <div className="w-full">{bottomSection}</div>}
    </div>
  );
}

/**
 * 3컬럼 카드 그리드 프리셋
 */
export function ThreeColumnGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashboardGrid columns={3} className={className}>
      {children}
    </DashboardGrid>
  );
}

/**
 * 2컬럼 카드 그리드 프리셋
 */
export function TwoColumnGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashboardGrid columns={2} className={className}>
      {children}
    </DashboardGrid>
  );
}

export default DashboardGrid;
