"use client";

import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";

type PlanCompletionLineChartProps = {
  data: Array<{
    date: string;
    dayOfWeek: string;
    totalPlans: number;
    completedPlans: number;
    completionRate: number;
  }>;
};

export function PlanCompletionLineChart({ data }: PlanCompletionLineChartProps) {
  const { recharts, loading } = useRecharts();

  const chartData = data.map((d) => ({
    day: d.dayOfWeek,
    rate: d.completionRate,
    completed: d.completedPlans,
    total: d.totalPlans,
  }));

  if (loading || !recharts) {
    return <ChartLoadingSkeleton height={300} />;
  }

  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = recharts;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis domain={[0, 100]} />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === "rate") {
              return [`${value}%`, "실행률"];
            }
            return [value, name === "completed" ? "완료" : "전체"];
          }}
          labelStyle={{ color: "#374151" }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 6 }}
          activeDot={{ r: 8 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

