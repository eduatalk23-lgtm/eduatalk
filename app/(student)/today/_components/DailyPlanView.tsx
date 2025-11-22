"use client";

import { PlanGroup } from "../_utils/planGroupUtils";
import { PlanGroupCard } from "./PlanGroupCard";
import { ViewMode } from "./ViewModeSelector";

type DailyPlanViewProps = {
  groups: PlanGroup[];
  sessions: Map<string, { isPaused: boolean }>;
  onViewDetail: (planNumber: number | null) => void;
};

export function DailyPlanView({
  groups,
  sessions,
  onViewDetail,
}: DailyPlanViewProps) {
  if (groups.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">📚</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            오늘 배울 내용이 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            자동 스케줄러를 실행해보세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group, index) => (
        <div key={group.planNumber ?? `group-${index}`}>
          <PlanGroupCard
            group={group}
            viewMode="daily"
            sessions={sessions}
            onViewDetail={() => onViewDetail(group.planNumber)}
          />
        </div>
      ))}
    </div>
  );
}

