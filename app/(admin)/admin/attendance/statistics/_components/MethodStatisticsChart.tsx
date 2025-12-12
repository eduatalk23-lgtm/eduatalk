"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { MethodStatistics } from "@/lib/domains/attendance/statistics";

type MethodStatisticsChartProps = {
  data: MethodStatistics[];
};

const METHOD_LABELS: Record<string, string> = {
  manual: "수동",
  qr: "QR 코드",
  location: "위치",
  auto: "자동",
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export function MethodStatisticsChart({ data }: MethodStatisticsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        데이터가 없습니다.
      </div>
    );
  }
  
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
          label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

