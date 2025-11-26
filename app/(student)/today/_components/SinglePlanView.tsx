"use client";

import { PlanCard } from "./PlanCard";
import { PlanSelector } from "./PlanSelector";
import { PlanGroup } from "../_utils/planGroupUtils";
import { formatKoreanDateWithDay } from "../_utils/dateDisplay";

type SinglePlanViewProps = {
  groups: PlanGroup[];
  sessions: Map<
    string,
    { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }
  >;
  planDate: string;
  selectedPlanNumber: number | null;
  onSelectPlan: (planNumber: number | null) => void;
};

export function SinglePlanView({
  groups,
  sessions,
  planDate,
  selectedPlanNumber,
  onSelectPlan,
}: SinglePlanViewProps) {
  const selectedGroup =
    groups.find((g) => g.planNumber === selectedPlanNumber) || groups[0];

  if (!selectedGroup) {
    const formattedDate = planDate
      ? formatKoreanDateWithDay(planDate)
      : "선택한 날짜";
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <div className="text-6xl">📚</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              선택한 날짜의 단일 플랜이 없습니다
            </h3>
            <p className="text-sm text-gray-500">
              {formattedDate}에는 학습 플랜이 생성되지 않았습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PlanSelector
        groups={groups}
        selectedPlanNumber={selectedPlanNumber ?? groups[0]?.planNumber ?? null}
        onSelect={onSelectPlan}
        sessions={sessions}
      />
      <PlanCard
        group={selectedGroup}
        sessions={sessions}
        planDate={planDate}
        viewMode="single"
      />
    </div>
  );
}
