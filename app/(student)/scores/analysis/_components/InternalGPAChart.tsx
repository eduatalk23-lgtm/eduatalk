"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type InternalGPAChartProps = {
  data: Array<{
    grade: number;
    semester: number;
    gpa: number;
    term: string;
  }>;
};

export default function InternalGPAChart({ data }: InternalGPAChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <p className="text-sm">GPA 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="term"
          tick={{ fontSize: 12 }}
          stroke="#6b7280"
        />
        <YAxis
          domain={[1, 9]}
          reversed
          tick={{ fontSize: 12 }}
          stroke="#6b7280"
          label={{ value: "등급", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: any) => [`${value}등급`, "GPA"]}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px" }}
        />
        <Line
          type="monotone"
          dataKey="gpa"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={{ fill: "#4f46e5", r: 4 }}
          activeDot={{ r: 6 }}
          name="GPA"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

