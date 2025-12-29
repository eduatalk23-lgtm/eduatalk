"use client";

import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { DayScheduleItem } from "./DayScheduleItem";
import type { WeeklyScheduleCardProps } from "./types";
import { useCallback } from "react";

/**
 * 주차별 스케줄 카드
 */
export function WeeklyScheduleCard({
  week,
  weekIndex,
  isExpanded,
  isVisible,
  onToggle,
  additionalPeriod,
  weekRef,
}: WeeklyScheduleCardProps) {
  const weekStart = week[0].date;
  const weekEnd = week[week.length - 1].date;

  // 시간 계산 헬퍼 함수 (메모이제이션)
  const calculateTimeFromSlots = useCallback(
    (
      timeSlots: Array<{ type: string; start: string; end: string }> | undefined,
      type: "학습시간" | "자율학습" | "이동시간" | "학원일정"
    ): number => {
      if (!timeSlots) return 0;
      const minutes = timeSlots
        .filter((slot) => slot.type === type)
        .reduce((sum, slot) => {
          const [startHour, startMin] = slot.start.split(":").map(Number);
          const [endHour, endMin] = slot.end.split(":").map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          return sum + (endMinutes - startMinutes);
        }, 0);
      return minutes / 60;
    },
    []
  );

  return (
    <div
      ref={weekRef}
      data-week-index={weekIndex}
      className="overflow-hidden rounded-lg border border-gray-200"
    >
      {/* 주차 헤더 */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-gray-50 p-4 transition-colors hover:bg-gray-100"
      >
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">
            {weekIndex + 1}주차
          </span>
          <span className="text-xs text-gray-600">
            {weekStart} ~ {weekEnd}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-600" />
        )}
      </button>

      {/* 주차 상세 - 지연 로딩: 확장되었거나 화면에 보이는 경우만 렌더링 */}
      {isExpanded && isVisible && (
        <div className="space-y-2 p-4">
          {week.map((day) => {
            // 추가 기간 여부 확인
            const isAdditionalPeriod =
              additionalPeriod &&
              day.date >= additionalPeriod.period_start &&
              day.date <= additionalPeriod.period_end;

            return (
              <DayScheduleItem
                key={day.date}
                day={day}
                isAdditionalPeriod={isAdditionalPeriod || false}
                calculateTimeFromSlots={calculateTimeFromSlots}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
