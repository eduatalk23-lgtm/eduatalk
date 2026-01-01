"use client";

/**
 * ListView - 리스트 뷰 컴포넌트
 *
 * 간단한 목록 형태로 플랜을 표시합니다.
 * - 그룹화 옵션 (날짜, 과목, 상태)
 * - 필터링
 * - 컴팩트/확장 모드
 */

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import { PlanListItem } from "./PlanListItem";
import type { MatrixPlanItem } from "@/lib/types/plan/views";

// ============================================
// 타입 정의
// ============================================

export interface ListPlanItem extends MatrixPlanItem {
  date: string; // YYYY-MM-DD
  rangeDisplay?: string;
  estimatedMinutes?: number;
}

export type GroupBy = "none" | "date" | "subject" | "status";

export interface ListViewProps {
  /** 플랜 데이터 */
  plans: ListPlanItem[];
  /** 플랜 클릭 핸들러 */
  onPlanClick?: (plan: ListPlanItem) => void;
  /** 간단 완료 활성화 */
  enableSimpleComplete?: boolean;
  /** 간단 완료 핸들러 */
  onSimpleComplete?: (planId: string, planType: string) => void;
  /** 그룹화 기준 */
  groupBy?: GroupBy;
  /** 완료된 플랜 표시 여부 */
  showCompleted?: boolean;
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  if (diffDays === -1) return "어제";

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}월 ${day}일 (${weekdays[date.getDay()]})`;
}

function getGroupKey(plan: ListPlanItem, groupBy: GroupBy): string {
  switch (groupBy) {
    case "date":
      return plan.date;
    case "subject":
      return plan.subject || "기타";
    case "status":
      return plan.status;
    default:
      return "all";
  }
}

function getGroupLabel(key: string, groupBy: GroupBy): string {
  switch (groupBy) {
    case "date":
      return formatDate(key);
    case "subject":
      return key;
    case "status":
      const statusLabels: Record<string, string> = {
        pending: "대기",
        in_progress: "진행 중",
        completed: "완료",
        cancelled: "취소",
      };
      return statusLabels[key] || key;
    default:
      return "";
  }
}

function getGroupIcon(key: string, groupBy: GroupBy): string {
  switch (groupBy) {
    case "date":
      return "📅";
    case "subject":
      return "📚";
    case "status":
      const statusIcons: Record<string, string> = {
        pending: "○",
        in_progress: "●",
        completed: "✓",
        cancelled: "✕",
      };
      return statusIcons[key] || "";
    default:
      return "";
  }
}

// ============================================
// 그룹 헤더 컴포넌트
// ============================================

interface GroupHeaderProps {
  groupKey: string;
  groupBy: GroupBy;
  count: number;
  completedCount: number;
}

function GroupHeader({ groupKey, groupBy, count, completedCount }: GroupHeaderProps) {
  const label = getGroupLabel(groupKey, groupBy);
  const icon = getGroupIcon(groupKey, groupBy);

  return (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="flex items-center gap-2">
        {icon && <span className="text-sm">{icon}</span>}
        <h3 className={cn("font-semibold text-sm", textPrimary)}>{label}</h3>
        <span className={cn("text-xs", textMuted)}>
          {completedCount}/{count}
        </span>
      </div>
      {/* 진행률 바 */}
      <div className="flex items-center gap-2">
        <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: count > 0 ? `${(completedCount / count) * 100}%` : "0%" }}
          />
        </div>
        <span className={cn("text-xs w-8 text-right", textMuted)}>
          {count > 0 ? Math.round((completedCount / count) * 100) : 0}%
        </span>
      </div>
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function ListView({
  plans,
  onPlanClick,
  enableSimpleComplete = false,
  onSimpleComplete,
  groupBy = "none",
  showCompleted = true,
  compact = false,
  className,
}: ListViewProps) {
  // 필터링
  const filteredPlans = useMemo(() => {
    return showCompleted ? plans : plans.filter((p) => p.status !== "completed");
  }, [plans, showCompleted]);

  // 그룹화
  const groupedPlans = useMemo(() => {
    if (groupBy === "none") {
      return new Map([["all", filteredPlans]]);
    }

    const groups = new Map<string, ListPlanItem[]>();

    filteredPlans.forEach((plan) => {
      const key = getGroupKey(plan, groupBy);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(plan);
    });

    // 각 그룹 내부 정렬 (시간순)
    groups.forEach((planList) => {
      planList.sort((a, b) => {
        // 날짜 먼저
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        // 시간순
        return (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
      });
    });

    return groups;
  }, [filteredPlans, groupBy]);

  // 그룹 키 정렬
  const sortedGroupKeys = useMemo(() => {
    const keys = Array.from(groupedPlans.keys());

    if (groupBy === "date") {
      return keys.sort();
    }
    if (groupBy === "status") {
      const order = ["in_progress", "pending", "completed", "cancelled"];
      return keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
    return keys.sort();
  }, [groupedPlans, groupBy]);

  if (filteredPlans.length === 0) {
    return (
      <div className={cn("p-8 text-center", textMuted, className)}>
        표시할 플랜이 없습니다.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {sortedGroupKeys.map((groupKey) => {
        const groupPlans = groupedPlans.get(groupKey) || [];
        const completedCount = groupPlans.filter((p) => p.status === "completed").length;

        return (
          <div key={groupKey}>
            {/* 그룹 헤더 */}
            {groupBy !== "none" && (
              <GroupHeader
                groupKey={groupKey}
                groupBy={groupBy}
                count={groupPlans.length}
                completedCount={completedCount}
              />
            )}

            {/* 플랜 목록 */}
            <div className={cn("space-y-2", groupBy !== "none" && "pl-6")}>
              {groupPlans.map((plan) => (
                <PlanListItem
                  key={plan.id}
                  id={plan.id}
                  title={plan.title}
                  planType={plan.planType}
                  status={plan.status === "cancelled" ? "pending" : plan.status}
                  progress={plan.progress}
                  subject={plan.subject}
                  rangeDisplay={plan.rangeDisplay}
                  estimatedMinutes={plan.estimatedMinutes}
                  onClick={onPlanClick ? () => onPlanClick(plan) : undefined}
                  compact={compact}
                  enableSimpleComplete={enableSimpleComplete}
                  onSimpleComplete={() => onSimpleComplete?.(plan.id, plan.planType)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* 전체 요약 */}
      <div
        className={cn(
          "pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 text-center text-sm",
          textSecondary
        )}
      >
        총 {filteredPlans.length}개 ·{" "}
        <span className="text-green-600 dark:text-green-400">
          완료 {filteredPlans.filter((p) => p.status === "completed").length}개
        </span>
        {" · "}
        <span className="text-blue-600 dark:text-blue-400">
          진행중 {filteredPlans.filter((p) => p.status === "in_progress").length}개
        </span>
      </div>
    </div>
  );
}

/**
 * 리스트 뷰 스켈레톤
 */
export function ListViewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((group) => (
        <div key={group}>
          <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded w-32 mb-2" />
          <div className="space-y-2 pl-6">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
