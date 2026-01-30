"use client";

import { useState, useMemo } from "react";
import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import type { EnrichedInternalScore } from "@/lib/types/scoreAnalysis";

type InternalGPAChartProps = {
  data: Array<{
    grade: number;
    semester: number;
    gpa: number;
    term: string;
  }>;
  scores?: EnrichedInternalScore[];
};

const MAIN_SUBJECTS = ["국어", "수학", "영어"];

export default function InternalGPAChart({ data, scores = [] }: InternalGPAChartProps) {
  const { recharts, loading } = useRecharts();
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  
  // 주요 교과별 GPA 추이 계산
  const subjectGpaTrends = useMemo(() => {
    if (!scores.length) return {};
    
    const trends: Record<string, Array<{ term: string; gpa: number }>> = {};
    
    MAIN_SUBJECTS.forEach((subjectName) => {
      // 해당 과목의 성적만 필터링
      const subjectScores = scores.filter(
        (s) => s.subject_name === subjectName && s.rank_grade
      );
      
      if (subjectScores.length === 0) return;
      
      // 학기별로 그룹화
      const groupedByTerm = subjectScores.reduce((acc, score) => {
        const key = `${score.grade}-${score.semester}`;
        if (!acc[key]) {
          acc[key] = {
            grade: score.grade,
            semester: score.semester,
            scores: [],
            credits: [],
          };
        }
        acc[key].scores.push(score.rank_grade!);
        acc[key].credits.push(score.credit_hours || 1);
        return acc;
      }, {} as Record<string, { grade: number; semester: number; scores: number[]; credits: number[] }>);
      
      // GPA 계산
      type TermData = { grade: number; semester: number; scores: number[]; credits: number[] };
      trends[subjectName] = (Object.values(groupedByTerm) as TermData[])
        .map((term) => {
          const totalCredits = term.credits.reduce((sum, c) => sum + c, 0);
          const weightedSum = term.scores.reduce(
            (sum, score, idx) => sum + score * term.credits[idx],
            0
          );
          const gpa = totalCredits > 0 ? weightedSum / totalCredits : 0;
          
          return {
            term: `${term.grade}학년 ${term.semester}학기`,
            gpa: Math.round(gpa * 100) / 100,
          };
        })
        .sort((a, b) => {
          const aTerm = a.term;
          const bTerm = b.term;
          if (aTerm < bTerm) return -1;
          if (aTerm > bTerm) return 1;
          return 0;
        });
    });
    
    return trends;
  }, [scores]);
  
  // 차트 데이터 준비 (전체 GPA + 선택된 주요 교과)
  const chartData = useMemo(() => {
    const baseData = data.map((d) => ({ term: d.term, gpa: d.gpa }));
    
    // 선택된 주요 교과 데이터 병합
    const result: Array<{ term: string; gpa: number; [key: string]: number | string }> = [];
    
    baseData.forEach((item) => {
      const entry: { term: string; gpa: number; [key: string]: number | string } = {
        term: item.term,
        gpa: item.gpa,
      };
      
      selectedSubjects.forEach((subjectName) => {
        const subjectTrend = subjectGpaTrends[subjectName];
        if (subjectTrend) {
          const termData = subjectTrend.find((t) => t.term === item.term);
          if (termData) {
            entry[subjectName] = termData.gpa;
          }
        }
      });
      
      result.push(entry);
    });
    
    return result;
  }, [data, selectedSubjects, subjectGpaTrends]);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <p className="text-sm">GPA 데이터가 없습니다.</p>
      </div>
    );
  }

  if (loading || !recharts) {
    return <ChartLoadingSkeleton height={300} />;
  }

  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = recharts;
  
  const colors: Record<string, string> = {
    gpa: "#4f46e5",
    국어: "#ef4444",
    수학: "#3b82f6",
    영어: "#10b981",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 주요 교과 선택 체크박스 */}
      {scores.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <label className="text-sm font-medium text-gray-700">주요 교과:</label>
          {MAIN_SUBJECTS.map((subject) => {
            const hasData = subjectGpaTrends[subject] && subjectGpaTrends[subject].length > 0;
            return (
              <label
                key={subject}
                className="flex items-center gap-2 cursor-pointer"
                style={{ opacity: hasData ? 1 : 0.5 }}
              >
                <input
                  type="checkbox"
                  checked={selectedSubjects.has(subject)}
                  onChange={(e) => {
                    const newSet = new Set(selectedSubjects);
                    if (e.target.checked) {
                      newSet.add(subject);
                    } else {
                      newSet.delete(subject);
                    }
                    setSelectedSubjects(newSet);
                  }}
                  disabled={!hasData}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{subject}</span>
              </label>
            );
          })}
        </div>
      )}
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            formatter={(value: any) => [`${value}등급`, ""]}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
          />
          <Line
            type="monotone"
            dataKey="gpa"
            stroke={colors.gpa}
            strokeWidth={2}
            dot={{ fill: colors.gpa, r: 4 }}
            activeDot={{ r: 6 }}
            name="전체 GPA"
          />
          {selectedSubjects.has("국어") && (
            <Line
              type="monotone"
              dataKey="국어"
              stroke={colors.국어}
              strokeWidth={2}
              dot={{ fill: colors.국어, r: 4 }}
              activeDot={{ r: 6 }}
              name="국어"
            />
          )}
          {selectedSubjects.has("수학") && (
            <Line
              type="monotone"
              dataKey="수학"
              stroke={colors.수학}
              strokeWidth={2}
              dot={{ fill: colors.수학, r: 4 }}
              activeDot={{ r: 6 }}
              name="수학"
            />
          )}
          {selectedSubjects.has("영어") && (
            <Line
              type="monotone"
              dataKey="영어"
              stroke={colors.영어}
              strokeWidth={2}
              dot={{ fill: colors.영어, r: 4 }}
              activeDot={{ r: 6 }}
              name="영어"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

