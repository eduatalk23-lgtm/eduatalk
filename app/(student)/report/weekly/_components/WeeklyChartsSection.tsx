"use client";

import { WeeklyTimeBarChart } from "./WeeklyTimeBarChart";
import { SubjectTimePieChart } from "./SubjectTimePieChart";
import { PlanCompletionLineChart } from "./PlanCompletionLineChart";

type WeeklyChartsSectionProps = {
  studyTimeByDay: Array<{
    date: string;
    dayOfWeek: string;
    seconds: number;
    minutes: number;
  }>;
  studyTimeBySubject: Array<{
    subject: string;
    seconds: number;
    minutes: number;
    percentage: number;
  }>;
  planCompletionByDay: Array<{
    date: string;
    dayOfWeek: string;
    totalPlans: number;
    completedPlans: number;
    completionRate: number;
  }>;
};

export function WeeklyChartsSection({
  studyTimeByDay,
  studyTimeBySubject,
  planCompletionByDay,
}: WeeklyChartsSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 요일별 학습시간 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">요일별 학습시간</h3>
        <WeeklyTimeBarChart data={studyTimeByDay} />
      </div>

      {/* 과목별 학습시간 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">과목별 학습시간</h3>
        {studyTimeBySubject.length > 0 ? (
          <SubjectTimePieChart data={studyTimeBySubject} />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-gray-500">
            데이터가 없습니다
          </div>
        )}
      </div>

      {/* 플랜 실행률 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">요일별 플랜 실행률</h3>
        <PlanCompletionLineChart data={planCompletionByDay} />
      </div>
    </div>
  );
}

