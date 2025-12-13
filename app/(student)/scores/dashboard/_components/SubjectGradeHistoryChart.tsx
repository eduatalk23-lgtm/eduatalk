"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SubjectGradeHistory } from "../_utils";
import { getChartColor } from "@/lib/constants/colors";

type SubjectGradeHistoryChartProps = {
  data: SubjectGradeHistory[];
};

export function SubjectGradeHistoryChart({
  data,
}: SubjectGradeHistoryChartProps) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    data.slice(0, 5).map((d) => `${d.course}:${d.course_detail}`)
  );

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        데이터가 없습니다.
      </div>
    );
  }

  // 모든 시험일 수집
  const allDates = new Set<string>();
  data.forEach((subject) => {
    subject.history.forEach((h) => {
      if (h.test_date) allDates.add(h.test_date);
    });
  });

  const sortedDates = Array.from(allDates).sort();

  // 차트 데이터 생성
  const chartData = sortedDates.map((date) => {
    const point: Record<string, any> = { date: date.slice(5) }; // MM-DD 형식
    data.forEach((subject) => {
      const key = `${subject.course}:${subject.course_detail}`;
      if (selectedSubjects.includes(key)) {
        const historyPoint = subject.history.find((h) => h.test_date === date);
        point[key] = historyPoint ? historyPoint.grade : null;
      }
    });
    return point;
  });

  const handleSubjectToggle = (key: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key].slice(0, 8) // 최대 8개까지만
    );
  };

  return (
    <div>
      {/* 과목 선택 체크박스 */}
      <div className="mb-4 flex flex-wrap gap-3">
        {data.map((subject, index) => {
          const key = `${subject.course}:${subject.course_detail}`;
          const isSelected = selectedSubjects.includes(key);
          return (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleSubjectToggle(key)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
              />
              <span
                className={`text-sm ${isSelected ? "text-chart-" + (index % 8) : "text-secondary-500"}`}
              >
                {subject.course_detail}
              </span>
            </label>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis
            domain={[1, 9]}
            reversed
            label={{ value: "등급", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            formatter={(value: any) => {
              if (value === null || value === undefined) return "데이터 없음";
              return `${value}등급`;
            }}
          />
          <Legend />
          {data.map((subject, index) => {
            const key = `${subject.course}:${subject.course_detail}`;
            if (!selectedSubjects.includes(key)) return null;
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={getChartColor(index)}
                strokeWidth={2}
                name={subject.course_detail}
                connectNulls={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

