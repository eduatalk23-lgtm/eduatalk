"use client";

import { useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, DailyScheduleInfo, AcademySchedule } from "@/lib/types/plan";
import type { AdHocPlanForCalendar } from "./PlanCalendarView";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { useCalendarData } from "../_hooks/useCalendarData";
import { useCalendarDragDrop } from "../_hooks/useCalendarDragDrop";
import { useMonthViewModals } from "../_hooks/useMonthViewModals";
import { usePlanConnectionState } from "../_hooks/usePlanConnectionState";
import { useAdHocPlansByDate } from "../_hooks/useAdHocPlansByDate";
import { WeekdayHeader } from "./WeekdayHeader";
import { CalendarGrid } from "./CalendarGrid";
import { MonthViewModals } from "./MonthViewModals";

type MonthViewProps = {
  plans: PlanWithContent[];
  adHocPlans?: AdHocPlanForCalendar[];
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

function MonthViewComponent({
  plans,
  adHocPlans = [],
  currentDate,
  exclusions,
  academySchedules,
  dayTypes,
  dailyScheduleMap,
  showOnlyStudyTime = false,
  studentId,
  tenantId,
  onPlansUpdated,
}: MonthViewProps) {
  const router = useRouter();

  // 모달 상태 관리 훅
  const modals = useMonthViewModals();

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

  // 날짜별 데이터 그룹화 (공통 훅 사용)
  const { plansByDate, exclusionsByDate } = useCalendarData(plans, exclusions, academySchedules);

  // Ad-hoc 플랜 날짜별 그룹화
  const adHocPlansByDate = useAdHocPlansByDate(adHocPlans);

  // 플랜 연결 상태 계산
  const getPlanConnectionState = usePlanConnectionState(plansByDate);

  // 오늘 날짜 확인
  const todayStr = formatDateString(new Date());

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

  return (
    <>
      {/* 드래그 이미지 (화면에 표시되지 않음) */}
      <div
        ref={setDragImageElement}
        className="fixed -left-[9999px] top-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg"
        aria-hidden="true"
      />

      <div className="w-full" role="grid" aria-label="월별 캘린더">
        {/* 요일 헤더 */}
        <WeekdayHeader />

        {/* 캘린더 그리드 */}
        <CalendarGrid
          year={year}
          month={month}
          daysInMonth={daysInMonth}
          startingDayOfWeek={startingDayOfWeek}
          plansByDate={plansByDate}
          adHocPlansByDate={adHocPlansByDate}
          exclusionsByDate={exclusionsByDate}
          academySchedulesByDay={academySchedulesByDay}
          dayTypes={dayTypes}
          dailyScheduleMap={dailyScheduleMap}
          todayStr={todayStr}
          showOnlyStudyTime={showOnlyStudyTime}
          studentId={studentId}
          getPlanConnectionState={getPlanConnectionState}
          onDateClick={modals.handleDateClick}
          onPlanClick={modals.handlePlanClick}
          onQuickAdd={modals.handleQuickAdd}
          dropTarget={dropTarget}
          draggedItem={draggedItem}
          isDragging={isDragging}
          isMoving={isMoving}
          dropHandlers={dropHandlers}
          dragHandlers={dragHandlers}
        />
      </div>

      {/* 모달들 */}
      <MonthViewModals
        selectedDate={modals.selectedDate}
        isModalOpen={modals.isModalOpen}
        onModalOpenChange={modals.setIsModalOpen}
        plans={plans}
        exclusions={exclusions}
        academySchedules={academySchedules}
        dayTypes={dayTypes}
        dailyScheduleMap={dailyScheduleMap}
        quickAddDate={modals.quickAddDate}
        isQuickAddOpen={modals.isQuickAddOpen}
        onQuickAddOpenChange={modals.setIsQuickAddOpen}
        studentId={studentId}
        tenantId={tenantId}
        onPlansUpdated={onPlansUpdated}
        selectedPlan={modals.selectedPlan}
        isPlanDetailOpen={modals.isPlanDetailOpen}
        onPlanDetailOpenChange={modals.setIsPlanDetailOpen}
      />
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

  // adHocPlans 배열 비교
  if ((prevProps.adHocPlans?.length ?? 0) !== (nextProps.adHocPlans?.length ?? 0)) {
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
