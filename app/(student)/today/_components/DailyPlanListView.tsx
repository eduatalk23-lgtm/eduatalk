"use client";

import { PlanCard } from "./PlanCard";
import { PlanGroup } from "../_utils/planGroupUtils";

type DailyPlanListViewProps = {
  groups: PlanGroup[];
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
  planDate: string;
  onViewDetail: (planNumber: number | null) => void;
};

export function DailyPlanListView({
  groups,
  sessions,
  planDate,
  onViewDetail,
}: DailyPlanListViewProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="text-6xl">📚</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              오늘 배울 내용이 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              자동 스케줄러를 실행해보세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <PlanCard
          key={group.planNumber ?? `null-${group.plan.id}`}
          group={group}
          sessions={sessions}
          planDate={planDate}
          viewMode="daily"
          onViewDetail={() => onViewDetail(group.planNumber)}
        />
      ))}
    </div>
  );
}
