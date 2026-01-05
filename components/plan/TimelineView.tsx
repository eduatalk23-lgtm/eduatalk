"use client";

/**
 * TimelineView - 타임라인 뷰 컴포넌트
 *
 * 시간순으로 플랜을 세로 타임라인 형태로 표시합니다.
 * - 날짜별 그룹화
 * - 시간대별 시각적 표현
 * - 현재 시간 표시기
 */

import { useMemo, memo } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import { SimpleCompleteCheckbox } from "./SimpleCompleteCheckbox";
import type { MatrixPlanItem } from "@/lib/types/plan/views";

// ============================================
// 타입 정의
// ============================================

export interface TimelinePlanItem extends MatrixPlanItem {
  date: string; // YYYY-MM-DD
}

export interface TimelineViewProps {
  /** 플랜 데이터 */
  plans: TimelinePlanItem[];
  /** 시작 날짜 (기본: 오늘) */
  startDate?: Date;
  /** 표시할 일수 (기본: 7일) */
  daysToShow?: number;
  /** 플랜 클릭 핸들러 */
  onPlanClick?: (plan: TimelinePlanItem) => void;
  /** 간단 완료 활성화 */
  enableSimpleComplete?: boolean;
  /** 간단 완료 핸들러 */
  onSimpleComplete?: (planId: string, planType: string) => void;
  /** 완료된 플랜 표시 여부 */
  showCompleted?: boolean;
  /** 빈 날짜 표시 여부 */
  showEmptyDays?: boolean;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 유틸리티 함수
// ============================================

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const dayOfWeek = weekdays[date.getDay()];

  if (diffDays === 0) return `오늘 (${dayOfWeek})`;
  if (diffDays === 1) return `내일 (${dayOfWeek})`;
  if (diffDays === -1) return `어제 (${dayOfWeek})`;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일 (${dayOfWeek})`;
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const period = h < 12 ? "오전" : "오후";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${displayHour}:${minutes}`;
}

function isCurrentTime(startTime?: string, endTime?: string): boolean {
  if (!startTime || !endTime) return false;
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  return currentTime >= startTime && currentTime <= endTime;
}

// ============================================
// 상태 설정
// ============================================

const statusConfig = {
  pending: {
    dotClass: "bg-gray-300 dark:bg-gray-600",
    lineClass: "bg-gray-200 dark:bg-gray-700",
    label: "대기",
  },
  in_progress: {
    dotClass: "bg-blue-500 animate-pulse",
    lineClass: "bg-blue-200 dark:bg-blue-800",
    label: "진행 중",
  },
  completed: {
    dotClass: "bg-green-500",
    lineClass: "bg-green-200 dark:bg-green-800",
    label: "완료",
  },
  cancelled: {
    dotClass: "bg-gray-400",
    lineClass: "bg-gray-200 dark:bg-gray-700",
    label: "취소",
  },
};

// ============================================
// 서브 컴포넌트
// ============================================

interface TimelineItemProps {
  plan: TimelinePlanItem;
  isFirst: boolean;
  isLast: boolean;
  isCurrent: boolean;
  onClick?: () => void;
  enableSimpleComplete?: boolean;
  onSimpleComplete?: (planId: string, planType: string) => void;
}

