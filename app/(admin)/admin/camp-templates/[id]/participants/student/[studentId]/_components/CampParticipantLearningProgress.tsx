"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import type { ParticipantLearningStats } from "@/lib/domains/camp/types";
import {
  LazyResponsiveContainer,
  useRecharts,
} from "@/components/charts/LazyRecharts";

type CampParticipantLearningProgressProps = {
  templateId: string;
  studentId: string;
  learningStats: ParticipantLearningStats;
  dailyLearningData: Array<{
    date: string;
    study_minutes: number;
    completed_plans: number;
    total_plans: number;
    completion_rate: number;
  }>;
  subjectStats: Array<{
    subject: string;
    study_minutes: number;
    completed_plans: number;
    total_plans: number;
    completion_rate: number;
    average_study_minutes_per_plan: number;
  }>;
};

export function CampParticipantLearningProgress({
  templateId,
  studentId,
  learningStats,
  dailyLearningData,
  subjectStats,
}: CampParticipantLearningProgressProps) {
  const { recharts } = useRecharts();

  // 일별 학습 현황 차트 데이터 포맷팅
  const dailyChartData = useMemo(() => {
    return dailyLearningData.map((item) => ({
      date: new Date(item.date).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      }),
      fullDate: item.date,
      studyHours: Math.round((item.study_minutes / 60) * 10) / 10,
      completionRate: item.completion_rate,
    }));
  }, [dailyLearningData]);

  // 과목별 학습 시간 차트 데이터
  const subjectChartData = useMemo(() => {
    return subjectStats
      .sort((a, b) => b.study_minutes - a.study_minutes)
      .slice(0, 10)
      .map((item) => ({
        subject: item.subject,
        studyHours: Math.round((item.study_minutes / 60) * 10) / 10,
        completionRate: item.completion_rate,
      }));
  }, [subjectStats]);

  // 과목별 학습 분포 파이 차트 데이터
  const subjectPieData = useMemo(() => {
    const totalMinutes = subjectStats.reduce(
      (sum, item) => sum + item.study_minutes,
      0
    );
    if (totalMinutes === 0) return [];

    return subjectStats
      .filter((item) => item.study_minutes > 0)
      .map((item) => ({
        name: item.subject,
        value: item.study_minutes,
        percentage: Math.round((item.study_minutes / totalMinutes) * 100),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // 상위 8개만 표시
  }, [subjectStats]);

  // 주간 학습 패턴 데이터 (요일별)
  const weeklyPatternData = useMemo(() => {
    const dayOfWeekMap = new Map<number, { totalMinutes: number; count: number }>();

    dailyLearningData.forEach((item) => {
      const date = new Date(item.date);
      const dayOfWeek = date.getDay(); // 0 = 일요일, 1 = 월요일, ...
      const existing = dayOfWeekMap.get(dayOfWeek) || {
        totalMinutes: 0,
        count: 0,
      };
      existing.totalMinutes += item.study_minutes;
      existing.count += 1;
      dayOfWeekMap.set(dayOfWeek, existing);
    });

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return Array.from(dayOfWeekMap.entries())
      .map(([day, data]) => ({
        day: dayNames[day],
        dayOfWeek: day,
        averageHours: Math.round((data.totalMinutes / 60 / data.count) * 10) / 10,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }, [dailyLearningData]);

  if (!recharts) {
    return (
      <Card className="p-6">
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold text-gray-900">학습 진행 현황</h2>
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-500">차트를 불러오는 중...</p>
          </div>
        </div>
      </Card>
    );
  }

  const {
    LineChart,
    BarChart,
    PieChart,
    Line,
    Bar,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
  } = recharts;

  // 색상 팔레트
  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold text-gray-900">학습 진행 현황</h2>

          {/* 플랜 완료 현황 */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">플랜 완료</p>
              <p className="text-lg font-semibold text-gray-900">
                {learningStats.completed_plans} / {learningStats.total_plans} (
                {learningStats.plan_completion_rate}%)
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 일별 학습 현황 차트 */}
      {dailyChartData.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-900">
              일별 학습 현황
            </h3>
            <LazyResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  yAxisId="left"
                  label={{ value: "학습 시간 (시간)", angle: -90, position: "insideLeft" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{
                    value: "완료율 (%)",
                    angle: 90,
                    position: "insideRight",
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "studyHours") {
                      return [`${value}시간`, "학습 시간"];
                    }
                    if (name === "completionRate") {
                      return [`${value}%`, "완료율"];
                    }
                    return [value, name];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="studyHours"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="학습 시간"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="completionRate"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="완료율"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </LazyResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 과목별 학습 시간 차트 */}
      {subjectChartData.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-900">
              과목별 학습 시간 (상위 10개)
            </h3>
            <LazyResponsiveContainer width="100%" height={300}>
              <BarChart data={subjectChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="subject"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis label={{ value: "학습 시간 (시간)", angle: -90, position: "insideLeft" }} />
                <Tooltip
                  formatter={(value: number) => [`${value}시간`, "학습 시간"]}
                />
                <Bar dataKey="studyHours" fill="#3b82f6" name="학습 시간" />
              </BarChart>
            </LazyResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 과목별 학습 분포 파이 차트 */}
      {subjectPieData.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-900">
              과목별 학습 분포
            </h3>
            <LazyResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={subjectPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {subjectPieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => {
                    const hours = Math.floor(value / 60);
                    const minutes = value % 60;
                    return `${hours > 0 ? `${hours}시간 ` : ""}${minutes}분`;
                  }}
                />
                <Legend />
              </PieChart>
            </LazyResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 주간 학습 패턴 */}
      {weeklyPatternData.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-900">
              주간 학습 패턴 (요일별 평균)
            </h3>
            <LazyResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyPatternData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis
                  label={{ value: "평균 학습 시간 (시간)", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}시간`, "평균 학습 시간"]}
                />
                <Bar dataKey="averageHours" fill="#8b5cf6" name="평균 학습 시간" />
              </BarChart>
            </LazyResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 과목별 상세 분석 테이블 */}
      {subjectStats.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-900">
              과목별 상세 분석
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">
                      과목
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                      학습 시간
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                      완료율
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                      완료 플랜
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                      평균 시간/플랜
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjectStats
                    .sort((a, b) => b.study_minutes - a.study_minutes)
                    .map((item, index) => {
                      const hours = Math.floor(item.study_minutes / 60);
                      const mins = item.study_minutes % 60;
                      const avgHours = Math.floor(
                        item.average_study_minutes_per_plan / 60
                      );
                      const avgMins = item.average_study_minutes_per_plan % 60;
                      return (
                        <tr
                          key={item.subject}
                          className={`border-b border-gray-100 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {item.subject}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {hours > 0 ? `${hours}시간 ` : ""}
                            {mins}분
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {item.completion_rate}%
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {item.completed_plans} / {item.total_plans}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {avgHours > 0 ? `${avgHours}시간 ` : ""}
                            {avgMins}분
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

      {/* 데이터가 없는 경우 */}
      {dailyChartData.length === 0 &&
        subjectChartData.length === 0 &&
        subjectPieData.length === 0 && (
          <Card className="p-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-semibold text-gray-900">
                학습 진행 현황
              </h3>
              <p className="text-sm text-gray-500">
                학습 데이터가 없습니다.
              </p>
            </div>
          </Card>
        )}
    </div>
  );
}

