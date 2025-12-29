"use client";

import { useMemo, useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, DailyScheduleInfo, AcademySchedule } from "@/lib/types/plan";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { DayTimelineModal } from "./DayTimelineModal";
import { useCalendarData } from "../_hooks/useCalendarData";
import { useCalendarDragDrop } from "../_hooks/useCalendarDragDrop";
import { QuickAddPlanModal } from "./QuickAddPlanModal";
import { PlanDetailModal } from "./PlanDetailModal";
import { MemoizedDayCell } from "./MemoizedDayCell";
import { cn } from "@/lib/cn";

type MonthViewProps = {
  plans: PlanWithContent[];
  currentDate: Date;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dayTypes: Map<string, DayTypeInfo>;
  dailyScheduleMap: Map<string, DailyScheduleInfo>;
  showOnlyStudyTime?: boolean;
  studentId?: string;
  tenantId?: string | null;
  onPlansUpdated?: () => void;
};

function MonthViewComponent({ plans, currentDate, exclusions, academySchedules, dayTypes, dailyScheduleMap, showOnlyStudyTime = false, studentId, tenantId, onPlansUpdated }: MonthViewProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanWithContent | null>(null);
  const [isPlanDetailOpen, setIsPlanDetailOpen] = useState(false);

  // 드래그 앤 드롭 훅
  const {
    draggedItem,
    dropTarget,
    isMoving,
    isDragging,
    dragHandlers,
    dropHandlers,
    setDragImageElement,
  } = useCalendarDragDrop({
    onMoveSuccess: () => {
      router.refresh();
      onPlansUpdated?.();
    },
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 월의 첫 날과 마지막 날
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // 요일 레이블
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  // 날짜별 데이터 그룹화 (공통 훅 사용)
  const { plansByDate, exclusionsByDate } = useCalendarData(plans, exclusions, academySchedules);

  // 콜백 함수들 (메모이제이션)
  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  }, []);

  const handlePlanClick = useCallback((plan: PlanWithContent) => {
    setSelectedPlan(plan);
    setIsPlanDetailOpen(true);
  }, []);

  const handleQuickAdd = useCallback((dateStr: string) => {
    setQuickAddDate(dateStr);
    setIsQuickAddOpen(true);
  }, []);

  // 같은 plan_number를 가진 플랜들의 연결 상태 계산
  const getPlanConnectionState = useMemo(() => {
    const connectionMap = new Map<string, {
      isConnected: boolean;
      isFirst: boolean;
      isLast: boolean;
      isMiddle: boolean;
    }>();
    
    // 날짜별로 그룹화
    plansByDate.forEach((dayPlans, date) => {
      // 같은 plan_number를 가진 플랜들을 그룹화
      const planNumberGroups = new Map<number | null, PlanWithContent[]>();
      
      dayPlans.forEach((plan) => {
        const planNumber = plan.plan_number ?? null;
        if (!planNumberGroups.has(planNumber)) {
          planNumberGroups.set(planNumber, []);
        }
        planNumberGroups.get(planNumber)!.push(plan);
      });
      
      // 각 그룹에서 2개 이상인 경우 연결 상태 계산
      planNumberGroups.forEach((groupPlans, planNumber) => {
        if (groupPlans.length >= 2 && planNumber !== null) {
          // block_index 순으로 정렬
          const sortedPlans = [...groupPlans].sort((a, b) => a.block_index - b.block_index);
          
          sortedPlans.forEach((plan, index) => {
            const isFirst = index === 0;
            const isLast = index === sortedPlans.length - 1;
            const isMiddle = !isFirst && !isLast;
            
            connectionMap.set(`${date}-${plan.id}`, {
              isConnected: true,
              isFirst,
              isLast,
              isMiddle,
            });
          });
        }
      });
    });
    
    return (date: string, planId: string) => {
      return connectionMap.get(`${date}-${planId}`) || {
        isConnected: false,
        isFirst: false,
        isLast: false,
        isMiddle: false,
      };
    };
  }, [plansByDate]);

  // 오늘 날짜 확인
  const todayStr = formatDateString(new Date());

  // 빈 셀 렌더링
  const renderEmptyCell = useCallback(
    (key: string) => (
      <div
        key={key}
        className="min-h-[120px] md:min-h-[140px] lg:min-h-[160px] border border-gray-200 bg-gray-50 rounded-lg"
      />
    ),
    []
  );

  // 날짜별 학원일정 맵 생성 (요일 기반)
  const academySchedulesByDay = useMemo(() => {
    const map = new Map<number, AcademySchedule[]>();
    for (let i = 0; i < 7; i++) {
      map.set(
        i,
        academySchedules.filter((schedule) => schedule.day_of_week === i)
      );
    }
    return map;
  }, [academySchedules]);

  // 캘린더 그리드 생성 (메모이제이션)
  const cells = useMemo(() => {
    const result: React.ReactElement[] = [];

    // 첫 주의 빈 셀
    for (let i = 0; i < startingDayOfWeek; i++) {
      result.push(renderEmptyCell(`empty-${i}`));
    }

    // 날짜 셀
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDateString(date);
      const dayPlans = plansByDate.get(dateStr) || [];
      const dayExclusions = exclusionsByDate.get(dateStr) || [];
      const dayTypeInfo = dayTypes.get(dateStr);
      const dailySchedule = dailyScheduleMap.get(dateStr);
      const dayOfWeek = date.getDay();
      const dayAcademySchedules = academySchedulesByDay.get(dayOfWeek) || [];
      const isToday = dateStr === todayStr;
      const isDropTargetCell = dropTarget === dateStr;
      const canDropHere = draggedItem && draggedItem.planDate !== dateStr;

      result.push(
        <MemoizedDayCell
          key={day}
          day={day}
          year={year}
          month={month}
          dateStr={dateStr}
          dayPlans={dayPlans}
          dayExclusions={dayExclusions}
          dayAcademySchedules={dayAcademySchedules}
          dayTypeInfo={dayTypeInfo}
          dailySchedule={dailySchedule}
          isToday={isToday}
          showOnlyStudyTime={showOnlyStudyTime}
          studentId={studentId}
          getConnectionState={getPlanConnectionState}
          onDateClick={handleDateClick}
          onPlanClick={handlePlanClick}
          onQuickAdd={handleQuickAdd}
          isDropTarget={isDropTargetCell}
          canDrop={!!canDropHere}
          isDragging={isDragging}
          isMoving={isMoving}
          draggedItemPlanId={draggedItem?.planId}
          onDragEnter={dropHandlers.onDragEnter}
          onDragOver={dropHandlers.onDragOver}
          onDragLeave={dropHandlers.onDragLeave}
          onDrop={dropHandlers.onDrop}
          onDragStart={dragHandlers.onDragStart}
          onDragEnd={dragHandlers.onDragEnd}
        />
      );
    }

    // 마지막 주의 빈 셀 (총 42개 셀 유지)
    const totalCells = 42;
    const remainingCells = totalCells - result.length;
    for (let i = 0; i < remainingCells; i++) {
      result.push(renderEmptyCell(`empty-end-${i}`));
    }

    return result;
  }, [
    startingDayOfWeek,
    daysInMonth,
    year,
    month,
    plansByDate,
    exclusionsByDate,
    dayTypes,
    dailyScheduleMap,
    academySchedulesByDay,
    todayStr,
    showOnlyStudyTime,
    studentId,
    getPlanConnectionState,
    handleDateClick,
    handlePlanClick,
    handleQuickAdd,
    dropTarget,
    draggedItem,
    isDragging,
    isMoving,
    dropHandlers,
    dragHandlers,
    renderEmptyCell,
  ]);

  return (
    <>
      {/* 드래그 이미지 (화면에 표시되지 않음) */}
      <div
        ref={setDragImageElement}
        className="fixed -left-[9999px] top-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg"
        aria-hidden="true"
      />

      <div className="w-full" role="grid" aria-label="월별 캘린더">
        {/* 요일 헤더 - 개선된 스타일 */}
        <div className="grid grid-cols-7 gap-2 md:gap-3" role="row">
          {weekdays.map((day) => (
            <div
              key={day}
              role="columnheader"
              className="py-2 md:py-3 text-center text-sm md:text-base font-semibold text-gray-700"
            >
              {day}
            </div>
          ))}
        </div>

        {/* 캘린더 그리드 - 확대된 간격 */}
        <div className="grid grid-cols-7 gap-2 md:gap-3" role="rowgroup">
          {cells}
        </div>
      </div>

      {/* 타임라인 모달 */}
      {selectedDate && (() => {
        const selectedDateStr = formatDateString(selectedDate);
        const selectedDatePlans = plans.filter((plan) => plan.plan_date === selectedDateStr);

        return (
          <DayTimelineModal
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            date={selectedDate}
            plans={selectedDatePlans}
            exclusions={exclusions.filter((ex) => ex.exclusion_date === selectedDateStr)}
            academySchedules={academySchedules}
            dayTypeInfo={dayTypes.get(selectedDateStr)}
            dailySchedule={dailyScheduleMap.get(selectedDateStr)}
          />
        );
      })()}

      {/* 빠른 플랜 추가 모달 */}
      {quickAddDate && studentId && (
        <QuickAddPlanModal
          open={isQuickAddOpen}
          onOpenChange={setIsQuickAddOpen}
          date={quickAddDate}
          studentId={studentId}
          tenantId={tenantId ?? null}
          onSuccess={onPlansUpdated}
        />
      )}

      {/* 플랜 상세 모달 */}
      {selectedPlan && (
        <PlanDetailModal
          open={isPlanDetailOpen}
          onOpenChange={setIsPlanDetailOpen}
          plan={selectedPlan}
          studentId={studentId}
          onPlanUpdated={onPlansUpdated}
        />
      )}
    </>
  );
}

