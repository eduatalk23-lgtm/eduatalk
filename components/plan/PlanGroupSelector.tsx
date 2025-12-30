"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type PlanGroup = {
  id: string;
  name: string | null;
  status: string | null;
  period_start: string | null;
  period_end: string | null;
};

type PlanGroupSelectorProps = {
  studentId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allowNone?: boolean;
  className?: string;
  disabled?: boolean;
};

/**
 * 캘린더(플랜그룹) 선택 컴포넌트
 *
 * 빠른 플랜 추가 시 어느 캘린더에 연결할지 선택할 수 있습니다.
 */
export function PlanGroupSelector({
  studentId,
  selectedId,
  onSelect,
  allowNone = true,
  className,
  disabled = false,
}: PlanGroupSelectorProps) {
  const [planGroups, setPlanGroups] = useState<PlanGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // 플랜그룹 목록 로드 (API 사용)
  useEffect(() => {
    async function loadPlanGroups() {
      if (!studentId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/plan-groups?status=active");
        if (!response.ok) {
          throw new Error("플랜그룹 목록 조회 실패");
        }

        const result = await response.json();
        if (result.success && result.data) {
          setPlanGroups(
            result.data.map((g: PlanGroup & Record<string, unknown>) => ({
              id: g.id,
              name: g.name,
              status: g.status,
              period_start: g.period_start,
              period_end: g.period_end,
            }))
          );
        }
      } catch (error) {
        console.error("[PlanGroupSelector] 플랜그룹 로드 실패:", error);
        setPlanGroups([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadPlanGroups();
  }, [studentId]);

  const selectedGroup = planGroups.find((g) => g.id === selectedId);

  const formatPeriod = (start: string | null, end: string | null) => {
    if (!start || !end) return "";
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.getMonth() + 1}/${startDate.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()}`;
  };

  const handleSelect = (id: string | null) => {
    onSelect(id);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>캘린더 로드 중...</span>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* 선택 버튼 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800"
            : "border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500",
          isOpen && "border-indigo-500 ring-2 ring-indigo-500/20"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
          {selectedGroup ? (
            <div className="flex flex-col items-start min-w-0">
              <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                {selectedGroup.name || "이름 없음"}
              </span>
              {selectedGroup.period_start && selectedGroup.period_end && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatPeriod(selectedGroup.period_start, selectedGroup.period_end)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              {allowNone ? "캘린더 선택 (선택사항)" : "캘린더 선택"}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <>
          {/* 오버레이 */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* 옵션 목록 */}
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {allowNone && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors",
                  selectedId === null
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                )}
              >
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>캘린더 없음 (독립 플랜)</span>
              </button>
            )}

            {planGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                활성 캘린더가 없습니다
              </div>
            ) : (
              planGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelect(group.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors",
                    selectedId === group.id
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  <Calendar className="h-4 w-4 shrink-0 text-indigo-500" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate font-medium">
                      {group.name || "이름 없음"}
                    </span>
                    {group.period_start && group.period_end && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatPeriod(group.period_start, group.period_end)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
