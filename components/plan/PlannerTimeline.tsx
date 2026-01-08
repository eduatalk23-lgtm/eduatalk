"use client";

/**
 * PlannerTimeline
 *
 * 플래너의 주간 타임라인을 시각화하는 컴포넌트
 * - 가용 학습 시간대 표시
 * - 기존 플랜 점유 시간 표시
 * - 빈 시간대 하이라이트
 *
 * @module components/plan/PlannerTimeline
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

// ============================================
// 타입 정의
// ============================================

export interface TimeRange {
  start: string;
  end: string;
}

export interface DailyScheduleInfo {
  date: string;
  dayType: string;
  weekNumber: number | null;
  timeSlots: TimeRange[];
  availableRanges: TimeRange[];
  existingPlans: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    contentType?: string;
  }>;
}

export interface PlannerTimelineProps {
  /** 플래너 ID */
  plannerId: string;
  /** 학생 ID */
  studentId: string;
  /** 플래너 기간 시작 */
  periodStart: string;
  /** 플래너 기간 종료 */
  periodEnd: string;
  /** 초기 주차 (Date) */
  initialWeekStart?: Date;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 클래스명 */
  className?: string;
  /** 날짜 클릭 핸들러 */
  onDateClick?: (date: string, availableRanges: TimeRange[]) => void;
}

// ============================================
// 유틸리티 함수
// ============================================

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToPercent(
  minutes: number,
  rangeStart: number,
  rangeEnd: number
): number {
  const total = rangeEnd - rangeStart;
  if (total <= 0) return 0;
  return ((minutes - rangeStart) / total) * 100;
}

function getWeekDates(weekStart: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function getWeekStartFromDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일 시작
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateShort(dateStr: string): { day: string; date: string; weekday: string } {
  const date = new Date(dateStr);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return {
    day: `${date.getMonth() + 1}/${date.getDate()}`,
    date: dateStr,
    weekday: weekdays[date.getDay()],
  };
}

// ============================================
// 시간 블록 컴포넌트
// ============================================

function TimeBlock({
  range,
  startMinutes,
  endMinutes,
  type,
  title,
  onClick,
}: {
  range: TimeRange;
  startMinutes: number;
  endMinutes: number;
  type: "available" | "occupied" | "empty";
  title?: string;
  onClick?: () => void;
}) {
  const left = minutesToPercent(
    timeToMinutes(range.start),
    startMinutes,
    endMinutes
  );
  const width =
    minutesToPercent(timeToMinutes(range.end), startMinutes, endMinutes) - left;

  const styleByType = {
    available: "bg-blue-100 border-blue-300",
    occupied: "bg-gray-200 border-gray-400",
    empty: "bg-emerald-50 border-emerald-200 border-dashed",
  };

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 border rounded transition-opacity",
        styleByType[type],
        onClick && "cursor-pointer hover:opacity-80"
      )}
      style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
      onClick={onClick}
      title={title || `${range.start} ~ ${range.end}`}
    >
      {width > 10 && title && (
        <div className="px-1 text-xs truncate leading-tight text-gray-700">
          {title}
        </div>
      )}
    </div>
  );
}

// ============================================
// 일별 타임라인 컴포넌트
// ============================================

