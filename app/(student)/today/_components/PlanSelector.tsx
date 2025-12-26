"use client";

import { memo, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlanGroup } from "../_utils/planGroupUtils";
import { formatTime, calculateGroupTotalStudyTime, getActivePlansCount, getCompletedPlansCount } from "../_utils/planGroupUtils";
import { cn } from "@/lib/cn";

type PlanSelectorProps = {
  groups: PlanGroup[];
  selectedPlanNumber: number | null;
  selectedPlanId?: string | null; // plan.id 기반 선택
  onSelect: (planNumber: number | null) => void;
  onSelectById?: (planId: string) => void; // plan.id 기반 선택 (우선 사용)
  sessions: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>;
};

function PlanSelectorBase({
  groups,
  selectedPlanNumber,
  selectedPlanId,
  onSelect,
  onSelectById,
  sessions,
}: PlanSelectorProps) {
  // groups를 planId로 인덱싱하여 O(1) 조회 가능하게 함 (useMemo로 캐싱)
  const groupsIndexMap = useMemo(() => {
    const map = new Map<string, { group: PlanGroup; index: number }>();
    groups.forEach((g, idx) => {
      map.set(g.plan.id, { group: g, index: idx });
    });
    return map;
  }, [groups]);

  // 현재 선택된 그룹과 인덱스 계산 (O(1) 조회)
  const { displayGroup, currentIndex } = useMemo(() => {
    let foundGroup: PlanGroup | null = null;
    let foundIndex = -1;

    if (selectedPlanId) {
      const entry = groupsIndexMap.get(selectedPlanId);
      if (entry) {
        foundGroup = entry.group;
        foundIndex = entry.index;
      }
    } else if (selectedPlanNumber !== null) {
      const entry = Array.from(groupsIndexMap.values()).find(
        (e) => e.group.planNumber === selectedPlanNumber
      );
      if (entry) {
        foundGroup = entry.group;
        foundIndex = entry.index;
      }
    }

    // 찾지 못하면 첫 번째 그룹 사용
    if (!foundGroup && groups.length > 0) {
      foundGroup = groups[0];
      foundIndex = 0;
    }

    return { displayGroup: foundGroup, currentIndex: foundIndex };
  }, [selectedPlanId, selectedPlanNumber, groupsIndexMap, groups]);

  const handlePrevious = () => {
    if (currentIndex > 0 && currentIndex < groups.length) {
      const prevGroup = groups[currentIndex - 1];
      if (prevGroup) {
        // onSelectById가 있으면 planId로 선택, 없으면 planNumber로 선택
        if (onSelectById) {
          onSelectById(prevGroup.plan.id);
        } else {
          onSelect(prevGroup.planNumber);
        }
      }
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < groups.length - 1) {
      const nextGroup = groups[currentIndex + 1];
      if (nextGroup) {
        // onSelectById가 있으면 planId로 선택, 없으면 planNumber로 선택
        if (onSelectById) {
          onSelectById(nextGroup.plan.id);
        } else {
          onSelect(nextGroup.planNumber);
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
        disabled={currentIndex <= 0}
        className={cn(
          "flex items-center justify-center rounded-lg border border-gray-300 p-2 transition",
          currentIndex <= 0
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
              // onSelectById가 있으면 planId로 선택, 없으면 planNumber로 선택
              if (onSelectById) {
                onSelectById(selectedPlanId);
              } else {
                onSelect(selectedGroup.planNumber);
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
        disabled={currentIndex < 0 || currentIndex >= groups.length - 1}
        className={cn(
          "flex items-center justify-center rounded-lg border border-gray-300 p-2 transition",
          currentIndex < 0 || currentIndex >= groups.length - 1
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

// 커스텀 비교 함수로 불필요한 리렌더링 방지
function arePropsEqual(
  prevProps: PlanSelectorProps,
  nextProps: PlanSelectorProps
): boolean {
  // 선택 상태 비교
  if (
    prevProps.selectedPlanNumber !== nextProps.selectedPlanNumber ||
    prevProps.selectedPlanId !== nextProps.selectedPlanId
  ) {
    return false;
  }

  // groups 배열 비교 (length와 각 plan.id 비교)
  if (prevProps.groups.length !== nextProps.groups.length) {
    return false;
  }
  for (let i = 0; i < prevProps.groups.length; i++) {
    const prevGroup = prevProps.groups[i];
    const nextGroup = nextProps.groups[i];
    if (prevGroup.plan.id !== nextGroup.plan.id) {
      return false;
    }
    // 상태 변경 확인
    if (prevGroup.plan.status !== nextGroup.plan.status) {
      return false;
    }
  }

  // sessions Map 비교 (size)
  if (prevProps.sessions.size !== nextProps.sessions.size) {
    return false;
  }

  return true;
}

export const PlanSelector = memo(PlanSelectorBase, arePropsEqual);
