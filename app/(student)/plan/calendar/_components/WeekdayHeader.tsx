"use client";

import { memo } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 캘린더 요일 헤더 컴포넌트
 */
function WeekdayHeaderComponent() {
  return (
    <div className="grid grid-cols-7 gap-2 md:gap-3" role="row">
      {WEEKDAYS.map((day) => (
        <div
          key={day}
          role="columnheader"
          className="py-2 md:py-3 text-center text-sm md:text-base font-semibold text-gray-700"
        >
          {day}
        </div>
      ))}
    </div>
  );
}

export const WeekdayHeader = memo(WeekdayHeaderComponent);
