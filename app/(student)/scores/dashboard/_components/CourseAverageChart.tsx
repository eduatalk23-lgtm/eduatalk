"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { CourseAverageGrade } from "../_utils";
import { getChartColor } from "@/lib/constants/colors";

type CourseAverageChartProps = {
  data: CourseAverageGrade[];
};

export function CourseAverageChart({ data }: CourseAverageChartProps) {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        데이터가 없습니다.
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.course,
    "평균 등급": Number(item.averageGrade.toFixed(1)),
    "성적 개수": item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={80}
          interval={0}
        />
        <YAxis
          domain={[0, 9]}
          reversed
          label={{ value: "등급", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === "평균 등급") {
              return [`${value.toFixed(1)}등급`, "평균 등급"];
            }
            return [value, name];
          }}
        />
        <Legend />
        <Bar dataKey="평균 등급" fill={getChartColor(0)} name="평균 등급" />
      </BarChart>
    </ResponsiveContainer>
  );
}

