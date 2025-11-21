"use client";

import React from "react";
import type { SchoolScoreRow } from "../../_utils/scoreQueries";

type SchoolWeakSubjectSectionProps = {
  schoolScores: SchoolScoreRow[];
};

type WeakSubject = {
  subject: string;
  riskScore: number;
  reasons: string[];
  recentGrades: number[];
  averageGrade: number;
};

export function SchoolWeakSubjectSection({
  schoolScores,
}: SchoolWeakSubjectSectionProps) {
  const weakSubjects = React.useMemo(() => {
    const results: WeakSubject[] = [];

    // 내신 취약 과목 분석
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
        const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
        const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
        return dateB - dateA; // 최신순
      });

      const recent3 = sorted.slice(0, 3);
      const recentGrades = recent3
        .map((s) => s.grade_score)
        .filter((g): g is number => g !== null);

      if (recentGrades.length === 0) return;

      const averageGrade =
        recentGrades.reduce((a, b) => a + b, 0) / recentGrades.length;

      const reasons: string[] = [];
      let riskScore = 0;

      // 1. 최근 3회 평균 기준 (6등급 이하)
      if (averageGrade >= 6) {
        riskScore += 40;
        reasons.push(`평균 등급 ${averageGrade.toFixed(1)}등급 (낮음)`);
      } else if (averageGrade >= 5) {
        riskScore += 20;
        reasons.push(`평균 등급 ${averageGrade.toFixed(1)}등급`);
      }

      // 2. 최근 점수 하락 가중치
      if (recentGrades.length >= 2) {
        const latest = recentGrades[0];
        const previous = recentGrades[1];
        if (latest > previous) {
          // 등급이 높아졌다는 것은 나빠졌다는 의미
          const decline = latest - previous;
          riskScore += decline * 15;
          reasons.push(`최근 등급 ${decline}단계 하락`);
        }
      }

      // 3. 원점수 편차
      const rawScores = recent3
        .map((s) => s.raw_score)
        .filter((r): r is number => r !== null && r !== undefined);

      if (rawScores.length >= 2) {
        const mean = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
        const variance =
          rawScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
          rawScores.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev > mean * 0.2) {
          riskScore += 20;
          reasons.push(`점수 편차 큼 (불안정)`);
        }
      }

      // 4. 학기별 하락 추세
      const semesterMap = new Map<string, number[]>();
      scores.forEach((score) => {
        if (score.grade && score.semester && score.grade_score !== null) {
          const key = `${score.grade}-${score.semester}`;
          if (!semesterMap.has(key)) {
            semesterMap.set(key, []);
          }
          semesterMap.get(key)!.push(score.grade_score);
        }
      });

      if (semesterMap.size >= 2) {
        const semesterAverages = Array.from(semesterMap.entries())
          .map(([key, grades]) => ({
            key,
            average: grades.reduce((a, b) => a + b, 0) / grades.length,
          }))
          .sort((a, b) => {
            const [aGrade, aSem] = a.key.split("-").map(Number);
            const [bGrade, bSem] = b.key.split("-").map(Number);
            if (aGrade !== bGrade) return aGrade - bGrade;
            return aSem - bSem;
          });

        if (semesterAverages.length >= 2) {
          const latest = semesterAverages[semesterAverages.length - 1];
          const previous = semesterAverages[semesterAverages.length - 2];
          if (latest.average > previous.average) {
            const decline = latest.average - previous.average;
            riskScore += decline * 10;
            reasons.push(`학기별 등급 하락 추세`);
          }
        }
      }

      if (riskScore >= 30) {
        results.push({
          subject,
          riskScore: Math.min(100, riskScore),
          reasons,
          recentGrades,
          averageGrade,
        });
      }
    });

    // Risk Score 순으로 정렬 (높은 순)
    return results.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  }, [schoolScores]);

  if (weakSubjects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">✅</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            취약 과목이 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            현재 내신 성적이 안정적입니다. 계속 유지하세요!
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
    <div className="space-y-4">
      {weakSubjects.map((item, index) => (
        <div
          key={`${item.subject}-${index}`}
          className={`rounded-lg border p-6 ${getRiskColor(item.riskScore)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">{item.subject}</h3>
                <span className="text-xs font-medium px-2 py-1 rounded bg-white/50">
                  내신
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
              {item.recentGrades.length > 0 && (
                <p className="mt-2 text-xs opacity-75">
                  최근 등급: {item.recentGrades.join(", ")} (평균:{" "}
                  {item.averageGrade.toFixed(1)})
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

