"use client";

import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import { getChartColor } from "@/lib/constants/colors";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";
import type { ProgramRevenue } from "@/lib/domains/revenue/types";

type Props = {
  data: ProgramRevenue[];
};

export function ProgramRevenueChart({ data }: Props) {
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

  const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = recharts;

  const chartData = data.map((p) => ({
    name: p.program_name,
    value: p.total_billed,
    pct: p.pct,
  }));

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={45}
            paddingAngle={2}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={getChartColor(index)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`₩${value.toLocaleString()}`, "매출"]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="flex flex-wrap justify-center gap-3">
        {data.map((p, i) => (
          <div key={p.program_id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getChartColor(i) }}
            />
            <span className={cn("text-xs", textPrimary)}>
              {p.program_name} ({p.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
