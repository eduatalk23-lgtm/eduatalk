"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlanGroup } from "../_utils/planGroupUtils";
import { formatTime, calculateGroupTotalStudyTime, getActivePlansCount, getCompletedPlansCount } from "../_utils/planGroupUtils";
import { cn } from "@/lib/cn";

type PlanSelectorProps = {
  groups: PlanGroup[];
  selectedPlanNumber: number | null;
  onSelect: (planNumber: number | null) => void;
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
};

export function PlanSelector({
  groups,
  selectedPlanNumber,
  onSelect,
  sessions,
}: PlanSelectorProps) {
  const currentIndex = groups.findIndex(
    (g) => g.planNumber === selectedPlanNumber
  );
  const currentGroup = groups[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onSelect(groups[currentIndex - 1].planNumber);
    }
  };

  const handleNext = () => {
    if (currentIndex < groups.length - 1) {
      onSelect(groups[currentIndex + 1].planNumber);
    }
  };

  const getGroupStatus = (group: PlanGroup): string => {
    const activeCount = getActivePlansCount(group, sessions);
    const completedCount = getCompletedPlansCount(group);
    const totalStudyTime = calculateGroupTotalStudyTime(group, sessions);

    if (activeCount > 0) {
      return `진행 중 | ⏱ ${formatTime(totalStudyTime)}`;
    }
    if (completedCount === 1) {
      return `완료 | ⏱ ${formatTime(totalStudyTime)}`;
    }
    return `대기 중`;
  };

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handlePrevious}
        disabled={currentIndex === 0}
        className={cn(
          "flex items-center justify-center rounded-lg border border-gray-300 p-2 transition",
          currentIndex === 0
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : "bg-white text-gray-700 hover:bg-gray-50"
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex-1">
        <select
          value={selectedPlanNumber ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            onSelect(value === "" ? null : Number(value));
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {groups.map((group) => {
            const contentTitle = group.content?.title || "제목 없음";
            const sequence = group.sequence
              ? `${group.sequence}회차`
              : `${group.plan.sequence || 1}회차`;
            const status = getGroupStatus(group);

            return (
              <option key={group.planNumber ?? "null"} value={group.planNumber ?? ""}>
                {contentTitle} ({sequence}) - {status}
              </option>
            );
          })}
        </select>
      </div>

      <button
        onClick={handleNext}
        disabled={currentIndex === groups.length - 1}
        className={cn(
          "flex items-center justify-center rounded-lg border border-gray-300 p-2 transition",
          currentIndex === groups.length - 1
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : "bg-white text-gray-700 hover:bg-gray-50"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {currentGroup && (
        <div className="text-xs text-gray-500">
          {currentIndex + 1} / {groups.length}
        </div>
      )}
    </div>
  );
}

