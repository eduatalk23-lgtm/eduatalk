"use client";

import Link from "next/link";
import { ProgressBar } from "@/components/atoms/ProgressBar";

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

const statusColors: Record<string, string> = {
  scheduled: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function GoalProgressSection({ goals }: GoalProgressSectionProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-gray-900">목표별 달성률</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const isUrgent = goal.status === "in_progress" && goal.daysRemaining !== null && goal.daysRemaining <= 7;

            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className={`rounded-lg border p-4 transition hover:shadow-md ${
                  isUrgent ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                      {goalTypeLabels[goal.goalType] || goal.goalType}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[goal.status]}`}>
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
                  <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">
                    {goal.title}
                  </h4>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">달성률</span>
                      <span className="font-semibold text-gray-900">{goal.progressPercentage}%</span>
                    </div>
                    <ProgressBar value={goal.progressPercentage} height="md" />
                  </div>
                  {goal.weeklyProgressAmount > 0 && (
                    <p className="text-xs text-gray-500">
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

