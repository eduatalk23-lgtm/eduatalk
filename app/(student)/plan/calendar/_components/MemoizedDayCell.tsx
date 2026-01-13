"use client";

/**
 * 메모이제이션된 날짜 셀 컴포넌트
 *
 * MonthView의 개별 날짜 셀을 분리하여 불필요한 리렌더링을 방지합니다.
 * 날짜 데이터가 변경되지 않으면 리렌더링하지 않습니다.
 */

import { memo, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, DailyScheduleInfo, AcademySchedule } from "@/lib/types/plan";
import type { AdHocPlanForCalendar } from "./PlanCalendarView";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { formatDateString } from "@/lib/date/calendarUtils";
import { timeToMinutes, getTimeSlotColorClass, getTimeSlotIcon } from "../_utils/timelineUtils";
import { CalendarPlanCard } from "./CalendarPlanCard";
import { getDayTypeStyling } from "../_hooks/useDayTypeStyling";
import { getTimelineSlots } from "../_hooks/useTimelineSlots";
import type { DragItem } from "../_hooks/useCalendarDragDrop";
import { cn } from "@/lib/cn";

type ConnectionState = {
  isConnected: boolean;
  isFirst: boolean;
  isLast: boolean;
  isMiddle: boolean;
};

// Props 그룹화 타입 정의
export type DateInfo = {
  day: number;
  year: number;
  month: number;
  dateStr: string;
};

export type DayData = {
  dayPlans: PlanWithContent[];
  dayAdHocPlans?: AdHocPlanForCalendar[];
  dayExclusions: PlanExclusion[];
  dayAcademySchedules: AcademySchedule[];
};

export type DayCellMetadata = {
  dayTypeInfo?: DayTypeInfo;
  dailySchedule?: DailyScheduleInfo;
  isToday: boolean;
  showOnlyStudyTime: boolean;
  studentId?: string;
};

export type DayCellHandlers = {
  getConnectionState: (date: string, planId: string) => ConnectionState;
  onDateClick: (date: Date) => void;
  onPlanClick: (plan: PlanWithContent) => void;
  onQuickAdd: (dateStr: string) => void;
};

export type DragDropState = {
  isDropTarget: boolean;
  canDrop: boolean;
  isDragging: boolean;
  isMoving: boolean;
  draggedItemPlanId?: string;
};

export type DragDropHandlers = {
  onDragEnter: (e: React.DragEvent, dateStr: string) => void;
  onDragOver: (e: React.DragEvent, dateStr: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, dateStr: string) => void;
  onDragStart: (e: React.DragEvent, item: DragItem) => void;
  onDragEnd: (e: React.DragEvent) => void;
};

type MemoizedDayCellProps = {
  dateInfo: DateInfo;
  dayData: DayData;
  metadata: DayCellMetadata;
  handlers: DayCellHandlers;
  dragDropState: DragDropState;
  dragDropHandlers: DragDropHandlers;
};

