"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { getSubjectColor, getSubjectColorClass } from "@/lib/constants/chartColors";

type SubjectTimePieChartProps = {
  data: Array<{
    subject: string;
    seconds: number;
    minutes: number;
    percentage: number;
  }>;
};

export function SubjectTimePieChart({ data }: SubjectTimePieChartProps) {
  const chartData = data.map((d) => ({
    name: d.subject,
    value: d.minutes,
    percentage: d.percentage,
  }));

  return (
    <div className="flex flex-col gap-4">
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
              <Cell key={`cell-${index}`} fill={getSubjectColor(index)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value}분`, "학습시간"]}
            labelStyle={{ color: "#374151" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {chartData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2 text-sm">
            <div
              className={`h-4 w-4 rounded ${getSubjectColorClass(index)}`}
            />
            <span className="text-gray-700">{item.name}</span>
            <span className="text-gray-500">({item.value}분)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

