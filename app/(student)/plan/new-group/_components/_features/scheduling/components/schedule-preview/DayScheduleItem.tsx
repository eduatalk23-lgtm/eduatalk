"use client";

import { Clock } from "lucide-react";
import { TimelineBar } from "../TimelineBar";
import { dayTypeLabels, dayTypeColors } from "./constants";
import type { DayScheduleItemProps } from "./types";

/**
 * 일별 스케줄 아이템
 */
export function DayScheduleItem({
  day,
  isAdditionalPeriod,
  calculateTimeFromSlots,
}: DayScheduleItemProps) {
  // 시간 슬롯에서 각 타입별 시간 계산
  const isDesignatedHoliday = day.day_type === "지정휴일";
  const studyHours = calculateTimeFromSlots(day.time_slots, "학습시간");
  const selfStudyHours = isDesignatedHoliday
    ? day.study_hours
    : calculateTimeFromSlots(day.time_slots, "자율학습");
  const travelHours = calculateTimeFromSlots(day.time_slots, "이동시간");
  const academyHours = calculateTimeFromSlots(day.time_slots, "학원일정");
  const totalHours = studyHours + selfStudyHours + travelHours + academyHours;

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        isAdditionalPeriod
          ? "border-purple-300 bg-purple-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-900">{day.date}</div>
          <div
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              dayTypeColors[day.day_type] ||
              "border-gray-200 bg-gray-100 text-gray-800"
            }`}
          >
            {dayTypeLabels[day.day_type] || day.day_type}
          </div>
          {isAdditionalPeriod && (
            <div className="rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
              추가 기간
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Clock className="h-3 w-3" />
          <span>
            {day.study_hours > 0
              ? `${Math.round(day.study_hours)}시간`
              : "학습 없음"}
          </span>
        </div>
      </div>

      {/* 타임라인 바 그래프 */}
      {day.time_slots && day.time_slots.length > 0 && (
        <TimelineBar timeSlots={day.time_slots} totalHours={totalHours} />
      )}
    </div>
  );
}
