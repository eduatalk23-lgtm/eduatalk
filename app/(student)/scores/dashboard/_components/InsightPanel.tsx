/**
 * @deprecated 이 컴포넌트는 레거시 성적 대시보드에서 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 */
"use client";

import React from "react";
import type { SchoolScoreRow, MockScoreRow } from "../_utils/scoreQueries";

type InsightPanelProps = {
  schoolScores: SchoolScoreRow[];
  mockScores: MockScoreRow[];
};

export function InsightPanel({
  schoolScores,
  mockScores,
}: InsightPanelProps) {
  const insights = React.useMemo(() => {
    const result: string[] = [];

    // 1. 교과별 최근 하락 추세 분석
    const schoolBySubject = new Map<string, SchoolScoreRow[]>();
    schoolScores.forEach((score) => {
      if (!score.subject_group || score.grade_score === null) return;
      const key = score.subject_group;
      if (!schoolBySubject.has(key)) {
        schoolBySubject.set(key, []);
      }
      schoolBySubject.get(key)!.push(score);
    });

    schoolBySubject.forEach((scores, subject) => {
      const sorted = scores.sort((a, b) => {
        // 학년 → 학기 → 생성일 순으로 정렬
        if (a.grade !== b.grade) return b.grade - a.grade;
        if (a.semester !== b.semester) return b.semester - a.semester;
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      if (sorted.length >= 2) {
        const recent2 = sorted.slice(0, 2);
        const grades = recent2
          .map((s) => s.grade_score)
          .filter((g): g is number => g !== null);

        if (grades.length === 2 && grades[0] > grades[1]) {
          // 등급이 높아졌다는 것은 나빠졌다는 의미
          result.push(
            `${subject} 과목은 최근 두 번 연속 등급이 하락했습니다. (${grades[1]}등급 → ${grades[0]}등급) 기초 개념 복습이 필요합니다.`
          );
        }
      }
    });

    // 2. 모의고사 백분위 낮은 과목
    const mockBySubject = new Map<string, MockScoreRow[]>();
    mockScores.forEach((score) => {
      if (!score.subject_group || score.percentile === null) return;
      const key = score.subject_group;
      if (!mockBySubject.has(key)) {
        mockBySubject.set(key, []);
      }
      mockBySubject.get(key)!.push(score);
    });

    mockBySubject.forEach((scores, subject) => {
      const sorted = scores.sort((a, b) => {
        // 학년 → 회차 → 생성일 순으로 정렬
        if (a.grade !== b.grade) return b.grade - a.grade;
        const roundA = a.exam_round || "";
        const roundB = b.exam_round || "";
        if (roundA !== roundB) return roundB.localeCompare(roundA);
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      const recent = sorted[0];
      if (recent && recent.percentile !== null && recent.percentile < 50) {
        result.push(
          `${subject} 모의고사 백분위가 ${recent.percentile.toFixed(1)}%로 낮아, 단원별 기초 문제 복습이 필요합니다.`
        );
      }
    });

    // 3. 내신 vs 모의고사 편차 분석
    const comparableSubjects = ["국어", "수학", "영어"];
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

        const diff = Math.abs(schoolAvg - mockAvg);
        if (diff >= 1.5) {
          if (schoolAvg < mockAvg) {
            result.push(
              `${subject} 과목은 내신(${schoolAvg.toFixed(1)}등급)이 모의고사(${mockAvg.toFixed(1)}등급)보다 좋습니다. 내신 유지에 집중하세요.`
            );
          } else {
            result.push(
              `${subject} 과목은 모의고사(${mockAvg.toFixed(1)}등급)가 내신(${schoolAvg.toFixed(1)}등급)보다 좋습니다. 내신 성적 향상이 필요합니다.`
            );
          }
        }
      }
    });

    // 4. 안정적인 과목 칭찬
    schoolBySubject.forEach((scores, subject) => {
      if (scores.length >= 3) {
        const grades = scores
          .map((s) => s.grade_score)
          .filter((g): g is number => g !== null)
          .slice(0, 3);

        if (grades.length === 3) {
          const variance =
            grades.reduce((sum, g) => {
              const mean = grades.reduce((a, b) => a + b, 0) / grades.length;
              return sum + Math.pow(g - mean, 2);
            }, 0) / grades.length;

          if (variance < 0.5) {
            // 편차가 작으면 안정적
            result.push(
              `${subject} 내신은 안정적으로 유지되고 있습니다. 현재 학습 패턴을 계속 유지하세요.`
            );
          }
        }
      }
    });

    return result.slice(0, 5); // 최대 5개
  }, [schoolScores, mockScores]);

  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">💡</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            인사이트 데이터가 부족합니다
          </h3>
          <p className="text-sm text-gray-500">
            더 많은 성적 데이터를 등록하면 학습 인사이트가 제공됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-indigo-900 mb-4">
        학습 인사이트
      </h2>
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="rounded-lg border border-indigo-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">💡</span>
              <p className="text-sm text-gray-700 flex-1">{insight}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

