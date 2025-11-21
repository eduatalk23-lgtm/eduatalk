"use client";

import { StatCard } from "./StatCard";
import type { PlanWithContent } from "../_types/plan";

type CalendarStatsProps = {
  plans: PlanWithContent[];
};

export function CalendarStats({ plans }: CalendarStatsProps) {
  const totalPlans = plans.length;
  const completedPlans = plans.filter((p) => p.progress !== null && p.progress >= 100).length;
  const activePlans = plans.filter((p) => p.actual_start_time && !p.actual_end_time).length;
  const averageProgress =
    totalPlans > 0
      ? Math.round(plans.reduce((sum, p) => sum + (p.progress || 0), 0) / totalPlans)
      : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">학습 통계</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="총 플랜" value={totalPlans} color="gray" />
        <StatCard label="완료" value={completedPlans} color="green" />
        <StatCard label="진행중" value={activePlans} color="blue" />
        <StatCard label="평균 진행률" value={`${averageProgress}%`} color="indigo" />
      </div>
    </div>
  );
}

