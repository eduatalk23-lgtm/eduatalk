"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type MockTrendChartProps = {
  scores: any[];
};

export default function MockTrendChart({ scores }: MockTrendChartProps) {
  // 과목별로 그룹화하여 차트 데이터 준비
  const chartData = useMemo(() => {
    // 시험일별로 그룹화
    const groupedByExam = scores.reduce((acc, score) => {
      const key = `${score.exam_date}-${score.exam_title}`;
      if (!acc[key]) {
        acc[key] = {
          exam_date: score.exam_date,
          exam_title: score.exam_title,
          label: `${new Date(score.exam_date).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
          })} ${score.exam_title}`,
          scores: [],
        };
      }

      if (score.percentile !== null) {
        acc[key].scores.push(score.percentile);
      }

      return acc;
    }, {} as Record<string, { exam_date: string; exam_title: string; label: string; scores: number[] }>);

    // 평균 백분위 계산
    return Object.values(groupedByExam)
      .map((exam) => ({
        label: exam.label,
        exam_date: exam.exam_date,
        average_percentile:
          exam.scores.length > 0
            ? exam.scores.reduce((sum, s) => sum + s, 0) / exam.scores.length
            : null,
      }))
      .filter((d) => d.average_percentile !== null)
      .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
  }, [scores]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <p className="text-sm">백분위 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /> {/* gray-200 */}
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          stroke="#6b7280" {/* gray-500 */}
          angle={-15}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          stroke="#6b7280" {/* gray-500 */}
          label={{ value: "백분위 (%)", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff", {/* white */}
            border: "1px solid #e5e7eb", {/* gray-200 */}
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: any) => [`${value.toFixed(1)}%`, "평균 백분위"]}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Line
          type="monotone"
          dataKey="average_percentile"
          stroke="#6366f1" {/* indigo-500 */}
          strokeWidth={2}
          dot={{ fill: "#6366f1", r: 4 }} {/* indigo-500 */}
          activeDot={{ r: 6 }}
          name="평균 백분위"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

