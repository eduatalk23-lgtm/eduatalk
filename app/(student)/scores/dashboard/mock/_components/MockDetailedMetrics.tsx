"use client";

import React from "react";
import type { MockScoreRow } from "../../_utils/scoreQueries";
import { Card } from "@/components/ui/Card";
import { getGradeColor } from "@/lib/scores/gradeColors";

type MockDetailedMetricsProps = {
  mockScores: MockScoreRow[];
};

export function MockDetailedMetrics({
  mockScores,
}: MockDetailedMetricsProps) {
  // 회차별 상세 통계
  const roundStats = React.useMemo(() => {
    const roundMap = new Map<string, MockScoreRow[]>();
    mockScores.forEach((score) => {
      if (score.exam_round) {
        if (!roundMap.has(score.exam_round)) {
          roundMap.set(score.exam_round, []);
        }
        roundMap.get(score.exam_round)!.push(score);
      }
    });

    const roundOrder = ["3월", "4월", "6월", "9월", "11월", "사설"];
    const result: Array<{
      round: string;
      averagePercentile: number;
      averageGrade: number;
      subjectCount: number;
      totalScores: number;
    }> = [];

    roundMap.forEach((scores, round) => {
      const validPercentiles = scores
        .map((s) => s.percentile)
        .filter((p): p is number => p !== null && p !== undefined);
      const validGrades = scores
        .map((s) => s.grade_score)
        .filter((g): g is number => g !== null && g !== undefined);

      if (validPercentiles.length === 0 && validGrades.length === 0) return;

      const averagePercentile =
        validPercentiles.length > 0
          ? validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length
          : 0;
      const averageGrade =
        validGrades.length > 0
          ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length
          : 0;

      const subjectSet = new Set<string>();
      scores.forEach((score) => {
        if (score.subject_group) {
          subjectSet.add(score.subject_group);
        }
      });

      result.push({
        round,
        averagePercentile: Number(averagePercentile.toFixed(1)),
        averageGrade: Number(averageGrade.toFixed(1)),
        subjectCount: subjectSet.size,
        totalScores: scores.length,
      });
    });

    return result.sort((a, b) => {
      const indexA = roundOrder.indexOf(a.round);
      const indexB = roundOrder.indexOf(b.round);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [mockScores]);

  // 시험 유형별 상세 통계
  const examTypeStats = React.useMemo(() => {
    const typeMap = new Map<string, MockScoreRow[]>();
    mockScores.forEach((score) => {
      if (score.exam_type) {
        if (!typeMap.has(score.exam_type)) {
          typeMap.set(score.exam_type, []);
        }
        typeMap.get(score.exam_type)!.push(score);
      }
    });

    const typeOrder = ["평가원", "교육청", "사설"];
    const result: Array<{
      type: string;
      averagePercentile: number;
      averageGrade: number;
      subjectCount: number;
      totalScores: number;
      bestSubject: string | null;
      worstSubject: string | null;
    }> = [];

    typeMap.forEach((scores, type) => {
      const validPercentiles = scores
        .map((s) => s.percentile)
        .filter((p): p is number => p !== null && p !== undefined);
      const validGrades = scores
        .map((s) => s.grade_score)
        .filter((g): g is number => g !== null && g !== undefined);

      if (validPercentiles.length === 0 && validGrades.length === 0) return;

      const averagePercentile =
        validPercentiles.length > 0
          ? validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length
          : 0;
      const averageGrade =
        validGrades.length > 0
          ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length
          : 0;

      const subjectSet = new Set<string>();
      const subjectPercentileMap = new Map<string, number[]>();
      scores.forEach((score) => {
        if (score.subject_group) {
          subjectSet.add(score.subject_group);
          if (score.percentile !== null) {
            if (!subjectPercentileMap.has(score.subject_group)) {
              subjectPercentileMap.set(score.subject_group, []);
            }
            subjectPercentileMap.get(score.subject_group)!.push(score.percentile);
          }
        }
      });

      let bestSubject: string | null = null;
      let worstSubject: string | null = null;
      let bestPercentile = 0;
      let worstPercentile = 100;

      subjectPercentileMap.forEach((percentiles, subject) => {
        const avg = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
        if (avg > bestPercentile) {
          bestPercentile = avg;
          bestSubject = subject;
        }
        if (avg < worstPercentile) {
          worstPercentile = avg;
          worstSubject = subject;
        }
      });

      result.push({
        type,
        averagePercentile: Number(averagePercentile.toFixed(1)),
        averageGrade: Number(averageGrade.toFixed(1)),
        subjectCount: subjectSet.size,
        totalScores: scores.length,
        bestSubject,
        worstSubject,
      });
    });

    return result.sort((a, b) => {
      const indexA = typeOrder.indexOf(a.type);
      const indexB = typeOrder.indexOf(b.type);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [mockScores]);

  // 과목별 평균 백분위
  const subjectAverages = React.useMemo(() => {
    const subjectMap = new Map<string, { percentiles: number[]; grades: number[] }>();
    mockScores.forEach((score) => {
      if (score.subject_group) {
        if (!subjectMap.has(score.subject_group)) {
          subjectMap.set(score.subject_group, { percentiles: [], grades: [] });
        }
        const data = subjectMap.get(score.subject_group)!;
        if (score.percentile !== null) {
          data.percentiles.push(score.percentile);
        }
        if (score.grade_score !== null) {
          data.grades.push(score.grade_score);
        }
      }
    });

    const result: Array<{
      subject: string;
      averagePercentile: number | null;
      averageGrade: number | null;
      count: number;
      trend: "improved" | "declined" | "stable" | null;
    }> = [];

    subjectMap.forEach((data, subject) => {
      const averagePercentile =
        data.percentiles.length > 0
          ? data.percentiles.reduce((a, b) => a + b, 0) / data.percentiles.length
          : null;
      const averageGrade =
        data.grades.length > 0
          ? data.grades.reduce((a, b) => a + b, 0) / data.grades.length
          : null;

      // 최근 2개 성적 비교로 추세 계산
      const sortedScores = mockScores
        .filter((s) => s.subject_group === subject && s.percentile !== null)
        .sort((a, b) => {
          // 학년 → 회차 → 생성일 순으로 정렬
          if (a.grade !== b.grade) return b.grade - a.grade;
          const roundA = a.exam_round || "";
          const roundB = b.exam_round || "";
          if (roundA !== roundB) return roundB.localeCompare(roundA);
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 2);

      let trend: "improved" | "declined" | "stable" | null = null;
      if (
        sortedScores.length >= 2 &&
        sortedScores[0].percentile !== null &&
        sortedScores[1].percentile !== null
      ) {
        const latest = sortedScores[0].percentile;
        const previous = sortedScores[1].percentile;
        if (latest > previous) trend = "improved";
        else if (latest < previous) trend = "declined";
        else trend = "stable";
      }

      result.push({
        subject,
        averagePercentile: averagePercentile ? Number(averagePercentile.toFixed(1)) : null,
        averageGrade: averageGrade ? Number(averageGrade.toFixed(1)) : null,
        count: data.percentiles.length + data.grades.length,
        trend,
      });
    });

    return result.sort((a, b) => {
      const aVal = a.averagePercentile ?? 0;
      const bVal = b.averagePercentile ?? 0;
      return bVal - aVal; // 백분위 높은 순
    });
  }, [mockScores]);

  if (mockScores.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 회차별 상세 통계 */}
      {roundStats.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              회차별 상세 통계
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      회차
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      평균 백분위
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      평균 등급
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      교과 수
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      성적 수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roundStats.map((stat) => {
                    const gradeColor = getGradeColor(
                      stat.averageGrade > 0 ? Math.round(stat.averageGrade) : null
                    );
                    return (
                      <tr
                        key={stat.round}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {stat.round}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {stat.averagePercentile > 0 ? (
                            <span className="text-sm font-semibold text-indigo-600">
                              {stat.averagePercentile}%
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {stat.averageGrade > 0 ? (
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${gradeColor.badge}`}
                            >
                              {stat.averageGrade}등급
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-600">
                          {stat.subjectCount}개
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-600">
                          {stat.totalScores}개
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* 시험 유형별 상세 통계 */}
      {examTypeStats.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              시험 유형별 상세 통계
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {examTypeStats.map((stat) => {
                const gradeColor = getGradeColor(
                  stat.averageGrade > 0 ? Math.round(stat.averageGrade) : null
                );
                return (
                  <div
                    key={stat.type}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-gray-900">
                        {stat.type}
                      </h4>
                      {stat.averagePercentile > 0 && (
                        <span className="text-sm font-semibold text-indigo-600">
                          {stat.averagePercentile}%
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      {stat.averageGrade > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">평균 등급</span>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${gradeColor.badge}`}
                          >
                            {stat.averageGrade}등급
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">과목 수</span>
                        <span className="font-medium text-gray-900">
                          {stat.subjectCount}개
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">성적 수</span>
                        <span className="font-medium text-gray-900">
                          {stat.totalScores}개
                        </span>
                      </div>
                      {stat.bestSubject && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">최고 과목</span>
                          <span className="font-medium text-green-600">
                            {stat.bestSubject}
                          </span>
                        </div>
                      )}
                      {stat.worstSubject && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">취약 과목</span>
                          <span className="font-medium text-red-600">
                            {stat.worstSubject}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* 과목별 평균 백분위 */}
      {subjectAverages.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              과목별 평균 성적
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjectAverages.map((item) => {
                const gradeColor = getGradeColor(
                  item.averageGrade ? Math.round(item.averageGrade) : null
                );
                const trendIcon =
                  item.trend === "improved"
                    ? "↑"
                    : item.trend === "declined"
                    ? "↓"
                    : item.trend === "stable"
                    ? "→"
                    : "";
                const trendColor =
                  item.trend === "improved"
                    ? "text-green-600"
                    : item.trend === "declined"
                    ? "text-red-600"
                    : "text-gray-600";

                return (
                  <div
                    key={item.subject}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-gray-900">
                        {item.subject}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.count}개 성적
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.trend && (
                        <span className={`text-sm font-semibold ${trendColor}`}>
                          {trendIcon}
                        </span>
                      )}
                      {item.averagePercentile !== null ? (
                        <span className="text-sm font-semibold text-indigo-600">
                          {item.averagePercentile}%
                        </span>
                      ) : item.averageGrade !== null ? (
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${gradeColor.badge}`}
                        >
                          {item.averageGrade}등급
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

