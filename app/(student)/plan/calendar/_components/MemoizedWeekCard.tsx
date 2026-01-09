"use client";

/**
 * 메모이제이션된 주간 뷰 카드 컴포넌트
 *
 * WeekView의 개별 날짜 카드를 분리하여 불필요한 리렌더링을 방지합니다.
 */

import { memo, useMemo } from "react";
import { Link2 } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, DailyScheduleInfo, AcademySchedule } from "@/lib/types/plan";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import { getContentTypeIcon } from "../../_shared/utils/contentTypeUtils";
import { getTimeSlotColorClass, getTimeSlotIcon } from "../_utils/timelineUtils";
import { getDayTypeStyling } from "../_hooks/useDayTypeStyling";
import { getTimelineSlots } from "../_hooks/useTimelineSlots";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted, bgSurface, bgPage, borderDefault } from "@/lib/utils/darkMode";

type MemoizedWeekCardProps = {
  date: Date;
  dateStr: string;
  dayPlans: PlanWithContent[];
  dayExclusions: PlanExclusion[];
  dayAcademySchedules: AcademySchedule[];
  dayTypeInfo?: DayTypeInfo;
  dailySchedule?: DailyScheduleInfo;
  showOnlyStudyTime: boolean;
  connectedPlanIds: Set<string>;
  onDateClick: () => void;
};

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function MemoizedWeekCardComponent({
  date,
  dateStr,
  dayPlans,
  dayExclusions,
  dayAcademySchedules,
  dayTypeInfo,
  dailySchedule,
  showOnlyStudyTime,
  connectedPlanIds,
  onDateClick,
}: MemoizedWeekCardProps) {
  // 날짜 타입별 스타일링 (공통 유틸리티 사용)
  const { bgColorClass, textColorClass, boldTextColorClass } = useMemo(
    () => getDayTypeStyling(date, dayTypeInfo, dayExclusions),
    [date, dayTypeInfo, dayExclusions]
  );

  const isExclusionDay =
    dayTypeInfo?.type === "지정휴일" ||
    dayTypeInfo?.type === "휴가" ||
    dayTypeInfo?.type === "개인일정";

  // 타임라인 슬롯 생성 (메모이제이션)
  const { filteredSlots } = useMemo(
    () =>
      getTimelineSlots(
        dateStr,
        dailySchedule,
        dayPlans,
        dayAcademySchedules,
        dayExclusions,
        showOnlyStudyTime
      ),
    [dateStr, dailySchedule, dayPlans, dayAcademySchedules, dayExclusions, showOnlyStudyTime]
  );

  // 타임라인 아이템 렌더링 (메모이제이션)
  const timelineItems = useMemo(() => {
    if (filteredSlots.length === 0 && dayPlans.length === 0) {
      return (
        <div className="py-4 text-center text-xs text-gray-400">플랜 없음</div>
      );
    }

    const items: React.ReactElement[] = [];
    const addedPlanIds = new Set<string>();

    filteredSlots.forEach((slot, slotIndex) => {
      // 학원일정 표시
      if (slot.type === "학원일정" && slot.academy) {
        const AcademyIcon = getTimeSlotIcon("학원일정");
        items.push(
          <div
            key={`${dateStr}-academy-${slotIndex}-${slot.academy.id}`}
            className="rounded border-2 border-purple-200 bg-purple-50 p-2 text-xs"
          >
            <div className="flex items-center gap-1">
              <AcademyIcon className="w-4 h-4 shrink-0" />
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
              if (addedPlanIds.has(plan.id)) return;
              addedPlanIds.add(plan.id);

              const ContentTypeIcon = getContentTypeIcon(plan.content_type);
              const isCompleted = plan.progress != null && plan.progress >= 100;
              const isActive = plan.actual_start_time && !plan.actual_end_time;
              const isConnected = connectedPlanIds.has(plan.id);

              const cardBorderClass = isCompleted
                ? "border-green-300 bg-green-50"
                : isActive
                  ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30"
                  : cn(bgSurface, borderDefault);

              items.push(
                <div
                  key={`${dateStr}-plan-${plan.id}`}
                  className={`rounded border p-2 text-xs relative ${cardBorderClass}`}
                >
                  <div className="flex flex-col gap-1">
                    {plan.start_time && (
                      <div className={cn("font-semibold", textPrimary)}>
                        {plan.start_time}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <ContentTypeIcon className="w-4 h-4 shrink-0" />
                      {plan.contentSubjectCategory && (
                        <span className={cn("font-medium", textSecondary)}>
                          {plan.contentSubjectCategory}
                        </span>
                      )}
                      {plan.contentEpisode && (
                        <span className="text-gray-600">{plan.contentEpisode}</span>
                      )}
                    </div>
                  </div>
                  {plan.contentSubject && (
                    <div className="text-gray-600">{plan.contentSubject}</div>
                  )}
                  {isConnected && (
                    <div className="absolute top-1.5 right-1.5">
                      <Link2 size={14} className="text-indigo-500 opacity-70" strokeWidth={2} />
                    </div>
                  )}
                </div>
              );
            });
        } else {
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
              <div className="font-medium">{slot.label || slot.type}</div>
              <div className="text-xs opacity-75">
                {slot.start} ~ {slot.end}
              </div>
            </div>
          </div>
        </div>
      );
    });

    return items;
  }, [filteredSlots, dayPlans.length, dateStr, connectedPlanIds]);

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg border-2 p-3 md:p-4 transition-base hover:shadow-[var(--elevation-8)]",
        bgColorClass
      )}
      onClick={onDateClick}
    >
      {/* 날짜 헤더 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className={`text-lg font-bold ${boldTextColorClass}`}>{formatDate(date)}</div>
          {dayTypeInfo && dayTypeInfo.type !== "normal" && (
            <div className="flex items-center gap-1">
              {dayTypeInfo.icon && <dayTypeInfo.icon className="w-3.5 h-3.5 shrink-0" />}
              <span className={`text-xs font-medium ${textColorClass}`}>{dayTypeInfo.label}</span>
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

      <div className="flex flex-col gap-1.5">{timelineItems}</div>
    </div>
  );
}

/**
 * 메모이제이션된 주간 뷰 카드
 *
 * props 비교 함수를 사용하여 실제 데이터 변경 시에만 리렌더링합니다.
 */
export const MemoizedWeekCard = memo(
  MemoizedWeekCardComponent,
  (prevProps, nextProps) => {
    // 기본 속성 비교
    if (
      prevProps.dateStr !== nextProps.dateStr ||
      prevProps.showOnlyStudyTime !== nextProps.showOnlyStudyTime
    ) {
      return false;
    }

    // dayPlans 배열 비교
    if (prevProps.dayPlans.length !== nextProps.dayPlans.length) {
      return false;
    }
    for (let i = 0; i < prevProps.dayPlans.length; i++) {
      const prevPlan = prevProps.dayPlans[i];
      const nextPlan = nextProps.dayPlans[i];
      if (
        prevPlan.id !== nextPlan.id ||
        prevPlan.progress !== nextPlan.progress ||
        prevPlan.status !== nextPlan.status
      ) {
        return false;
      }
    }

    // dayExclusions 배열 비교
    if (prevProps.dayExclusions.length !== nextProps.dayExclusions.length) {
      return false;
    }

    // dayAcademySchedules 배열 비교
    if (prevProps.dayAcademySchedules.length !== nextProps.dayAcademySchedules.length) {
      return false;
    }

    // dayTypeInfo 비교
    if (
      prevProps.dayTypeInfo?.type !== nextProps.dayTypeInfo?.type ||
      prevProps.dayTypeInfo?.label !== nextProps.dayTypeInfo?.label
    ) {
      return false;
    }

    // connectedPlanIds Set 크기 비교 (깊은 비교는 비용이 크므로 크기만 비교)
    if (prevProps.connectedPlanIds.size !== nextProps.connectedPlanIds.size) {
      return false;
    }

    return true;
  }
);
