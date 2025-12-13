"use client";

import React from "react";
import type { SchoolScoreRow } from "../../_utils/scoreQueries";
import { Card } from "@/components/molecules/Card";
import { getGradeColor, getTrendColor } from "@/lib/constants/colors";

type SchoolSummarySectionProps = {
  schoolScores: SchoolScoreRow[];
};

export function SchoolSummarySection({
  schoolScores,
}: SchoolSummarySectionProps) {
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

  // 학년별 평균 등급
  const gradeAverages = React.useMemo(() => {
    const gradeMap = new Map<number, number[]>();
    schoolScores.forEach((score) => {
      if (score.grade && score.grade_score !== null) {
        if (!gradeMap.has(score.grade)) {
          gradeMap.set(score.grade, []);
        }
        gradeMap.get(score.grade)!.push(score.grade_score);
      }
    });

    const result: Array<{ grade: number; average: number }> = [];
    gradeMap.forEach((grades, grade) => {
      const average = grades.reduce((a, b) => a + b, 0) / grades.length;
      result.push({ grade, average: Number(average.toFixed(1)) });
    });
    return result.sort((a, b) => a.grade - b.grade);
  }, [schoolScores]);

  // 학기별 평균 등급
  const semesterAverages = React.useMemo(() => {
    const semesterMap = new Map<string, number[]>();
    schoolScores.forEach((score) => {
      if (score.grade && score.semester && score.grade_score !== null) {
        const key = `${score.grade}-${score.semester}`;
        if (!semesterMap.has(key)) {
          semesterMap.set(key, []);
        }
        semesterMap.get(key)!.push(score.grade_score);
      }
    });

    const result: Array<{ period: string; average: number }> = [];
    semesterMap.forEach((grades, key) => {
      const [grade, semester] = key.split("-");
      const average = grades.reduce((a, b) => a + b, 0) / grades.length;
      result.push({
        period: `${grade}학년 ${semester}학기`,
        average: Number(average.toFixed(1)),
      });
    });
    return result.sort((a, b) => {
      const aMatch = a.period.match(/(\d)학년 (\d)학기/);
      const bMatch = b.period.match(/(\d)학년 (\d)학기/);
      if (!aMatch || !bMatch) return 0;
      const aGrade = parseInt(aMatch[1]);
      const bGrade = parseInt(bMatch[1]);
      if (aGrade !== bGrade) return aGrade - bGrade;
      const aSemester = parseInt(aMatch[2]);
      const bSemester = parseInt(bMatch[2]);
      return aSemester - bSemester;
    });
  }, [schoolScores]);

  // 최근 내신 성적 (최신 3개)
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
    return sorted.slice(0, 3);
  }, [schoolScores]);

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
              <p className="text-sm font-medium text-gray-600">전체 평균 등급</p>
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

      {/* 학년별 평균 */}
      <Card>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-600">학년별 평균</p>
          {gradeAverages.length > 0 ? (
            <div className="flex flex-col gap-2">
              {gradeAverages.map((item) => {
                const gradeColor = getGradeColor(Math.round(item.average));
                return (
                  <div
                    key={item.grade}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="text-xs text-gray-600">
                      {item.grade}학년
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-sm font-semibold ${gradeColor.badge}`}
                    >
                      {item.average}등급
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

      {/* 최근 학기 평균 */}
      <Card>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-600">최근 학기 평균</p>
          {semesterAverages.length > 0 ? (
            <div className="flex flex-col gap-2">
              {semesterAverages.slice(-2).map((item) => {
                const gradeColor = getGradeColor(Math.round(item.average));
                return (
                  <div
                    key={item.period}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="text-xs text-gray-600">{item.period}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-sm font-semibold ${gradeColor.badge}`}
                    >
                      {item.average}등급
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
    </div>
  );
}

