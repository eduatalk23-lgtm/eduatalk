"use client";

import { useMemo, useState } from "react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule, DailyScheduleInfo } from "@/lib/types/plan";
import { CONTENT_TYPE_EMOJIS } from "../_constants/contentIcons";
import { getWeekStart, formatDateString, isToday } from "@/lib/date/calendarUtils";
import { DAY_TYPE_INFO } from "@/lib/date/calendarDayTypes";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { buildTimelineSlots, getTimeSlotColorClass, getTimeSlotIcon, timeToMinutes, type TimeSlotType } from "../_utils/timelineUtils";
import { PlanCard } from "./PlanCard";
import { StatCard } from "./StatCard";
import { DayTimelineModal } from "./DayTimelineModal";

type WeekViewProps = {
  plans: PlanWithContent[];
  currentDate: Date;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dayTypes: Map<string, DayTypeInfo>;
  dailyScheduleMap: Map<string, DailyScheduleInfo>;
  showOnlyStudyTime?: boolean;
};

export function WeekView({ plans, currentDate, exclusions, academySchedules, dayTypes, dailyScheduleMap, showOnlyStudyTime = false }: WeekViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const weekStart = getWeekStart(currentDate);
  const weekDays: Date[] = [];

  // 주의 7일 생성
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    weekDays.push(date);
  }

  const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

  // 날짜별 플랜 그룹화 (메모이제이션)
  const plansByDate = useMemo(() => {
    const map = new Map<string, PlanWithContent[]>();
    plans.forEach((plan) => {
      const date = plan.plan_date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(plan);
    });
    return map;
  }, [plans]);

  // 날짜별 휴일 그룹화 (메모이제이션)
  const exclusionsByDate = useMemo(() => {
    const map = new Map<string, PlanExclusion[]>();
    exclusions.forEach((exclusion) => {
      const date = exclusion.exclusion_date;
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(exclusion);
    });
    return map;
  }, [exclusions]);

  // 날짜별 학원일정 그룹화 (메모이제이션)
  const academySchedulesByDate = useMemo(() => {
    const map = new Map<string, AcademySchedule[]>();
    weekDays.forEach((date) => {
      const dateStr = formatDateString(date);
      const dayOfWeek = date.getDay();
      // 요일이 일치하는 학원일정 찾기 (0=일요일, 1=월요일, ...)
      const daySchedules = academySchedules.filter(
        (schedule) => schedule.day_of_week === dayOfWeek
      );
      if (daySchedules.length > 0) {
        map.set(dateStr, daySchedules);
      }
    });
    return map;
  }, [academySchedules, weekDays]);

  const formatDate = (date: Date): string => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <>
      <div className="w-full">
        {/* 요일 헤더 (카드 영역 밖 상단) */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekdays.map((day, index) => (
            <div key={index} className="text-center">
              <div className="text-sm font-semibold text-gray-700">
                {day}
              </div>
            </div>
          ))}
        </div>

        {/* 날짜 카드들 */}
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((date, index) => {
          const dateStr = formatDateString(date);
          const dayPlans = plansByDate.get(dateStr) || [];
          const dayExclusions = exclusionsByDate.get(dateStr) || [];
          const dayAcademySchedules = academySchedulesByDate.get(dateStr) || [];
          const dayTypeInfo = dayTypes.get(dateStr);
          const dayType = dayTypeInfo?.type || "normal";
          
          // dayType 기반으로 스타일 결정
          const isHoliday = dayType === "지정휴일" || dayType === "휴가" || dayType === "개인일정" || dayExclusions.length > 0;
          const isStudyDay = dayType === "학습일";
          const isReviewDay = dayType === "복습일";
          const isTodayDate = isToday(date);

          // 배경색 결정
          const bgColorClass = isHoliday
            ? "border-red-300 bg-red-50"
            : isTodayDate
            ? "border-indigo-300 bg-indigo-50"
            : isStudyDay
            ? "border-blue-300 bg-blue-50"
            : isReviewDay
            ? "border-amber-300 bg-amber-50"
            : "border-gray-200 bg-white";

          // 텍스트 색상 결정
          const textColorClass = isHoliday
            ? "text-red-600"
            : isTodayDate
            ? "text-indigo-600"
            : isStudyDay
            ? "text-blue-600"
            : isReviewDay
            ? "text-amber-600"
            : "text-gray-600";

          const boldTextColorClass = isHoliday
            ? "text-red-900"
            : isTodayDate
            ? "text-indigo-900"
            : isStudyDay
            ? "text-blue-900"
            : isReviewDay
            ? "text-amber-900"
            : "text-gray-900";

          // 날짜 타입 배지 스타일
          const dayTypeBadgeClass = isHoliday
            ? "bg-red-100 text-red-800"
            : isStudyDay
            ? "bg-blue-100 text-blue-800"
            : isReviewDay
            ? "bg-amber-100 text-amber-800"
            : "bg-gray-100 text-gray-800";

          const completedPlans = dayPlans.filter((p) => p.progress !== null && p.progress >= 100).length;

          const handleDateClick = () => {
            setSelectedDate(date);
            setIsModalOpen(true);
          };

          return (
            <div
              key={dateStr}
              className={`cursor-pointer rounded-lg border-2 p-2 transition hover:shadow-lg ${bgColorClass}`}
              onClick={handleDateClick}
            >
              {/* 날짜 헤더 */}
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className={`text-lg font-bold ${boldTextColorClass}`}>
                    {date.getDate()}
                  </div>
                  <div className="text-[10px] text-gray-500">{formatDate(date)}</div>
                </div>
                {/* 날짜 타입 배지 - 아이콘만 표시 */}
                {dayTypeInfo && dayType !== "normal" && (
                  <span 
                    className={`rounded-full p-1 text-sm border shadow-sm ${dayTypeBadgeClass}`}
                    title={dayTypeInfo.label}
                  >
                    {dayTypeInfo.icon}
                  </span>
                )}
              </div>

              {/* 플랜 및 학원일정 통계 */}
              {(dayPlans.length > 0 || dayAcademySchedules.length > 0) && (
                <div className="mb-2 rounded-lg bg-white/60 p-2">
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="text-center">
                      <div className="font-bold text-gray-900">{dayPlans.length}</div>
                      <div className="text-gray-500">플랜</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-600">
                        {dayPlans.filter((p) => p.progress !== null && p.progress >= 100).length}
                      </div>
                      <div className="text-gray-500">완료</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto">
                {/* 타임라인 슬롯 표시 (시간 순서대로 정렬) */}
                {(() => {
                  const dailySchedule = dailyScheduleMap.get(dateStr);
                  const timelineSlots = buildTimelineSlots(
                    dateStr,
                    dailySchedule,
                    dayPlans,
                    dayAcademySchedules,
                    dayExclusions
                  );
                  
                  // 시간 순서대로 정렬 (start 시간 기준)
                  const sortedSlots = [...timelineSlots].sort((a, b) => {
                    const aStart = timeToMinutes(a.start);
                    const bStart = timeToMinutes(b.start);
                    return aStart - bStart;
                  });
                  
                  // showOnlyStudyTime 필터링
                  const filteredSlots = showOnlyStudyTime
                    ? sortedSlots.filter((slot) => slot.type === "학습시간")
                    : sortedSlots;
                  
                  if (filteredSlots.length === 0 && dayPlans.length === 0) {
                    return (
                      <div className="py-4 text-center text-xs text-gray-400">
                        플랜 없음
                      </div>
                    );
                  }
                  
                  const items: JSX.Element[] = [];
                  const addedPlanIds = new Set<string>(); // 이미 추가된 플랜 ID 추적
                  
                  filteredSlots.forEach((slot, slotIndex) => {
                    // 학원일정 표시
                    if (slot.type === "학원일정" && slot.academy) {
                      items.push(
                        <div
                          key={`${dateStr}-academy-${slotIndex}-${slot.academy.id}`}
                          className="rounded border-2 border-purple-200 bg-purple-50 p-2 text-xs"
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-sm">🏫</span>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {slot.academy.academy_name || "학원"}
                              </div>
                              <div className="text-gray-600">
                                {slot.start} ~ {slot.end}
                              </div>
                              {slot.academy.subject && (
                                <div className="text-gray-500">{slot.academy.subject}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      return;
                    }
                    
                    // 학습시간인 경우 플랜 표시
                    if (slot.type === "학습시간") {
                      if (slot.plans && slot.plans.length > 0) {
                        slot.plans
                          .sort((a, b) => a.block_index - b.block_index)
                          .forEach((plan) => {
                            // 이미 추가된 플랜은 건너뛰기
                            if (addedPlanIds.has(plan.id)) {
                              return;
                            }
                            addedPlanIds.add(plan.id);

                            items.push(
                              <PlanCard
                                key={`${dateStr}-plan-${plan.id}`}
                                plan={plan}
                                compact={false}
                                showTime={true}
                                showProgress={true}
                              />
                            );
                          });
                      } else {
                        // 학습시간이지만 플랜이 없는 경우
                        items.push(
                          <div
                            key={`${dateStr}-study-empty-${slotIndex}`}
                            className="rounded border border-gray-200 bg-gray-50 p-2 text-xs"
                          >
                            <div className="text-center text-gray-400">
                              {slot.start} ~ {slot.end} 학습시간
                            </div>
                          </div>
                        );
                      }
                      return;
                    }
                    
                    // 점심시간, 이동시간, 자율학습 등 특수 타임슬롯 표시
                    if (slot.type !== "학습시간" && slot.type !== "학원일정") {
                      const colorClass = getTimeSlotColorClass(slot.type);
                      const icon = getTimeSlotIcon(slot.type);
                      
                      items.push(
                        <div
                          key={`${dateStr}-slot-${slotIndex}`}
                          className={`rounded border p-2 text-xs ${colorClass}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{icon}</span>
                            <div className="flex-1">
                              <div className="font-medium">
                                {slot.label || slot.type}
                              </div>
                              <div className="text-xs opacity-75">
                                {slot.start} ~ {slot.end}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  });
                  
                  return items;
                })()}
              </div>
            </div>
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

