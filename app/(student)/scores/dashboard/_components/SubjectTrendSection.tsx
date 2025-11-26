"use client";

import React, { useState } from "react";
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

type SubjectTrendSectionProps = {
  schoolScores: SchoolScoreRow[];
};

const SUBJECT_GROUPS = ["국어", "수학", "영어", "사회", "과학"];
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export function SubjectTrendSection({
  schoolScores,
}: SubjectTrendSectionProps) {
  const [showAll, setShowAll] = useState(false);

  // 교과별로 데이터 그룹화 및 최근 성적 추출
  const chartData = React.useMemo(() => {
    const subjectMap = new Map<string, SchoolScoreRow[]>();

    schoolScores.forEach((score) => {
      if (!score.subject_group || score.grade_score === null) return;
      if (!subjectMap.has(score.subject_group)) {
        subjectMap.set(score.subject_group, []);
      }
      subjectMap.get(score.subject_group)!.push(score);
    });

    // 각 교과별로 학년/학기 순 정렬
    subjectMap.forEach((scores, group) => {
      scores.sort((a, b) => {
        // 학년 → 학기 → 생성일 순으로 정렬
        if (a.grade !== b.grade) return a.grade - b.grade;
        if (a.semester !== b.semester) return a.semester - b.semester;
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      });
    });

    // 학년/학기별로 데이터 포인트 생성
    const dateMap = new Map<string, Record<string, number | null>>();

    subjectMap.forEach((scores, group) => {
      const displayScores = showAll ? scores : scores.slice(-3); // 최근 3개 또는 전체

      displayScores.forEach((score) => {
        const dateKey = `${score.grade}학년 ${score.semester}학기`;

        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {});
        }
        dateMap.get(dateKey)![group] = score.grade_score;
      });
    });

    // 날짜순으로 정렬
    const sortedDates = Array.from(dateMap.entries()).sort((a, b) => {
      const dateA = new Date(a[0]).getTime();
      const dateB = new Date(b[0]).getTime();
      return dateA - dateB;
    });

    return sortedDates.map(([date, values]) => ({
      date,
      ...values,
    }));
  }, [schoolScores, showAll]);

  const availableSubjects = React.useMemo(() => {
    const subjects = new Set<string>();
    schoolScores.forEach((score) => {
      if (score.subject_group) subjects.add(score.subject_group);
    });
    return Array.from(subjects).filter((s) => SUBJECT_GROUPS.includes(s));
  }, [schoolScores]);

  if (schoolScores.length === 0 || availableSubjects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">📈</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            교과별 성적 트렌드 데이터가 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            내신 성적을 등록하면 교과별 변화 그래프가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          교과별 성적 변화
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>전체 표시</span>
        </label>
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
          {availableSubjects.map((subject, index) => (
            <Line
              key={subject}
              type="monotone"
              dataKey={subject}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              name={subject}
              connectNulls={false}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

