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

import React, { Suspense, lazy, ComponentType } from "react";

// Loading skeleton for charts
export function ChartLoadingSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center"
      style={{ height }}
    >
      <div className="text-gray-400 dark:text-gray-600 text-sm">
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
export const LazyBarChart = createLazyChart(
  (r) => r.BarChart as ComponentType<any>,
  "LazyBarChart"
);

export const LazyLineChart = createLazyChart(
  (r) => r.LineChart as ComponentType<any>,
  "LazyLineChart"
);

export const LazyAreaChart = createLazyChart(
  (r) => r.AreaChart as ComponentType<any>,
  "LazyAreaChart"
);

export const LazyPieChart = createLazyChart(
  (r) => r.PieChart as ComponentType<any>,
  "LazyPieChart"
);

export const LazyComposedChart = createLazyChart(
  (r) => r.ComposedChart as ComponentType<any>,
  "LazyComposedChart"
);

export const LazyScatterChart = createLazyChart(
  (r) => r.ScatterChart as ComponentType<any>,
  "LazyScatterChart"
);

export const LazyRadarChart = createLazyChart(
  (r) => r.RadarChart as ComponentType<any>,
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
