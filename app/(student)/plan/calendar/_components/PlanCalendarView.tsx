"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from "lucide-react";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { CalendarLegend } from "./CalendarLegend";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import { formatMonthYear, formatWeekRangeShort, formatDay, parseDateString, formatDateString } from "@/lib/date/calendarUtils";
import { buildDayTypesFromDailySchedule } from "@/lib/date/calendarDayTypes";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import { useTouchGestures } from "../_hooks/useTouchGestures";
import { PlanFilters, filterPlans, type FilterState } from "./PlanFilters";
import { CalendarExport } from "./CalendarExport";

type PlanCalendarViewProps = {
  plans: PlanWithContent[];
  view: "month" | "week" | "day";
  minDate: string;
  maxDate: string;
  initialDate: string;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dailySchedules: DailyScheduleInfo[][]; // 플랜 그룹들의 daily_schedule 배열
  studentId?: string;
  onPlansUpdated?: () => void;
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
  studentId,
  onPlansUpdated,
}: PlanCalendarViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL에서 날짜와 뷰 읽기
  const urlDate = searchParams.get("date");
  const urlView = searchParams.get("view") as "month" | "week" | "day" | null;

  // initialDate를 Date 객체로 변환 (YYYY-MM-DD 형식)
  // 로컬 타임존 기준으로 파싱하여 날짜가 변경되지 않도록 합니다.
  const initialDateObj = parseDateString(initialDate);
  
  // URL에서 날짜가 있으면 사용, 없으면 initialDate 사용
  const startDate = urlDate ? parseDateString(urlDate) : initialDateObj;
  const startView = urlView && ["month", "week", "day"].includes(urlView) ? urlView : initialView;

  const [currentDate, setCurrentDate] = useState(startDate);
  const [view, setView] = useState<"month" | "week" | "day">(startView);
  const [showOnlyStudyTime, setShowOnlyStudyTime] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    contentTypes: [],
    statuses: [],
    planGroups: [],
  });

  // 필터링된 플랜
  const filteredPlans = useMemo(() => {
    return filterPlans(plans, filters);
  }, [plans, filters]);

  // 플랜 그룹 목록 추출
  const availablePlanGroups = useMemo(() => {
    const groupMap = new Map<string, string>();
    plans.forEach((plan) => {
      if (plan.plan_group_id) {
        // plan_group_id만 있으면 이름은 ID의 처음 8자로 대체
        groupMap.set(plan.plan_group_id, plan.plan_group_id.slice(0, 8));
      }
    });
    return Array.from(groupMap.entries()).map(([id, name]) => ({ id, name }));
  }, [plans]);

  // URL 파라미터 추출 (의존성 최적화를 위해 값만 추출)
  const currentDateParam = searchParams.get("date");
  const currentViewParam = searchParams.get("view");

  // URL 동기화 함수 - 실제 변경이 있을 때만 업데이트
  const updateURL = useCallback((date: Date, viewType: "month" | "week" | "day") => {
    const dateStr = formatDateString(date);
    
    // URL이 이미 올바른 값이면 업데이트하지 않음
    if (currentDateParam === dateStr && currentViewParam === viewType) {
      return;
    }
    
    const params = new URLSearchParams();
    params.set("date", dateStr);
    params.set("view", viewType);
    
    // replace를 사용하여 히스토리 스택에 쌓이지 않도록 함 (뒤로가기 지원)
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, currentDateParam, currentViewParam]);

  // 날짜 변경 시 URL 업데이트 - 초기 마운트 시 스킵
  const isInitialMount = useRef(true);
  useEffect(() => {
    // 초기 마운트 시에는 URL이 이미 올바르게 설정되어 있으므로 스킵
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    const dateStr = formatDateString(currentDate);
    // URL과 상태가 다를 때만 업데이트
    if (currentDateParam !== dateStr || currentViewParam !== view) {
      updateURL(currentDate, view);
    }
  }, [currentDate, view, updateURL, currentDateParam, currentViewParam]);

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

  // 날짜 범위 체크 유틸리티
  const isDateInRange = useCallback((date: Date): boolean => {
    const dateStr = formatDateString(date);
    return dateStr >= minDate && dateStr <= maxDate;
  }, [minDate, maxDate]);

  // 날짜 이동 유틸리티 (범위 체크 포함)
  const moveDate = useCallback((direction: "prev" | "next" | "today") => {
    const newDate = new Date(currentDate);
    
    if (direction === "today") {
      const today = new Date();
      if (isDateInRange(today)) {
        setCurrentDate(today);
      }
      return;
    }

    if (direction === "prev") {
      if (view === "month") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (view === "week") {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() - 1);
      }
    } else {
      if (view === "month") {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (view === "week") {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
    }

    // 범위 체크: 범위 밖이면 이동하지 않음
    if (isDateInRange(newDate)) {
      setCurrentDate(newDate);
    }
  }, [currentDate, view, isDateInRange]);

  // 뷰 변경 핸들러 - updateURL은 useEffect에서 자동으로 처리됨
  const handleViewChange = useCallback((newView: "month" | "week" | "day") => {
    setView(newView);
  }, []);

  // 이전/다음 버튼 활성화 상태
  const canGoPrevious = useMemo(() => {
    const testDate = new Date(currentDate);
    if (view === "month") {
      testDate.setMonth(testDate.getMonth() - 1);
    } else if (view === "week") {
      testDate.setDate(testDate.getDate() - 7);
    } else {
      testDate.setDate(testDate.getDate() - 1);
    }
    return isDateInRange(testDate);
  }, [currentDate, view, isDateInRange]);

  const canGoNext = useMemo(() => {
    const testDate = new Date(currentDate);
    if (view === "month") {
      testDate.setMonth(testDate.getMonth() + 1);
    } else if (view === "week") {
      testDate.setDate(testDate.getDate() + 7);
    } else {
      testDate.setDate(testDate.getDate() + 1);
    }
    return isDateInRange(testDate);
  }, [currentDate, view, isDateInRange]);

  // 키보드 네비게이션
  const calendarRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 캘린더 영역에 포커스가 있을 때만 처리
      if (!calendarRef.current?.contains(document.activeElement)) {
        return;
      }

      // 입력 필드에 포커스가 있으면 무시
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveDate("prev");
          break;
        case "ArrowRight":
          e.preventDefault();
          moveDate("next");
          break;
        case "ArrowUp":
          e.preventDefault();
          if (view === "week" || view === "day") {
            moveDate("prev");
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (view === "week" || view === "day") {
            moveDate("next");
          }
          break;
        case "Home":
          e.preventDefault();
          moveDate("today");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveDate, view]);

  // 오늘 날짜인지 확인
  const isToday = useMemo(() => {
    const today = formatDateString(new Date());
    const current = formatDateString(currentDate);
    return today === current;
  }, [currentDate]);

  // 터치 제스처
  const handleSwipeNext = useCallback(() => {
    if (canGoNext) moveDate("next");
  }, [canGoNext, moveDate]);

  const handleSwipePrev = useCallback(() => {
    if (canGoPrevious) moveDate("prev");
  }, [canGoPrevious, moveDate]);

  const { containerRef: touchContainerRef } = useTouchGestures({
    onSwipeLeft: handleSwipeNext,
    onSwipeRight: handleSwipePrev,
    threshold: 75,
  });

  // Combine refs
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    calendarRef.current = node;
    touchContainerRef.current = node;
  }, [touchContainerRef]);

  return (
    <div
      ref={setRefs}
      className="rounded-xl border-2 border-gray-200 bg-white shadow-lg touch-pan-y"
      role="application"
      aria-label="플랜 캘린더"
      tabIndex={0}
    >
      {/* 헤더 - 개선된 레이아웃 */}
      <div className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 md:px-8 py-5 md:py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* 왼쪽: 날짜 네비게이션 */}
          <div className="flex items-center gap-3" role="group" aria-label="날짜 네비게이션">
            <button
              onClick={() => moveDate("prev")}
              disabled={!canGoPrevious}
              aria-label="이전 기간으로 이동"
              aria-disabled={!canGoPrevious}
              className={`rounded-lg p-2 transition-all duration-200 ${
                canGoPrevious
                  ? "text-gray-600 hover:bg-gray-100 hover:scale-110 active:scale-95 cursor-pointer"
                  : "text-gray-300 cursor-not-allowed opacity-50"
              }`}
            >
              <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <h2 
              className="text-2xl md:text-3xl font-bold text-gray-900"
              aria-live="polite"
              aria-atomic="true"
            >
              {view === "month"
                ? formatMonthYear(currentDate)
                : view === "week"
                ? formatWeekRangeShort(currentDate)
                : formatDay(currentDate)}
            </h2>
            <button
              onClick={() => moveDate("next")}
              disabled={!canGoNext}
              aria-label="다음 기간으로 이동"
              aria-disabled={!canGoNext}
              className={`rounded-lg p-2 transition-all duration-200 ${
                canGoNext
                  ? "text-gray-600 hover:bg-gray-100 hover:scale-110 active:scale-95 cursor-pointer"
                  : "text-gray-300 cursor-not-allowed opacity-50"
              }`}
            >
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <button
              onClick={() => moveDate("today")}
              aria-label="오늘 날짜로 이동"
              aria-pressed={isToday}
              className={`rounded-lg px-4 py-2 text-sm md:text-base font-bold shadow-md transition-all duration-200 ${
                isToday
                  ? "bg-indigo-700 text-white shadow-lg"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg active:scale-95"
              }`}
            >
              오늘
            </button>
          </div>

          {/* 오른쪽: 뷰 전환 및 필터 */}
          <div className="flex items-center gap-3" role="group" aria-label="뷰 전환 및 필터">
            {/* 뷰 전환 버튼 그룹 */}
            <div 
              className="flex rounded-lg border-2 border-gray-200 bg-gray-50 p-1 shadow-sm"
              role="tablist"
              aria-label="캘린더 뷰 선택"
            >
              <button
                onClick={() => handleViewChange("month")}
                role="tab"
                aria-selected={view === "month"}
                aria-controls="calendar-view"
                className={`rounded-md px-3 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  view === "month"
                    ? "bg-white text-indigo-600 shadow-md scale-105"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <CalendarIcon className="inline h-3 w-3 md:h-4 md:w-4" aria-hidden="true" />
                <span className="ml-1">월별</span>
              </button>
              <button
                onClick={() => handleViewChange("week")}
                role="tab"
                aria-selected={view === "week"}
                aria-controls="calendar-view"
                className={`rounded-md px-3 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  view === "week"
                    ? "bg-white text-indigo-600 shadow-md scale-105"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                주별
              </button>
              <button
                onClick={() => handleViewChange("day")}
                role="tab"
                aria-selected={view === "day"}
                aria-controls="calendar-view"
                className={`rounded-md px-3 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  view === "day"
                    ? "bg-white text-indigo-600 shadow-md scale-105"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                일별
              </button>
            </div>

            {/* 타임슬롯 필터 */}
            <button
              onClick={() => setShowOnlyStudyTime(!showOnlyStudyTime)}
              aria-pressed={showOnlyStudyTime}
              aria-label={showOnlyStudyTime ? "모든 타임슬롯 표시" : "학습시간만 표시"}
              className={`flex items-center gap-2 rounded-lg border-2 bg-white px-3 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all duration-200 hover:shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                showOnlyStudyTime
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              title={showOnlyStudyTime ? "모든 타임슬롯 표시" : "학습시간만 표시"}
            >
              <Filter className="h-3 w-3 md:h-4 md:w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{showOnlyStudyTime ? "전체" : "학습시간만"}</span>
            </button>

            {/* 플랜 필터 */}
            <PlanFilters
              filters={filters}
              onFiltersChange={setFilters}
              availablePlanGroups={availablePlanGroups}
            />

            {/* 캘린더 내보내기 */}
            <CalendarExport
              plans={filteredPlans}
              minDate={minDate}
              maxDate={maxDate}
            />
          </div>
        </div>
      </div>

      {/* 캘린더 뷰 - 확대된 패딩 */}
      <div
        id="calendar-view"
        role="region"
        aria-label={`${view === "month" ? "월별" : view === "week" ? "주별" : "일별"} 캘린더 뷰`}
        className="p-4 md:p-6 lg:p-8"
      >
        {view === "month" ? (
          <MonthView plans={filteredPlans} currentDate={currentDate} exclusions={exclusions} academySchedules={academySchedules} dayTypes={dayTypes} dailyScheduleMap={dailyScheduleMap} showOnlyStudyTime={showOnlyStudyTime} studentId={studentId} onPlansUpdated={onPlansUpdated} />
        ) : view === "week" ? (
          <WeekView plans={filteredPlans} currentDate={currentDate} exclusions={exclusions} academySchedules={academySchedules} dayTypes={dayTypes} dailyScheduleMap={dailyScheduleMap} showOnlyStudyTime={showOnlyStudyTime} />
        ) : (
          <DayView plans={filteredPlans} currentDate={currentDate} exclusions={exclusions} academySchedules={academySchedules} dayTypes={dayTypes} dailyScheduleMap={dailyScheduleMap} showOnlyStudyTime={showOnlyStudyTime} studentId={studentId} onPlansUpdated={onPlansUpdated} />
        )}
      </div>

      {/* 캘린더 범례 - 가용 날짜 설명 */}
      <div className="border-t border-gray-200 px-4 md:px-6 lg:px-8 py-4">
        <CalendarLegend compact={view !== "month"} />
      </div>
    </div>
  );
}

