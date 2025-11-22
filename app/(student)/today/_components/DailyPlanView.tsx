"use client";

import { PlanGroup } from "../_utils/planGroupUtils";
import { PlanGroupCard } from "./PlanGroupCard";
import { ViewMode } from "./ViewModeSelector";

type DailyPlanViewProps = {
  groups: PlanGroup[];
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
  planDate: string;
  memos: Map<number | null, string | null>; // planNumber -> memo
  totalPagesMap: Map<string, number>; // contentKey -> totalPages
  onViewDetail: (planNumber: number | null) => void;
};

export function DailyPlanView({
  groups,
  sessions,
  planDate,
  memos,
  totalPagesMap,
  onViewDetail,
}: DailyPlanViewProps) {
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
      {groups.map((group, index) => {
        const contentKey = group.plans[0]
          ? `${group.plans[0].content_type}:${group.plans[0].content_id}`
          : "";
        const totalPages = totalPagesMap.get(contentKey);
        const memo = memos.get(group.planNumber);

        return (
          <div key={group.planNumber ?? `group-${index}`}>
            <PlanGroupCard
              group={group}
              viewMode="daily"
              sessions={sessions}
              planDate={planDate}
              memo={memo}
              totalPages={totalPages}
              onViewDetail={() => onViewDetail(group.planNumber)}
            />
          </div>
        );
      })}
    </div>
  );
}

