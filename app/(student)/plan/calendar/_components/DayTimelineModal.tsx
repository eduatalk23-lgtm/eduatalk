"use client";

import { Dialog } from "@/components/ui/Dialog";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule, DailyScheduleInfo } from "@/lib/types/plan";
import { formatDateFull, formatDateString } from "@/lib/date/calendarUtils";
import { buildTimelineSlots, getTimeSlotColorClass, getTimeSlotIcon, timeToMinutes } from "../_utils/timelineUtils";
import { PlanCard } from "./PlanCard";
import { StatCard } from "./StatCard";
import { DAY_TYPE_INFO } from "@/lib/date/calendarDayTypes";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";

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

  // 타임라인 슬롯 생성
  const timelineSlots = buildTimelineSlots(
    dateStr,
    dailySchedule,
    plans,
    dayAcademySchedules,
    dayExclusions
  );

  // 시간 순서대로 정렬
  const sortedSlots = [...timelineSlots].sort((a, b) => {
    const aStart = timeToMinutes(a.start);
    const bStart = timeToMinutes(b.start);
    return aStart - bStart;
  });

  // 통계 계산
  const totalPlans = plans.length;
  const completedPlans = plans.filter((p) => p.progress !== null && p.progress >= 100).length;
  const activePlans = plans.filter((p) => p.actual_start_time && !p.actual_end_time).length;
  const averageProgress =
    totalPlans > 0
      ? Math.round(plans.reduce((sum, p) => sum + (p.progress || 0), 0) / totalPlans)
      : 0;

  const dayType = dayTypeInfo?.type || "normal";
  const isHoliday = dayType === "지정휴일" || dayType === "휴가" || dayType === "개인일정" || dayExclusions.length > 0;
  const isStudyDay = dayType === "학습일";
  const isReviewDay = dayType === "복습일";

  const bgColorClass = isHoliday
    ? "border-red-300 bg-red-50"
    : isStudyDay
    ? "border-blue-300 bg-blue-50"
    : isReviewDay
    ? "border-amber-300 bg-amber-50"
    : "border-gray-200 bg-white";

  const dayTypeBadgeClass = isHoliday
    ? "bg-red-100 text-red-800"
    : isStudyDay
    ? "bg-blue-100 text-blue-800"
    : isReviewDay
    ? "bg-amber-100 text-amber-800"
    : "bg-gray-100 text-gray-800";

  const description = dayTypeInfo && dayType !== "normal" ? (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-3 py-1 text-sm font-medium ${dayTypeBadgeClass}`}>
        {dayTypeInfo.icon} {dayTypeInfo.label}
      </span>
      {dayExclusions.length > 0 && dayExclusions[0].exclusion_type && (
        <span className="text-sm text-gray-600">
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
      description={description}
      maxWidth="4xl"
    >
      <div className="w-full max-h-[90vh] overflow-hidden">
          {/* 통계 */}
          {(totalPlans > 0 || dayAcademySchedules.length > 0) && (
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
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
                  <div className="py-12 text-center text-gray-400">
                    <div className="text-4xl mb-2">📅</div>
                    <div className="text-lg font-medium">이 날짜에는 플랜이 없습니다</div>
                  </div>
                ) : (
                  // plans는 있지만 타임라인 슬롯이 생성되지 않은 경우 (시간 정보가 없는 플랜)
                  <div className="flex flex-col gap-3">
                    {plans.map((plan) => (
                      <PlanCard
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
                    const icon = getTimeSlotIcon(slot.type);

                    return (
                      <div
                        key={`slot-${index}-academy`}
                        className={`rounded-lg border-2 p-4 ${colorClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{icon}</span>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">
                              {slot.academy.academy_name || "학원"}
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {slot.start} ~ {slot.end}
                            </div>
                            {slot.academy.subject && (
                              <div className="mt-1 text-sm text-gray-500">
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
                          className="rounded-lg border border-gray-200 bg-white p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <div className="font-semibold text-gray-900">
                              {slot.start} ~ {slot.end}
                            </div>
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                              학습시간
                            </span>
                          </div>
                          <div className="flex flex-col gap-3">
                            {slot.plans
                              .sort((a, b) => a.block_index - b.block_index)
                              .map((plan) => (
                                <PlanCard
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
                          className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-gray-700">
                              {slot.start} ~ {slot.end}
                            </div>
                            <span className="text-sm text-gray-400">플랜 없음</span>
                          </div>
                        </div>
                      );
                    }
                  }

                  // 점심시간, 이동시간, 자율학습 등 특수 타임슬롯 표시
                  if (slot.type !== "학습시간" && slot.type !== "학원일정") {
                    const colorClass = getTimeSlotColorClass(slot.type);
                    const icon = getTimeSlotIcon(slot.type);

                    return (
                      <div
                        key={`slot-${index}-${slot.type}`}
                        className={`rounded-lg border p-4 ${colorClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{icon}</span>
                          <div className="flex-1">
                            <div className="font-semibold">{slot.label || slot.type}</div>
                            <div className="mt-1 text-sm opacity-75">
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

