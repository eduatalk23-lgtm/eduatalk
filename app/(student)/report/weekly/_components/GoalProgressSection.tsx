"use client";

import Link from "next/link";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { goalStatusColors, borderDefault, bgSurface, textPrimary, textTertiary, textMuted } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type GoalProgressSectionProps = {
  goals: Array<{
    id: string;
    title: string;
    goalType: string;
    progressPercentage: number;
    status: "scheduled" | "in_progress" | "completed" | "failed";
    daysRemaining: number | null;
    weeklyProgressAmount: number;
  }>;
};

const goalTypeLabels: Record<string, string> = {
  study_time: "학습시간",
  content_completion: "콘텐츠 완료",
  page_progress: "페이지 진행",
  custom: "커스텀",
};


export function GoalProgressSection({ goals }: GoalProgressSectionProps) {
  return (
    <div className={cn("rounded-xl border p-6 shadow-sm", borderDefault, bgSurface)}>
      <div className="flex flex-col gap-4">
        <h3 className={cn("text-lg font-semibold", textPrimary)}>목표별 달성률</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const isUrgent = goal.status === "in_progress" && goal.daysRemaining !== null && goal.daysRemaining <= 7;

            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className={cn(
                  "rounded-lg border p-4 transition hover:shadow-md",
                  isUrgent
                    ? "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30"
                    : cn(borderDefault, bgSurface)
                )}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                      {goalTypeLabels[goal.goalType] || goal.goalType}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", goalStatusColors[goal.status])}>
                      {goal.status === "scheduled"
                        ? "예정"
                        : goal.status === "in_progress"
                        ? goal.daysRemaining !== null
                          ? `D-${goal.daysRemaining}`
                          : "진행중"
                        : goal.status === "completed"
                        ? "완료"
                        : "미달성"}
                    </span>
                  </div>
                  <h4 className={cn("text-sm font-semibold line-clamp-2", textPrimary)}>
                    {goal.title}
                  </h4>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={textTertiary}>달성률</span>
                      <span className={cn("font-semibold", textPrimary)}>{goal.progressPercentage}%</span>
                    </div>
                    <ProgressBar value={goal.progressPercentage} height="md" />
                  </div>
                  {goal.weeklyProgressAmount > 0 && (
                    <p className={cn("text-xs", textMuted)}>
                      이번 주 진행량: +{goal.weeklyProgressAmount}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

