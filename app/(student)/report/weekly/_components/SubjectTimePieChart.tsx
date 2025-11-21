"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

type SubjectTimePieChartProps = {
  data: Array<{
    subject: string;
    seconds: number;
    minutes: number;
    percentage: number;
  }>;
};

// 과목별 색상 팔레트
const SUBJECT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#14b8a6", // teal
];

export function SubjectTimePieChart({ data }: SubjectTimePieChartProps) {
  const chartData = data.map((d) => ({
    name: d.subject,
    value: d.minutes,
    percentage: d.percentage,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(props: any) => {
              const { name, payload } = props;
              const percentage = payload?.percentage ?? 0;
              return `${name} ${percentage.toFixed(1)}%`;
            }}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={SUBJECT_COLORS[index % SUBJECT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value}분`, "학습시간"]}
            labelStyle={{ color: "#374151" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {chartData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2 text-sm">
            <div
              className="h-4 w-4 rounded"
              style={{
                backgroundColor: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
              }}
            />
            <span className="text-gray-700">{item.name}</span>
            <span className="text-gray-500">({item.value}분)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

