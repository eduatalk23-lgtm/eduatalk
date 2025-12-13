/**
 * @deprecated 이 컴포넌트는 레거시 성적 대시보드에서 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 * 새로운 대시보드는 /api/students/[id]/score-dashboard API를 사용합니다.
 */
"use client";

import React from "react";
import type { SchoolScoreRow, MockScoreRow } from "../_utils/scoreQueries";
import { Card } from "@/components/molecules/Card";
import { getGradeColor, getTrendColor } from "@/lib/constants/colors";

type SummarySectionProps = {
  schoolScores: SchoolScoreRow[];
  mockScores: MockScoreRow[];
};

export function SummarySection({
  schoolScores,
  mockScores,
}: SummarySectionProps) {
  // 내신 평균 등급 계산
  const schoolAverageGrade = React.useMemo(() => {
    if (schoolScores.length === 0) return null;
    const validGrades = schoolScores
      .map((s) => s.grade_score)
      .filter((g): g is number => g !== null && g !== undefined);
    if (validGrades.length === 0) return null;
    const sum = validGrades.reduce((a, b) => a + b, 0);
    return sum / validGrades.length;
  }, [schoolScores]);

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

  // 최근 내신 성적 (최신 2개)
  const recentSchoolScores = React.useMemo(() => {
    const sorted = [...schoolScores]
      .filter((s) => s.grade_score !== null)
      .sort((a, b) => {
        // 학년 → 학기 → 생성일 순으로 정렬
        if (a.grade !== b.grade) return b.grade - a.grade;
        if (a.semester !== b.semester) return b.semester - a.semester;
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    return sorted.slice(0, 2);
  }, [schoolScores]);

  // 최근 모의고사 성적 (최신 2개)
  const recentMockScores = React.useMemo(() => {
    const sorted = [...mockScores]
      .filter((s) => s.percentile !== null)
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
    return sorted.slice(0, 2);
  }, [mockScores]);

  // 내신 추세 계산
  const schoolTrend = React.useMemo(() => {
    if (recentSchoolScores.length < 2) return null;
    const [latest, previous] = recentSchoolScores;
    if (!latest.grade_score || !previous.grade_score) return null;
    // 등급은 낮을수록 좋으므로, 등급이 낮아지면(숫자가 작아지면) 개선
    return latest.grade_score < previous.grade_score
      ? "improved"
      : latest.grade_score > previous.grade_score
      ? "declined"
      : "stable";
  }, [recentSchoolScores]);

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

  const hasData = schoolScores.length > 0 || mockScores.length > 0;

  if (!hasData) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-6xl">📊</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              성적 데이터가 없습니다
            </h3>
            <p className="text-sm text-gray-600">
              내신 또는 모의고사 성적을 등록하면 요약 정보가 표시됩니다.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const schoolGradeColor = getGradeColor(
    schoolAverageGrade ? Math.round(schoolAverageGrade) : null
  );
  const trendColor = getTrendColor(schoolTrend);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 내신 평균 등급 */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-600">내신 평균 등급</p>
              <div className="flex items-baseline gap-2">
                {schoolAverageGrade !== null ? (
                  <>
                    <span
                      className={`text-3xl font-bold ${schoolGradeColor.text}`}
                    >
                      {schoolAverageGrade.toFixed(1)}
                    </span>
                    <span className="text-lg text-gray-500">등급</span>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-gray-400">-</span>
                )}
              </div>
              {schoolScores.length > 0 && (
                <p className="text-xs text-gray-500">
                  {schoolScores.length}개 성적 기준
                </p>
              )}
            </div>
            <div className="text-4xl">📚</div>
          </div>
          {schoolTrend && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${trendColor.bg}`}
            >
              <span className={`text-sm font-medium ${trendColor.text}`}>
                {trendColor.icon}
              </span>
              <span className={`text-sm font-medium ${trendColor.text}`}>
                {schoolTrend === "improved"
                  ? "개선"
                  : schoolTrend === "declined"
                  ? "하락"
                  : "유지"}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* 모의고사 평균 백분위 */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-600">
                모의고사 평균 백분위
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
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${getTrendColor(mockTrend).bg}`}
            >
              <span
                className={`text-sm font-medium ${getTrendColor(mockTrend).text}`}
              >
                {getTrendColor(mockTrend).icon}
              </span>
              <span
                className={`text-sm font-medium ${getTrendColor(mockTrend).text}`}
              >
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

      {/* 최근 내신 성적 */}
      <Card>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-600">최근 내신 성적</p>
          {recentSchoolScores.length > 0 ? (
            <div className="flex flex-col gap-2">
              {recentSchoolScores.map((score) => {
                const gradeColor = getGradeColor(score.grade_score);
                return (
                  <div
                    key={score.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${gradeColor.border} ${gradeColor.bg}`}
                  >
                    <span className="text-xs text-gray-600">
                      {score.grade}학년 {score.semester}학기
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-sm font-semibold ${gradeColor.badge}`}
                    >
                      {score.grade_score !== null
                        ? `${score.grade_score}등급`
                        : "-"}
                    </span>
                  </div>
                );
              })}
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
                      {score.grade}학년
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

