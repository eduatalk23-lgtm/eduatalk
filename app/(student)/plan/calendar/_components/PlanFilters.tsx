"use client";

import { useState } from "react";
import {
  Filter,
  X,
  BookOpen,
  Video,
  FileText,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type FilterState = {
  contentTypes: string[];
  statuses: string[];
  planGroups: string[];
};

type PlanFiltersProps = {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availablePlanGroups?: Array<{ id: string; name: string }>;
  className?: string;
};

const CONTENT_TYPE_OPTIONS = [
  { value: "book", label: "교재", icon: BookOpen },
  { value: "lecture", label: "강의", icon: Video },
  { value: "custom", label: "기타", icon: FileText },
];

const STATUS_OPTIONS = [
  { value: "scheduled", label: "예정", icon: Calendar, color: "text-gray-600" },
  { value: "in_progress", label: "진행 중", icon: Clock, color: "text-blue-600" },
  { value: "completed", label: "완료", icon: CheckCircle2, color: "text-green-600" },
];

/**
 * 플랜 필터 컴포넌트
 *
 * 콘텐츠 유형, 상태, 플랜 그룹별로 필터링할 수 있습니다.
 */
export function PlanFilters({
  filters,
  onFiltersChange,
  availablePlanGroups = [],
  className,
}: PlanFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.contentTypes.length > 0 ||
    filters.statuses.length > 0 ||
    filters.planGroups.length > 0;

  const activeFilterCount =
    filters.contentTypes.length + filters.statuses.length + filters.planGroups.length;

  const toggleContentType = (type: string) => {
    const newTypes = filters.contentTypes.includes(type)
      ? filters.contentTypes.filter((t) => t !== type)
      : [...filters.contentTypes, type];
    onFiltersChange({ ...filters, contentTypes: newTypes });
  };

  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const togglePlanGroup = (groupId: string) => {
    const newGroups = filters.planGroups.includes(groupId)
      ? filters.planGroups.filter((g) => g !== groupId)
      : [...filters.planGroups, groupId];
    onFiltersChange({ ...filters, planGroups: newGroups });
  };

  const clearAllFilters = () => {
    onFiltersChange({ contentTypes: [], statuses: [], planGroups: [] });
  };

  return (
    <div className={cn("relative", className)}>
      {/* 필터 토글 버튼 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors",
          hasActiveFilters
            ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300"
            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        )}
      >
        <Filter className="h-4 w-4" />
        <span>필터</span>
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
        />
      </button>

      {/* 필터 패널 */}
      {isExpanded && (
        <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">필터</h3>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                모두 지우기
              </button>
            )}
          </div>

          {/* 콘텐츠 유형 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              콘텐츠 유형
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => toggleContentType(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    filters.contentTypes.includes(value)
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 상태 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              상태
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => toggleStatus(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    filters.statuses.includes(value)
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", filters.statuses.includes(value) ? "" : color)} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 플랜 그룹 */}
          {availablePlanGroups.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                플랜 그룹
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availablePlanGroups.map(({ id, name }) => (
                  <button
                    key={id}
                    onClick={() => togglePlanGroup(id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      filters.planGroups.includes(id)
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                    )}
                  >
                    {name || id.slice(0, 8)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 닫기 버튼 */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setIsExpanded(false)}
              className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 활성 필터 태그 */}
      {hasActiveFilters && !isExpanded && (
        <div className="mt-2 flex flex-wrap gap-1">
          {filters.contentTypes.map((type) => {
            const option = CONTENT_TYPE_OPTIONS.find((o) => o.value === type);
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
              >
                {option?.label}
                <button onClick={() => toggleContentType(type)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {filters.statuses.map((status) => {
            const option = STATUS_OPTIONS.find((o) => o.value === status);
            return (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
              >
                {option?.label}
                <button onClick={() => toggleStatus(status)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {filters.planGroups.map((groupId) => {
            const group = availablePlanGroups.find((g) => g.id === groupId);
            return (
              <span
                key={groupId}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
              >
                {group?.name || groupId.slice(0, 8)}
                <button onClick={() => togglePlanGroup(groupId)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 플랜 필터링 유틸리티
 */
export function filterPlans<T extends { content_type?: string | null; status?: string | null; plan_group_id?: string | null }>(
  plans: T[],
  filters: FilterState
): T[] {
  return plans.filter((plan) => {
    // 콘텐츠 유형 필터
    if (filters.contentTypes.length > 0) {
      if (!plan.content_type || !filters.contentTypes.includes(plan.content_type)) {
        return false;
      }
    }

    // 상태 필터
    if (filters.statuses.length > 0) {
      if (!plan.status || !filters.statuses.includes(plan.status)) {
        return false;
      }
    }

    // 플랜 그룹 필터
    if (filters.planGroups.length > 0) {
      if (!plan.plan_group_id || !filters.planGroups.includes(plan.plan_group_id)) {
        return false;
      }
    }

    return true;
  });
}
