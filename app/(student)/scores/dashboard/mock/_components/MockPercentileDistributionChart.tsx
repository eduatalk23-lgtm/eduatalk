"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { MockScoreRow } from "../../_utils/scoreQueries";
import { getChartColor } from "@/lib/constants/colors";

type MockPercentileDistributionChartProps = {
  mockScores: MockScoreRow[];
};

export function MockPercentileDistributionChart({
  mockScores,
}: MockPercentileDistributionChartProps) {
  // 백분위 구간별 분포
  const percentileDistribution = React.useMemo(() => {
    const ranges = [
      { label: "0-20%", min: 0, max: 20 },
      { label: "21-40%", min: 21, max: 40 },
      { label: "41-60%", min: 41, max: 60 },
      { label: "61-80%", min: 61, max: 80 },
      { label: "81-100%", min: 81, max: 100 },
    ];

    const result: Array<{ range: string; count: number; percentage: number }> = [];
    const validScores = mockScores.filter((s) => s.percentile !== null);
    const total = validScores.length;

    ranges.forEach((range) => {
      const count = validScores.filter((s) => {
        const percentile = s.percentile!;
        return percentile >= range.min && percentile <= range.max;
      }).length;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      result.push({
        range: range.label,
        count,
        percentage: Number(percentage.toFixed(1)),
      });
    });

    return result;
  }, [mockScores]);

  // 시험 유형별 백분위 분포
  const typeDistribution = React.useMemo(() => {
    const typeMap = new Map<string, number[]>();

    mockScores.forEach((score) => {
      if (score.exam_type && score.percentile !== null) {
        if (!typeMap.has(score.exam_type)) {
          typeMap.set(score.exam_type, []);
        }
        typeMap.get(score.exam_type)!.push(score.percentile);
      }
    });

    const ranges = [
      { label: "0-20%", min: 0, max: 20 },
      { label: "21-40%", min: 21, max: 40 },
      { label: "41-60%", min: 41, max: 60 },
      { label: "61-80%", min: 61, max: 80 },
      { label: "81-100%", min: 81, max: 100 },
    ];

    const result: Array<Record<string, number | string>> = [];

    ranges.forEach((range) => {
      const dataPoint: Record<string, number | string> = { range: range.label };

      typeMap.forEach((percentiles, type) => {
        const count = percentiles.filter(
          (p) => p >= range.min && p <= range.max
        ).length;
        const total = percentiles.length;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        dataPoint[type] = Number(percentage.toFixed(1));
      });

      result.push(dataPoint);
    });

    return { data: result, types: Array.from(typeMap.keys()) };
  }, [mockScores]);

  // 회차별 평균 백분위 추이
  const roundTrend = React.useMemo(() => {
    const roundMap = new Map<string, number[]>();

    mockScores.forEach((score) => {
      if (score.exam_round && score.percentile !== null) {
        if (!roundMap.has(score.exam_round)) {
          roundMap.set(score.exam_round, []);
        }
        roundMap.get(score.exam_round)!.push(score.percentile);
      }
    });

    const roundOrder = ["3월", "4월", "6월", "9월", "11월", "사설"];
    const result: Array<{ round: string; average: number }> = [];

    roundOrder.forEach((round) => {
      const percentiles = roundMap.get(round);
      if (percentiles && percentiles.length > 0) {
        const average = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
        result.push({
          round,
          average: Number(average.toFixed(1)),
        });
      }
    });

    return result;
  }, [mockScores]);

  if (mockScores.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto flex flex-col gap-2 max-w-md">
          <div className="text-6xl">📊</div>
          <h3 className="text-lg font-semibold text-gray-900">
            분포 데이터가 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            모의고사 성적을 등록하면 분포 차트가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 백분위 구간별 분포 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          백분위 구간별 분포
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={percentileDistribution}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "count") return [`${value}개`, "개수"];
                if (name === "percentage") return [`${value}%`, "비율"];
                return [value, name];
              }}
            />
            <Legend />
            <Bar dataKey="count" fill={getChartColor(0)} name="개수" />
            <Bar dataKey="percentage" fill={getChartColor(1)} name="비율(%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 시험 유형별 백분위 분포 */}
      {typeDistribution.types.length > 0 && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            시험 유형별 백분위 분포
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={typeDistribution.data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value}%`} />
              <Legend />
              {typeDistribution.types.map((type, index) => {
                return (
                  <Bar
                    key={type}
                    dataKey={type}
                    fill={getChartColor(index)}
                    name={type}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 회차별 평균 백분위 추이 */}
      {roundTrend.length > 0 && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            회차별 평균 백분위 추이
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={roundTrend}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="round" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value: number) => `${value}%`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="average"
                stroke={getChartColor(0)}
                strokeWidth={2}
                name="평균 백분위"
                dot={{ r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

