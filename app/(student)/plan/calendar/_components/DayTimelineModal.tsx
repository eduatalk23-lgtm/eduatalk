"use client";

import { Dialog } from "@/components/ui/Dialog";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule, DailyScheduleInfo } from "@/lib/types/plan";
import { formatDateFull, formatDateString } from "@/lib/date/calendarUtils";
import { getTimeSlotColorClass, getTimeSlotIcon, timeToMinutes } from "../_utils/timelineUtils";
import { CalendarPlanCard } from "./CalendarPlanCard";
import { StatCard } from "./StatCard";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { textPrimary, textSecondary, textTertiary, textMuted, bgSurface, borderDefault } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";
import { getDayTypeStyling } from "../_hooks/useDayTypeStyling";
import { getTimelineSlots } from "../_hooks/useTimelineSlots";

type DayTimelineModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  plans: PlanWithContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dayTypeInfo?: DayTypeInfo;
  dailySchedule?: DailyScheduleInfo;
};

export function DayTimelineModal({
  open,
  onOpenChange,
  date,
  plans,
  exclusions,
  academySchedules,
  dayTypeInfo,
  dailySchedule,
}: DayTimelineModalProps) {
  const dateStr = formatDateString(date);
  
  // 해당 날짜의 학원일정 (요일 기반)
  const dayOfWeek = date.getDay();
  const dayAcademySchedules = academySchedules.filter(
    (schedule) => schedule.day_of_week === dayOfWeek
  );

  // 해당 날짜의 휴일
  const dayExclusions = exclusions.filter(
    (exclusion) => exclusion.exclusion_date === dateStr
  );

  // 타임라인 슬롯 생성 및 정렬/필터링 (공통 유틸리티 사용)
  const { sortedSlots } = getTimelineSlots(
    dateStr,
    dailySchedule,
    plans,
    dayAcademySchedules,
    dayExclusions,
    false // 모달에서는 항상 전체 표시
  );

  // 통계 계산 - binary completion (status + actual_end_time)
  const totalPlans = plans.length;
  const completedPlans = plans.filter((p) => p.status === "completed" || p.actual_end_time != null).length;
  const activePlans = plans.filter((p) => p.actual_start_time && !p.actual_end_time).length;
  const averageProgress = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

  // 날짜 타입별 스타일링 (공통 유틸리티 사용)
  const {
    dayTypeBadgeClass,
  } = getDayTypeStyling(date, dayTypeInfo, dayExclusions);

  const description = dayTypeInfo && dayTypeInfo.type !== "normal" ? (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-3 py-1 text-sm font-medium ${dayTypeBadgeClass}`}>
{dayTypeInfo.icon && <dayTypeInfo.icon className="w-4 h-4 shrink-0" />} {dayTypeInfo.label}
      </span>
      {dayExclusions.length > 0 && dayExclusions[0].exclusion_type && (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          ({dayExclusions[0].exclusion_type})
        </span>
      )}
    </div>
  ) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatDateFull(date)}
      maxWidth="4xl"
    >
      <div className="flex w-full max-h-[90vh] flex-col gap-6 overflow-hidden px-6 py-4">
          {/* 통계 */}
          {(totalPlans > 0 || dayAcademySchedules.length > 0) && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {totalPlans > 0 && (
                <>
                  <StatCard label="총 플랜" value={totalPlans} color="gray" />
                  <StatCard label="완료" value={completedPlans} color="green" />
                  {activePlans > 0 && (
                    <StatCard label="진행중" value={activePlans} color="blue" />
                  )}
                  {averageProgress > 0 && (
                    <StatCard label="평균 진행률" value={`${averageProgress}%`} color="indigo" />
                  )}
                </>
              )}
              {dayAcademySchedules.length > 0 && (
                <StatCard label="학원 일정" value={dayAcademySchedules.length} color="purple" />
              )}
            </div>
          )}

          {/* 타임라인 콘텐츠 */}
          <div className="max-h-[calc(90vh-200px)] overflow-y-auto p-6">
            <div className="flex flex-col gap-3">
              {sortedSlots.length === 0 ? (
                plans.length === 0 ? (
                  <div className={cn("flex flex-col gap-2 py-12 text-center", textMuted)}>
                    <div className="text-4xl">📅</div>
                    <div className="text-lg font-medium">이 날짜에는 플랜이 없습니다</div>
                  </div>
                ) : (
                  // plans는 있지만 타임라인 슬롯이 생성되지 않은 경우 (시간 정보가 없는 플랜)
                  <div className="flex flex-col gap-3">
                    {plans.map((plan) => (
                      <CalendarPlanCard
                        key={plan.id}
                        plan={plan}
                        compact={false}
                        showTime={true}
                        showProgress={true}
                      />
                    ))}
                  </div>
                )
              ) : (
                sortedSlots.map((slot, index) => {
                  // 학원일정 표시
                  if (slot.type === "학원일정" && slot.academy) {
                    const colorClass = getTimeSlotColorClass(slot.type);
                    const IconComponent = getTimeSlotIcon(slot.type);

                    return (
                      <div
                        key={`slot-${index}-academy`}
                        className={`rounded-lg border-2 p-4 ${colorClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="w-6 h-6 shrink-0" />
                          <div className="flex flex-1 flex-col gap-1">
                            <div className={cn("font-semibold", textPrimary)}>
                              {slot.academy.academy_name || "학원"}
                            </div>
                            <div className={cn("text-sm", textTertiary)}>
                              {slot.start} ~ {slot.end}
                            </div>
                            {slot.academy.subject && (
                              <div className={cn("text-sm", textMuted)}>
                                {slot.academy.subject}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 학습시간인 경우 플랜 표시
                  if (slot.type === "학습시간") {
                    if (slot.plans && slot.plans.length > 0) {
                      return (
                        <div
                          key={`slot-${index}-study`}
                          className={cn("flex flex-col gap-3 rounded-lg border p-4", borderDefault, bgSurface)}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn("font-semibold", textPrimary)}>
                              {slot.start} ~ {slot.end}
                            </div>
                            <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-800 dark:text-blue-300">
                              학습시간
                            </span>
                          </div>
                          <div className="flex flex-col gap-3">
                            {slot.plans
                              .sort((a, b) => a.block_index - b.block_index)
                              .map((plan) => (
                                <CalendarPlanCard
                                  key={plan.id}
                                  plan={plan}
                                  compact={false}
                                  showTime={true}
                                  showProgress={true}
                                />
                              ))}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={`slot-${index}-study-empty`}
                          className={cn("rounded-lg border p-4", borderDefault, "bg-gray-50 dark:bg-gray-900/50")}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn("font-medium", textSecondary)}>
                              {slot.start} ~ {slot.end}
                            </div>
                            <span className={cn("text-sm", textMuted)}>플랜 없음</span>
                          </div>
                        </div>
                      );
                    }
                  }

                  // 점심시간, 이동시간, 자율학습 등 특수 타임슬롯 표시
                  // (학습시간과 학원일정은 위에서 이미 처리됨)
                  {
                    const colorClass = getTimeSlotColorClass(slot.type);
                    const IconComponent = getTimeSlotIcon(slot.type);

                    return (
                      <div
                        key={`slot-${index}-${slot.type}`}
                        className={`rounded-lg border p-4 ${colorClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="w-6 h-6 shrink-0" />
                          <div className="flex flex-1 flex-col gap-1">
                            <div className={cn("font-semibold", textPrimary)}>{slot.label || slot.type}</div>
                            <div className={cn("text-sm opacity-75", textTertiary)}>
                              {slot.start} ~ {slot.end}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })
              )}
            </div>
          </div>
      </div>
    </Dialog>
  );
}

