"use client";

import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import type { MethodStatistics } from "@/lib/domains/attendance/statistics";
import { getChartColor } from "@/lib/constants/colors";

type MethodStatisticsChartProps = {
  data: MethodStatistics[];
};

const METHOD_LABELS: Record<string, string> = {
  manual: "수동",
  qr: "QR 코드",
  location: "위치",
  auto: "자동",
};

export function MethodStatisticsChart({ data }: MethodStatisticsChartProps) {
  const { recharts, loading } = useRecharts();

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        데이터가 없습니다.
      </div>
    );
  }

  if (loading || !recharts) {
    return <ChartLoadingSkeleton height={300} />;
  }

  const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } = recharts;

  const chartData = data.map((item) => ({
    name: METHOD_LABELS[item.method] || item.method,
    value: item.count,
    percentage: item.percentage,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(props) => {
            const name = props.name ?? "";
            const percent = props.percent ?? 0;
            return `${name}: ${(percent * 100).toFixed(1)}%`;
          }}
          outerRadius={80}
          fill={getChartColor(0)}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getChartColor(index)} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

