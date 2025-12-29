"use client";

import { useState } from "react";
import { PlanEmptyState } from "../_shared/EmptyStatePresets";
import { Trash2, CheckSquare, Square } from "lucide-react";
import { PlanGroup } from "@/lib/types/plan";
import { PlanGroupListItem } from "./PlanGroupListItem";
import { PlanGroupBulkDeleteDialog } from "./PlanGroupBulkDeleteDialog";

type StatusBreakdown = {
  pending: number;
  inProgress: number;
  completed: number;
};

type PlanGroupListProps = {
  groups: PlanGroup[];
  planCounts: Map<string, number>; // groupId -> 플랜 개수
  planProgressData: Map<string, { completedCount: number; totalCount: number }>; // groupId -> 진행 상황
  statusBreakdownData?: Map<string, StatusBreakdown>; // groupId -> 상태별 개수
};

export function PlanGroupList({ groups, planCounts, planProgressData, statusBreakdownData }: PlanGroupListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleToggleSelect = (groupId: string) => {
    // 캠프 플랜은 선택 불가
    const group = groups.find((g) => g.id === groupId);
    if (group && group.plan_type === "camp" && group.camp_invitation_id) {
      return;
    }
    
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // 캠프 플랜 제외한 그룹 목록
  const selectableGroups = groups.filter(
    (g) => !(g.plan_type === "camp" && g.camp_invitation_id)
  );
  const selectableGroupIds = new Set(selectableGroups.map((g) => g.id));
  const allSelectableSelected = 
    selectableGroups.length > 0 && 
    selectableGroups.every((g) => selectedIds.has(g.id));

  const handleSelectAll = () => {
    if (allSelectableSelected) {
      // 전체 해제
      setSelectedIds(new Set());
    } else {
      // 캠프 플랜 제외하고 전체 선택
      setSelectedIds(new Set(selectableGroupIds));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      return;
    }
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteComplete = () => {
    setSelectedIds(new Set());
    setBulkDeleteDialogOpen(false);
  };

  const selectedGroups = groups.filter((g) => selectedIds.has(g.id));
  const selectedGroupNames = selectedGroups.map((g) => g.name);

  if (groups.length === 0) {
    return <PlanEmptyState preset="planGroup" />;
  }

  const allSelected = allSelectableSelected;

  return (
    <>
      {/* 다중 선택 헤더 */}
      {groups.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            onClick={handleSelectAll}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            title={allSelected ? "전체 해제" : "전체 선택"}
            aria-label={allSelected ? "전체 해제" : "전체 선택"}
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span>{allSelected ? "전체 해제" : "전체 선택"}</span>
          </button>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedIds.size}개 선택됨
              </span>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 dark:border-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                title="선택 삭제"
                aria-label="선택한 플랜 그룹 삭제"
              >
                <Trash2 className="h-4 w-4" />
                선택 삭제
              </button>
            </div>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {groups.map((group) => {
          const planCount = planCounts.get(group.id) || 0;
          const hasPlans = planCount > 0;
          const isSelected = selectedIds.has(group.id);
          const progressData = planProgressData.get(group.id);
          const completedCount = progressData?.completedCount || 0;
          const totalCount = progressData?.totalCount || planCount;
          const statusBreakdown = statusBreakdownData?.get(group.id);

          return (
            <PlanGroupListItem
              key={group.id}
              group={group}
              planCount={planCount}
              hasPlans={hasPlans}
              completedCount={completedCount}
              totalCount={totalCount}
              statusBreakdown={statusBreakdown}
              isSelected={isSelected}
              onToggleSelect={() => handleToggleSelect(group.id)}
            />
          );
        })}
      </ul>

      <PlanGroupBulkDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={(open) => {
          setBulkDeleteDialogOpen(open);
          if (!open) {
            setSelectedIds(new Set());
          }
        }}
        groupIds={Array.from(selectedIds)}
        groupNames={selectedGroupNames}
      />
    </>
  );
}

