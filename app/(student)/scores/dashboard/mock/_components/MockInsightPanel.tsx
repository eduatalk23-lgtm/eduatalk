"use client";

import React from "react";
import type { MockScoreRow } from "../../_utils/scoreQueries";

type MockInsightPanelProps = {
  mockScores: MockScoreRow[];
};

export function MockInsightPanel({
  mockScores,
}: MockInsightPanelProps) {
  const insights = React.useMemo(() => {
    const result: string[] = [];

    // 1. 교과별 최근 하락 추세 분석
    const mockBySubject = new Map<string, MockScoreRow[]>();
    mockScores.forEach((score) => {
      if (!score.subject_group || (score.percentile === null && score.grade_score === null)) return;
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

      if (sorted.length >= 2) {
        const recent2 = sorted.slice(0, 2);
        const percentiles = recent2
          .map((s) => s.percentile)
          .filter((p): p is number => p !== null && p !== undefined);
        const grades = recent2
          .map((s) => s.grade_score)
          .filter((g): g is number => g !== null && g !== undefined);

        if (percentiles.length === 2 && percentiles[0] < percentiles[1]) {
          result.push(
            `${subject} 과목은 최근 두 번 연속 백분위가 하락했습니다. (${percentiles[1].toFixed(1)}% → ${percentiles[0].toFixed(1)}%) 기초 개념 복습이 필요합니다.`
          );
        }

        if (grades.length === 2 && grades[0] > grades[1]) {
          result.push(
            `${subject} 과목은 최근 두 번 연속 등급이 하락했습니다. (${grades[1]}등급 → ${grades[0]}등급) 단원별 기초 문제 복습이 필요합니다.`
          );
        }
      }
    });

    // 2. 모의고사 백분위 낮은 과목
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

    // 3. 시험 유형별 성적 편차
    const typeBySubject = new Map<string, Map<string, number[]>>();
    mockScores.forEach((score) => {
      if (!score.subject_group || !score.exam_type || score.percentile === null) return;
      const subject = score.subject_group;
      const type = score.exam_type;

      if (!typeBySubject.has(subject)) {
        typeBySubject.set(subject, new Map());
      }
      const subjectMap = typeBySubject.get(subject)!;

      if (!subjectMap.has(type)) {
        subjectMap.set(type, []);
      }
      subjectMap.get(type)!.push(score.percentile);
    });

    typeBySubject.forEach((typeMap, subject) => {
      const typeAverages = Array.from(typeMap.entries()).map(([type, percentiles]) => ({
        type,
        average: percentiles.reduce((a, b) => a + b, 0) / percentiles.length,
      }));

      if (typeAverages.length >= 2) {
        const max = Math.max(...typeAverages.map((t) => t.average));
        const min = Math.min(...typeAverages.map((t) => t.average));
        const diff = max - min;

        if (diff > 20) {
          const bestType = typeAverages.find((t) => t.average === max)?.type;
          const worstType = typeAverages.find((t) => t.average === min)?.type;
          result.push(
            `${subject} 과목은 시험 유형별 편차가 큽니다. (${worstType}: ${min.toFixed(1)}%, ${bestType}: ${max.toFixed(1)}%) ${worstType} 유형 문제에 집중하세요.`
          );
        }
      }
    });

    // 4. 회차별 성적 향상
    const roundBySubject = new Map<string, Map<string, number[]>>();
    mockScores.forEach((score) => {
      if (!score.subject_group || !score.exam_round || score.percentile === null) return;
      const subject = score.subject_group;
      const round = score.exam_round;

      if (!roundBySubject.has(subject)) {
        roundBySubject.set(subject, new Map());
      }
      const subjectMap = roundBySubject.get(subject)!;

      if (!subjectMap.has(round)) {
        subjectMap.set(round, []);
      }
      subjectMap.get(round)!.push(score.percentile);
    });

    roundBySubject.forEach((roundMap, subject) => {
      const roundAverages = Array.from(roundMap.entries())
        .map(([round, percentiles]) => ({
          round,
          average: percentiles.reduce((a, b) => a + b, 0) / percentiles.length,
        }))
        .sort((a, b) => {
          const order = ["3월", "4월", "6월", "9월", "11월", "사설"];
          const indexA = order.indexOf(a.round);
          const indexB = order.indexOf(b.round);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });

      if (roundAverages.length >= 2) {
        const latest = roundAverages[roundAverages.length - 1];
        const previous = roundAverages[roundAverages.length - 2];
        if (latest.average > previous.average + 5) {
          result.push(
            `${subject} 과목은 ${previous.round} 대비 ${latest.round} 백분위가 향상되었습니다. (${previous.average.toFixed(1)}% → ${latest.average.toFixed(1)}%)`
          );
        }
      }
    });

    // 5. 안정적인 과목 칭찬
    mockBySubject.forEach((scores, subject) => {
      if (scores.length >= 3) {
        const percentiles = scores
          .map((s) => s.percentile)
          .filter((p): p is number => p !== null && p !== undefined)
          .slice(0, 3);

        if (percentiles.length === 3) {
          const mean = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
          const variance =
            percentiles.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) /
            percentiles.length;

          if (variance < 50) {
            // 편차가 작으면 안정적
            result.push(
              `${subject} 모의고사는 안정적으로 유지되고 있습니다. (평균 ${mean.toFixed(1)}%) 현재 학습 패턴을 계속 유지하세요.`
            );
          }
        }
      }
    });

    return result.slice(0, 5); // 최대 5개
  }, [mockScores]);

  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto flex flex-col gap-2 max-w-md">
          <div className="text-6xl">💡</div>
          <h3 className="text-lg font-semibold text-gray-900">
            인사이트 데이터가 부족합니다
          </h3>
          <p className="text-sm text-gray-500">
            더 많은 모의고사 성적 데이터를 등록하면 학습 인사이트가 제공됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-purple-200 bg-purple-50 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-purple-900">
        모의고사 학습 인사이트
      </h2>
      <div className="flex flex-col gap-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="rounded-lg border border-purple-200 bg-white p-4"
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

