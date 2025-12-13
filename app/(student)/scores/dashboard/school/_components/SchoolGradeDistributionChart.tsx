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
import type { SchoolScoreRow } from "../../_utils/scoreQueries";

type SchoolGradeDistributionChartProps = {
  schoolScores: SchoolScoreRow[];
};

export function SchoolGradeDistributionChart({
  schoolScores,
}: SchoolGradeDistributionChartProps) {
  // 등급별 분포 데이터 생성
  const distributionData = React.useMemo(() => {
    const gradeCount = new Map<number, number>();
    
    schoolScores.forEach((score) => {
      if (score.grade_score !== null && score.grade_score !== undefined) {
        const grade = Math.round(score.grade_score);
        gradeCount.set(grade, (gradeCount.get(grade) || 0) + 1);
      }
    });

    const result: Array<{ grade: string; count: number; percentage: number }> = [];
    const total = schoolScores.filter((s) => s.grade_score !== null).length;

    for (let i = 1; i <= 9; i++) {
      const count = gradeCount.get(i) || 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      result.push({
        grade: `${i}등급`,
        count,
        percentage: Number(percentage.toFixed(1)),
      });
    }

    return result;
  }, [schoolScores]);

  // 학년별 등급 분포
  const gradeDistribution = React.useMemo(() => {
    const gradeMap = new Map<number, Map<number, number>>();

    schoolScores.forEach((score) => {
      if (score.grade && score.grade_score !== null) {
        if (!gradeMap.has(score.grade)) {
          gradeMap.set(score.grade, new Map());
        }
        const distribution = gradeMap.get(score.grade)!;
        const grade = Math.round(score.grade_score);
        distribution.set(grade, (distribution.get(grade) || 0) + 1);
      }
    });

    const result: Array<Record<string, number | string>> = [];

    for (let grade = 1; grade <= 9; grade++) {
      const dataPoint: Record<string, number | string> = { grade: `${grade}등급` };
      
      gradeMap.forEach((distribution, studentGrade) => {
        dataPoint[`${studentGrade}학년`] = distribution.get(grade) || 0;
      });

      result.push(dataPoint);
    }

    return { data: result, grades: Array.from(gradeMap.keys()).sort() };
  }, [schoolScores]);

  if (schoolScores.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto flex flex-col gap-2 max-w-md">
          <div className="text-6xl">📊</div>
          <h3 className="text-lg font-semibold text-gray-900">
            분포 데이터가 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            내신 성적을 등록하면 분포 차트가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 전체 등급 분포 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          전체 등급 분포
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="grade" />
            <YAxis />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "count") return [`${value}개`, "개수"];
                if (name === "percentage") return [`${value}%`, "비율"];
                return [value, name];
              }}
            />
            <Legend />
            <Bar dataKey="count" fill="#6366f1" name="개수" />
            <Bar dataKey="percentage" fill="#8b5cf6" name="비율(%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 학년별 등급 분포 */}
      {gradeDistribution.grades.length > 0 && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">
            학년별 등급 분포
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={gradeDistribution.data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" />
              <YAxis />
              <Tooltip />
              <Legend />
              {gradeDistribution.grades.map((grade, index) => {
                const colors = ["#6366f1", "#8b5cf6", "#ec4899"];
                return (
                  <Bar
                    key={grade}
                    dataKey={`${grade}학년`}
                    fill={colors[index % colors.length]}
                    name={`${grade}학년`}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

