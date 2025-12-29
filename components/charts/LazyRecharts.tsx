"use client";

/**
 * Lazy-loaded Recharts components
 *
 * Recharts is a large library (~327KB). This module provides lazy-loaded
 * versions of commonly used components to reduce initial bundle size.
 *
 * Usage:
 * Instead of: import { BarChart, Bar, ... } from "recharts";
 * Use: import { LazyBarChart, LazyBar, ... } from "@/components/charts/LazyRecharts";
 *
 * Or use the hook for dynamic import:
 * const { BarChart, Bar, ... } = await useRechartsComponents();
 */

import React, { ComponentType } from "react";

// Recharts 차트 컴포넌트의 공통 Props 타입 (런타임에 동적 로딩되므로 정확한 타입 불필요)
// Record<string, unknown>은 any보다 안전하면서도 유연성 제공
type ChartProps = Record<string, unknown>;

// Loading skeleton for charts
export function ChartLoadingSkeleton({ height = 300 }: { height?: number }) {
  // 동적 height는 인라인 스타일이 필요 (Tailwind arbitrary values는 빌드 시점에 생성되어야 함)
  return (
    <div
      className="animate-pulse bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-900))] rounded-lg flex items-center justify-center"
      style={{ height: `${height}px` }}
    >
      <div className="text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)] text-body-2">
        차트 로딩 중...
      </div>
    </div>
  );
}

// Type definitions for recharts components
type RechartsModule = typeof import("recharts");

// Cache for loaded recharts module
let rechartsCache: RechartsModule | null = null;
let rechartsPromise: Promise<RechartsModule> | null = null;

/**
 * Dynamically import recharts module (with caching)
 */
export async function loadRecharts(): Promise<RechartsModule> {
  if (rechartsCache) {
    return rechartsCache;
  }

  if (!rechartsPromise) {
    rechartsPromise = import("recharts").then((module) => {
      rechartsCache = module;
      return module;
    });
  }

  return rechartsPromise;
}

/**
 * Hook to get recharts components with loading state
 */
export function useRecharts() {
  const [recharts, setRecharts] = React.useState<RechartsModule | null>(rechartsCache);
  const [loading, setLoading] = React.useState(!rechartsCache);

  React.useEffect(() => {
    if (!recharts) {
      loadRecharts().then((module) => {
        setRecharts(module);
        setLoading(false);
      });
    }
  }, [recharts]);

  return { recharts, loading };
}

// Lazy wrapper component factory
function createLazyChart<P extends object>(
  getComponent: (recharts: RechartsModule) => ComponentType<P>,
  displayName: string
) {
  const LazyComponent = React.forwardRef<unknown, P & { fallbackHeight?: number }>(
    function LazyChartComponent({ fallbackHeight = 300, ...props }, ref) {
      const { recharts, loading } = useRecharts();

      if (loading || !recharts) {
        return <ChartLoadingSkeleton height={fallbackHeight} />;
      }

      const Component = getComponent(recharts);
      return <Component {...(props as P)} ref={ref} />;
    }
  );

  LazyComponent.displayName = displayName;
  return LazyComponent;
}

// Export lazy-loaded chart components
export const LazyBarChart = createLazyChart<ChartProps>(
  (r) => r.BarChart as ComponentType<ChartProps>,
  "LazyBarChart"
);

export const LazyLineChart = createLazyChart<ChartProps>(
  (r) => r.LineChart as ComponentType<ChartProps>,
  "LazyLineChart"
);

export const LazyAreaChart = createLazyChart<ChartProps>(
  (r) => r.AreaChart as ComponentType<ChartProps>,
  "LazyAreaChart"
);

export const LazyPieChart = createLazyChart<ChartProps>(
  (r) => r.PieChart as ComponentType<ChartProps>,
  "LazyPieChart"
);

export const LazyComposedChart = createLazyChart<ChartProps>(
  (r) => r.ComposedChart as ComponentType<ChartProps>,
  "LazyComposedChart"
);

export const LazyScatterChart = createLazyChart<ChartProps>(
  (r) => r.ScatterChart as ComponentType<ChartProps>,
  "LazyScatterChart"
);

export const LazyRadarChart = createLazyChart<ChartProps>(
  (r) => r.RadarChart as ComponentType<ChartProps>,
  "LazyRadarChart"
);

// ResponsiveContainer wrapper that loads recharts lazily
export function LazyResponsiveContainer({
  children,
  fallbackHeight = 300,
  width,
  height,
  aspect,
  minWidth,
  minHeight,
  debounce,
}: {
  children: React.ReactNode;
  fallbackHeight?: number;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  aspect?: number;
  minWidth?: number;
  minHeight?: number;
  debounce?: number;
}) {
  const { recharts, loading } = useRecharts();

  if (loading || !recharts) {
    return <ChartLoadingSkeleton height={fallbackHeight} />;
  }

  const { ResponsiveContainer } = recharts;
  return (
    <ResponsiveContainer
      width={width}
      height={height}
      aspect={aspect}
      minWidth={minWidth}
      minHeight={minHeight}
      debounce={debounce}
    >
      {children}
    </ResponsiveContainer>
  );
}