const TimelineItem = memo(function TimelineItem({
  plan,
  isFirst,
  isLast,
  isCurrent,
  onClick,
  enableSimpleComplete,
  onSimpleComplete,
}: TimelineItemProps) {
  const config = statusConfig[plan.status];
  const isCompleted = plan.status === "completed";
  const isInProgress = plan.status === "in_progress";

  return (
    <div className="relative flex gap-4">
      {/* 타임라인 라인 + 점 */}
      <div className="flex flex-col items-center">
        {/* 위 라인 */}
        <div
          className={cn(
            "w-0.5 flex-1",
            isFirst ? "bg-transparent" : config.lineClass
          )}
        />
        {/* 점 */}
        <div
          className={cn(
            "w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-900",
            config.dotClass,
            isCurrent && "ring-4 ring-blue-100 dark:ring-blue-900"
          )}
        />
        {/* 아래 라인 */}
        <div
          className={cn(
            "w-0.5 flex-1",
            isLast ? "bg-transparent" : config.lineClass
          )}
        />
      </div>

      {/* 콘텐츠 */}
      <div
        role={onClick ? "button" : "listitem"}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        className={cn(
          "flex-1 pb-6 group",
          onClick && "cursor-pointer"
        )}
      >
        <div
          className={cn(
            "rounded-lg border bg-white dark:bg-gray-800 p-3 transition-all",
            "border-gray-200 dark:border-gray-700",
            onClick && "group-hover:shadow-md group-hover:border-gray-300 dark:group-hover:border-gray-600",
            isCurrent && "ring-2 ring-blue-400 dark:ring-blue-500",
            isCompleted && "opacity-70"
          )}
        >
          {/* 시간 */}
          {plan.startTime && (
            <div className={cn("text-xs mb-1", textMuted)}>
              {formatTime(plan.startTime)}
              {plan.endTime && ` - ${formatTime(plan.endTime)}`}
            </div>
          )}

          {/* 제목 및 과목 */}
          <div className="flex items-start gap-2">
            {enableSimpleComplete ? (
              <SimpleCompleteCheckbox
                planId={plan.id}
                planType={plan.planType}
                isCompleted={isCompleted}
                disabled={isInProgress}
                onComplete={(completedAt) =>
                  onSimpleComplete?.(plan.id, plan.planType)
                }
                size="sm"
                label={`${plan.title} 완료하기`}
              />
            ) : null}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-medium truncate",
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
              {plan.subject && (
                <div className={cn("text-sm mt-0.5", textSecondary)}>
                  {plan.subject}
                  {plan.subjectCategory && ` · ${plan.subjectCategory}`}
                </div>
              )}
            </div>

            {/* 상태 뱃지 */}
            <div className="flex-shrink-0">
              {isCompleted && (
                <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded">
                  완료
                </span>
              )}
              {isInProgress && (
                <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
                  진행중
                </span>
              )}
            </div>
          </div>

          {/* 진행률 */}
          {plan.progress !== undefined && plan.progress > 0 && plan.progress < 100 && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${plan.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
TimelineItem.displayName = "TimelineItem";

// ============================================
// 메인 컴포넌트
// ============================================

export function TimelineView({
  plans,
  startDate = new Date(),
  daysToShow = 7,
  onPlanClick,
  enableSimpleComplete = false,
  onSimpleComplete,
  showCompleted = true,
  showEmptyDays = false,
  className,
}: TimelineViewProps) {
  // 날짜 범위 생성
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(formatDate(d));
    }
    return dates;
  }, [startDate, daysToShow]);

  // 날짜별 플랜 그룹화
  const groupedPlans = useMemo(() => {
    const filtered = showCompleted
      ? plans
      : plans.filter((p) => p.status !== "completed");

    const groups = new Map<string, TimelinePlanItem[]>();

    // 빈 날짜도 포함
    if (showEmptyDays) {
      dateRange.forEach((date) => groups.set(date, []));
    }

    // 플랜 분류
    filtered.forEach((plan) => {
      if (!groups.has(plan.date)) {
        groups.set(plan.date, []);
      }
      groups.get(plan.date)!.push(plan);
    });

    // 시간순 정렬
    groups.forEach((planList) => {
      planList.sort((a, b) => {
        const timeA = a.startTime || "99:99";
        const timeB = b.startTime || "99:99";
        return timeA.localeCompare(timeB);
      });
    });

    return groups;
  }, [plans, showCompleted, showEmptyDays, dateRange]);

  // 오늘 날짜
  const today = formatDate(new Date());

  if (plans.length === 0 && !showEmptyDays) {
    return (
      <div className={cn("p-8 text-center", textMuted, className)}>
        표시할 플랜이 없습니다.
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {Array.from(groupedPlans.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayPlans]) => {
          const isToday = date === today;

          // 빈 날짜 스킵 (showEmptyDays가 false인 경우)
          if (dayPlans.length === 0 && !showEmptyDays) return null;

          return (
            <div key={date}>
              {/* 날짜 헤더 */}
              <div
                className={cn(
                  "sticky top-0 z-10 py-2 px-3 -mx-3 mb-4 rounded-lg",
                  isToday
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "bg-gray-50 dark:bg-gray-800/50"
                )}
              >
                <h3
                  className={cn(
                    "font-semibold text-sm",
                    isToday ? "text-blue-700 dark:text-blue-300" : textPrimary
                  )}
                >
                  {formatDisplayDate(date)}
                  <span className={cn("ml-2 font-normal", textMuted)}>
                    {dayPlans.length}개
                  </span>
                </h3>
              </div>

              {/* 플랜 목록 */}
              {dayPlans.length > 0 ? (
                <div>
                  {dayPlans.map((plan, idx) => (
                    <TimelineItem
                      key={plan.id}
                      plan={plan}
                      isFirst={idx === 0}
                      isLast={idx === dayPlans.length - 1}
                      isCurrent={isToday && isCurrentTime(plan.startTime, plan.endTime)}
                      onClick={onPlanClick ? () => onPlanClick(plan) : undefined}
                      enableSimpleComplete={enableSimpleComplete}
                      onSimpleComplete={onSimpleComplete}
                    />
                  ))}
                </div>
              ) : (
                <div className={cn("py-4 text-center text-sm", textMuted)}>
                  이 날에는 플랜이 없습니다.
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

/**
 * 타임라인 뷰 스켈레톤
 */
export function TimelineViewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2, 3].map((day) => (
        <div key={day}>
          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4" />
          <div className="space-y-4">
            {[1, 2].map((item) => (
              <div key={item} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
                  <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="flex-1 pb-6">
                  <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
