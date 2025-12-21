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
  // 현재 선택된 그룹 찾기
  const currentGroup = selectedPlanNumber !== null
    ? groups.find((g) => g.planNumber === selectedPlanNumber)
    : null;
  
  // currentGroup이 없으면 planNumber가 null이 아닌 첫 번째 그룹을 표시용으로 사용
  const displayGroup = currentGroup || groups.find((g) => g.planNumber !== null) || groups[0];
  
  const currentIndex = displayGroup 
    ? groups.findIndex((g) => g.plan.id === displayGroup.plan.id)
    : -1;

  const handlePrevious = () => {
    if (currentIndex > 0 && currentIndex < groups.length) {
      const prevGroup = groups[currentIndex - 1];
      // planNumber가 null이 아닌 그룹만 선택
      if (prevGroup && prevGroup.planNumber !== null) {
        console.log("handlePrevious called, selecting:", prevGroup.planNumber);
        onSelect(prevGroup.planNumber);
      } else {
        // planNumber가 null이면 이전 유효한 그룹 찾기
        for (let i = currentIndex - 1; i >= 0; i--) {
          if (groups[i].planNumber !== null) {
            console.log("handlePrevious called, selecting (skipped null):", groups[i].planNumber);
            onSelect(groups[i].planNumber);
            break;
          }
        }
      }
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < groups.length - 1) {
      const nextGroup = groups[currentIndex + 1];
      // planNumber가 null이 아닌 그룹만 선택
      if (nextGroup && nextGroup.planNumber !== null) {
        console.log("handleNext called, selecting:", nextGroup.planNumber);
        onSelect(nextGroup.planNumber);
      } else {
        // planNumber가 null이면 다음 유효한 그룹 찾기
        for (let i = currentIndex + 1; i < groups.length; i++) {
          if (groups[i].planNumber !== null) {
            console.log("handleNext called, selecting (skipped null):", groups[i].planNumber);
            onSelect(groups[i].planNumber);
            break;
          }
        }
      }
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
        disabled={currentIndex <= 0 || !groups.slice(0, currentIndex).some((g) => g.planNumber !== null)}
        className={cn(
          "flex items-center justify-center rounded-lg border border-gray-300 p-2 transition",
          currentIndex <= 0 || !groups.slice(0, currentIndex).some((g) => g.planNumber !== null)
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : "bg-white text-gray-700 hover:bg-gray-50"
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex-1">
        <select
          value={displayGroup?.plan.id ?? ""}
          onChange={(e) => {
            const selectedPlanId = e.target.value;
            const selectedGroup = groups.find((g) => g.plan.id === selectedPlanId);
            if (selectedGroup) {
              // planNumber가 null이 아닌 경우에만 선택
              if (selectedGroup.planNumber !== null) {
                console.log("select onChange called, selecting:", selectedGroup.planNumber);
                onSelect(selectedGroup.planNumber);
              } else {
                console.warn("select onChange called, but planNumber is null for group:", selectedGroup.plan.id);
              }
            }
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
              <option key={group.plan.id} value={group.plan.id}>
                {contentTitle} ({sequence}) - {status}
              </option>
            );
          })}
        </select>
      </div>

      <button
        onClick={handleNext}
        disabled={currentIndex < 0 || currentIndex >= groups.length - 1 || !groups.slice(currentIndex + 1).some((g) => g.planNumber !== null)}
        className={cn(
          "flex items-center justify-center rounded-lg border border-gray-300 p-2 transition",
          currentIndex < 0 || currentIndex >= groups.length - 1 || !groups.slice(currentIndex + 1).some((g) => g.planNumber !== null)
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : "bg-white text-gray-700 hover:bg-gray-50"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {displayGroup && currentIndex >= 0 && (
        <div className="text-xs text-gray-500">
          {currentIndex + 1} / {groups.length}
        </div>
      )}
    </div>
  );
}

