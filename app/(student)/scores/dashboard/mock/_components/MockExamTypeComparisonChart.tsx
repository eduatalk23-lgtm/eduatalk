"use client";

import React, { useState } from "react";
import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import type { MockScoreRow } from "../../_utils/scoreQueries";
import { getChartColor } from "@/lib/constants/colors";

type MockExamTypeComparisonChartProps = {
  mockScores: MockScoreRow[];
};

type MetricType = "percentile" | "grade_score";

export function MockExamTypeComparisonChart({
  mockScores,
}: MockExamTypeComparisonChartProps) {
  const { recharts, loading } = useRecharts();
  const [metric, setMetric] = useState<MetricType>("percentile");
  const [chartType, setChartType] = useState<"bar" | "radar">("bar");

  // 시험 유형별/과목별 평균 계산
  const comparisonData = React.useMemo(() => {
    const typeMap = new Map<string, Map<string, number[]>>();

    mockScores.forEach((score) => {
      if (!score.exam_type || !score.subject_group) return;

      let value: number | null = null;
      if (metric === "percentile" && score.percentile !== null) {
        value = score.percentile;
      } else if (metric === "grade_score" && score.grade_score !== null) {
        value = score.grade_score;
      }

      if (value === null) return;

      if (!typeMap.has(score.exam_type)) {
        typeMap.set(score.exam_type, new Map());
      }
      const subjectMap = typeMap.get(score.exam_type)!;

      if (!subjectMap.has(score.subject_group)) {
        subjectMap.set(score.subject_group, []);
      }
      subjectMap.get(score.subject_group)!.push(value);
    });

    // 모든 과목 수집
    const allSubjects = new Set<string>();
    typeMap.forEach((subjectMap) => {
      subjectMap.forEach((_, subject) => {
        allSubjects.add(subject);
      });
    });

    // 차트 데이터 생성
    const result: Array<Record<string, number | string>> = [];

    allSubjects.forEach((subject) => {
      const dataPoint: Record<string, number | string> = { subject };

      typeMap.forEach((subjectMap, examType) => {
        const values = subjectMap.get(subject);
        if (values && values.length > 0) {
          const average = values.reduce((a, b) => a + b, 0) / values.length;
          dataPoint[examType] = Number(average.toFixed(1));
        } else {
          dataPoint[examType] = 0;
        }
      });

      result.push(dataPoint);
    });

    return result;
  }, [mockScores, metric]);

  // 레이더 차트용 데이터 변환
  const radarData = React.useMemo(() => {
    if (chartType !== "radar") return [];

    const typeMap = new Map<string, Map<string, number[]>>();

    mockScores.forEach((score) => {
      if (!score.exam_type || !score.subject_group) return;

      let value: number | null = null;
      if (metric === "percentile" && score.percentile !== null) {
        value = score.percentile;
      } else if (metric === "grade_score" && score.grade_score !== null) {
        value = score.grade_score;
      }

      if (value === null) return;

      if (!typeMap.has(score.exam_type)) {
        typeMap.set(score.exam_type, new Map());
      }
      const subjectMap = typeMap.get(score.exam_type)!;

      if (!subjectMap.has(score.subject_group)) {
        subjectMap.set(score.subject_group, []);
      }
      subjectMap.get(score.subject_group)!.push(value);
    });

    const result: Array<Record<string, number | string>> = [];

    typeMap.forEach((subjectMap, examType) => {
      const dataPoint: Record<string, number | string> = { examType };

      subjectMap.forEach((values, subject) => {
        if (values.length > 0) {
          const average = values.reduce((a, b) => a + b, 0) / values.length;
          dataPoint[subject] = Number(average.toFixed(1));
        }
      });

      result.push(dataPoint);
    });

    return result;
  }, [mockScores, metric, chartType]);

  if (mockScores.length === 0 || comparisonData.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-12 text-center">
        <div className="mx-auto flex flex-col gap-2 max-w-md">
          <div className="text-6xl">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            비교 데이터가 없습니다
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            모의고사 성적을 등록하면 비교 차트가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  // Show loading skeleton while recharts is loading
  if (loading || !recharts) {
    return <ChartLoadingSkeleton height={400} />;
  }

  const {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
  } = recharts;

  const metricLabel = metric === "percentile" ? "백분위" : "등급";
  const yAxisDomain: [number, number] = metric === "percentile" ? [0, 100] : [1, 9];
  const yAxisReversed = metric === "grade_score";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          시험 유형별 비교
        </h2>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setMetric("percentile")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                metric === "percentile"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              백분위
            </button>
            <button
              onClick={() => setMetric("grade_score")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                metric === "grade_score"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              등급
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setChartType("bar")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                chartType === "bar"
                  ? "bg-purple-600 dark:bg-purple-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              막대
            </button>
            <button
              onClick={() => setChartType("radar")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                chartType === "radar"
                  ? "bg-purple-600 dark:bg-purple-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              레이더
            </button>
          </div>
        </div>
      </div>

      {chartType === "bar" ? (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={comparisonData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="subject"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
            />
            <YAxis
              domain={yAxisDomain}
              reversed={yAxisReversed}
              label={{
                value: metricLabel,
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (value === 0) return ["데이터 없음", name];
                if (metric === "percentile") return [`${value}%`, name];
                return [`${value}등급`, name];
              }}
            />
            <Legend />
            <Bar dataKey="평가원" fill={getChartColor(0)} name="평가원" />
            <Bar dataKey="교육청" fill={getChartColor(1)} name="교육청" />
            <Bar dataKey="사설" fill={getChartColor(2)} name="사설" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis
              dataKey="examType"
              tick={{ fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={yAxisDomain}
              tick={{ fontSize: 10 }}
            />
            <Radar
              name="평가원"
              dataKey="평가원"
              stroke={getChartColor(0)}
              fill={getChartColor(0)}
              fillOpacity={0.6}
            />
            <Radar
              name="교육청"
              dataKey="교육청"
              stroke={getChartColor(1)}
              fill={getChartColor(1)}
              fillOpacity={0.6}
            />
            <Radar
              name="사설"
              dataKey="사설"
              stroke={getChartColor(2)}
              fill={getChartColor(2)}
              fillOpacity={0.6}
            />
            <Tooltip
              formatter={(value: number) => {
                if (metric === "percentile") return `${value}%`;
                return `${value}등급`;
              }}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

