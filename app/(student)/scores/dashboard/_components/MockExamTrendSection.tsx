/**
 * @deprecated 이 컴포넌트는 레거시 성적 대시보드에서 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)에서는 사용되지 않습니다.
 */
"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/molecules/Card";
import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import type { MockScoreRow } from "@/lib/types/legacyScoreTypes";
import { getChartColor } from "@/lib/constants/colors";
import { EmptyState } from "@/components/molecules/EmptyState";

type MockExamTrendSectionProps = {
  mockScores: MockScoreRow[];
};

type MetricType = "percentile" | "grade_score" | "raw_score";

export function MockExamTrendSection({
  mockScores,
}: MockExamTrendSectionProps) {
  const { recharts, loading } = useRecharts();
  const [metric, setMetric] = useState<MetricType>("percentile");

  // exam_round별로 데이터 그룹화
  const chartData = React.useMemo(() => {
    const roundMap = new Map<string, MockScoreRow[]>();

    mockScores.forEach((score) => {
      if (!score.exam_round) return;
      const round = score.exam_round;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(score);
    });

    // exam_round 순서 정의
    const roundOrder = ["3월", "4월", "6월", "9월", "11월", "사설"];
    const sortedRounds = Array.from(roundMap.entries()).sort((a, b) => {
      const indexA = roundOrder.indexOf(a[0]);
      const indexB = roundOrder.indexOf(b[0]);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // exam_type별로 평균 계산
    const typeMap = new Map<string, number[]>();

    sortedRounds.forEach(([round, scores]) => {
      scores.forEach((score) => {
        const type = score.exam_type;
        let value: number | null = null;

        if (metric === "percentile" && score.percentile !== null) {
          value = score.percentile;
        } else if (metric === "grade_score" && score.grade_score !== null) {
          value = score.grade_score;
        } else if (metric === "raw_score" && score.raw_score !== null) {
          value = score.raw_score;
        }

        if (value !== null) {
          if (!typeMap.has(`${round}_${type}`)) {
            typeMap.set(`${round}_${type}`, []);
          }
          typeMap.get(`${round}_${type}`)!.push(value);
        }
      });
    });

    // 차트 데이터 생성
    const result: Array<Record<string, number | null | string>> = [];

    sortedRounds.forEach(([round]) => {
      const dataPoint: Record<string, number | null | string> = { round };
      const types = ["평가원", "교육청", "사설"];

      types.forEach((type) => {
        const key = `${round}_${type}`;
        const values = typeMap.get(key);
        if (values && values.length > 0) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          dataPoint[type] = Number(avg.toFixed(1));
        } else {
          dataPoint[type] = null;
        }
      });

      result.push(dataPoint);
    });

    return result;
  }, [mockScores, metric]);

  const hasData = mockScores.length > 0 && chartData.length > 0;

  if (!hasData) {
    return (
      <EmptyState
        icon="📊"
        title="모의고사 성적 트렌드 데이터가 없습니다"
        description="모의고사 성적을 등록하면 변화 그래프가 표시됩니다."
      />
    );
  }

  const metricLabel =
    metric === "percentile"
      ? "백분위"
      : metric === "grade_score"
      ? "등급"
      : "원점수";

  const yAxisDomain =
    metric === "percentile"
      ? [0, 100]
      : metric === "grade_score"
      ? [1, 9]
      : undefined;

  const yAxisReversed = metric === "grade_score";

  if (loading || !recharts) {
    return (
      <Card padding="md">
        <CardContent className="flex flex-col gap-4">
          <ChartLoadingSkeleton height={400} />
        </CardContent>
      </Card>
    );
  }

  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = recharts;

  return (
    <Card padding="md">
      <CardContent className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-text-primary">
          모의고사 성적 트렌드
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setMetric("percentile")}
            className={`rounded-lg px-3 py-1.5 text-body-2 font-medium transition ${
              metric === "percentile"
                ? "bg-primary-600 text-white"
                : "bg-secondary-100 text-text-secondary hover:bg-secondary-200"
            }`}
          >
            백분위
          </button>
          <button
            onClick={() => setMetric("grade_score")}
            className={`rounded-lg px-3 py-1.5 text-body-2 font-medium transition ${
              metric === "grade_score"
                ? "bg-primary-600 text-white"
                : "bg-secondary-100 text-text-secondary hover:bg-secondary-200"
            }`}
          >
            등급
          </button>
          <button
            onClick={() => setMetric("raw_score")}
            className={`rounded-lg px-3 py-1.5 text-body-2 font-medium transition ${
              metric === "raw_score"
                ? "bg-primary-600 text-white"
                : "bg-secondary-100 text-text-secondary hover:bg-secondary-200"
            }`}
          >
            원점수
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="round" />
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
            formatter={(value: number | string | null) => {
              if (value === null || value === undefined) return "데이터 없음";
              if (metric === "percentile") return `${value}%`;
              if (metric === "grade_score") return `${value}등급`;
              return value;
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="평가원"
            stroke={getChartColor(0)}
            strokeWidth={2}
            name="평가원"
            dot={{ r: 4 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="교육청"
            stroke={getChartColor(1)}
            strokeWidth={2}
            name="교육청"
            dot={{ r: 4 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="사설"
            stroke={getChartColor(2)}
            strokeWidth={2}
            name="사설"
            dot={{ r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

