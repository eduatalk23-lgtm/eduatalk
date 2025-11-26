"use client";

import React from "react";
import type { MockScoreRow } from "../../_utils/scoreQueries";
import { Card } from "@/components/ui/Card";
import { getGradeColor, getTrendColor } from "@/lib/scores/gradeColors";

type MockSummarySectionProps = {
  mockScores: MockScoreRow[];
};

export function MockSummarySection({
  mockScores,
}: MockSummarySectionProps) {
  // 모의고사 평균 백분위 계산
  const mockAveragePercentile = React.useMemo(() => {
    if (mockScores.length === 0) return null;
    const validPercentiles = mockScores
      .map((s) => s.percentile)
      .filter((p): p is number => p !== null && p !== undefined);
    if (validPercentiles.length === 0) return null;
    const sum = validPercentiles.reduce((a, b) => a + b, 0);
    return sum / validPercentiles.length;
  }, [mockScores]);

  // 모의고사 평균 등급 계산
  const mockAverageGrade = React.useMemo(() => {
    if (mockScores.length === 0) return null;
    const validGrades = mockScores
      .map((s) => s.grade_score)
      .filter((g): g is number => g !== null && g !== undefined);
    if (validGrades.length === 0) return null;
    const sum = validGrades.reduce((a, b) => a + b, 0);
    return sum / validGrades.length;
  }, [mockScores]);

  // 시험 유형별 평균 백분위
  const examTypeAverages = React.useMemo(() => {
    const typeMap = new Map<string, number[]>();
    mockScores.forEach((score) => {
      if (score.exam_type && score.percentile !== null) {
        if (!typeMap.has(score.exam_type)) {
          typeMap.set(score.exam_type, []);
        }
        typeMap.get(score.exam_type)!.push(score.percentile);
      }
    });

    const result: Array<{ type: string; average: number }> = [];
    typeMap.forEach((percentiles, type) => {
      const average = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
      result.push({ type, average: Number(average.toFixed(1)) });
    });
    return result.sort((a, b) => {
      const order = ["평가원", "교육청", "사설"];
      return order.indexOf(a.type) - order.indexOf(b.type);
    });
  }, [mockScores]);

  // 회차별 평균 백분위
  const roundAverages = React.useMemo(() => {
    const roundMap = new Map<string, number[]>();
    mockScores.forEach((score) => {
      if (score.exam_round && score.percentile !== null) {
        if (!roundMap.has(score.exam_round)) {
          roundMap.set(score.exam_round, []);
        }
        roundMap.get(score.exam_round)!.push(score.percentile);
      }
    });

    const result: Array<{ round: string; average: number }> = [];
    roundMap.forEach((percentiles, round) => {
      const average = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
      result.push({ round, average: Number(average.toFixed(1)) });
    });
    return result.sort((a, b) => {
      const order = ["3월", "4월", "6월", "9월", "11월", "사설"];
      const indexA = order.indexOf(a.round);
      const indexB = order.indexOf(b.round);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [mockScores]);

  // 최근 모의고사 성적 (최신 3개)
  const recentMockScores = React.useMemo(() => {
    const sorted = [...mockScores]
      .filter((s) => s.percentile !== null || s.grade_score !== null)
      .sort((a, b) => {
        // 학년 → 회차 → 생성일 순으로 정렬
        if (a.grade !== b.grade) return b.grade - a.grade;
        const roundA = a.exam_round || "";
        const roundB = b.exam_round || "";
        if (roundA !== roundB) return roundB.localeCompare(roundA);
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    return sorted.slice(0, 3);
  }, [mockScores]);

  // 모의고사 추세 계산
  const mockTrend = React.useMemo(() => {
    if (recentMockScores.length < 2) return null;
    const [latest, previous] = recentMockScores;
    if (!latest.percentile || !previous.percentile) return null;
    return latest.percentile > previous.percentile
      ? "improved"
      : latest.percentile < previous.percentile
      ? "declined"
      : "stable";
  }, [recentMockScores]);

  const trendColor = getTrendColor(mockTrend);
  const gradeColor = getGradeColor(
    mockAverageGrade ? Math.round(mockAverageGrade) : null
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 모의고사 평균 백분위 */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-600">
                전체 평균 백분위
              </p>
              <div className="flex items-baseline gap-2">
                {mockAveragePercentile !== null ? (
                  <>
                    <span className="text-3xl font-bold text-indigo-600">
                      {mockAveragePercentile.toFixed(1)}
                    </span>
                    <span className="text-lg text-gray-500">%</span>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-gray-400">-</span>
                )}
              </div>
              {mockScores.length > 0 && (
                <p className="text-xs text-gray-500">
                  {mockScores.length}개 성적 기준
                </p>
              )}
            </div>
            <div className="text-4xl">📊</div>
          </div>
          {mockTrend && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${trendColor.bg}`}
            >
              <span className={`text-sm font-medium ${trendColor.text}`}>
                {trendColor.icon}
              </span>
              <span className={`text-sm font-medium ${trendColor.text}`}>
                {mockTrend === "improved"
                  ? "개선"
                  : mockTrend === "declined"
                  ? "하락"
                  : "유지"}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* 평균 등급 */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-600">평균 등급</p>
              <div className="flex items-baseline gap-2">
                {mockAverageGrade !== null ? (
                  <>
                    <span
                      className={`text-3xl font-bold ${gradeColor.text}`}
                    >
                      {mockAverageGrade.toFixed(1)}
                    </span>
                    <span className="text-lg text-gray-500">등급</span>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-gray-400">-</span>
                )}
              </div>
            </div>
            <div className="text-4xl">⭐</div>
          </div>
        </div>
      </Card>

      {/* 시험 유형별 평균 */}
      <Card>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-600">시험 유형별 평균</p>
          {examTypeAverages.length > 0 ? (
            <div className="flex flex-col gap-2">
              {examTypeAverages.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2"
                >
                  <span className="text-xs text-gray-600">{item.type}</span>
                  <span className="text-sm font-semibold text-indigo-700">
                    {item.average}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">데이터 없음</p>
          )}
        </div>
      </Card>

      {/* 최근 모의고사 성적 */}
      <Card>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-600">최근 모의고사 성적</p>
          {recentMockScores.length > 0 ? (
            <div className="flex flex-col gap-2">
              {recentMockScores.map((score) => {
                const gradeColor = getGradeColor(score.grade_score);
                return (
                  <div
                    key={score.id}
                    className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2"
                  >
                    <span className="text-xs text-gray-600">
                      {score.grade}학년 {score.exam_round || "-"}회차
                    </span>
                    <div className="flex items-center gap-2">
                      {score.percentile !== null && (
                        <span className="text-sm font-semibold text-indigo-700">
                          {score.percentile.toFixed(1)}%
                        </span>
                      )}
                      {score.grade_score !== null && (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${gradeColor.badge}`}
                        >
                          {score.grade_score}등급
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">데이터 없음</p>
          )}
        </div>
      </Card>
    </div>
  );
}

