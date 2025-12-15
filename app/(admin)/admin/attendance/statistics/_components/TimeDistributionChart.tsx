"use client";

import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import type { TimeDistribution } from "@/lib/domains/attendance/statistics";
import { getChartColor } from "@/lib/constants/colors";

type TimeDistributionChartProps = {
  data: TimeDistribution[];
};

export function TimeDistributionChart({ data }: TimeDistributionChartProps) {
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

  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = recharts;

  const chartData = data.map((item) => ({
    hour: `${item.hour}시`,
    count: item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="count"
          stroke={getChartColor(5)}
          fill={getChartColor(5)}
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

