"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import { scoreTrendsQueryOptions } from "@/lib/query-options/scores";
import { cn } from "@/lib/cn";

type ScoreTrendChartsProps = {
  studentId: string;
  tenantId: string;
};

const SUBJECT_COLORS: Record<string, string> = {
  "국어": "#ef4444",
  "수학": "#3b82f6",
  "영어": "#f59e0b",
};

export function ScoreTrendCharts({ studentId, tenantId }: ScoreTrendChartsProps) {
  const { recharts, loading: chartsLoading } = useRecharts();
  const [showSubjects, setShowSubjects] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery(scoreTrendsQueryOptions(studentId, tenantId));

  if (isLoading || chartsLoading || !recharts) {
    return <ChartLoadingSkeleton height={160} />;
  }

  if (!data) return null;

  const hasGpa = data.gpaByTerm.length >= 2;
  const hasMock = data.mockTrend.length >= 2;
  const hasSubjects = Object.keys(data.subjectTrends).length > 0;
  const hasTermSummary = data.termSummary.length > 0;
  const hasWeakSubjects = data.weakSubjects.length > 0;

  if (!hasGpa && !hasMock && !hasTermSummary) return null;

  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } = recharts;

  // 교과별 오버레이 데이터 병합
  const mergedChartData = hasGpa ? data.gpaByTerm.map((d) => {
    const merged: Record<string, unknown> = { ...d };
    for (const [subj, trend] of Object.entries(data.subjectTrends)) {
      if (showSubjects.has(subj)) {
        const match = trend.find((t) => t.term === d.term);
        merged[subj] = match?.gpa ?? null;
      }
    }
    return merged;
  }) : [];

  const toggleSubject = (subj: string) => {
    setShowSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subj)) next.delete(subj); else next.add(subj);
      return next;
    });
  };

  return (
    <div className="mb-4 flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h4 className="text-sm font-medium text-[var(--text-primary)]">성적 분석</h4>

      {/* 내신 등급 추이 + 교과별 오버레이 */}
      {hasGpa && (
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--text-secondary)]">내신 등급 추이</span>
            {hasSubjects && (
              <div className="flex gap-1">
                {Object.keys(data.subjectTrends).map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => toggleSubject(subj)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                      showSubjects.has(subj)
                        ? "bg-opacity-100 text-white"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                    )}
                    style={showSubjects.has(subj) ? { backgroundColor: SUBJECT_COLORS[subj] ?? "#6b7280" } : undefined}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                <YAxis domain={[1, 9]} reversed tick={{ fontSize: 11 }} width={25} />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}등급`, name === "gpa" ? "전체 평균" : name]}
                  labelFormatter={(label: string) => {
                    const [g, s] = label.split("-");
                    return `${g}학년 ${s}학기`;
                  }}
                />
                <Line type="monotone" dataKey="gpa" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="전체 평균" />
                {Array.from(showSubjects).map((subj) => (
                  <Line
                    key={subj}
                    type="monotone"
                    dataKey={subj}
                    stroke={SUBJECT_COLORS[subj] ?? "#6b7280"}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={{ r: 2 }}
                    connectNulls
                    name={subj}
                  />
                ))}
                {showSubjects.size > 0 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 학기별 요약 테이블 */}
      {hasTermSummary && (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">학기별 요약</span>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-2 py-1 text-left font-medium text-[var(--text-tertiary)]">학기</th>
                <th className="px-2 py-1 text-right font-medium text-[var(--text-tertiary)]">과목수</th>
                <th className="px-2 py-1 text-right font-medium text-[var(--text-tertiary)]">평균등급</th>
                <th className="px-2 py-1 text-right font-medium text-[var(--text-tertiary)]">총학점</th>
              </tr>
            </thead>
            <tbody>
              {data.termSummary.map((t) => (
                <tr key={t.term} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-2 py-1 text-[var(--text-primary)]">{t.grade}학년 {t.semester}학기</td>
                  <td className="px-2 py-1 text-right text-[var(--text-secondary)]">{t.subjectCount}</td>
                  <td className="px-2 py-1 text-right">
                    <span className={cn(
                      "font-medium",
                      t.avgGrade <= 2 ? "text-blue-600" : t.avgGrade <= 4 ? "text-green-600" : t.avgGrade <= 6 ? "text-amber-600" : "text-red-600",
                    )}>
                      {t.avgGrade}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right text-[var(--text-secondary)]">{t.totalCredits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 취약 과목 */}
      {hasWeakSubjects && (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-red-600 dark:text-red-400">취약 과목 (평균 5등급 이상)</span>
          <div className="flex flex-wrap gap-1.5">
            {data.weakSubjects.map((w) => (
              <span key={w.name} className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {w.name} ({w.avgGrade}등급, {w.count}회)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 모의고사 백분위 추이 */}
      {hasMock && (
        <div>
          <span className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">모의고사 평균 백분위 추이</span>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.mockTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="exam_date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}월`;
                  }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={30} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "평균 백분위"]}
                  labelFormatter={(_: unknown, payload: Array<{ payload?: { exam_title?: string } }>) =>
                    payload?.[0]?.payload?.exam_title ?? ""
                  }
                />
                <Line type="monotone" dataKey="percentile" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="백분위" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