function MemoizedDayCellComponent({
  dateInfo,
  dayData,
  metadata,
  handlers,
  dragDropState,
  dragDropHandlers,
}: MemoizedDayCellProps) {
  // Props 구조 분해
  const { day, year, month, dateStr } = dateInfo;
  const { dayPlans, dayAdHocPlans = [], dayExclusions, dayAcademySchedules } = dayData;
  const { dayTypeInfo, dailySchedule, isToday, showOnlyStudyTime, studentId } = metadata;
  const { getConnectionState, onDateClick, onPlanClick, onQuickAdd } = handlers;
  const { isDropTarget, canDrop, isDragging, isMoving, draggedItemPlanId } = dragDropState;
  const { onDragEnter, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd } = dragDropHandlers;

  const date = new Date(year, month, day);

  // 날짜 타입별 스타일링
  const { bgColorClass, textColorClass } = getDayTypeStyling(
    date,
    dayTypeInfo,
    dayExclusions
  );

  const dayType = dayTypeInfo?.type || "normal";

  // 컨테이너별 플랜 개수 계산
  const containerCounts = useMemo(() => {
    type ContainerType = "unfinished" | "daily" | "weekly";
    const counts: Record<ContainerType, number> = {
      unfinished: 0,
      daily: 0,
      weekly: 0,
    };

    // dayPlans에서 컨테이너별 집계
    dayPlans.forEach((plan) => {
      const containerType = (plan as { container_type?: string | null }).container_type;
      // 미완료/이월 플랜 체크 (carryover_count > 0 또는 status가 미완료)
      const carryoverCount = (plan as { carryover_count?: number | null }).carryover_count || 0;
      const isUnfinished = carryoverCount > 0 || plan.status === "overdue";

      if (isUnfinished) {
        counts.unfinished++;
      } else if (containerType === "weekly") {
        counts.weekly++;
      } else {
        // 기본값은 daily
        counts.daily++;
      }
    });

    // dayAdHocPlans에서 컨테이너별 집계
    dayAdHocPlans.forEach((adHocPlan) => {
      const containerType = adHocPlan.container_type;
      if (containerType === "weekly") {
        counts.weekly++;
      } else {
        counts.daily++;
      }
    });

    return counts;
  }, [dayPlans, dayAdHocPlans]);

  // 컨테이너가 있는지 확인
  const hasContainers = containerCounts.unfinished > 0 || containerCounts.daily > 0 || containerCounts.weekly > 0;

  const handleDateClick = useCallback(() => {
    onDateClick(date);
  }, [onDateClick, date]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleDateClick();
      }
    },
    [handleDateClick]
  );

  const handlePlanClick = useCallback(
    (plan: PlanWithContent) => {
      onPlanClick(plan);
    },
    [onPlanClick]
  );

  const handleQuickAdd = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onQuickAdd(dateStr);
    },
    [onQuickAdd, dateStr]
  );

  // 타임라인 슬롯 생성
  const { filteredSlots } = getTimelineSlots(
    dateStr,
    dailySchedule,
    dayPlans,
    dayAcademySchedules,
    dayExclusions,
    showOnlyStudyTime
  );

  // 플랜 및 슬롯 렌더링
  const renderContent = () => {
    const items: React.ReactElement[] = [];
    const addedPlanIds = new Set<string>();

    // 최대 6개까지만 표시 (공간 제약)
    let displayedCount = 0;
    const maxDisplay = 6;

    filteredSlots.forEach((slot) => {
      if (displayedCount >= maxDisplay) return;

      // 학원일정 표시
      if (slot.type === "학원일정" && slot.academy) {
        if (displayedCount < maxDisplay) {
          const AcademyIcon = getTimeSlotIcon("학원일정");
          items.push(
            <div
              key={`slot-${slot.start}-${slot.end}-academy`}
              className="truncate rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800 flex items-center gap-0.5"
              title={`${slot.academy.academy_name || "학원"}: ${slot.start} ~ ${slot.end}`}
            >
              <AcademyIcon className="w-3 h-3 shrink-0" />
              <span>{slot.academy.academy_name || "학원"}</span>
            </div>
          );
          displayedCount++;
        }
        return;
      }

      // 점심시간, 이동시간, 자율학습 표시
      if (slot.type !== "학습시간") {
        if (displayedCount < maxDisplay && !showOnlyStudyTime) {
          const IconComponent = getTimeSlotIcon(slot.type);
          const colorClass = getTimeSlotColorClass(slot.type);
          items.push(
            <div
              key={`slot-${slot.start}-${slot.end}-${slot.type}`}
              className={`truncate rounded px-1.5 py-0.5 text-[10px] border flex items-center gap-0.5 ${colorClass}`}
              title={`${slot.type}: ${slot.start} ~ ${slot.end}`}
            >
              <IconComponent className="w-3 h-3 shrink-0" />
              <span>{slot.type}</span>
            </div>
          );
          displayedCount++;
        }
        return;
      }

      // 학습시간인 경우 플랜 표시
      if (slot.type === "학습시간" && slot.plans && slot.plans.length > 0) {
        slot.plans
          .sort((a, b) => {
            if (a.start_time && b.start_time) {
              return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
            }
            return a.block_index - b.block_index;
          })
          .forEach((plan) => {
            if (displayedCount >= maxDisplay || addedPlanIds.has(plan.id)) {
              return;
            }
            addedPlanIds.add(plan.id);

            const connectionState = getConnectionState(dateStr, plan.id);
            const isVirtual =
              (plan as { is_virtual?: boolean | null }).is_virtual === true;
            const dragItem: DragItem = {
              planId: plan.id,
              planDate: dateStr,
              contentTitle: plan.contentTitle || plan.content_title || "플랜",
            };

            items.push(
              <CalendarPlanCard
                key={plan.id}
                plan={plan}
                compact={true}
                showTime={false}
                showProgress={false}
                isConnected={connectionState.isConnected}
                isFirst={connectionState.isFirst}
                isLast={connectionState.isLast}
                isMiddle={connectionState.isMiddle}
                draggable={!isVirtual && !isMoving}
                onDragStart={(e) => onDragStart(e, dragItem)}
                onDragEnd={onDragEnd}
                isDragging={draggedItemPlanId === plan.id}
                onClick={() => handlePlanClick(plan)}
              />
            );
            displayedCount++;
          });
      }
    });

    // 타임라인 슬롯에 매칭되지 않은 플랜
    const unmatchedPlans = dayPlans.filter((plan) => !addedPlanIds.has(plan.id));
    if (unmatchedPlans.length > 0 && displayedCount < maxDisplay) {
      unmatchedPlans
        .sort((a, b) => a.block_index - b.block_index)
        .slice(0, maxDisplay - displayedCount)
        .forEach((plan) => {
          const connectionState = getConnectionState(dateStr, plan.id);
          const isVirtual =
            (plan as { is_virtual?: boolean | null }).is_virtual === true;
          const dragItem: DragItem = {
            planId: plan.id,
            planDate: dateStr,
            contentTitle: plan.contentTitle || plan.content_title || "플랜",
          };

          items.push(
            <CalendarPlanCard
              key={plan.id}
              plan={plan}
              compact={true}
              showTime={false}
              showProgress={false}
              isConnected={connectionState.isConnected}
              isFirst={connectionState.isFirst}
              isLast={connectionState.isLast}
              isMiddle={connectionState.isMiddle}
              draggable={!isVirtual && !isMoving}
              onDragStart={(e) => onDragStart(e, dragItem)}
              onDragEnd={onDragEnd}
              isDragging={draggedItemPlanId === plan.id}
              onClick={() => handlePlanClick(plan)}
            />
          );
          displayedCount++;
        });
    }

    // Ad-hoc 플랜 표시
    if (dayAdHocPlans.length > 0 && displayedCount < maxDisplay) {
      dayAdHocPlans.slice(0, maxDisplay - displayedCount).forEach((adHocPlan) => {
        const isCompleted = adHocPlan.status === "completed" || !!adHocPlan.completed_at;
        const isInProgress = adHocPlan.status === "in_progress" && !!adHocPlan.started_at;

        items.push(
          <div
            key={`adhoc-${adHocPlan.id}`}
            className={cn(
              "group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all",
              "border border-dashed",
              isCompleted
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : isInProgress
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-purple-50 border-purple-300 text-purple-700",
              adHocPlan.color ? `border-[${adHocPlan.color}]` : ""
            )}
            title={adHocPlan.title}
          >
            <span className="text-[10px]">⚡</span>
            <span className="truncate font-medium">{adHocPlan.title}</span>
            {isCompleted && <span className="text-[9px]">✓</span>}
          </div>
        );
        displayedCount++;
      });
    }

    // 총 개수 계산
    const totalItems =
      filteredSlots.reduce((count, slot) => {
        if (slot.type === "학습시간" && slot.plans) {
          return count + slot.plans.length;
        }
        return count + 1;
      }, 0) + unmatchedPlans.length + dayAdHocPlans.length;

    return (
      <>
        {/* 제외일 안내 */}
        {dayExclusions.length > 0 && items.length > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 mb-1">
            <span className="text-[9px] text-orange-700 dark:text-orange-300 font-semibold">
              ⚠️
            </span>
            <span className="text-[9px] text-orange-600 dark:text-orange-400 font-medium">
              제외일
            </span>
            {dayExclusions[0].exclusion_type && (
              <span className="text-[9px] text-orange-500 dark:text-orange-500">
                ({dayExclusions[0].exclusion_type})
              </span>
            )}
          </div>
        )}
        {items}
        {totalItems > maxDisplay && (
          <div
            className="flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
            title={`${totalItems - maxDisplay}개 더 있음`}
          >
            <span className="text-[10px] font-medium">
              +{totalItems - maxDisplay}
            </span>
          </div>
        )}
      </>
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${dateStr} 날짜, ${dayPlans.length}개의 플랜`}
      aria-current={isToday ? "date" : undefined}
      className={cn(
        "min-h-[120px] md:min-h-[140px] lg:min-h-[160px] cursor-pointer rounded-lg border-2 p-2 md:p-3 transition-base hover:scale-[1.02] hover:shadow-[var(--elevation-8)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 group",
        bgColorClass,
        isToday && "ring-2 ring-indigo-500 ring-offset-2",
        isDropTarget &&
          canDrop &&
          "ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.02]",
        isDragging && !canDrop && "opacity-50"
      )}
      onClick={handleDateClick}
      onKeyDown={handleKeyDown}
      onDragEnter={(e) => onDragEnter(e, dateStr)}
      onDragOver={(e) => onDragOver(e, dateStr)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, dateStr)}
    >
      {/* 날짜 헤더 */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "text-base md:text-lg font-bold leading-tight",
                textColorClass,
                isToday && "text-indigo-600 dark:text-indigo-400"
              )}
            >
              {day}
              {isToday && (
                <span
                  className="ml-0.5 text-[10px] leading-none"
                  aria-label="오늘"
                >
                  ●
                </span>
              )}
            </span>
            {/* 컨테이너 인디케이터 도트 */}
            {hasContainers && (
              <div className="flex items-center gap-0.5 ml-0.5" aria-label="컨테이너 현황">
                {containerCounts.unfinished > 0 && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-red-500"
                    title={`미완료 ${containerCounts.unfinished}개`}
                    aria-label={`미완료 플랜 ${containerCounts.unfinished}개`}
                  />
                )}
                {containerCounts.daily > 0 && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-blue-500"
                    title={`오늘 ${containerCounts.daily}개`}
                    aria-label={`오늘 플랜 ${containerCounts.daily}개`}
                  />
                )}
                {containerCounts.weekly > 0 && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-green-500"
                    title={`주간 ${containerCounts.weekly}개`}
                    aria-label={`주간 플랜 ${containerCounts.weekly}개`}
                  />
                )}
              </div>
            )}
            {/* 빠른 추가 버튼 */}
            {studentId && (
              <button
                onClick={handleQuickAdd}
                className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                aria-label={`${dateStr}에 플랜 추가`}
                title="빠른 플랜 추가"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* 날짜 타입 배지 및 주차/일차 정보 */}
          {dayTypeInfo && dayType !== "normal" && (
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center gap-0.5">
                {dayTypeInfo.icon && (
                  <dayTypeInfo.icon className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                )}
                <span
                  className={cn(
                    "text-[9px] md:text-[10px] font-medium",
                    textColorClass
                  )}
                >
                  {dayTypeInfo.label}
                </span>
              </div>
              {/* 주차/일차 정보 (학습일/복습일인 경우에만 표시) */}
              {dailySchedule?.week_number && dailySchedule?.cycle_day_number && (
                <span className="text-[9px] md:text-[10px] text-muted-foreground whitespace-nowrap">
                  {dailySchedule.week_number}주차 {dailySchedule.cycle_day_number}일차
                </span>
              )}
            </div>
          )}
        </div>

        {/* 타임라인 슬롯 및 플랜 */}
        <div className="flex flex-col gap-1 min-w-0">{renderContent()}</div>
      </div>
    </div>
  );
}

/**
 * 메모이제이션된 날짜 셀
 *
 * props 비교 함수를 사용하여 실제 데이터 변경 시에만 리렌더링합니다.
 */
export const MemoizedDayCell = memo(
  MemoizedDayCellComponent,
  (prevProps, nextProps) => {
    // dateInfo 비교
    if (
      prevProps.dateInfo.day !== nextProps.dateInfo.day ||
      prevProps.dateInfo.year !== nextProps.dateInfo.year ||
      prevProps.dateInfo.month !== nextProps.dateInfo.month
    ) {
      return false;
    }

    // metadata 비교
    if (
      prevProps.metadata.isToday !== nextProps.metadata.isToday ||
      prevProps.metadata.showOnlyStudyTime !== nextProps.metadata.showOnlyStudyTime
    ) {
      return false;
    }

    // dragDropState 비교
    if (
      prevProps.dragDropState.isDropTarget !== nextProps.dragDropState.isDropTarget ||
      prevProps.dragDropState.canDrop !== nextProps.dragDropState.canDrop ||
      prevProps.dragDropState.isDragging !== nextProps.dragDropState.isDragging ||
      prevProps.dragDropState.isMoving !== nextProps.dragDropState.isMoving ||
      prevProps.dragDropState.draggedItemPlanId !== nextProps.dragDropState.draggedItemPlanId
    ) {
      return false;
    }

    // dayData.dayPlans 배열 비교 (길이와 ID, 상태, 컨테이너 타입 비교)
    if (prevProps.dayData.dayPlans.length !== nextProps.dayData.dayPlans.length) {
      return false;
    }
    for (let i = 0; i < prevProps.dayData.dayPlans.length; i++) {
      const prevPlan = prevProps.dayData.dayPlans[i];
      const nextPlan = nextProps.dayData.dayPlans[i];
      const prevContainerType = (prevPlan as { container_type?: string | null }).container_type;
      const nextContainerType = (nextPlan as { container_type?: string | null }).container_type;
      const prevCarryover = (prevPlan as { carryover_count?: number | null }).carryover_count;
      const nextCarryover = (nextPlan as { carryover_count?: number | null }).carryover_count;
      if (
        prevPlan.id !== nextPlan.id ||
        prevPlan.progress !== nextPlan.progress ||
        prevPlan.status !== nextPlan.status ||
        prevContainerType !== nextContainerType ||
        prevCarryover !== nextCarryover
      ) {
        return false;
      }
    }

    // dayData.dayExclusions 배열 비교
    if (prevProps.dayData.dayExclusions.length !== nextProps.dayData.dayExclusions.length) {
      return false;
    }

    // dayData.dayAcademySchedules 배열 비교
    if (prevProps.dayData.dayAcademySchedules.length !== nextProps.dayData.dayAcademySchedules.length) {
      return false;
    }

    // dayData.dayAdHocPlans 배열 비교
    const prevAdHocPlans = prevProps.dayData.dayAdHocPlans || [];
    const nextAdHocPlans = nextProps.dayData.dayAdHocPlans || [];
    if (prevAdHocPlans.length !== nextAdHocPlans.length) {
      return false;
    }
    for (let i = 0; i < prevAdHocPlans.length; i++) {
      const prevAdHoc = prevAdHocPlans[i];
      const nextAdHoc = nextAdHocPlans[i];
      if (
        prevAdHoc.id !== nextAdHoc.id ||
        prevAdHoc.status !== nextAdHoc.status ||
        prevAdHoc.container_type !== nextAdHoc.container_type
      ) {
        return false;
      }
    }

    // metadata.dayTypeInfo 비교
    if (
      prevProps.metadata.dayTypeInfo?.type !== nextProps.metadata.dayTypeInfo?.type ||
      prevProps.metadata.dayTypeInfo?.label !== nextProps.metadata.dayTypeInfo?.label
    ) {
      return false;
    }

    return true;
  }
);
