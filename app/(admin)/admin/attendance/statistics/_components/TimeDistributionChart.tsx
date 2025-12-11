"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TimeDistribution } from "@/lib/domains/attendance/statistics";

type TimeDistributionChartProps = {
  data: TimeDistribution[];
};

export function TimeDistributionChart({ data }: TimeDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        데이터가 없습니다.
      </div>
    );
  }
  
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
          stroke="#3b82f6" 
          fill="#3b82f6" 
          fillOpacity={0.6} 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

