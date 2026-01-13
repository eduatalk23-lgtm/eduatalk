"use client";

/**
 * 관리자 월간 캘린더 뷰
 *
 * 한 달 전체 플랜을 7열 그리드로 표시합니다.
 * 드래그앤드롭으로 플랜 날짜 변경 지원
 */

import { useMemo, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";

import { cn } from "@/lib/cn";
import DroppableAdminDayCell from "./DroppableAdminDayCell";
import type {
  AdminMonthViewProps,
  DayCellStatus,
  DayCellStats,
} from "./_types/adminCalendar";

// 요일 헤더
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function AdminMonthView({
  currentMonth,
  selectedDate,
  onDateSelect,
  plansByDate,
  exclusionsByDate,
  dailySchedulesByDate,
  onPlanClick,
  onContextMenu: onContextMenuProp,
  onExclusionToggle,
  isSelectionMode = false,
  selectedPlanIds,
  onPlanSelect,
}: AdminMonthViewProps) {
  // 캘린더 날짜 배열 생성 (6주 * 7일 = 42일)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // 날짜별 상태 계산
  const getDayCellStatus = useCallback(
    (date: Date): DayCellStatus => {
      const dateStr = format(date, "yyyy-MM-dd");
      const exclusion = exclusionsByDate[dateStr];
      const dailySchedule = dailySchedulesByDate?.[dateStr];
      const today = startOfDay(new Date());

      return {
        isExclusion: !!exclusion,
        exclusionType: exclusion?.exclusion_type,
        exclusionReason: exclusion?.reason || undefined,
        isToday: isToday(date),
        isSelected: dateStr === selectedDate,
        isCurrentMonth: isSameMonth(date, currentMonth),
        isPast: isBefore(date, today),
        isDragOver: false, // DnD 컨텍스트에서 관리
        // 1730 Timetable 주기 정보
        weekNumber: dailySchedule?.week_number,
        cycleDayNumber: dailySchedule?.cycle_day_number,
        dayType: dailySchedule?.day_type,
      };
    },
    [currentMonth, selectedDate, exclusionsByDate, dailySchedulesByDate]
  );

  // 날짜별 통계 계산
  const getDayCellStats = useCallback(
    (date: Date): DayCellStats => {
      const dateStr = format(date, "yyyy-MM-dd");
      const plans = plansByDate[dateStr] || [];

      const totalPlans = plans.length;
      const completedPlans = plans.filter((p) => p.status === "completed").length;
      const inProgressPlans = plans.filter((p) => p.status === "in_progress").length;
      const pendingPlans = plans.filter(
        (p) => p.status === "pending" || !p.status
      ).length;
      const completionRate =
        totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
      const totalEstimatedMinutes = plans.reduce(
        (sum, p) => sum + (p.estimated_minutes || 0),
        0
      );

      return {
        totalPlans,
        completedPlans,
        inProgressPlans,
        pendingPlans,
        completionRate,
        totalEstimatedMinutes,
      };
    },
    [plansByDate]
  );

  // 날짜 클릭 핸들러 (dateStr을 직접 받음 - 메모이제이션 최적화)
  const handleDateClick = useCallback(
    (dateStr: string) => {
      onDateSelect(dateStr);
    },
    [onDateSelect]
  );

  // 컨텍스트 메뉴 핸들러 (dateStr을 직접 받음 - 메모이제이션 최적화)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, dateStr: string) => {
      e.preventDefault();
      const hasExclusion = !!exclusionsByDate[dateStr];

      // 외부 핸들러가 있으면 사용, 없으면 기본 토글
      if (onContextMenuProp) {
        onContextMenuProp(e, dateStr, hasExclusion);
      } else {
        onExclusionToggle(dateStr, hasExclusion);
      }
    },
    [exclusionsByDate, onContextMenuProp, onExclusionToggle]
  );

  return (
    <div className="flex flex-col h-full p-4">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-px mb-2">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "text-center text-sm font-medium py-2",
              index === 0 && "text-red-500",
              index === 6 && "text-blue-500"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7 gap-px flex-1 bg-gray-200 rounded-lg overflow-hidden">
        {calendarDays.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const status = getDayCellStatus(date);
          const stats = getDayCellStats(date);
          const plans = plansByDate[dateStr] || [];

          return (
            <DroppableAdminDayCell
              key={dateStr}
              date={date}
              status={status}
              stats={stats}
              plans={plans}
              onDateClick={handleDateClick}
              onPlanClick={onPlanClick}
              onContextMenu={handleContextMenu}
              isSelectionMode={isSelectionMode}
              selectedPlanIds={selectedPlanIds}
              onPlanSelect={onPlanSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
