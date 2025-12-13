/**
 * @deprecated 이 컴포넌트는 레거시 성적 대시보드에서 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 */
"use client";

import React from "react";
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
import type { SchoolScoreRow } from "../_utils/scoreQueries";
import { EmptyState } from "@/components/molecules/EmptyState";

type SemesterChartsSectionProps = {
  schoolScores: SchoolScoreRow[];
};

export function SemesterChartsSection({
  schoolScores,
}: SemesterChartsSectionProps) {
  // 학년·학기별로 데이터 그룹화
  const chartData = React.useMemo(() => {
    const grouped = new Map<string, SchoolScoreRow[]>();

    schoolScores.forEach((score) => {
      if (!score.grade || !score.semester) return;
      const key = `${score.grade}학년 ${score.semester}학기`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(score);
    });

    // 각 학기별로 평균 등급 계산
    const result: Array<{
      period: string;
      averageGrade: number;
      count: number;
    }> = [];

    grouped.forEach((scores, period) => {
      const validGrades = scores
        .map((s) => s.grade_score)
        .filter((g): g is number => g !== null && g !== undefined);
      if (validGrades.length === 0) return;

      const average =
        validGrades.reduce((a, b) => a + b, 0) / validGrades.length;
      result.push({
        period,
        averageGrade: Number(average.toFixed(1)),
        count: validGrades.length,
      });
    });

    // 학년·학기 순서로 정렬
    return result.sort((a, b) => {
      const aMatch = a.period.match(/(\d)학년 (\d)학기/);
      const bMatch = b.period.match(/(\d)학년 (\d)학기/);
      if (!aMatch || !bMatch) return 0;
      const aGrade = parseInt(aMatch[1]);
      const bGrade = parseInt(bMatch[1]);
      if (aGrade !== bGrade) return aGrade - bGrade;
      const aSemester = parseInt(aMatch[2]);
      const bSemester = parseInt(bMatch[2]);
      return aSemester - bSemester;
    });
  }, [schoolScores]);

  if (schoolScores.length === 0 || chartData.length === 0) {
    return (
      <EmptyState
        icon="📈"
        title="내신 학기별 데이터가 없습니다"
        description="내신 성적을 등록하면 학기별 변화 그래프가 표시됩니다."
      />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-gray-900">
        내신 학기별 변화
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="period"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis
            domain={[1, 9]}
            reversed
            label={{ value: "평균 등급", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}등급`, "평균 등급"]}
            labelFormatter={(label) => `기간: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="averageGrade"
            stroke="#6366f1"
            strokeWidth={2}
            name="평균 등급"
            dot={{ r: 6 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

