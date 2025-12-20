"use client";

import React from "react";
import type { SchoolScoreRow } from "@/lib/types/legacyScoreTypes";
import { EmptyState } from "@/components/molecules/EmptyState";
import { getRiskColorClasses, textPrimary, textMuted, getBadgeStyle } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

/**
 * @deprecated 이 컴포넌트는 레거시 내신 성적 대시보드용입니다.
 * 새로운 통합 성적 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 */
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
        // 학년 → 학기 → 생성일 순으로 정렬
        if (a.grade !== b.grade) return b.grade - a.grade;
        if (a.semester !== b.semester) return b.semester - a.semester;
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
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
      <EmptyState
        icon="✅"
        title="취약 과목이 없습니다"
        description="현재 내신 성적이 안정적입니다. 계속 유지하세요!"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {weakSubjects.map((item, index) => (
        <div
          key={`${item.subject}-${index}`}
          className={cn("rounded-lg border p-6", getRiskColorClasses(item.riskScore))}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h3 className={cn("text-lg font-semibold", textPrimary)}>{item.subject}</h3>
                <span className={getBadgeStyle("subtle")}>
                  내신
                </span>
                <span className={cn("text-sm font-bold", textPrimary)}>
                  Risk Score: {item.riskScore}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {item.reasons.map((reason, idx) => (
                  <p key={idx} className={cn("text-sm", textPrimary)}>
                    • {reason}
                  </p>
                ))}
              </div>
              {item.recentGrades.length > 0 && (
                <p className={cn("text-xs", textMuted)}>
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

