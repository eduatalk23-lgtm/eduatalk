"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import type { InternalAnalysis } from "@/lib/types/scoreDashboard";
import { MetricCard } from "./MetricCard";
import { InfoMessage } from "./InfoMessage";
import { useRecharts } from "@/components/charts/LazyRecharts";
import { ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import { cn } from "@/lib/cn";

interface InternalAnalysisCardProps {
  analysis: InternalAnalysis;
}

export function InternalAnalysisCard({ analysis }: InternalAnalysisCardProps) {
  const { totalGpa, zIndex, subjectStrength } = analysis;
  const { recharts, loading } = useRecharts();
  const [chartType, setChartType] = useState<"bar" | "radar">("bar");

  // subjectStrength를 배열로 변환 (정렬)
  const subjectEntries = Object.entries(subjectStrength).sort(
    ([, gpaA], [, gpaB]) => gpaB - gpaA // 높은 GPA 순
  );

  // 차트 데이터 준비
  const chartData = subjectEntries.map(([name, gpa]) => ({
    name,
    gpa: Number(gpa.toFixed(2)),
  }));

  return (
    <SectionCard
      title="내신 분석"
      description="전체 GPA 및 교과군별 성적"
    >
      {/* 전체 지표 */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          label="전체 GPA"
          value={totalGpa !== null ? totalGpa.toFixed(2) : "N/A"}
          color="indigo"
        />
        <MetricCard
          label="Z-Index"
          value={zIndex !== null ? zIndex.toFixed(2) : "N/A"}
          color="purple"
        />
      </div>

      {/* 교과군별 GPA 차트 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            교과군별 평점
          </div>
          {subjectEntries.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChartType("bar")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition",
                  chartType === "bar"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                막대 차트
              </button>
              <button
                onClick={() => setChartType("radar")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition",
                  chartType === "radar"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                레이더 차트
              </button>
            </div>
          )}
        </div>
        {subjectEntries.length > 0 ? (
          <>
            {/* 막대 차트 */}
            {chartType === "bar" && (
              loading || !recharts ? (
                <ChartLoadingSkeleton height={200} />
              ) : (
                <div className="h-[200px] w-full">
                  {(() => {
                    const {
                      BarChart,
                      Bar,
                      XAxis,
                      YAxis,
                      CartesianGrid,
                      Tooltip,
                      ResponsiveContainer,
                    } = recharts;

                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-gray-200 dark:stroke-gray-700"
                          />
                          <XAxis
                            dataKey="name"
                            className="text-xs text-gray-600 dark:text-gray-400"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            domain={[0, 5]}
                            className="text-xs text-gray-600 dark:text-gray-400"
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              `${value.toFixed(2)}`,
                              "GPA",
                            ]}
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                            }}
                            labelStyle={{ color: "#374151" }}
                          />
                          <Bar
                            dataKey="gpa"
                            fill="#6366f1"
                            radius={[8, 8, 0, 0]}
                            className="dark:fill-indigo-500"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              )
            )}
            
            {/* 레이더 차트 */}
            {chartType === "radar" && (
              loading || !recharts ? (
                <ChartLoadingSkeleton height={300} />
              ) : (
                <div className="h-[300px] w-full">
                  {(() => {
                    const {
                      RadarChart,
                      PolarGrid,
                      PolarAngleAxis,
                      PolarRadiusAxis,
                      Radar,
                      Tooltip,
                      ResponsiveContainer,
                      Legend,
                    } = recharts;

                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <PolarGrid className="stroke-gray-200 dark:stroke-gray-700" />
                          <PolarAngleAxis
                            dataKey="name"
                            className="text-xs text-gray-600 dark:text-gray-400"
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 5]}
                            className="text-xs text-gray-600 dark:text-gray-400"
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              `${value.toFixed(2)}`,
                              "GPA",
                            ]}
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                            }}
                            labelStyle={{ color: "#374151" }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: "12px" }}
                          />
                          <Radar
                            name="GPA"
                            dataKey="gpa"
                            stroke="#6366f1"
                            fill="#6366f1"
                            fillOpacity={0.6}
                            className="dark:stroke-indigo-500 dark:fill-indigo-500"
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              )
            )}
            {/* 리스트 (모바일에서 더 나은 가독성을 위해) */}
            <div className="flex flex-col gap-2 md:hidden">
              {subjectEntries.map(([subjectName, gpa]) => (
                <div
                  key={subjectName}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2"
                >
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {subjectName}
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {gpa.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              교과군 데이터가 없습니다
            </p>
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      {totalGpa === null && zIndex === null && (
        <InfoMessage
          message="내신 성적 데이터가 없습니다. 성적을 입력해주세요."
          variant="warning"
        />
      )}
    </SectionCard>
  );
}

