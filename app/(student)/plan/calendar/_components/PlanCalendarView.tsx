"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from "lucide-react";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import { formatMonthYear, formatWeekRangeShort, formatDay, parseDateString } from "@/lib/date/calendarUtils";
import { buildDayTypesFromDailySchedule } from "@/lib/date/calendarDayTypes";
import { useMemo } from "react";
import type { DailyScheduleInfo } from "@/lib/types/plan";

type PlanCalendarViewProps = {
  plans: PlanWithContent[];
  view: "month" | "week" | "day";
  minDate: string;
  maxDate: string;
  initialDate: string;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dailySchedules: DailyScheduleInfo[][]; // 플랜 그룹들의 daily_schedule 배열
};

/**
 * 날짜별 daily_schedule 맵 생성
 * 같은 날짜에 여러 플랜 그룹이 있으면 합치기 (우선순위 반영)
 */
function buildDailyScheduleMap(
  dailySchedules: DailyScheduleInfo[][]
): Map<string, DailyScheduleInfo> {
  const map = new Map<string, DailyScheduleInfo>();

  // 모든 daily_schedule을 순회하며 날짜별로 합치기
  dailySchedules.forEach((scheduleArray) => {
    scheduleArray.forEach((daily) => {
      const dateStr = daily.date.slice(0, 10);
      const existing = map.get(dateStr);

      // 기존 항목이 없거나, 더 나중에 생성된 항목이 우선
      // (같은 날짜에 여러 플랜 그룹이 있으면 나중 것을 우선)
      if (!existing) {
        map.set(dateStr, daily);
      } else {
        // time_slots가 더 많은 것을 우선
        if (daily.time_slots && daily.time_slots.length > 0) {
          map.set(dateStr, daily);
        }
      }
    });
  });

  return map;
}

export function PlanCalendarView({
  plans,
  view: initialView,
  minDate,
  maxDate,
  initialDate,
  exclusions,
  academySchedules,
  dailySchedules,
}: PlanCalendarViewProps) {
  // initialDate를 Date 객체로 변환 (YYYY-MM-DD 형식)
  // 로컬 타임존 기준으로 파싱하여 날짜가 변경되지 않도록 합니다.
  const initialDateObj = parseDateString(initialDate);
  const [currentDate, setCurrentDate] = useState(initialDateObj);
  const [view, setView] = useState<"month" | "week" | "day">(initialView);
  const [showOnlyStudyTime, setShowOnlyStudyTime] = useState(false);

  // 플랜 그룹의 daily_schedule에서 날짜별 일정 타입 정보 생성
  // Step7에서 생성된 정보를 그대로 사용 (재계산 불필요)
  // 단, 제외일은 실제 제외일 목록(exclusions)에 있는 것만 표시
  const dayTypes = useMemo(() => {
    return buildDayTypesFromDailySchedule(dailySchedules, exclusions);
  }, [dailySchedules, exclusions]);

  // 날짜별 daily_schedule 맵 생성 (타임라인 정보 포함)
  const dailyScheduleMap = useMemo(() => {
    return buildDailyScheduleMap(dailySchedules);
  }, [dailySchedules]);

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white shadow-lg">
      {/* 헤더 */}
      <div className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* 왼쪽: 날짜 네비게이션 */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPrevious}
              aria-label="이전 기간으로 이동"
              className="rounded-lg p-2 text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:scale-110 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              {view === "month"
                ? formatMonthYear(currentDate)
                : view === "week"
                ? formatWeekRangeShort(currentDate)
                : formatDay(currentDate)}
            </h2>
            <button
              onClick={goToNext}
              aria-label="다음 기간으로 이동"
              className="rounded-lg p-2 text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:scale-110 active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              onClick={goToToday}
              aria-label="오늘 날짜로 이동"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-indigo-700 hover:shadow-lg active:scale-95"
            >
              오늘
            </button>
          </div>

          {/* 오른쪽: 뷰 전환 및 필터 */}
          <div className="flex items-center gap-3">
            {/* 뷰 전환 버튼 그룹 */}
            <div className="flex rounded-lg border-2 border-gray-200 bg-gray-50 p-1 shadow-sm">
              <button
                onClick={() => setView("month")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  view === "month"
                    ? "bg-white text-indigo-600 shadow-md scale-105"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <CalendarIcon className="mr-1.5 inline h-4 w-4" />
                월별
              </button>
              <button
                onClick={() => setView("week")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  view === "week"
                    ? "bg-white text-indigo-600 shadow-md scale-105"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                주별
              </button>
              <button
                onClick={() => setView("day")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  view === "day"
                    ? "bg-white text-indigo-600 shadow-md scale-105"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                일별
              </button>
            </div>

            {/* 필터 버튼 */}
            <button
              onClick={() => setShowOnlyStudyTime(!showOnlyStudyTime)}
              className={`flex items-center gap-2 rounded-lg border-2 bg-white px-4 py-2 text-sm font-semibold transition-all duration-200 hover:shadow-md active:scale-95 ${
                showOnlyStudyTime 
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm" 
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              title={showOnlyStudyTime ? "모든 타임슬롯 표시" : "학습시간만 표시"}
            >
              <Filter className="h-4 w-4" />
              <span>{showOnlyStudyTime ? "전체" : "학습시간만"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 캘린더 뷰 */}
      <div className="p-4">
        {view === "month" ? (
          <MonthView plans={plans} currentDate={currentDate} exclusions={exclusions} academySchedules={academySchedules} dayTypes={dayTypes} dailyScheduleMap={dailyScheduleMap} showOnlyStudyTime={showOnlyStudyTime} />
        ) : view === "week" ? (
          <WeekView plans={plans} currentDate={currentDate} exclusions={exclusions} academySchedules={academySchedules} dayTypes={dayTypes} dailyScheduleMap={dailyScheduleMap} showOnlyStudyTime={showOnlyStudyTime} />
        ) : (
          <DayView plans={plans} currentDate={currentDate} exclusions={exclusions} academySchedules={academySchedules} dayTypes={dayTypes} dailyScheduleMap={dailyScheduleMap} showOnlyStudyTime={showOnlyStudyTime} />
        )}
      </div>
    </div>
  );
}

