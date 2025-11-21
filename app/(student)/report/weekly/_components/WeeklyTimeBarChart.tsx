"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type WeeklyTimeBarChartProps = {
  data: Array<{
    date: string;
    dayOfWeek: string;
    seconds: number;
    minutes: number;
  }>;
};

export function WeeklyTimeBarChart({ data }: WeeklyTimeBarChartProps) {
  const chartData = data.map((d) => ({
    day: d.dayOfWeek,
    minutes: d.minutes,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip
          formatter={(value: number) => [`${value}분`, "학습시간"]}
          labelStyle={{ color: "#374151" }}
        />
        <Bar dataKey="minutes" fill="#6366f1" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