function DayTimeline({
  schedule,
  startMinutes,
  endMinutes,
  compact,
  onClick,
}: {
  schedule: DailyScheduleInfo;
  startMinutes: number;
  endMinutes: number;
  compact?: boolean;
  onClick?: () => void;
}) {
  const dateInfo = formatDateShort(schedule.date);
  const isWeekend = ["토", "일"].includes(dateInfo.weekday);
  const isToday = schedule.date === new Date().toISOString().slice(0, 10);

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* 날짜 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-medium",
              isToday ? "text-blue-600" : isWeekend ? "text-gray-500" : "text-gray-700"
            )}
          >
            {dateInfo.day}
          </span>
          <span
            className={cn(
              "text-xs",
              isToday
                ? "px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded"
                : isWeekend
                ? "text-gray-400"
                : "text-gray-500"
            )}
          >
            {dateInfo.weekday}
          </span>
          {schedule.dayType && schedule.dayType !== "학습일" && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
              {schedule.dayType}
            </span>
          )}
        </div>
        {!compact && schedule.existingPlans.length > 0 && (
          <span className="text-xs text-gray-500">
            {schedule.existingPlans.length}개 플랜
          </span>
        )}
      </div>

      {/* 타임라인 바 */}
      <div
        className={cn(
          "relative bg-gray-50 border border-gray-200 rounded",
          compact ? "h-5" : "h-6"
        )}
      >
        {/* 가용 시간대 (학습 가능 시간) */}
        {schedule.timeSlots.map((slot, idx) => (
          <TimeBlock
            key={`slot-${idx}`}
            range={slot}
            startMinutes={startMinutes}
            endMinutes={endMinutes}
            type="available"
            title={`학습 ${slot.start}~${slot.end}`}
          />
        ))}

        {/* 기존 플랜 (점유 시간) */}
        {schedule.existingPlans.map((plan, idx) => (
          <TimeBlock
            key={`plan-${idx}`}
            range={{ start: plan.start, end: plan.end }}
            startMinutes={startMinutes}
            endMinutes={endMinutes}
            type="occupied"
            title={plan.title}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// 시간 눈금 컴포넌트
// ============================================

function TimeScale({
  startMinutes,
  endMinutes,
}: {
  startMinutes: number;
  endMinutes: number;
}) {
  const hours = useMemo(() => {
    const result: number[] = [];
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.ceil(endMinutes / 60);

    for (let h = startHour; h <= endHour; h += 2) {
      result.push(h);
    }
    return result;
  }, [startMinutes, endMinutes]);

  return (
    <div className="relative h-4 border-b border-gray-200 ml-16">
      {hours.map((hour) => {
        const position = minutesToPercent(hour * 60, startMinutes, endMinutes);
        return (
          <div
            key={hour}
            className="absolute -translate-x-1/2 text-xs text-gray-400"
            style={{ left: `${position}%` }}
          >
            {hour}시
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function PlannerTimeline({
  plannerId,
  studentId,
  periodStart,
  periodEnd,
  initialWeekStart,
  compact = false,
  className,
  onDateClick,
}: PlannerTimelineProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => {
    if (initialWeekStart) return getWeekStartFromDate(initialWeekStart);
    // 기본: 현재 날짜 또는 플래너 시작일 중 더 늦은 날짜
    const today = new Date();
    const plannerStart = new Date(periodStart);
    return getWeekStartFromDate(today > plannerStart ? today : plannerStart);
  });
  const [scheduleData, setScheduleData] = useState<DailyScheduleInfo[]>([]);

  // 시간 범위 (06:00 ~ 24:00)
  const startMinutes = 6 * 60; // 06:00
  const endMinutes = 24 * 60; // 24:00

  // 현재 주의 날짜 목록
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  // 플래너 기간 내인지 확인
  const isWithinPlannerPeriod = useCallback(
    (weekStartDate: Date) => {
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);

      return weekStartDate <= periodEndDate && weekEndDate >= periodStartDate;
    },
    [periodStart, periodEnd]
  );

  // 스케줄 데이터 로드
  useEffect(() => {
    async function loadScheduleData() {
      setIsLoading(true);
      setError(null);

      try {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // API 호출 (서버 액션 또는 API 라우트)
        const response = await fetch(
          `/api/admin/planners/${plannerId}/schedule?` +
            new URLSearchParams({
              studentId,
              periodStart: weekDates[0],
              periodEnd: weekDates[6],
            })
        );

        if (!response.ok) {
          throw new Error("스케줄 데이터를 불러오는데 실패했습니다.");
        }

        const result = await response.json();
        if (result.success) {
          setScheduleData(result.data);
        } else {
          // 데이터가 없으면 빈 스케줄로 표시
          setScheduleData(
            weekDates.map((date) => ({
              date,
              dayType: "학습일",
              weekNumber: null,
              timeSlots: [],
              availableRanges: [],
              existingPlans: [],
            }))
          );
        }
      } catch (err) {
        console.error("[PlannerTimeline] 스케줄 로드 실패:", err);
        setError(err instanceof Error ? err.message : "데이터 로드 실패");
        // 에러 시에도 빈 스케줄 표시
        setScheduleData(
          weekDates.map((date) => ({
            date,
            dayType: "학습일",
            weekNumber: null,
            timeSlots: [],
            availableRanges: [],
            existingPlans: [],
          }))
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadScheduleData();
  }, [plannerId, studentId, weekStart, weekDates]);

  // 주 이동
  const goToPreviousWeek = useCallback(() => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(weekStart.getDate() - 7);
    if (isWithinPlannerPeriod(newWeekStart)) {
      setWeekStart(newWeekStart);
    }
  }, [weekStart, isWithinPlannerPeriod]);

  const goToNextWeek = useCallback(() => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(weekStart.getDate() + 7);
    if (isWithinPlannerPeriod(newWeekStart)) {
      setWeekStart(newWeekStart);
    }
  }, [weekStart, isWithinPlannerPeriod]);

  // 이전/다음 주 버튼 활성화 여부
  const canGoPrevious = useMemo(() => {
    const prevWeek = new Date(weekStart);
    prevWeek.setDate(weekStart.getDate() - 7);
    return isWithinPlannerPeriod(prevWeek);
  }, [weekStart, isWithinPlannerPeriod]);

  const canGoNext = useMemo(() => {
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(weekStart.getDate() + 7);
    return isWithinPlannerPeriod(nextWeek);
  }, [weekStart, isWithinPlannerPeriod]);

  // 주차 표시 형식
  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.getMonth() + 1}/${startDate.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()}`;
  }, [weekDates]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">주간 타임라인</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousWeek}
            disabled={!canGoPrevious}
            className={cn(
              "p-1 rounded hover:bg-gray-100 transition-colors",
              !canGoPrevious && "opacity-50 cursor-not-allowed"
            )}
            title="이전 주"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm text-gray-600 min-w-[100px] text-center">
            {weekLabel}
          </span>
          <button
            onClick={goToNextWeek}
            disabled={!canGoNext}
            className={cn(
              "p-1 rounded hover:bg-gray-100 transition-colors",
              !canGoNext && "opacity-50 cursor-not-allowed"
            )}
            title="다음 주"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      )}

      {/* 에러 상태 */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* 타임라인 */}
      {!isLoading && (
        <div className="flex flex-col gap-2">
          {/* 시간 눈금 */}
          <TimeScale startMinutes={startMinutes} endMinutes={endMinutes} />

          {/* 일별 타임라인 */}
          <div className="space-y-2">
            {scheduleData.map((schedule) => (
              <DayTimeline
                key={schedule.date}
                schedule={schedule}
                startMinutes={startMinutes}
                endMinutes={endMinutes}
                compact={compact}
                onClick={
                  onDateClick
                    ? () => onDateClick(schedule.date, schedule.availableRanges)
                    : undefined
                }
              />
            ))}
          </div>

          {/* 범례 */}
          {!compact && (
            <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
                <span>학습 가능 시간</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-200 border border-gray-400 rounded" />
                <span>기존 플랜</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlannerTimeline;
