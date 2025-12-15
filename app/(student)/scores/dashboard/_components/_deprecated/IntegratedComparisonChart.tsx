/**
 * @deprecated 이 컴포넌트는 레거시 성적 대시보드에서 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 */
"use client";

import React, { useState } from "react";
import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import type { SchoolScoreRow, MockScoreRow } from "../../_utils/scoreQueries";
import { getChartColor } from "@/lib/constants/colors";

type IntegratedComparisonChartProps = {
  schoolScores: SchoolScoreRow[];
  mockScores: MockScoreRow[];
};

type ChartType = "trend" | "subject";

export function IntegratedComparisonChart({
  schoolScores,
  mockScores,
}: IntegratedComparisonChartProps) {
  const { recharts, loading } = useRecharts();
  const [chartType, setChartType] = useState<ChartType>("trend");

  // 시간별 추세 비교 데이터
  const trendData = React.useMemo(() => {
    const result: Array<Record<string, number | string | null>> = [];

    // 내신 데이터: 학기별 평균 등급
    const schoolSemesterMap = new Map<string, number[]>();
    schoolScores.forEach((score) => {
      if (score.grade && score.semester && score.grade_score !== null) {
        const key = `${score.grade}-${score.semester}`;
        if (!schoolSemesterMap.has(key)) {
          schoolSemesterMap.set(key, []);
        }
        schoolSemesterMap.get(key)!.push(score.grade_score);
      }
    });

    const schoolData: Array<{ period: string; average: number }> = [];
    schoolSemesterMap.forEach((grades, key) => {
      const [grade, semester] = key.split("-");
      const average = grades.reduce((a, b) => a + b, 0) / grades.length;
      schoolData.push({
        period: `${grade}학년 ${semester}학기`,
        average: Number(average.toFixed(1)),
      });
    });

    // 모의고사 데이터: 회차별 평균 등급
    const mockRoundMap = new Map<string, number[]>();
    mockScores.forEach((score) => {
      if (score.exam_round && score.grade_score !== null) {
        if (!mockRoundMap.has(score.exam_round)) {
          mockRoundMap.set(score.exam_round, []);
        }
        mockRoundMap.get(score.exam_round)!.push(score.grade_score);
      }
    });

    const mockData: Array<{ period: string; average: number }> = [];
    const roundOrder = ["3월", "4월", "6월", "9월", "11월", "사설"];
    roundOrder.forEach((round) => {
      const grades = mockRoundMap.get(round);
      if (grades && grades.length > 0) {
        const average = grades.reduce((a, b) => a + b, 0) / grades.length;
        mockData.push({
          period: `${round} 모의고사`,
          average: Number(average.toFixed(1)),
        });
      }
    });

    // 모든 기간 수집 및 정렬
    const allPeriods = new Set<string>();
    schoolData.forEach((d) => allPeriods.add(d.period));
    mockData.forEach((d) => allPeriods.add(d.period));

    const sortedPeriods = Array.from(allPeriods).sort((a, b) => {
      // 학기 데이터와 모의고사 데이터를 함께 정렬
      const aIsSchool = a.includes("학기");
      const bIsSchool = b.includes("학기");
      
      if (aIsSchool && !bIsSchool) return -1;
      if (!aIsSchool && bIsSchool) return 1;
      
      // 같은 타입 내에서 정렬
      if (aIsSchool && bIsSchool) {
        const aMatch = a.match(/(\d)학년 (\d)학기/);
        const bMatch = b.match(/(\d)학년 (\d)학기/);
        if (aMatch && bMatch) {
          const aGrade = parseInt(aMatch[1]);
          const bGrade = parseInt(bMatch[1]);
          if (aGrade !== bGrade) return aGrade - bGrade;
          return parseInt(aMatch[2]) - parseInt(bMatch[2]);
        }
      }
      
      return a.localeCompare(b);
    });

    sortedPeriods.forEach((period) => {
      const dataPoint: Record<string, number | string | null> = { period };
      const schoolItem = schoolData.find((d) => d.period === period);
      const mockItem = mockData.find((d) => d.period === period);
      
      dataPoint["내신"] = schoolItem ? schoolItem.average : null;
      dataPoint["모의고사"] = mockItem ? mockItem.average : null;
      
      result.push(dataPoint);
    });

    return result;
  }, [schoolScores, mockScores]);

  // 과목별 비교 데이터
  const subjectData = React.useMemo(() => {
    const comparableSubjects = ["국어", "수학", "영어"];
    const result: Array<{
      subject: string;
      내신: number | null;
      모의고사: number | null;
      차이: number | null;
    }> = [];

    comparableSubjects.forEach((subject) => {
      // 내신 평균 등급
      const schoolScoresForSubject = schoolScores.filter(
        (s) => s.subject_group === subject && s.grade_score !== null
      );
      const schoolAverage =
        schoolScoresForSubject.length > 0
          ? schoolScoresForSubject.reduce(
              (sum, s) => sum + (s.grade_score ?? 0),
              0
            ) / schoolScoresForSubject.length
          : null;

      // 모의고사 평균 등급
      const mockScoresForSubject = mockScores.filter(
        (s) => s.subject_group === subject && s.grade_score !== null
      );
      const mockAverage =
        mockScoresForSubject.length > 0
          ? mockScoresForSubject.reduce(
              (sum, s) => sum + (s.grade_score ?? 0),
              0
            ) / mockScoresForSubject.length
          : null;

      const diff =
        schoolAverage !== null && mockAverage !== null
          ? Number((schoolAverage - mockAverage).toFixed(1))
          : null;

      if (schoolAverage !== null || mockAverage !== null) {
        result.push({
          subject,
          내신: schoolAverage !== null ? Number(schoolAverage.toFixed(1)) : null,
          모의고사: mockAverage !== null ? Number(mockAverage.toFixed(1)) : null,
          차이: diff,
        });
      }
    });

    return result;
  }, [schoolScores, mockScores]);

  if (schoolScores.length === 0 && mockScores.length === 0) {
    return null;
  }

  // Show loading skeleton while recharts is loading
  if (loading || !recharts) {
    return <ChartLoadingSkeleton height={400} />;
  }

  const {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
  } = recharts;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          통합 성적 비교 분석
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType("trend")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              chartType === "trend"
                ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            시간별 추세
          </button>
          <button
            onClick={() => setChartType("subject")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              chartType === "subject"
                ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            과목별 비교
          </button>
        </div>
      </div>

      {chartType === "trend" ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={trendData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
            />
            <YAxis
              domain={[1, 9]}
              reversed
              label={{ value: "등급", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value: any) => {
                if (value === null || value === undefined) return "데이터 없음";
                return `${value}등급`;
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="내신"
              stroke={getChartColor(0)}
              strokeWidth={2}
              name="내신 평균 등급"
              dot={{ r: 6 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="모의고사"
              stroke={getChartColor(1)}
              strokeWidth={2}
              name="모의고사 평균 등급"
              dot={{ r: 6 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col gap-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={subjectData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" />
              <YAxis
                domain={[1, 9]}
                reversed
                label={{ value: "등급", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                formatter={(value: any) => {
                  if (value === null || value === undefined) return "데이터 없음";
                  return `${value}등급`;
                }}
              />
              <Legend />
              <Bar dataKey="내신" fill={getChartColor(0)} name="내신 평균 등급" />
              <Bar dataKey="모의고사" fill={getChartColor(1)} name="모의고사 평균 등급" />
            </BarChart>
          </ResponsiveContainer>
          
          {/* 차이 분석 테이블 */}
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              등급 차이 분석
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                      과목
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                      내신
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                      모의고사
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                      차이
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                      분석
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjectData.map((item) => {
                    const diff = item.차이;
                    const analysis =
                      diff === null
                        ? "-"
                        : diff < -0.5
                        ? "내신이 더 좋음"
                        : diff > 0.5
                        ? "모의고사가 더 좋음"
                        : "비슷함";
                    const analysisColor =
                      diff === null
                        ? "text-gray-500 dark:text-gray-400"
                        : diff < -0.5
                        ? "text-green-600 dark:text-green-400"
                        : diff > 0.5
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-gray-600 dark:text-gray-400";

                    return (
                      <tr
                        key={item.subject}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800"
                      >
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                          {item.subject}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">
                          {item.내신 !== null ? `${item.내신}등급` : "-"}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">
                          {item.모의고사 !== null ? `${item.모의고사}등급` : "-"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {diff !== null ? (
                            <span
                              className={`font-semibold ${
                                diff < 0
                                  ? "text-green-600 dark:text-green-400"
                                  : diff > 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              {diff > 0 ? "+" : ""}
                              {diff}등급
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className={`py-2 px-3 text-center font-medium ${analysisColor}`}>
                          {analysis}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

