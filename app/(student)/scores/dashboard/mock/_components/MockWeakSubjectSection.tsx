"use client";

import React from "react";
import type { MockScoreRow } from "../../_utils/scoreQueries";

type MockWeakSubjectSectionProps = {
  mockScores: MockScoreRow[];
};

type WeakSubject = {
  subject: string;
  riskScore: number;
  reasons: string[];
  recentPercentiles: number[];
  recentGrades: number[];
  averagePercentile: number;
  averageGrade: number;
};

export function MockWeakSubjectSection({
  mockScores,
}: MockWeakSubjectSectionProps) {
  const weakSubjects = React.useMemo(() => {
    const results: WeakSubject[] = [];

    // 모의고사 취약 과목 분석
    const mockBySubject = new Map<string, MockScoreRow[]>();
    mockScores.forEach((score) => {
      if (!score.subject_group || (score.percentile === null && score.grade_score === null))
        return;
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
        return dateB - dateA; // 최신순
      });

      const recent3 = sorted.slice(0, 3);
      const recentPercentiles = recent3
        .map((s) => s.percentile)
        .filter((p): p is number => p !== null && p !== undefined);
      const recentGrades = recent3
        .map((s) => s.grade_score)
        .filter((g): g is number => g !== null && g !== undefined);

      if (recentPercentiles.length === 0 && recentGrades.length === 0) return;

      const reasons: string[] = [];
      let riskScore = 0;

      // 백분위 50 미만
      if (recentPercentiles.length > 0) {
        const avgPercentile =
          recentPercentiles.reduce((a, b) => a + b, 0) / recentPercentiles.length;
        if (avgPercentile < 50) {
          riskScore += 50;
          reasons.push(`평균 백분위 ${avgPercentile.toFixed(1)}% (낮음)`);
        } else if (avgPercentile < 60) {
          riskScore += 25;
          reasons.push(`평균 백분위 ${avgPercentile.toFixed(1)}%`);
        }
      }

      // 등급 6 이상
      if (recentGrades.length > 0) {
        const avgGrade =
          recentGrades.reduce((a, b) => a + b, 0) / recentGrades.length;
        if (avgGrade >= 6) {
          riskScore += 40;
          reasons.push(`평균 등급 ${avgGrade.toFixed(1)}등급 (낮음)`);
        } else if (avgGrade >= 5) {
          riskScore += 20;
          reasons.push(`평균 등급 ${avgGrade.toFixed(1)}등급`);
        }
      }

      // 최근 하락
      if (recentPercentiles.length >= 2) {
        const latest = recentPercentiles[0];
        const previous = recentPercentiles[1];
        if (latest < previous) {
          const decline = previous - latest;
          riskScore += decline * 2;
          reasons.push(`최근 백분위 ${decline.toFixed(1)}%p 하락`);
        }
      }

      // 등급 하락
      if (recentGrades.length >= 2) {
        const latest = recentGrades[0];
        const previous = recentGrades[1];
        if (latest > previous) {
          const decline = latest - previous;
          riskScore += decline * 15;
          reasons.push(`최근 등급 ${decline}단계 하락`);
        }
      }

      // 시험 유형별 편차
      const typeMap = new Map<string, number[]>();
      scores.forEach((score) => {
        if (score.exam_type && score.percentile !== null) {
          if (!typeMap.has(score.exam_type)) {
            typeMap.set(score.exam_type, []);
          }
          typeMap.get(score.exam_type)!.push(score.percentile);
        }
      });

      if (typeMap.size >= 2) {
        const typeAverages = Array.from(typeMap.entries()).map(([type, percentiles]) => ({
          type,
          average: percentiles.reduce((a, b) => a + b, 0) / percentiles.length,
        }));

        const max = Math.max(...typeAverages.map((t) => t.average));
        const min = Math.min(...typeAverages.map((t) => t.average));
        const diff = max - min;

        if (diff > 15) {
          riskScore += 20;
          reasons.push(`시험 유형별 편차 큼 (${diff.toFixed(1)}%p)`);
        }
      }

      if (riskScore >= 30) {
        results.push({
          subject,
          riskScore: Math.min(100, riskScore),
          reasons,
          recentPercentiles,
          recentGrades,
          averagePercentile:
            recentPercentiles.length > 0
              ? recentPercentiles.reduce((a, b) => a + b, 0) / recentPercentiles.length
              : 0,
          averageGrade:
            recentGrades.length > 0
              ? recentGrades.reduce((a, b) => a + b, 0) / recentGrades.length
              : 0,
        });
      }
    });

    // Risk Score 순으로 정렬 (높은 순)
    return results.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  }, [mockScores]);

  if (weakSubjects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto flex flex-col gap-2 max-w-md">
          <div className="text-6xl">✅</div>
          <h3 className="text-lg font-semibold text-gray-900">
            취약 과목이 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            현재 모의고사 성적이 안정적입니다. 계속 유지하세요!
          </p>
        </div>
      </div>
    );
  }

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 70) return "text-red-600 bg-red-50 border-red-200";
    if (riskScore >= 50) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-yellow-600 bg-yellow-50 border-yellow-200";
  };

  return (
    <div className="flex flex-col gap-4">
      {weakSubjects.map((item, index) => (
        <div
          key={`${item.subject}-${index}`}
          className={`rounded-lg border p-6 ${getRiskColor(item.riskScore)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">{item.subject}</h3>
                <span className="text-xs font-medium px-2 py-1 rounded bg-white/50">
                  모의고사
                </span>
                <span className="text-sm font-bold">
                  Risk Score: {item.riskScore}
                </span>
              </div>
              <div className="space-y-1">
                {item.reasons.map((reason, idx) => (
                  <p key={idx} className="text-sm">
                    • {reason}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-xs opacity-75">
                {item.recentPercentiles.length > 0 && (
                  <p>
                    최근 백분위: {item.recentPercentiles.map(p => p.toFixed(1)).join(", ")}% (평균: {item.averagePercentile.toFixed(1)}%)
                  </p>
                )}
                {item.recentGrades.length > 0 && (
                  <p>
                    최근 등급: {item.recentGrades.join(", ")} (평균: {item.averageGrade.toFixed(1)})
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

