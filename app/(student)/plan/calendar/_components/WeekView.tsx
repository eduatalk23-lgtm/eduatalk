"use client";

import { useMemo, useState, memo } from "react";
import dynamic from "next/dynamic";
import { Link2 } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule, DailyScheduleInfo } from "@/lib/types/plan";
import { getContentTypeIcon } from "../../_shared/utils/contentTypeUtils";
import { getWeekStart, formatDateString } from "@/lib/date/calendarUtils";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { getTimeSlotColorClass, getTimeSlotIcon, type TimeSlotType } from "../_utils/timelineUtils";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { textPrimary, textSecondary, textMuted, bgSurface, bgPage, borderDefault } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";
import { getDayTypeStyling } from "../_hooks/useDayTypeStyling";
import { useCalendarData } from "../_hooks/useCalendarData";
import { getTimelineSlots } from "../_hooks/useTimelineSlots";
import { usePlanConnections } from "../_hooks/usePlanConnections";

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

  const formatDate = (date: Date): string => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 플랜 연결 그룹화 (공통 훅 사용)
  const { connectedPlanIds } = usePlanConnections(plans);

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

        {/* 날짜 카드들 - 확대된 간격 */}
        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {weekDays.map((date, index) => {
          const dateStr = formatDateString(date);
          const dayPlans = plansByDate.get(dateStr) || [];
          const dayExclusions = exclusionsByDate.get(dateStr) || [];
          const dayAcademySchedules = academySchedulesByDate.get(dateStr) || [];
          const dayTypeInfo = dayTypes.get(dateStr);
          
          // 날짜 타입별 스타일링 (공통 유틸리티 사용)
          const {
            bgColorClass,
            textColorClass,
            boldTextColorClass,
            dayTypeBadgeClass,
          } = getDayTypeStyling(date, dayTypeInfo, dayExclusions);
          
          const isStudyDay = dayTypeInfo?.type === "학습일";
          const isReviewDay = dayTypeInfo?.type === "복습일";
          const isExclusionDay = dayTypeInfo?.type === "지정휴일" || 
                                 dayTypeInfo?.type === "휴가" || 
                                 dayTypeInfo?.type === "개인일정";

          const completedPlans = dayPlans.filter((p) => p.progress != null && p.progress >= 100).length;

          const handleDateClick = () => {
            setSelectedDate(date);
            setIsModalOpen(true);
          };

          return (
            <div
              key={dateStr}
              className={cn("cursor-pointer rounded-lg border-2 p-3 md:p-4 transition-base hover:shadow-[var(--elevation-8)]", bgColorClass)}
              onClick={handleDateClick}
            >
              {/* 날짜 헤더 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className={`text-lg font-bold ${boldTextColorClass}`}>
                    {formatDate(date)}
                  </div>
                  {/* 날짜 타입 표시 - 모든 타입을 동일한 구조로 통일 */}
                  {dayTypeInfo && dayTypeInfo.type !== "normal" && (
                    <div className="flex items-center gap-1">
                      {dayTypeInfo.icon && (
                        <dayTypeInfo.icon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className={`text-xs font-medium ${textColorClass}`}>
                        {dayTypeInfo.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* 제외일 상세 정보 표시 */}
                {isExclusionDay && dayExclusions.length > 0 && dayExclusions[0] && (
                  <div className="flex flex-col gap-0.5 px-2 py-1 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    {dayExclusions[0].exclusion_type && (
                      <span className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
                        {dayExclusions[0].exclusion_type}
                      </span>
                    )}
                    {dayExclusions[0].reason && (
                      <span className="text-[9px] text-orange-600 dark:text-orange-400 line-clamp-1">
                        {dayExclusions[0].reason}
                      </span>
                    )}
                  </div>
                )}

                {/* 플랜 및 학원일정 통계 */}
                {(dayPlans.length > 0 || dayAcademySchedules.length > 0) && (
                  <div className={cn("rounded-lg p-2 bg-white/60 dark:bg-gray-800/60")}>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="text-center">
                        <div className={cn("font-bold", textPrimary)}>{dayPlans.length}</div>
                        <div className={textMuted}>플랜</div>
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
                  
                  // 타임라인 슬롯 생성 및 정렬/필터링 (공통 유틸리티 사용)
                  const { filteredSlots } = getTimelineSlots(
                    dateStr,
                    dailySchedule,
                    dayPlans,
                    dayAcademySchedules,
                    dayExclusions,
                    showOnlyStudyTime
                  );
                  
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
                            {(() => {
                              const AcademyIcon = getTimeSlotIcon("학원일정");
                              return <AcademyIcon className="w-4 h-4 shrink-0" />;
                            })()}
                            <div className="flex-1">
                              <div className={cn("font-medium", textPrimary)}>
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

                            const ContentTypeIcon = getContentTypeIcon(plan.content_type);
                            const isCompleted = plan.progress != null && plan.progress >= 100;
                            const isActive = plan.actual_start_time && !plan.actual_end_time;
                            
                            // 플랜 카드 스타일
                            const cardBorderClass = isCompleted
                              ? "border-green-300 bg-green-50"
                              : isActive
                              ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30"
                              : cn(bgSurface, borderDefault);

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
                                    <div className={cn("font-semibold", textPrimary)}>
                                      {plan.start_time}
                                    </div>
                                  )}
                                  {/* 2행: 아이콘 + 교과 + 회차 */}
                                  <div className="flex items-center gap-1">
                                    <ContentTypeIcon className="w-4 h-4 shrink-0" />
                                  {plan.contentSubjectCategory && (
                                    <span className={cn("font-medium", textSecondary)}>
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
                            className={cn("rounded border p-2 text-xs", bgPage, borderDefault)}
                          >
                            <div className={cn("text-center", textMuted)}>
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
                      const IconComponent = getTimeSlotIcon(slot.type);
                      
                      items.push(
                        <div
                          key={`${dateStr}-slot-${slotIndex}`}
                          className={`rounded border p-2 text-xs ${colorClass}`}
                        >
                          <div className="flex items-center gap-1">
                            <IconComponent className="w-4 h-4 shrink-0" />
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

