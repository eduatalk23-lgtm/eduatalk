/**
 * @deprecated 이 컴포넌트는 레거시 성적 대시보드에서 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 */
"use client";

import React from "react";
import type { SchoolScoreRow, MockScoreRow } from "../../_utils/scoreQueries";
import { Card } from "@/components/molecules/Card";

type ScoreConsistencyAnalysisProps = {
  schoolScores: SchoolScoreRow[];
  mockScores: MockScoreRow[];
};

export function ScoreConsistencyAnalysis({
  schoolScores,
  mockScores,
}: ScoreConsistencyAnalysisProps) {
  // 내신 성적 일관성 분석
  const schoolConsistency = React.useMemo(() => {
    if (schoolScores.length === 0) return null;

    const validGrades = schoolScores
      .map((s) => s.grade_score)
      .filter((g): g is number => g !== null && g !== undefined);

    if (validGrades.length < 2) return null;

    const mean = validGrades.reduce((a, b) => a + b, 0) / validGrades.length;
    const variance =
      validGrades.reduce((sum, grade) => sum + Math.pow(grade - mean, 2), 0) /
      validGrades.length;
    const stdDev = Math.sqrt(variance);

    // 일관성 점수 (표준편차가 낮을수록 높음, 0-100점)
    const consistencyScore = Math.max(0, 100 - stdDev * 20);

    let level: "high" | "medium" | "low" = "medium";
    if (consistencyScore >= 80) level = "high";
    else if (consistencyScore < 50) level = "low";

    return {
      mean: Number(mean.toFixed(1)),
      stdDev: Number(stdDev.toFixed(2)),
      consistencyScore: Number(consistencyScore.toFixed(1)),
      level,
    };
  }, [schoolScores]);

  // 모의고사 성적 일관성 분석
  const mockConsistency = React.useMemo(() => {
    if (mockScores.length === 0) return null;

    const validPercentiles = mockScores
      .map((s) => s.percentile)
      .filter((p): p is number => p !== null && p !== undefined);

    if (validPercentiles.length < 2) return null;

    const mean = validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length;
    const variance =
      validPercentiles.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) /
      validPercentiles.length;
    const stdDev = Math.sqrt(variance);

    // 일관성 점수 (표준편차가 낮을수록 높음, 0-100점)
    const consistencyScore = Math.max(0, 100 - (stdDev / 100) * 100);

    let level: "high" | "medium" | "low" = "medium";
    if (consistencyScore >= 80) level = "high";
    else if (consistencyScore < 50) level = "low";

    return {
      mean: Number(mean.toFixed(1)),
      stdDev: Number(stdDev.toFixed(2)),
      consistencyScore: Number(consistencyScore.toFixed(1)),
      level,
    };
  }, [mockScores]);

  // 내신과 모의고사 간 일관성
  const crossConsistency = React.useMemo(() => {
    if (schoolScores.length === 0 || mockScores.length === 0) return null;

    const comparableSubjects = ["국어", "수학", "영어"];
    const differences: number[] = [];

    comparableSubjects.forEach((subject) => {
      const schoolScoresForSubject = schoolScores.filter(
        (s) => s.subject_group === subject && s.grade_score !== null
      );
      const mockScoresForSubject = mockScores.filter(
        (s) => s.subject_group === subject && s.grade_score !== null
      );

      if (schoolScoresForSubject.length > 0 && mockScoresForSubject.length > 0) {
        const schoolAvg =
          schoolScoresForSubject.reduce(
            (sum, s) => sum + (s.grade_score ?? 0),
            0
          ) / schoolScoresForSubject.length;
        const mockAvg =
          mockScoresForSubject.reduce(
            (sum, s) => sum + (s.grade_score ?? 0),
            0
          ) / mockScoresForSubject.length;

        differences.push(Math.abs(schoolAvg - mockAvg));
      }
    });

    if (differences.length === 0) return null;

    const avgDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
    const consistencyScore = Math.max(0, 100 - avgDiff * 20);

    let level: "high" | "medium" | "low" = "medium";
    if (consistencyScore >= 80) level = "high";
    else if (consistencyScore < 50) level = "low";

    return {
      avgDiff: Number(avgDiff.toFixed(2)),
      consistencyScore: Number(consistencyScore.toFixed(1)),
      level,
    };
  }, [schoolScores, mockScores]);

  const getLevelColor = (level: "high" | "medium" | "low") => {
    if (level === "high") return "text-green-600 bg-green-50 border-green-200";
    if (level === "low") return "text-red-600 bg-red-50 border-red-200";
    return "text-yellow-600 bg-yellow-50 border-yellow-200";
  };

  const getLevelText = (level: "high" | "medium" | "low") => {
    if (level === "high") return "높음";
    if (level === "low") return "낮음";
    return "보통";
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* 내신 일관성 */}
      {schoolConsistency && (
        <Card>
          <div className="p-6">
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-gray-900">
                내신 성적 일관성
              </h3>
              <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">일관성 점수</span>
                <span className="text-2xl font-bold text-gray-900">
                  {schoolConsistency.consistencyScore}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">평균 등급</span>
                <span className="text-sm font-medium text-gray-900">
                  {schoolConsistency.mean}등급
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">표준편차</span>
                <span className="text-sm font-medium text-gray-900">
                  {schoolConsistency.stdDev}
                </span>
              </div>
              <div
                className={`rounded-lg border p-3 text-center ${getLevelColor(
                  schoolConsistency.level
                )}`}
              >
                <span className="text-sm font-semibold">
                  {getLevelText(schoolConsistency.level)}
                </span>
              </div>
            </div>
          </div>
          </div>
        </Card>
      )}

      {/* 모의고사 일관성 */}
      {mockConsistency && (
        <Card>
          <div className="p-6">
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-gray-900">
                모의고사 성적 일관성
              </h3>
              <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">일관성 점수</span>
                <span className="text-2xl font-bold text-gray-900">
                  {mockConsistency.consistencyScore}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">평균 백분위</span>
                <span className="text-sm font-medium text-gray-900">
                  {mockConsistency.mean}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">표준편차</span>
                <span className="text-sm font-medium text-gray-900">
                  {mockConsistency.stdDev}
                </span>
              </div>
              <div
                className={`rounded-lg border p-3 text-center ${getLevelColor(
                  mockConsistency.level
                )}`}
              >
                <span className="text-sm font-semibold">
                  {getLevelText(mockConsistency.level)}
                </span>
              </div>
            </div>
          </div>
          </div>
        </Card>
      )}

      {/* 내신-모의고사 간 일관성 */}
      {crossConsistency && (
        <Card>
          <div className="p-6">
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-gray-900">
                내신-모의고사 일관성
              </h3>
              <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">일관성 점수</span>
                <span className="text-2xl font-bold text-gray-900">
                  {crossConsistency.consistencyScore}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">평균 등급 차이</span>
                <span className="text-sm font-medium text-gray-900">
                  {crossConsistency.avgDiff}등급
                </span>
              </div>
              <div className="text-xs text-gray-500">
                핵심 과목(국어, 수학, 영어)의
                <br />
                내신-모의고사 등급 차이 기준
              </div>
              <div
                className={`rounded-lg border p-3 text-center ${getLevelColor(
                  crossConsistency.level
                )}`}
              >
                <span className="text-sm font-semibold">
                  {getLevelText(crossConsistency.level)}
                </span>
              </div>
            </div>
          </div>
          </div>
        </Card>
      )}

      {!schoolConsistency && !mockConsistency && !crossConsistency && (
        <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="text-6xl">📊</div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                일관성 분석 데이터가 없습니다
              </h3>
              <p className="text-sm text-gray-500">
                충분한 성적 데이터를 등록하면 일관성 분석이 제공됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

