"use client";

import React from "react";
import type { SchoolScoreRow } from "../../_utils/scoreQueries";
import { Card } from "@/components/ui/Card";
import { getGradeColor } from "@/lib/scores/gradeColors";

type SchoolDetailedMetricsProps = {
  schoolScores: SchoolScoreRow[];
};

export function SchoolDetailedMetrics({
  schoolScores,
}: SchoolDetailedMetricsProps) {
  // 학년별 상세 통계
  const gradeStats = React.useMemo(() => {
    const gradeMap = new Map<number, SchoolScoreRow[]>();
    schoolScores.forEach((score) => {
      if (score.grade) {
        if (!gradeMap.has(score.grade)) {
          gradeMap.set(score.grade, []);
        }
        gradeMap.get(score.grade)!.push(score);
      }
    });

    const result: Array<{
      grade: number;
      averageGrade: number;
      subjectCount: number;
      bestSubject: string | null;
      worstSubject: string | null;
    }> = [];

    gradeMap.forEach((scores, grade) => {
      const validGrades = scores
        .map((s) => s.grade_score)
        .filter((g): g is number => g !== null && g !== undefined);
      
      if (validGrades.length === 0) return;

      const averageGrade = validGrades.reduce((a, b) => a + b, 0) / validGrades.length;

      // 과목별 평균 등급 계산
      const subjectMap = new Map<string, number[]>();
      scores.forEach((score) => {
        if (score.subject_group && score.grade_score !== null) {
          if (!subjectMap.has(score.subject_group)) {
            subjectMap.set(score.subject_group, []);
          }
          subjectMap.get(score.subject_group)!.push(score.grade_score);
        }
      });

      let bestSubject: string | null = null;
      let worstSubject: string | null = null;
      let bestAverage = 10;
      let worstAverage = 0;

      subjectMap.forEach((grades, subject) => {
        const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
        if (avg < bestAverage) {
          bestAverage = avg;
          bestSubject = subject;
        }
        if (avg > worstAverage) {
          worstAverage = avg;
          worstSubject = subject;
        }
      });

      result.push({
        grade,
        averageGrade: Number(averageGrade.toFixed(1)),
        subjectCount: subjectMap.size,
        bestSubject,
        worstSubject,
      });
    });

    return result.sort((a, b) => a.grade - b.grade);
  }, [schoolScores]);

  // 학기별 상세 통계
  const semesterStats = React.useMemo(() => {
    const semesterMap = new Map<string, SchoolScoreRow[]>();
    schoolScores.forEach((score) => {
      if (score.grade && score.semester) {
        const key = `${score.grade}-${score.semester}`;
        if (!semesterMap.has(key)) {
          semesterMap.set(key, []);
        }
        semesterMap.get(key)!.push(score);
      }
    });

    const result: Array<{
      period: string;
      averageGrade: number;
      subjectCount: number;
      totalSubjects: number;
    }> = [];

    semesterMap.forEach((scores, key) => {
      const [grade, semester] = key.split("-");
      const validGrades = scores
        .map((s) => s.grade_score)
        .filter((g): g is number => g !== null && g !== undefined);
      
      if (validGrades.length === 0) return;

      const averageGrade = validGrades.reduce((a, b) => a + b, 0) / validGrades.length;
      const subjectSet = new Set<string>();
      scores.forEach((score) => {
        if (score.subject_group) {
          subjectSet.add(score.subject_group);
        }
      });

      result.push({
        period: `${grade}학년 ${semester}학기`,
        averageGrade: Number(averageGrade.toFixed(1)),
        subjectCount: subjectSet.size,
        totalSubjects: scores.length,
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

  // 과목별 평균 등급
  const subjectAverages = React.useMemo(() => {
    const subjectMap = new Map<string, number[]>();
    schoolScores.forEach((score) => {
      if (score.subject_group && score.grade_score !== null) {
        if (!subjectMap.has(score.subject_group)) {
          subjectMap.set(score.subject_group, []);
        }
        subjectMap.get(score.subject_group)!.push(score.grade_score);
      }
    });

    const result: Array<{
      subject: string;
      average: number;
      count: number;
      trend: "improved" | "declined" | "stable" | null;
    }> = [];

    subjectMap.forEach((grades, subject) => {
      const average = grades.reduce((a, b) => a + b, 0) / grades.length;
      
      // 최근 2개 성적 비교로 추세 계산
      const sortedScores = schoolScores
        .filter((s) => s.subject_group === subject && s.grade_score !== null)
        .sort((a, b) => {
          // 학년 → 학기 → 생성일 순으로 정렬
          if (a.grade !== b.grade) return b.grade - a.grade;
          if (a.semester !== b.semester) return b.semester - a.semester;
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 2);

      let trend: "improved" | "declined" | "stable" | null = null;
      if (sortedScores.length >= 2 && sortedScores[0].grade_score !== null && sortedScores[1].grade_score !== null) {
        const latest = sortedScores[0].grade_score;
        const previous = sortedScores[1].grade_score;
        if (latest < previous) trend = "improved";
        else if (latest > previous) trend = "declined";
        else trend = "stable";
      }

      result.push({
        subject,
        average: Number(average.toFixed(1)),
        count: grades.length,
        trend,
      });
    });

    return result.sort((a, b) => a.average - b.average); // 등급 낮은 순 (좋은 순)
  }, [schoolScores]);

  if (schoolScores.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 학년별 상세 통계 */}
      {gradeStats.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              학년별 상세 통계
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gradeStats.map((stat) => {
                const gradeColor = getGradeColor(Math.round(stat.averageGrade));
                return (
                  <div
                    key={stat.grade}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-gray-900">
                        {stat.grade}학년
                      </h4>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${gradeColor.badge}`}
                      >
                        {stat.averageGrade}등급
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">과목 수</span>
                        <span className="font-medium text-gray-900">
                          {stat.subjectCount}개
                        </span>
                      </div>
                      {stat.bestSubject && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">최고 과목</span>
                          <span className="font-medium text-green-600">
                            {stat.bestSubject}
                          </span>
                        </div>
                      )}
                      {stat.worstSubject && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">취약 과목</span>
                          <span className="font-medium text-red-600">
                            {stat.worstSubject}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* 학기별 상세 통계 */}
      {semesterStats.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              학기별 상세 통계
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      학기
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      평균 등급
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      교과 수
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      성적 수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {semesterStats.map((stat) => {
                    const gradeColor = getGradeColor(Math.round(stat.averageGrade));
                    return (
                      <tr
                        key={stat.period}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {stat.period}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${gradeColor.badge}`}
                          >
                            {stat.averageGrade}등급
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-600">
                          {stat.subjectCount}개
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-600">
                          {stat.totalSubjects}개
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* 과목별 평균 등급 */}
      {subjectAverages.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              과목별 평균 등급
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjectAverages.map((item) => {
                const gradeColor = getGradeColor(Math.round(item.average));
                const trendIcon =
                  item.trend === "improved"
                    ? "↑"
                    : item.trend === "declined"
                    ? "↓"
                    : item.trend === "stable"
                    ? "→"
                    : "";
                const trendColor =
                  item.trend === "improved"
                    ? "text-green-600"
                    : item.trend === "declined"
                    ? "text-red-600"
                    : "text-gray-600";

                return (
                  <div
                    key={item.subject}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-gray-900">
                        {item.subject}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.count}개 성적
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.trend && (
                        <span className={`text-sm font-semibold ${trendColor}`}>
                          {trendIcon}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${gradeColor.badge}`}
                      >
                        {item.average}등급
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

