/**
 * @deprecated 이 컴포넌트는 레거시 성적 대시보드에서 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 */
"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SchoolScoreRow, MockScoreRow } from "../_utils/scoreQueries";

type CompareSectionProps = {
  schoolScores: SchoolScoreRow[];
  mockScores: MockScoreRow[];
};

const COMPARABLE_SUBJECTS = ["국어", "수학", "영어"];

export function CompareSection({
  schoolScores,
  mockScores,
}: CompareSectionProps) {
  const chartData = React.useMemo(() => {
    const result: Array<{
      subject: string;
      내신: number | null;
      모의고사: number | null;
    }> = [];

    COMPARABLE_SUBJECTS.forEach((subject) => {
      // 내신 평균 등급 계산
      const schoolScoresForSubject = schoolScores.filter(
        (s) => s.subject_group === subject && s.grade_score !== null
      );
      const schoolAverage =
        schoolScoresForSubject.length > 0
          ? schoolScoresForSubject.reduce(
              (sum, s) => sum + (s.grade_score ?? 0),
              0
            ) / schoolScoresForSubject.length
          : null;

      // 모의고사 평균 등급 계산
      const mockScoresForSubject = mockScores.filter(
        (s) => s.subject_group === subject && s.grade_score !== null
      );
      const mockAverage =
        mockScoresForSubject.length > 0
          ? mockScoresForSubject.reduce(
              (sum, s) => sum + (s.grade_score ?? 0),
              0
            ) / mockScoresForSubject.length
          : null;

      // 둘 중 하나라도 데이터가 있으면 추가
      if (schoolAverage !== null || mockAverage !== null) {
        result.push({
          subject,
          내신: schoolAverage !== null ? Number(schoolAverage.toFixed(1)) : null,
          모의고사: mockAverage !== null ? Number(mockAverage.toFixed(1)) : null,
        });
      }
    });

    return result;
  }, [schoolScores, mockScores]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">⚖️</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            비교 데이터가 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            내신과 모의고사 성적을 모두 등록하면 비교 그래프가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        내신 vs 모의고사 비교
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="subject" />
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
          <Bar dataKey="내신" fill="#6366f1" name="내신 평균 등급" />
          <Bar dataKey="모의고사" fill="#8b5cf6" name="모의고사 평균 등급" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

