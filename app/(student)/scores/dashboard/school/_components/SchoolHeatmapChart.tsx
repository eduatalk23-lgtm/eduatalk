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
  Cell,
} from "recharts";
import type { SchoolScoreRow } from "../../_utils/scoreQueries";
import { getGradeColor } from "@/lib/scores/gradeColors";

type SchoolHeatmapChartProps = {
  schoolScores: SchoolScoreRow[];
};

export function SchoolHeatmapChart({
  schoolScores,
}: SchoolHeatmapChartProps) {
  // 학기별/과목별 등급 히트맵 데이터 생성
  const heatmapData = React.useMemo(() => {
    const semesterMap = new Map<string, Map<string, number[]>>();

    schoolScores.forEach((score) => {
      if (!score.grade || !score.semester || !score.subject_group || score.grade_score === null) return;
      
      const periodKey = `${score.grade}학년 ${score.semester}학기`;
      if (!semesterMap.has(periodKey)) {
        semesterMap.set(periodKey, new Map());
      }
      const subjectMap = semesterMap.get(periodKey)!;
      
      if (!subjectMap.has(score.subject_group)) {
        subjectMap.set(score.subject_group, []);
      }
      subjectMap.get(score.subject_group)!.push(score.grade_score);
    });

    // 모든 과목 수집
    const allSubjects = new Set<string>();
    semesterMap.forEach((subjectMap) => {
      subjectMap.forEach((_, subject) => {
        allSubjects.add(subject);
      });
    });

    // 학기 순서 정렬
    const sortedPeriods = Array.from(semesterMap.keys()).sort((a, b) => {
      const aMatch = a.match(/(\d)학년 (\d)학기/);
      const bMatch = b.match(/(\d)학년 (\d)학기/);
      if (!aMatch || !bMatch) return 0;
      const aGrade = parseInt(aMatch[1]);
      const bGrade = parseInt(bMatch[1]);
      if (aGrade !== bGrade) return aGrade - bGrade;
      const aSemester = parseInt(aMatch[2]);
      const bSemester = parseInt(bMatch[2]);
      return aSemester - bSemester;
    });

    // 차트 데이터 생성
    const result: Array<Record<string, number | string>> = [];

    sortedPeriods.forEach((period) => {
      const dataPoint: Record<string, number | string> = { period };
      const subjectMap = semesterMap.get(period)!;

      allSubjects.forEach((subject) => {
        const grades = subjectMap.get(subject);
        if (grades && grades.length > 0) {
          const average = grades.reduce((a, b) => a + b, 0) / grades.length;
          dataPoint[subject] = Number(average.toFixed(1));
        } else {
          dataPoint[subject] = 0; // 데이터 없음
        }
      });

      result.push(dataPoint);
    });

    return { data: result, subjects: Array.from(allSubjects) };
  }, [schoolScores]);

  if (schoolScores.length === 0 || heatmapData.subjects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">📊</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            히트맵 데이터가 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            내신 성적을 등록하면 히트맵이 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  // 등급별 색상 매핑
  const getColorForGrade = (grade: number): string => {
    if (grade <= 1) return "#3b82f6"; // blue-500
    if (grade <= 2) return "#60a5fa"; // blue-400
    if (grade <= 3) return "#6366f1"; // indigo-500
    if (grade <= 4) return "#9ca3af"; // gray-400
    if (grade <= 5) return "#eab308"; // yellow-500
    if (grade <= 6) return "#f97316"; // orange-500
    if (grade <= 7) return "#ef4444"; // red-500
    return "#dc2626"; // red-600
  };

  const COLORS = [
    "#3b82f6", "#60a5fa", "#6366f1", "#9ca3af",
    "#eab308", "#f97316", "#ef4444", "#dc2626"
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        학기별/과목별 등급 히트맵
      </h2>
      <div className="mb-4 text-sm text-gray-600">
        <p>각 셀의 색상은 해당 학기/과목의 평균 등급을 나타냅니다.</p>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-blue-500"></div>
            <span className="text-xs">1-2등급</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-indigo-500"></div>
            <span className="text-xs">3등급</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-yellow-500"></div>
            <span className="text-xs">5등급</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500"></div>
            <span className="text-xs">6-9등급</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={heatmapData.data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="period"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
          />
          <YAxis
            domain={[1, 9]}
            reversed
            label={{ value: "등급", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (value === 0) return ["데이터 없음", name];
              return [`${value}등급`, name];
            }}
          />
          <Legend />
          {heatmapData.subjects.map((subject, index) => (
            <Bar
              key={subject}
              dataKey={subject}
              stackId="a"
              name={subject}
              fill={COLORS[index % COLORS.length]}
            >
              {heatmapData.data.map((entry, idx) => {
                const grade = entry[subject] as number;
                if (grade === 0) return <Cell key={idx} fill="#f3f4f6" />;
                return <Cell key={idx} fill={getColorForGrade(grade)} />;
              })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

