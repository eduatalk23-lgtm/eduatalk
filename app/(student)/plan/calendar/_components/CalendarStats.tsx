"use client";

import { StatCard } from "./StatCard";
import type { PlanWithContent } from "../_types/plan";
import { bgSurface, borderDefault } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type CalendarStatsProps = {
  plans: PlanWithContent[];
};

export function CalendarStats({ plans }: CalendarStatsProps) {
  const totalPlans = plans.length;
  const completedPlans = plans.filter((p) => p.status === "completed" || p.actual_end_time != null).length;
  const activePlans = plans.filter((p) => p.actual_start_time && !p.actual_end_time).length;
  const averageProgress = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border p-4", borderDefault, bgSurface)}>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">학습 통계</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="총 플랜" value={totalPlans} color="gray" />
        <StatCard label="완료" value={completedPlans} color="green" />
        <StatCard label="진행중" value={activePlans} color="blue" />
        <StatCard label="평균 진행률" value={`${averageProgress}%`} color="indigo" />
      </div>
    </div>
  );
}