/**
 * 메모이제이션된 MonthView 컴포넌트
 *
 * 주요 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const MonthView = memo(MonthViewComponent, (prevProps, nextProps) => {
  // 기본 속성 비교
  if (
    prevProps.currentDate.getTime() !== nextProps.currentDate.getTime() ||
    prevProps.showOnlyStudyTime !== nextProps.showOnlyStudyTime ||
    prevProps.studentId !== nextProps.studentId ||
    prevProps.tenantId !== nextProps.tenantId
  ) {
    return false;
  }

  // plans 배열 비교 (길이만 비교 - 상세 비교는 MemoizedDayCell에서 수행)
  if (prevProps.plans.length !== nextProps.plans.length) {
    return false;
  }

  // exclusions 배열 비교
  if (prevProps.exclusions.length !== nextProps.exclusions.length) {
    return false;
  }

  // academySchedules 배열 비교
  if (prevProps.academySchedules.length !== nextProps.academySchedules.length) {
    return false;
  }

  // dayTypes Map 비교
  if (prevProps.dayTypes.size !== nextProps.dayTypes.size) {
    return false;
  }

  // dailyScheduleMap Map 비교
  if (prevProps.dailyScheduleMap.size !== nextProps.dailyScheduleMap.size) {
    return false;
  }

  return true;
});

