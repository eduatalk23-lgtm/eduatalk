"use client";

import { useMemo, useState, memo } from "react";
import dynamic from "next/dynamic";
import { Link2 } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule, DailyScheduleInfo } from "@/lib/types/plan";
import { CONTENT_TYPE_EMOJIS } from "../_constants/contentIcons";
import { getWeekStart, formatDateString, isToday } from "@/lib/date/calendarUtils";
import { DAY_TYPE_INFO } from "@/lib/date/calendarDayTypes";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { buildTimelineSlots, getTimeSlotColorClass, getTimeSlotIcon, timeToMinutes, type TimeSlotType } from "../_utils/timelineUtils";
import { getDayTypeColor } from "@/lib/constants/colors";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

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

type PlanConnection = {
  planIds: string[];
  groupKey: string;
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

  // 같은 플랜의 동일 회차를 그룹화 (plan_number 또는 content_id + sequence 기준)
  const planConnections = useMemo(() => {
    const connectionMap = new Map<string, PlanConnection>();
    
    plans.forEach((plan) => {
      // 그룹 키 생성: plan_number가 있으면 사용, 없으면 content_id + sequence 조합
      const groupKey = plan.plan_number !== null && plan.plan_number !== undefined
        ? `plan_number_${plan.plan_number}`
        : plan.sequence !== null && plan.sequence !== undefined
        ? `content_${plan.content_id}_seq_${plan.sequence}`
        : null;
      
      if (!groupKey) return;
      
      if (!connectionMap.has(groupKey)) {
        connectionMap.set(groupKey, {
          planIds: [],
          groupKey,
        });
      }
      
      connectionMap.get(groupKey)!.planIds.push(plan.id);
    });
    
    // 2개 이상의 플랜이 있는 그룹만 반환
    return Array.from(connectionMap.values()).filter(
      (conn) => conn.planIds.length >= 2
    );
  }, [plans]);

  // 연결된 플랜 ID Set 생성 (빠른 조회를 위해)
  const connectedPlanIds = useMemo(() => {
    const ids = new Set<string>();
    planConnections.forEach((conn) => {
      conn.planIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [planConnections]);

  return (
    <>
      <div className="w-full flex flex-col gap-2">
        {/* 요일 헤더 (카드 영역 밖 상단) */}
        <div className="grid grid-cols-7 gap-2">
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
          const isTodayDate = isToday(date);
          const isStudyDay = dayType === "학습일";
          const isReviewDay = dayType === "복습일";
          
          // 날짜 타입 색상 가져오기
          const dayTypeColor = getDayTypeColor(
            isHoliday ? "지정휴일" : dayType,
            isTodayDate
          );

          const bgColorClass = `${dayTypeColor.border} ${dayTypeColor.bg}`;
          const textColorClass = dayTypeColor.text;
          const boldTextColorClass = dayTypeColor.boldText;
          const dayTypeBadgeClass = dayTypeColor.badge;

          const completedPlans = dayPlans.filter((p) => p.progress != null && p.progress >= 100).length;

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
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className={`text-lg font-bold ${boldTextColorClass}`}>
                    {formatDate(date)}
                  </div>
                  {/* 학습일/복습일일 때 아이콘 + 텍스트 표시 */}
                  {(isStudyDay || isReviewDay) && dayTypeInfo && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{dayTypeInfo.icon}</span>
                      <span className={`text-xs font-medium ${textColorClass}`}>
                        {dayTypeInfo.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* 플랜 및 학원일정 통계 */}
                {(dayPlans.length > 0 || dayAcademySchedules.length > 0) && (
                  <div className="rounded-lg bg-white/60 p-2">
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="text-center">
                        <div className="font-bold text-gray-900">{dayPlans.length}</div>
                        <div className="text-gray-500">플랜</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-green-600">
                          {dayPlans.filter((p) => p.progress != null && p.progress >= 100).length}
                        </div>
                        <div className="text-gray-500">완료</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
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
                  
                  const items: React.ReactElement[] = [];
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

                            const contentTypeIcon = CONTENT_TYPE_EMOJIS[plan.content_type] || "📚";
                            const isCompleted = plan.progress != null && plan.progress >= 100;
                            const isActive = plan.actual_start_time && !plan.actual_end_time;
                            
                            // 플랜 카드 스타일
                            const cardBorderClass = isCompleted
                              ? "border-green-300 bg-green-50"
                              : isActive
                              ? "border-blue-300 bg-blue-50"
                              : "border-gray-200 bg-white";

                            // 연결된 플랜인지 확인
                            const isConnected = connectedPlanIds.has(plan.id);
                            
                            items.push(
                              <div
                                key={`${dateStr}-plan-${plan.id}`}
                                className={`rounded border p-2 text-xs relative ${cardBorderClass}`}
                              >
                                <div className="flex flex-col gap-1">
                                  {/* 1행: 플랜 시작시간 */}
                                  {plan.start_time && (
                                    <div className="font-semibold text-gray-900">
                                      {plan.start_time}
                                    </div>
                                  )}
                                  {/* 2행: 아이콘 + 교과 + 회차 */}
                                  <div className="flex items-center gap-1">
                                  <span className="text-sm">{contentTypeIcon}</span>
                                  {plan.contentSubjectCategory && (
                                    <span className="font-medium text-gray-700">
                                      {plan.contentSubjectCategory}
                                    </span>
                                  )}
                                  {plan.contentEpisode && (
                                    <span className="text-gray-600">
                                      {plan.contentEpisode}
                                    </span>
                                  )}
                                  </div>
                                </div>
                                {/* 3행: 과목 */}
                                {plan.contentSubject && (
                                  <div className="text-gray-600">
                                    {plan.contentSubject}
                                  </div>
                                )}
                                {/* 연결 아이콘 (오른쪽 상단) */}
                                {isConnected && (
                                  <div className="absolute top-1.5 right-1.5">
                                    <Link2 
                                      size={14} 
                                      className="text-indigo-500 opacity-70" 
                                      strokeWidth={2}
                                    />
                                  </div>
                                )}
                              </div>
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
                    // (학습시간과 학원일정은 위에서 이미 처리됨)
                    {
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

