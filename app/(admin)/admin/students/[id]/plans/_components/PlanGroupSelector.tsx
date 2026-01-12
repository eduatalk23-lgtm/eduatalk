"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Info } from "lucide-react";
import type { PlanGroupSummary } from "./context/AdminPlanContext";
import { PlanGroupDetailModal } from "./dynamicModals";

interface PlanGroupSelectorProps {
  groups: PlanGroupSummary[];
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
  tenantId: string;
  studentId: string;
  onRefresh?: () => void;
}

// 상태별 배지 스타일
const statusStyles: Record<string, { label: string; className: string }> = {
  active: {
    label: "활성",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  draft: {
    label: "초안",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  saved: {
    label: "저장됨",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    label: "완료",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  paused: {
    label: "일시정지",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  cancelled: {
    label: "취소",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

// 목적별 라벨
const purposeLabels: Record<string, string> = {
  내신대비: "내신",
  모의고사: "모의",
  수능: "수능",
  기타: "기타",
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${format(startDate)} ~ ${format(endDate)}`;
}

export function PlanGroupSelector({
  groups,
  selectedGroupId,
  onSelect,
  tenantId,
  studentId,
  onRefresh,
}: PlanGroupSelectorProps) {
  // 상세 모달 상태
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);

  // 선택된 그룹 찾기
  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId]
  );

  // 표시할 텍스트
  const displayText = selectedGroup
    ? selectedGroup.name || "이름 없음"
    : "전체 그룹";

  // 그룹이 없으면 드롭다운 비활성화
  if (groups.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-tertiary)] rounded-lg border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] bg-[var(--bg-surface)]">
        <span>플랜 그룹 없음</span>
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border",
          "border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",
          "bg-[var(--bg-surface)] hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]",
          "text-[var(--text-primary)] transition-base"
        )}
      >
        <svg
          className="w-4 h-4 text-[var(--text-tertiary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <span className="max-w-[150px] truncate">{displayText}</span>
        {selectedGroup && (
          <span
            className={cn(
              "px-1.5 py-0.5 text-xs rounded",
              statusStyles[selectedGroup.status]?.className ||
                statusStyles.draft.className
            )}
          >
            {statusStyles[selectedGroup.status]?.label || selectedGroup.status}
          </span>
        )}
        <svg
          className="w-4 h-4 text-[var(--text-tertiary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content align="start" className="min-w-[280px] max-h-[400px] overflow-y-auto">
        {/* 전체 보기 옵션 */}
        <DropdownMenu.Item
          onClick={() => onSelect(null)}
          className={cn(
            selectedGroupId === null && "bg-[rgb(var(--color-primary-50))] dark:bg-[rgb(var(--color-primary-900))]"
          )}
        >
          <div className="flex items-center gap-2 w-full">
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                selectedGroupId === null
                  ? "border-[rgb(var(--color-primary-500))]"
                  : "border-[rgb(var(--color-secondary-300))]"
              )}
            >
              {selectedGroupId === null && (
                <div className="w-2 h-2 rounded-full bg-[rgb(var(--color-primary-500))]" />
              )}
            </div>
            <span className="font-medium">전체 보기</span>
            <span className="ml-auto text-xs text-[var(--text-tertiary)]">
              {groups.length}개 그룹
            </span>
          </div>
        </DropdownMenu.Item>

        <DropdownMenu.Separator />

        {/* 그룹 목록 */}
        {groups.map((group) => (
          <DropdownMenu.Item
            key={group.id}
            onClick={() => onSelect(group.id)}
            className={cn(
              selectedGroupId === group.id &&
                "bg-[rgb(var(--color-primary-50))] dark:bg-[rgb(var(--color-primary-900))]"
            )}
          >
            <div className="flex flex-col w-full gap-1">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    selectedGroupId === group.id
                      ? "border-[rgb(var(--color-primary-500))]"
                      : "border-[rgb(var(--color-secondary-300))]"
                  )}
                >
                  {selectedGroupId === group.id && (
                    <div className="w-2 h-2 rounded-full bg-[rgb(var(--color-primary-500))]" />
                  )}
                </div>
                <span className="font-medium truncate flex-1">
                  {group.name || "이름 없음"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailGroupId(group.id);
                  }}
                  className="p-1 hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-700))] rounded transition-colors flex-shrink-0"
                  title="그룹 상세 보기"
                >
                  <Info className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                </button>
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-xs rounded flex-shrink-0",
                    statusStyles[group.status]?.className ||
                      statusStyles.draft.className
                  )}
                >
                  {statusStyles[group.status]?.label || group.status}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-6 text-xs text-[var(--text-tertiary)]">
                <span>{formatDateRange(group.periodStart, group.periodEnd)}</span>
                {group.planPurpose && (
                  <>
                    <span>·</span>
                    <span>{purposeLabels[group.planPurpose] || group.planPurpose}</span>
                  </>
                )}
              </div>
            </div>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>

      {/* 플랜 그룹 상세 모달 */}
      {detailGroupId && (
        <PlanGroupDetailModal
          planGroupId={detailGroupId}
          tenantId={tenantId}
          studentId={studentId}
          onClose={() => setDetailGroupId(null)}
          onSelect={() => {
            onSelect(detailGroupId);
            setDetailGroupId(null);
          }}
          onRefresh={onRefresh}
        />
      )}
    </DropdownMenu.Root>
  );
}
