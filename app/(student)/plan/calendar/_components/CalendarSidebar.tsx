"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MiniCalendar } from "./MiniCalendar";
import { WeeklySummary } from "./WeeklySummary";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { PlanWithContent } from "../_types/plan";

type CalendarSidebarProps = {
  plans: PlanWithContent[];
  minDate: string;
  maxDate: string;
  initialDate: string;
};

/**
 * 캘린더 사이드바
 *
 * 미니 캘린더와 주간 요약을 포함하는 사이드바입니다.
 */
export function CalendarSidebar({
  plans,
  minDate,
  maxDate,
  initialDate,
}: CalendarSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL에서 현재 날짜 읽기
  const urlDate = searchParams.get("date");
  const currentDateStr = urlDate || initialDate;
  const currentDate = new Date(currentDateStr + "T00:00:00");

  // 날짜 선택 핸들러
  const handleDateSelect = useCallback(
    (date: Date) => {
      const dateStr = formatDateString(date);
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", dateStr);
      params.set("view", "day"); // 날짜 선택 시 일별 보기로 전환
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-col gap-4">
      <MiniCalendar
        currentDate={currentDate}
        onDateSelect={handleDateSelect}
        plans={plans}
        minDate={minDate}
        maxDate={maxDate}
      />
      <WeeklySummary plans={plans} currentDate={currentDate} />
    </div>
  );
}
