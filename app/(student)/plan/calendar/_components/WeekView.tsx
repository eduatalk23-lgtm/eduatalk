"use client";

import { useMemo, useState, useCallback, memo } from "react";
import dynamic from "next/dynamic";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule, DailyScheduleInfo } from "@/lib/types/plan";
import { getWeekStart, formatDateString } from "@/lib/date/calendarUtils";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { textSecondary } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";
import { useCalendarData } from "../_hooks/useCalendarData";
import { usePlanConnections } from "../_hooks/usePlanConnections";
import { MemoizedWeekCard } from "./MemoizedWeekCard";

// 큰 모달 컴포넌트는 동적 import로 코드 스플리팅
const DayTimelineModal = dynamic(
  () => import("./DayTimelineModal").then((mod) => ({ default: mod.DayTimelineModal })),
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

type WeekViewProps = {
  plans: PlanWithContent[];
  currentDate: Date;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dayTypes: Map<string, DayTypeInfo>;
  dailyScheduleMap: Map<string, DailyScheduleInfo>;
  showOnlyStudyTime?: boolean;
};

function WeekViewComponent({ plans, currentDate, exclusions, academySchedules, dayTypes, dailyScheduleMap, showOnlyStudyTime = false }: WeekViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 주 시작일 계산 (메모이제이션)
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  
  // 주의 7일 생성 (메모이제이션)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [weekStart]);

  const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

  // 날짜별 데이터 그룹화 (공통 훅 사용)
  const { plansByDate, exclusionsByDate, academySchedulesByDate } = useCalendarData(
    plans,
    exclusions,
    academySchedules,
    weekDays
  );

  // 플랜 연결 그룹화 (공통 훅 사용)
  const { connectedPlanIds } = usePlanConnections(plans);

  // 날짜 클릭 핸들러 생성
  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  }, []);

  return (
    <>
      <div className="w-full flex flex-col gap-3 md:gap-4">
        {/* 요일 헤더 (카드 영역 밖 상단) - 개선된 스타일 */}
        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {weekdays.map((day, index) => (
            <div key={index} className="text-center">
              <div className={cn("text-sm md:text-base font-semibold", textSecondary)}>
                {day}
              </div>
            </div>
          ))}
        </div>

        {/* 날짜 카드들 - 메모이제이션된 컴포넌트 사용 */}
        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {weekDays.map((date) => {
            const dateStr = formatDateString(date);
            const dayPlans = plansByDate.get(dateStr) || [];
            const dayExclusions = exclusionsByDate.get(dateStr) || [];
            const dayAcademySchedules = academySchedulesByDate.get(dateStr) || [];
            const dayTypeInfo = dayTypes.get(dateStr);
            const dailySchedule = dailyScheduleMap.get(dateStr);

            return (
              <MemoizedWeekCard
                key={dateStr}
                date={date}
                dateStr={dateStr}
                dayPlans={dayPlans}
                dayExclusions={dayExclusions}
                dayAcademySchedules={dayAcademySchedules}
                dayTypeInfo={dayTypeInfo}
                dailySchedule={dailySchedule}
                showOnlyStudyTime={showOnlyStudyTime}
                connectedPlanIds={connectedPlanIds}
                onDateClick={() => handleDateClick(date)}
              />
            );
          })}
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
    </>
  );
}

export const WeekView = memo(WeekViewComponent, (prevProps, nextProps) => {
  // currentDate 비교 (날짜 문자열로 변환하여 비교)
  const prevDateStr = prevProps.currentDate.toISOString().slice(0, 10);
  const nextDateStr = nextProps.currentDate.toISOString().slice(0, 10);
  
  // plans 배열의 길이 비교
  if (prevProps.plans.length !== nextProps.plans.length) {
    return false;
  }
  
  return (
    prevDateStr === nextDateStr &&
    prevProps.showOnlyStudyTime === nextProps.showOnlyStudyTime &&
    prevProps.exclusions.length === nextProps.exclusions.length &&
    prevProps.academySchedules.length === nextProps.academySchedules.length &&
    prevProps.dayTypes.size === nextProps.dayTypes.size &&
    prevProps.dailyScheduleMap.size === nextProps.dailyScheduleMap.size
  );
});

