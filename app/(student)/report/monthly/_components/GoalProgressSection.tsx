"use client";

import Link from "next/link";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { goalStatusColors, borderDefault, bgSurface, textPrimary, textTertiary } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type GoalProgressSectionProps = {
  goals: Array<{
    id: string;
    title: string;
    goalType: string;
    progressPercentage: number;
    status: "scheduled" | "in_progress" | "completed" | "failed";
  }>;
};

const goalTypeLabels: Record<string, string> = {
  range: "기간 목표",
  exam: "시험 목표",
  weekly: "주간 목표",
  monthly: "월간 목표",
};


export function GoalProgressSection({ goals }: GoalProgressSectionProps) {
  return (
    <div className={cn("rounded-xl border p-6 shadow-sm", borderDefault, bgSurface)}>
      <div className="flex flex-col gap-4">
        <h3 className={cn("text-lg font-semibold", textPrimary)}>목표별 달성률</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Link
              key={goal.id}
              href={`/goals/${goal.id}`}
              className={cn("rounded-lg border p-4 transition hover:shadow-md", borderDefault, bgSurface)}
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
                      ? "진행중"
                      : goal.status === "completed"
                      ? "완료"
                      : "미달성"}
                  </span>
                </div>
                <h4 className={cn("text-sm font-semibold line-clamp-2", textPrimary)}>{goal.title}</h4>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={textTertiary}>달성률</span>
                    <span className={cn("font-semibold", textPrimary)}>{goal.progressPercentage}%</span>
                  </div>
                  <ProgressBar value={goal.progressPercentage} height="md" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

