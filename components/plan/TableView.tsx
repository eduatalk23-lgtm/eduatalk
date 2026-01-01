"use client";

/**
 * TableView - 테이블 뷰 컴포넌트
 *
 * 스프레드시트 형태로 플랜을 표시합니다.
 * - 정렬 가능한 컬럼
 * - 필터링
 * - 인라인 상태 변경
 */

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import { SimpleCompleteCheckbox } from "./SimpleCompleteCheckbox";
import type { MatrixPlanItem } from "@/lib/types/plan/views";

// ============================================
// 타입 정의
// ============================================

export interface TablePlanItem extends MatrixPlanItem {
  date: string; // YYYY-MM-DD
}

export type SortField = "date" | "startTime" | "title" | "subject" | "status" | "progress";
export type SortDirection = "asc" | "desc";

export interface TableViewProps {
  /** 플랜 데이터 */
  plans: TablePlanItem[];
  /** 플랜 클릭 핸들러 */
  onPlanClick?: (plan: TablePlanItem) => void;
  /** 간단 완료 활성화 */
  enableSimpleComplete?: boolean;
  /** 간단 완료 핸들러 */
  onSimpleComplete?: (planId: string, planType: string) => void;
  /** 초기 정렬 필드 */
  initialSortField?: SortField;
  /** 초기 정렬 방향 */
  initialSortDirection?: SortDirection;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 유틸리티 함수
// ============================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}/${day} (${weekdays[date.getDay()]})`;
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return "-";
  return timeStr.slice(0, 5);
}

// ============================================
// 상태 설정
// ============================================

const statusConfig = {
  pending: {
    label: "대기",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
  in_progress: {
    label: "진행중",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  completed: {
    label: "완료",
    className: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
  cancelled: {
    label: "취소",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
  },
};

// ============================================
// 헤더 컴포넌트
// ============================================

interface TableHeaderProps {
  field: SortField;
  label: string;
  currentSort: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

function TableHeader({
  field,
  label,
  currentSort,
  sortDirection,
  onSort,
  className,
}: TableHeaderProps) {
  const isActive = currentSort === field;

  return (
    <th
      onClick={() => onSort(field)}
      className={cn(
        "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none",
        "hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
        textMuted,
        className
      )}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className={cn("text-[10px]", !isActive && "opacity-30")}>
          {isActive ? (sortDirection === "asc" ? "▲" : "▼") : "▼"}
        </span>
      </div>
    </th>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function TableView({
  plans,
  onPlanClick,
  enableSimpleComplete = false,
  onSimpleComplete,
  initialSortField = "date",
  initialSortDirection = "asc",
  compact = false,
  className,
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);

  // 정렬 토글
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  // 정렬된 플랜
  const sortedPlans = useMemo(() => {
    const sorted = [...plans];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = a.date.localeCompare(b.date);
          if (comparison === 0) {
            comparison = (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
          }
          break;
        case "startTime":
          comparison = (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "subject":
          comparison = (a.subject || "").localeCompare(b.subject || "");
          break;
        case "status":
          const statusOrder = { pending: 1, in_progress: 2, completed: 3, cancelled: 4 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case "progress":
          comparison = (a.progress || 0) - (b.progress || 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [plans, sortField, sortDirection]);

  if (plans.length === 0) {
    return (
      <div className={cn("p-8 text-center", textMuted, className)}>
        표시할 플랜이 없습니다.
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {/* 완료 체크박스 컬럼 */}
            {enableSimpleComplete && (
              <th className="px-3 py-2 w-10" />
            )}
            <TableHeader
              field="date"
              label="날짜"
              currentSort={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              className="w-24"
            />
            <TableHeader
              field="startTime"
              label="시간"
              currentSort={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              className="w-20"
            />
            <TableHeader
              field="title"
              label="제목"
              currentSort={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <TableHeader
              field="subject"
              label="과목"
              currentSort={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              className="w-28"
            />
            <TableHeader
              field="status"
              label="상태"
              currentSort={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              className="w-20"
            />
            <TableHeader
              field="progress"
              label="진행률"
              currentSort={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              className="w-24"
            />
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {sortedPlans.map((plan) => {
            const status = statusConfig[plan.status];
            const isCompleted = plan.status === "completed";
            const isInProgress = plan.status === "in_progress";

            return (
              <tr
                key={plan.id}
                onClick={onPlanClick ? () => onPlanClick(plan) : undefined}
                className={cn(
                  "transition-colors",
                  onPlanClick && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800",
                  isCompleted && "opacity-60"
                )}
              >
                {/* 완료 체크박스 */}
                {enableSimpleComplete && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <SimpleCompleteCheckbox
                      planId={plan.id}
                      planType={plan.planType}
                      isCompleted={isCompleted}
                      disabled={isInProgress}
                      onComplete={() => onSimpleComplete?.(plan.id, plan.planType)}
                      size={compact ? "sm" : "md"}
                      label={`${plan.title} 완료하기`}
                    />
                  </td>
                )}

                {/* 날짜 */}
                <td className={cn("px-3 py-2 whitespace-nowrap text-sm", textSecondary)}>
                  {formatDate(plan.date)}
                </td>

                {/* 시간 */}
                <td className={cn("px-3 py-2 whitespace-nowrap text-sm", textMuted)}>
                  {formatTime(plan.startTime)}
                </td>

                {/* 제목 */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium truncate max-w-xs",
                        textPrimary,
                        isCompleted && "line-through"
                      )}
                    >
                      {plan.title}
                    </span>
                    {plan.planType === "ad_hoc_plan" && (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded flex-shrink-0">
                        단발성
                      </span>
                    )}
                  </div>
                </td>

                {/* 과목 */}
                <td className={cn("px-3 py-2 text-sm", textSecondary)}>
                  {plan.subject || "-"}
                </td>

                {/* 상태 */}
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      status.className
                    )}
                  >
                    {status.label}
                  </span>
                </td>

                {/* 진행률 */}
                <td className="px-3 py-2">
                  {plan.progress !== undefined ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            plan.progress >= 100
                              ? "bg-green-500"
                              : plan.progress > 0
                                ? "bg-blue-500"
                                : "bg-gray-300"
                          )}
                          style={{ width: `${Math.min(plan.progress, 100)}%` }}
                        />
                      </div>
                      <span className={cn("text-xs w-8 text-right", textMuted)}>
                        {Math.round(plan.progress)}%
                      </span>
                    </div>
                  ) : (
                    <span className={cn("text-sm", textMuted)}>-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 요약 */}
      <div className={cn("px-3 py-2 text-xs border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800", textMuted)}>
        총 {plans.length}개 ·{" "}
        완료 {plans.filter((p) => p.status === "completed").length}개 ·{" "}
        진행중 {plans.filter((p) => p.status === "in_progress").length}개
      </div>
    </div>
  );
}

/**
 * 테이블 뷰 스켈레톤
 */
export function TableViewSkeleton() {
  return (
    <div className="overflow-x-auto animate-pulse">
      <table className="min-w-full">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <th key={i} className="px-3 py-3">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {[1, 2, 3, 4, 5].map((row) => (
            <tr key={row}>
              {[1, 2, 3, 4, 5, 6].map((col) => (
                <td key={col} className="px-3 py-3">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
