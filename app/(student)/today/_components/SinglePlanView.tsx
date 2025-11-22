"use client";

import { PlanGroup } from "../_utils/planGroupUtils";
import { PlanGroupCard } from "./PlanGroupCard";
import { PlanSelector } from "./PlanSelector";

type SinglePlanViewProps = {
  groups: PlanGroup[];
  selectedPlanNumber: number | null;
  onSelectPlan: (planNumber: number | null) => void;
  sessions: Map<string, { isPaused: boolean }>;
  planDate: string;
  memos: Map<number | null, string | null>; // planNumber -> memo
  totalPagesMap: Map<string, number>; // contentKey -> totalPages
};

export function SinglePlanView({
  groups,
  selectedPlanNumber,
  onSelectPlan,
  sessions,
  planDate,
  memos,
  totalPagesMap,
}: SinglePlanViewProps) {
  const selectedGroup =
    groups.find((g) => g.planNumber === selectedPlanNumber) || groups[0];

  if (!selectedGroup) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">📚</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            선택할 플랜이 없습니다
          </h3>
        </div>
      </div>
    );
  }

  const contentKey = selectedGroup.plans[0]
    ? `${selectedGroup.plans[0].content_type}:${selectedGroup.plans[0].content_id}`
    : "";
  const totalPages = totalPagesMap.get(contentKey);
  const memo = memos.get(selectedGroup.planNumber);

  return (
    <div>
      <PlanSelector
        groups={groups}
        selectedPlanNumber={selectedPlanNumber ?? groups[0]?.planNumber ?? null}
        onSelect={onSelectPlan}
        sessions={sessions}
      />
      <PlanGroupCard
        group={selectedGroup}
        viewMode="single"
        sessions={sessions}
        planDate={planDate}
        memo={memo}
        totalPages={totalPages}
      />
    </div>
  );
}

