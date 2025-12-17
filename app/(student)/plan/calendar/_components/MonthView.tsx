"use client";

import { useMemo, useState } from "react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, DailyScheduleInfo, AcademySchedule } from "@/lib/types/plan";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { timeToMinutes, getTimeSlotColorClass, getTimeSlotIcon } from "../_utils/timelineUtils";
import { CalendarPlanCard } from "./CalendarPlanCard";
import { DayTimelineModal } from "./DayTimelineModal";
import { getDayTypeStyling } from "../_hooks/useDayTypeStyling";
import { useCalendarData } from "../_hooks/useCalendarData";
import { getTimelineSlots } from "../_hooks/useTimelineSlots";
import { cn } from "@/lib/cn";

type MonthViewProps = {
  plans: PlanWithContent[];
  currentDate: Date;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dayTypes: Map<string, DayTypeInfo>;
  dailyScheduleMap: Map<string, DailyScheduleInfo>;
  showOnlyStudyTime?: boolean;
};

export function MonthView({ plans, currentDate, exclusions, academySchedules, dayTypes, dailyScheduleMap, showOnlyStudyTime = false }: MonthViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // 날짜 셀 렌더링
  const renderDayCell = (day: number) => {
    const date = new Date(year, month, day);
    const dateStr = formatDateString(date);
    const dayPlans = plansByDate.get(dateStr) || [];
    const dayExclusions = exclusionsByDate.get(dateStr) || [];
    const dayTypeInfo = dayTypes.get(dateStr);
    const isToday = dateStr === todayStr;
    
    // 날짜 타입별 스타일링 (공통 유틸리티 사용)
    const {
      bgColorClass,
      textColorClass,
      dayTypeBadgeClass,
    } = getDayTypeStyling(date, dayTypeInfo, dayExclusions);

    const dayType = dayTypeInfo?.type || "normal";

    const handleDateClick = () => {
      setSelectedDate(date);
      setIsModalOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleDateClick();
      }
    };

    return (
      <div
        key={day}
        role="button"
        tabIndex={0}
        aria-label={`${dateStr} 날짜, ${dayPlans.length}개의 플랜`}
        aria-current={isToday ? "date" : undefined}
        className={cn(
          "min-h-[120px] md:min-h-[140px] lg:min-h-[160px] cursor-pointer rounded-lg border-2 p-2 md:p-3 transition-base hover:scale-[1.02] hover:shadow-[var(--elevation-8)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
          bgColorClass,
          isToday && "ring-2 ring-indigo-500 ring-offset-2"
        )}
        onClick={handleDateClick}
        onKeyDown={handleKeyDown}
      >
        {/* 날짜 헤더 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className={cn("text-base md:text-lg font-bold leading-tight", textColorClass, isToday && "text-indigo-600 dark:text-indigo-400")}>
              {day}
              {isToday && (
                <span className="ml-0.5 text-[10px] leading-none" aria-label="오늘">●</span>
              )}
            </div>
            {/* 날짜 타입 배지 - 학습일/복습일과 동일한 구조로 통일 */}
            {dayTypeInfo && dayType !== "normal" && (
              <div className="flex items-center gap-0.5 shrink-0">
                {dayTypeInfo.icon && (
                  <dayTypeInfo.icon className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                )}
                <span className={cn("text-[9px] md:text-[10px] font-medium", textColorClass)}>
                  {dayTypeInfo.label}
                </span>
              </div>
            )}
          </div>
          {/* 타임라인 슬롯 기반으로 플랜 및 기타 슬롯 표시 */}
          <div className="flex flex-col gap-1 min-w-0">
          {(() => {
            const dailySchedule = dailyScheduleMap.get(dateStr);
            
            // 해당 날짜의 학원일정 (요일 기반)
            const dayOfWeek = date.getDay();
            const dayAcademySchedules = academySchedules.filter(
              (schedule) => schedule.day_of_week === dayOfWeek
            );
            
            // 타임라인 슬롯 생성 및 정렬/필터링 (공통 유틸리티 사용)
            const { filteredSlots } = getTimelineSlots(
              dateStr,
              dailySchedule,
              dayPlans,
              dayAcademySchedules,
              dayExclusions,
              showOnlyStudyTime
            );
            
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
                  // 공통 유틸리티 함수 사용하여 색상 통일
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
                    // 시간 정보가 있으면 시간 순, 없으면 block_index 순
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
                    
                    // 연결 상태 계산
                    const connectionState = getPlanConnectionState(dateStr, plan.id);
                    
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
                      />
                    );
                    displayedCount++;
                  });
              }
            });
            
            // 플랜이 타임라인 슬롯에 매칭되지 않은 경우 (시간 정보가 없는 기존 플랜)
            const unmatchedPlans = dayPlans.filter((plan) => !addedPlanIds.has(plan.id));
            if (unmatchedPlans.length > 0 && displayedCount < maxDisplay) {
              unmatchedPlans
                .sort((a, b) => a.block_index - b.block_index)
                .slice(0, maxDisplay - displayedCount)
                .forEach((plan) => {
                  // 연결 상태 계산
                  const connectionState = getPlanConnectionState(dateStr, plan.id);
                  
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
                    />
                  );
                  displayedCount++;
                });
            }
            
            // 총 개수 표시
            const totalItems = filteredSlots.reduce((count, slot) => {
              if (slot.type === "학습시간" && slot.plans) {
                return count + slot.plans.length;
              }
              return count + 1;
            }, 0) + unmatchedPlans.length;
            
            return (
              <>
                {/* 제외일 안내 (제외일이 있고 플랜이 있는 경우) */}
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
                    <span className="text-[10px] font-medium">+{totalItems - maxDisplay}</span>
                  </div>
                )}
              </>
            );
          })()}
          </div>
        </div>
      </div>
    );
  };

  // 빈 셀 렌더링
  const renderEmptyCell = (key: string) => (
    <div key={key} className="min-h-[120px] md:min-h-[140px] lg:min-h-[160px] border border-gray-200 bg-gray-50 rounded-lg" />
  );

  // 캘린더 그리드 생성
  const cells: (React.ReactElement | null)[] = [];
  
  // 첫 주의 빈 셀
  for (let i = 0; i < startingDayOfWeek; i++) {
    cells.push(renderEmptyCell(`empty-${i}`));
  }

  // 날짜 셀
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(renderDayCell(day));
  }

  // 마지막 주의 빈 셀 (총 42개 셀 유지)
  const totalCells = 42;
  const remainingCells = totalCells - cells.length;
  for (let i = 0; i < remainingCells; i++) {
    cells.push(renderEmptyCell(`empty-end-${i}`));
  }

  return (
    <>
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
    </>
  );
}

