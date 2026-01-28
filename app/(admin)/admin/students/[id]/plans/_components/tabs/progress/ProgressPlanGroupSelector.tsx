"use client";

import type { PlanGroupSummary } from "../../context/AdminPlanContext";

interface ProgressPlanGroupSelectorProps {
  planGroups: PlanGroupSummary[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

export function ProgressPlanGroupSelector({
  planGroups,
  selectedId,
  onChange,
}: ProgressPlanGroupSelectorProps) {
  if (planGroups.length === 0) {
    return (
      <p className="text-sm text-secondary-500">
        활성 플랜 그룹이 없습니다.
      </p>
    );
  }

  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
    >
      {planGroups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name ?? "이름 없음"} ({group.periodStart} ~ {group.periodEnd})
        </option>
      ))}
    </select>
  );
}
