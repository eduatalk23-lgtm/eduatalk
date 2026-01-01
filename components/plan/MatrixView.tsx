"use client";

/**
 * MatrixView - 시간 × 요일 매트릭스 뷰
 *
 * Notion 스타일의 시간표 형태로 플랜을 표시합니다.
 * 행: 시간 슬롯 (1교시, 2교시, ...)
 * 열: 요일 (월, 화, 수, ...)
 */

import { useMemo, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import { Check, Clock, MoreHorizontal } from "lucide-react";
import type {
  MatrixTimeSlot,
  MatrixPlanItem,
  DayOfWeek,
} from "@/lib/types/plan/views";

// ============================================
// 타입 정의
// ============================================

export interface MatrixViewProps {
  /** 시간 슬롯 목록 */
  slots: MatrixTimeSlot[];
  /** 플랜 데이터 */
  plans: MatrixPlanItem[];
  /** 주 시작 날짜 */
  weekStart: Date;
  /** 주말 표시 여부 */
  showWeekends?: boolean;
  /** 빈 셀 표시 여부 */
  showEmptySlots?: boolean;
  /** 플랜 클릭 핸들러 */
  onPlanClick?: (plan: MatrixPlanItem) => void;
  /** 셀 클릭 핸들러 (빈 셀 클릭 시) */
  onCellClick?: (slotId: string, date: string) => void;
  /** 간단 완료 활성화 */
  enableSimpleComplete?: boolean;
  /** 간단 완료 핸들러 */
  onSimpleComplete?: (planId: string, planType: string) => void;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 상수
// ============================================

const DAY_LABELS: Record<DayOfWeek, string> = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

const SLOT_TYPE_COLORS: Record<string, string> = {
  study: "bg-blue-50 dark:bg-blue-900/20",
  break: "bg-gray-50 dark:bg-gray-800/50",
  meal: "bg-orange-50 dark:bg-orange-900/20",
  free: "bg-green-50 dark:bg-green-900/20",
  academy: "bg-purple-50 dark:bg-purple-900/20",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-l-4 border-l-gray-300",
  in_progress: "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/30",
  completed: "border-l-4 border-l-green-500 opacity-70",
  cancelled: "border-l-4 border-l-red-300 opacity-50 line-through",
};

// ============================================
// 유틸리티 함수
// ============================================

function getWeekDates(weekStart: Date, showWeekends: boolean): Date[] {
  const dates: Date[] = [];
  const start = new Date(weekStart);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    // 주말 제외
    if (!showWeekends && (date.getDay() === 0 || date.getDay() === 6)) {
      continue;
    }

    dates.push(date);
  }

  return dates;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// ============================================
// 컴포넌트
// ============================================

export function MatrixView({
  slots,
  plans,
  weekStart,
  showWeekends = false,
  showEmptySlots = true,
  onPlanClick,
  onCellClick,
  enableSimpleComplete = false,
  onSimpleComplete,
  className,
}: MatrixViewProps) {
  // 주간 날짜 계산
  const weekDates = useMemo(
    () => getWeekDates(weekStart, showWeekends),
    [weekStart, showWeekends]
  );

  // 플랜을 셀별로 그룹화
  const plansByCell = useMemo(() => {
    const map = new Map<string, MatrixPlanItem[]>();

    plans.forEach((plan) => {
      // 플랜의 날짜와 시간으로 슬롯 매칭
      const planDate = plan.startTime?.split("T")[0];
      if (!planDate) return;

      // 시간에 맞는 슬롯 찾기
      const planTime = plan.startTime?.split("T")[1]?.substring(0, 5);
      const matchingSlot = slots.find(
        (slot) => slot.startTime <= (planTime || "") && slot.endTime > (planTime || "")
      );

      if (matchingSlot) {
        const key = `${matchingSlot.id}-${planDate}`;
        const existing = map.get(key) || [];
        map.set(key, [...existing, plan]);
      }
    });

    return map;
  }, [plans, slots]);

  // 플랜 클릭 핸들러
  const handlePlanClick = useCallback(
    (plan: MatrixPlanItem, e: React.MouseEvent) => {
      e.stopPropagation();
      onPlanClick?.(plan);
    },
    [onPlanClick]
  );

  // 셀 클릭 핸들러
  const handleCellClick = useCallback(
    (slotId: string, date: string) => {
      onCellClick?.(slotId, date);
    },
    [onCellClick]
  );

  // 간단 완료 핸들러
  const handleSimpleComplete = useCallback(
    (plan: MatrixPlanItem, e: React.MouseEvent) => {
      e.stopPropagation();
      onSimpleComplete?.(plan.id, plan.planType);
    },
    [onSimpleComplete]
  );

  // 학습 슬롯만 필터링 (옵션)
  const displaySlots = showEmptySlots
    ? slots
    : slots.filter((slot) => slot.type === "study");

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="min-w-[800px]">
        {/* 헤더: 요일 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          {/* 시간 슬롯 헤더 */}
          <div className="w-24 flex-shrink-0 p-2 border-r border-gray-200 dark:border-gray-700">
            <span className={cn("text-xs font-medium", textMuted)}>시간</span>
          </div>

          {/* 요일 헤더 */}
          {weekDates.map((date) => {
            const dayOfWeek = date.getDay() as DayOfWeek;
            const isCurrentDay = isToday(date);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div
                key={formatDate(date)}
                className={cn(
                  "flex-1 p-2 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0",
                  isCurrentDay && "bg-blue-50 dark:bg-blue-900/20",
                  isWeekend && "bg-gray-50 dark:bg-gray-800/50"
                )}
              >
                <div
                  className={cn(
                    "text-xs font-medium",
                    isCurrentDay ? "text-blue-600 dark:text-blue-400" : textMuted
                  )}
                >
                  {DAY_LABELS[dayOfWeek]}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold mt-0.5",
                    isCurrentDay ? "text-blue-600 dark:text-blue-400" : textPrimary
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* 바디: 시간 슬롯 × 요일 */}
        {displaySlots.map((slot) => (
          <div
            key={slot.id}
            className="flex border-b border-gray-200 dark:border-gray-700 last:border-b-0"
          >
            {/* 시간 슬롯 라벨 */}
            <div
              className={cn(
                "w-24 flex-shrink-0 p-2 border-r border-gray-200 dark:border-gray-700",
                SLOT_TYPE_COLORS[slot.type]
              )}
            >
              <div className={cn("text-xs font-medium", textPrimary)}>
                {slot.name}
              </div>
              <div className={cn("text-xs mt-0.5", textMuted)}>
                {slot.startTime.substring(0, 5)} - {slot.endTime.substring(0, 5)}
              </div>
            </div>

            {/* 각 요일의 셀 */}
            {weekDates.map((date) => {
              const dateStr = formatDate(date);
              const cellKey = `${slot.id}-${dateStr}`;
              const cellPlans = plansByCell.get(cellKey) || [];
              const isCurrentDay = isToday(date);
              const isStudySlot = slot.type === "study";

              return (
                <div
                  key={cellKey}
                  onClick={() => isStudySlot && handleCellClick(slot.id, dateStr)}
                  className={cn(
                    "flex-1 min-h-[60px] p-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0",
                    isCurrentDay && "bg-blue-50/30 dark:bg-blue-900/10",
                    isStudySlot && onCellClick && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    !isStudySlot && SLOT_TYPE_COLORS[slot.type]
                  )}
                >
                  {/* 셀 내 플랜 목록 */}
                  <div className="space-y-1">
                    {cellPlans.map((plan) => (
                      <MatrixPlanCard
                        key={plan.id}
                        plan={plan}
                        onClick={(e) => handlePlanClick(plan, e)}
                        enableSimpleComplete={enableSimpleComplete}
                        onSimpleComplete={(e) => handleSimpleComplete(plan, e)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 매트릭스 플랜 카드
// ============================================

interface MatrixPlanCardProps {
  plan: MatrixPlanItem;
  onClick: (e: React.MouseEvent) => void;
  enableSimpleComplete?: boolean;
  onSimpleComplete?: (e: React.MouseEvent) => void;
}

function MatrixPlanCard({
  plan,
  onClick,
  enableSimpleComplete,
  onSimpleComplete,
}: MatrixPlanCardProps) {
  const isCompleted = plan.status === "completed";
  const isInProgress = plan.status === "in_progress";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative p-1.5 rounded text-xs cursor-pointer transition-all",
        "bg-white dark:bg-gray-800 shadow-sm hover:shadow",
        STATUS_STYLES[plan.status],
        isCompleted && "opacity-60"
      )}
    >
      {/* 간단 완료 체크박스 */}
      {enableSimpleComplete && !isCompleted && (
        <button
          onClick={onSimpleComplete}
          className={cn(
            "absolute -left-1 -top-1 w-4 h-4 rounded border-2",
            "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600",
            "hover:border-green-500 transition-colors",
            "opacity-0 group-hover:opacity-100"
          )}
        >
          {isCompleted && <Check className="w-3 h-3 text-green-500" />}
        </button>
      )}

      {/* 제목 */}
      <div
        className={cn(
          "font-medium truncate",
          textPrimary,
          isCompleted && "line-through"
        )}
        style={{ color: plan.color }}
      >
        {plan.title}
      </div>

      {/* 과목 */}
      {plan.subject && (
        <div className={cn("truncate mt-0.5", textMuted)}>{plan.subject}</div>
      )}

      {/* 진행률 바 */}
      {plan.progress !== undefined && plan.progress > 0 && plan.progress < 100 && (
        <div className="mt-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${plan.progress}%` }}
          />
        </div>
      )}

      {/* 상태 아이콘 */}
      {isInProgress && (
        <Clock className="absolute top-1 right-1 w-3 h-3 text-blue-500 animate-pulse" />
      )}
      {isCompleted && (
        <Check className="absolute top-1 right-1 w-3 h-3 text-green-500" />
      )}
    </div>
  );
}

// ============================================
// 빈 매트릭스 (스켈레톤)
// ============================================

export function MatrixViewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-x-auto animate-pulse", className)}>
      <div className="min-w-[800px]">
        {/* 헤더 스켈레톤 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <div className="w-24 flex-shrink-0 p-2 border-r border-gray-200 dark:border-gray-700">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex-1 p-2 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
            >
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-6 mx-auto" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 mx-auto mt-1" />
            </div>
          ))}
        </div>

        {/* 행 스켈레톤 */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex border-b border-gray-200 dark:border-gray-700"
          >
            <div className="w-24 flex-shrink-0 p-2 border-r border-gray-200 dark:border-gray-700">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-20 mt-1" />
            </div>
            {[...Array(5)].map((_, j) => (
              <div
                key={j}
                className="flex-1 min-h-[60px] p-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
              >
                {j % 3 === i % 3 && (
                  <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
