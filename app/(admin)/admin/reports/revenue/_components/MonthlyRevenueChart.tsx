"use client";

import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import { getChartColor } from "@/lib/constants/colors";
import { cn } from "@/lib/cn";
import { textSecondary } from "@/lib/utils/darkMode";
import type { MonthlyRevenue } from "@/lib/domains/revenue/types";

type Props = {
  data: MonthlyRevenue[];
};

export function MonthlyRevenueChart({ data }: Props) {
  const { recharts, loading } = useRecharts();

  if (loading || !recharts) {
    return <ChartLoadingSkeleton height={300} />;
  }

  if (data.length === 0) {
    return (
      <div className={cn("flex h-[300px] items-center justify-center text-sm", textSecondary)}>
        데이터가 없습니다.
      </div>
    );
  }

  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } =
    recharts;

  // 시간순 정렬 (오래된 것 먼저)
  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));

  const formatAmount = (value: number) =>
    `₩${(value / 10000).toFixed(0)}만`;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={sorted} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          tickFormatter={(v: string) => v.slice(5)} // "2026-02" → "02"
        />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAmount} width={60} />
        <Tooltip
          formatter={(value: number, name: string) => [
            `₩${value.toLocaleString()}`,
            name === "paid" ? "수납" : name === "billed" ? "청구" : "미수금",
          ]}
          labelFormatter={(label: string) => `${label}월`}
        />
        <Legend
          formatter={(value: string) =>
            value === "paid" ? "수납" : value === "billed" ? "청구" : "미수금"
          }
        />
        <Bar dataKey="billed" fill={getChartColor(5)} radius={[4, 4, 0, 0]} />
        <Bar dataKey="paid" fill={getChartColor(4)} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
