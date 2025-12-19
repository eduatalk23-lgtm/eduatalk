"use client";

import React from "react";
import type { SchoolScoreRow } from "@/lib/types/legacyScoreTypes";

type SchoolInsightPanelProps = {
  schoolScores: SchoolScoreRow[];
};

export function SchoolInsightPanel({
  schoolScores,
}: SchoolInsightPanelProps) {
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

    // 2. 학기별 하락 추세
    const semesterBySubject = new Map<string, Map<string, number[]>>();
    schoolScores.forEach((score) => {
      if (!score.subject_group || !score.grade || !score.semester || score.grade_score === null) return;
      const subject = score.subject_group;
      const semesterKey = `${score.grade}-${score.semester}`;
      
      if (!semesterBySubject.has(subject)) {
        semesterBySubject.set(subject, new Map());
      }
      const subjectMap = semesterBySubject.get(subject)!;
      
      if (!subjectMap.has(semesterKey)) {
        subjectMap.set(semesterKey, []);
      }
      subjectMap.get(semesterKey)!.push(score.grade_score);
    });

    semesterBySubject.forEach((semesterMap, subject) => {
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
        if (latest.average > previous.average + 0.5) {
          result.push(
            `${subject} 과목은 ${previous.key.replace("-", "학년 ").replace("-", "학기")}에서 ${latest.key.replace("-", "학년 ").replace("-", "학기")}로 등급이 하락했습니다. (${previous.average.toFixed(1)}등급 → ${latest.average.toFixed(1)}등급)`
          );
        }
      }
    });

    // 3. 안정적인 과목 칭찬
    schoolBySubject.forEach((scores, subject) => {
      if (scores.length >= 3) {
        const grades = scores
          .map((s) => s.grade_score)
          .filter((g): g is number => g !== null)
          .slice(0, 3);

        if (grades.length === 3) {
          const mean = grades.reduce((a, b) => a + b, 0) / grades.length;
          const variance =
            grades.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) /
            grades.length;

          if (variance < 0.5) {
            // 편차가 작으면 안정적
            result.push(
              `${subject} 내신은 안정적으로 유지되고 있습니다. (평균 ${mean.toFixed(1)}등급) 현재 학습 패턴을 계속 유지하세요.`
            );
          }
        }
      }
    });

    // 4. 학년별 성적 향상
    const gradeMap = new Map<number, number[]>();
    schoolScores.forEach((score) => {
      if (score.grade && score.grade_score !== null) {
        if (!gradeMap.has(score.grade)) {
          gradeMap.set(score.grade, []);
        }
        gradeMap.get(score.grade)!.push(score.grade_score);
      }
    });

    const gradeAverages = Array.from(gradeMap.entries())
      .map(([grade, grades]) => ({
        grade,
        average: grades.reduce((a, b) => a + b, 0) / grades.length,
      }))
      .sort((a, b) => a.grade - b.grade);

    if (gradeAverages.length >= 2) {
      const latest = gradeAverages[gradeAverages.length - 1];
      const previous = gradeAverages[gradeAverages.length - 2];
      if (latest.average < previous.average - 0.3) {
        result.push(
          `${previous.grade}학년 대비 ${latest.grade}학년 평균 등급이 향상되었습니다. (${previous.average.toFixed(1)}등급 → ${latest.average.toFixed(1)}등급)`
        );
      }
    }

    return result.slice(0, 5); // 최대 5개
  }, [schoolScores]);

  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto flex flex-col gap-2 max-w-md">
          <div className="text-6xl">💡</div>
          <h3 className="text-lg font-semibold text-gray-900">
            인사이트 데이터가 부족합니다
          </h3>
          <p className="text-sm text-gray-500">
            더 많은 내신 성적 데이터를 등록하면 학습 인사이트가 제공됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-indigo-900">
        내신 학습 인사이트
      </h2>
      <div className="flex flex-col gap-3">
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

