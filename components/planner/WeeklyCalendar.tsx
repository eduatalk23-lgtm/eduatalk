'use client';

import { useEffect, useState, useMemo, useCallback, memo, type ReactNode, type ComponentType } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { buildDayTypesFromDailySchedule, type DayType } from '@/lib/date/calendarDayTypes';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import type { DailyScheduleInfo } from '@/lib/types/plan';

/** DateCellWrapper 컴포넌트 인터페이스 (DnD 지원용) */
export interface DateCellWrapperProps {
  date: string;
  className?: string;
  children: ReactNode;
}

interface WeeklyCalendarProps {
  studentId: string;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  plannerId?: string;
  /** 선택된 플랜 그룹 ID (null = 전체 보기) */
  selectedGroupId?: string | null;
  /** 플랜 그룹의 daily_schedule (1730 Timetable 방법론 준수) */
  dailySchedules?: DailyScheduleInfo[][];
  /** 플래너 제외일 목록 */
  exclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  /** 플래너 기간 시작일 */
  plannerPeriodStart?: string;
  /** 플래너 기간 종료일 */
  plannerPeriodEnd?: string;
  /** 날짜 셀 래퍼 컴포넌트 (DnD용, 기본: div) */
  DateCellWrapper?: ComponentType<DateCellWrapperProps>;
}

interface DaySummary {
  date: string;
  totalPlans: number;
  completedPlans: number;
  dayType: DayType;
  dayTypeLabel?: string;
  isExclusionDay: boolean;
  exclusionType?: string;
  exclusionReason?: string;
  isToday: boolean;
  weekNumber?: number | null;
  cycleDayNumber?: number | null;
  rawDayType?: string | null;
}

/** 1730 주차별 날짜 그룹 */
interface WeekGroup {
  weekNumber: number;
  dates: string[];
  startDate: string;
  endDate: string;
}

/** 기본 DateCellWrapper (단순 div) */
function DefaultDateCellWrapper({ children, className }: DateCellWrapperProps) {
  return <div className={className}>{children}</div>;
}

export const WeeklyCalendar = memo(function WeeklyCalendar({
  studentId,
  selectedDate,
  onDateSelect,
  plannerId,
  selectedGroupId,
  dailySchedules,
  exclusions,
  DateCellWrapper = DefaultDateCellWrapper,
}: WeeklyCalendarProps) {
  const [planCounts, setPlanCounts] = useState<Map<string, { total: number; completed: number }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  // 표시 주차 인덱스 (선택 날짜와 독립적으로 관리)
  const [displayedWeekIndex, setDisplayedWeekIndex] = useState<number | null>(null);

  // 1730 주차별 날짜 그룹화
  const weekGroups = useMemo(() => {
    const groups: WeekGroup[] = [];
    const weekMap = new Map<number, string[]>();

    if (dailySchedules) {
      for (const scheduleArray of dailySchedules) {
        for (const schedule of scheduleArray) {
          if (schedule.date && schedule.week_number != null) {
            const dates = weekMap.get(schedule.week_number) || [];
            if (!dates.includes(schedule.date)) {
              dates.push(schedule.date);
            }
            weekMap.set(schedule.week_number, dates);
          }
        }
      }
    }

    // 주차 번호순으로 정렬
    const sortedWeekNumbers = Array.from(weekMap.keys()).sort((a, b) => a - b);
    for (const weekNumber of sortedWeekNumbers) {
      const dates = weekMap.get(weekNumber) || [];
      // 날짜순 정렬
      dates.sort();
      if (dates.length > 0) {
        groups.push({
          weekNumber,
          dates,
          startDate: dates[0],
          endDate: dates[dates.length - 1],
        });
      }
    }

    return groups;
  }, [dailySchedules]);

  // 선택된 날짜가 속한 주차 인덱스 계산 (초기값 설정용)
  const selectedDateWeekIndex = useMemo(() => {
    if (!dailySchedules || weekGroups.length === 0) return 0;

    // 선택된 날짜의 주차 번호 찾기
    for (const scheduleArray of dailySchedules) {
      for (const schedule of scheduleArray) {
        if (schedule.date === selectedDate && schedule.week_number != null) {
          const idx = weekGroups.findIndex((g) => g.weekNumber === schedule.week_number);
          return idx >= 0 ? idx : 0;
        }
      }
    }

    // 선택된 날짜가 스케줄에 없으면 가장 가까운 주차 찾기
    for (let i = 0; i < weekGroups.length; i++) {
      const group = weekGroups[i];
      if (selectedDate >= group.startDate && selectedDate <= group.endDate) {
        return i;
      }
      if (selectedDate < group.startDate) {
        return i;
      }
    }

    return weekGroups.length - 1;
  }, [selectedDate, dailySchedules, weekGroups]);

  // 실제 사용할 주차 인덱스 (null이면 선택 날짜 기준)
  const effectiveWeekIndex = displayedWeekIndex ?? selectedDateWeekIndex;

  // 현재 표시 주차 정보
  const currentWeekGroup = weekGroups[effectiveWeekIndex] ?? null;
  const currentWeekNumber = currentWeekGroup?.weekNumber ?? null;

  // 현재 주차의 날짜들
  const currentWeekDates = useMemo(() => {
    return currentWeekGroup?.dates ?? [];
  }, [currentWeekGroup]);

  // 이전/다음 주차 이동 가능 여부
  const canGoPrevWeek = effectiveWeekIndex > 0;
  const canGoNextWeek = effectiveWeekIndex >= 0 && effectiveWeekIndex < weekGroups.length - 1;

  // 이전 주차 이동 (날짜 선택 없이 주차만 변경)
  const handlePrevWeek = useCallback(() => {
    if (!canGoPrevWeek) return;
    setDisplayedWeekIndex(effectiveWeekIndex - 1);
  }, [canGoPrevWeek, effectiveWeekIndex]);

  // 다음 주차 이동 (날짜 선택 없이 주차만 변경)
  const handleNextWeek = useCallback(() => {
    if (!canGoNextWeek) return;
    setDisplayedWeekIndex(effectiveWeekIndex + 1);
  }, [canGoNextWeek, effectiveWeekIndex]);

  // 날짜별 스케줄 정보 맵
  const scheduleInfoMap = useMemo(() => {
    const map = new Map<string, {
      weekNumber?: number | null;
      cycleDayNumber?: number | null;
      rawDayType?: string | null;
    }>();

    if (dailySchedules) {
      for (const scheduleArray of dailySchedules) {
        for (const schedule of scheduleArray) {
          if (schedule.date) {
            map.set(schedule.date, {
              weekNumber: schedule.week_number,
              cycleDayNumber: schedule.cycle_day_number,
              rawDayType: schedule.day_type,
            });
          }
        }
      }
    }

    return map;
  }, [dailySchedules]);

  // 날짜별 타입 정보 맵
  const dayTypeMap = useMemo(() => {
    const formattedExclusions = exclusions?.map((exc) => ({
      exclusion_date: exc.exclusionDate,
      exclusion_type: exc.exclusionType,
      reason: exc.reason,
    }));

    return buildDayTypesFromDailySchedule(
      dailySchedules ?? [],
      formattedExclusions
    );
  }, [dailySchedules, exclusions]);

  // 현재 주차의 DaySummary 배열 생성
  const weekDays = useMemo(() => {
    const today = getTodayInTimezone();
    const days: DaySummary[] = [];

    for (const dateStr of currentWeekDates) {
      const dayTypeInfo = dayTypeMap.get(dateStr);
      const dayType = dayTypeInfo?.type ?? 'normal';
      const isExclusionDay = dayType === '지정휴일' || dayType === '휴가' || dayType === '개인일정';
      const scheduleInfo = scheduleInfoMap.get(dateStr);
      const planCount = planCounts.get(dateStr) || { total: 0, completed: 0 };

      days.push({
        date: dateStr,
        totalPlans: planCount.total,
        completedPlans: planCount.completed,
        dayType,
        dayTypeLabel: dayTypeInfo?.label,
        isExclusionDay,
        exclusionType: dayTypeInfo?.exclusion?.exclusion_type,
        exclusionReason: dayTypeInfo?.exclusion?.reason ?? undefined,
        isToday: dateStr === today,
        weekNumber: scheduleInfo?.weekNumber,
        cycleDayNumber: scheduleInfo?.cycleDayNumber,
        rawDayType: scheduleInfo?.rawDayType,
      });
    }

    return days;
  }, [currentWeekDates, dayTypeMap, scheduleInfoMap, planCounts]);

  // 플랜 데이터 조회
  useEffect(() => {
    async function fetchPlanData() {
      if (currentWeekDates.length === 0) {
        setIsLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const weekStartStr = currentWeekDates[0];
      const weekEndStr = currentWeekDates[currentWeekDates.length - 1];

      type PlanData = { plan_date: string; status: string };
      let plans: PlanData[] = [];

      // 플랜 그룹 필터링 우선순위:
      // 1. selectedGroupId가 있으면 특정 그룹만 필터링
      // 2. plannerId만 있으면 해당 플래너의 모든 그룹
      // 3. 둘 다 없으면 전체
      if (selectedGroupId) {
        // 특정 플랜 그룹으로 필터링
        const { data } = await supabase
          .from('student_plan')
          .select('plan_date, status')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('container_type', 'daily')
          .eq('plan_group_id', selectedGroupId)
          .gte('plan_date', weekStartStr)
          .lte('plan_date', weekEndStr);
        plans = (data ?? []) as PlanData[];
      } else if (plannerId) {
        // 플래너 내 모든 그룹으로 필터링
        const { data } = await supabase
          .from('student_plan')
          .select('plan_date, status, plan_groups!inner(planner_id)')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('container_type', 'daily')
          .gte('plan_date', weekStartStr)
          .lte('plan_date', weekEndStr)
          .eq('plan_groups.planner_id', plannerId);
        plans = (data ?? []) as unknown as PlanData[];
      } else {
        // 필터 없이 전체
        const { data } = await supabase
          .from('student_plan')
          .select('plan_date, status')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .eq('container_type', 'daily')
          .gte('plan_date', weekStartStr)
          .lte('plan_date', weekEndStr);
        plans = (data ?? []) as PlanData[];
      }

      // 날짜별로 집계
      const counts = new Map<string, { total: number; completed: number }>();
      for (const plan of plans) {
        const existing = counts.get(plan.plan_date) || { total: 0, completed: 0 };
        existing.total++;
        if (plan.status === 'completed') {
          existing.completed++;
        }
        counts.set(plan.plan_date, existing);
      }

      setPlanCounts(counts);
      setIsLoading(false);
    }

    setIsLoading(true);
    fetchPlanData();
  }, [studentId, plannerId, selectedGroupId, currentWeekDates]);

  // 요일 라벨
  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    return labels[date.getDay()];
  };

  // 상태 아이콘 (완료/미완료)
  const getStatusIcon = (day: DaySummary) => {
    if (day.totalPlans === 0) return null;
    if (day.completedPlans === day.totalPlans) return '✓'; // 전부 완료
    return '○'; // 미완료 있음
  };

  // 사이클 라벨 (D1, D2, R1)
  const getCycleLabel = (day: DaySummary) => {
    if (day.cycleDayNumber == null) return null;
    const isReview = day.rawDayType === 'review' || day.rawDayType === '복습일' || day.dayType === '복습일';
    return isReview ? `R${day.cycleDayNumber}` : `D${day.cycleDayNumber}`;
  };

  // day_type 라벨 (학습/복습/휴일)
  const getDayTypeLabel = (day: DaySummary) => {
    if (day.isExclusionDay) return '휴일';
    if (day.rawDayType === 'review' || day.rawDayType === '복습일' || day.dayType === '복습일') return '복습';
    if (day.rawDayType === 'study' || day.rawDayType === '학습일' || day.cycleDayNumber != null) return '학습';
    return null;
  };

  // 날짜 범위 문자열
  const getDateRangeString = () => {
    if (!currentWeekGroup) return '';
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr + 'T00:00:00');
      return `${d.getMonth() + 1}/${d.getDate()}`;
    };
    return `${formatDate(currentWeekGroup.startDate)} ~ ${formatDate(currentWeekGroup.endDate)}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="h-5 bg-gray-200 rounded w-24 mb-3 animate-pulse" />
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // 데이터가 없는 경우
  if (weekGroups.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-center text-gray-500 py-8">
          플래너 스케줄 데이터가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* 주차 네비게이터 */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button
          onClick={handlePrevWeek}
          disabled={!canGoPrevWeek}
          className={cn(
            'p-1 rounded-full transition-colors',
            canGoPrevWeek
              ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              : 'text-gray-300 cursor-not-allowed'
          )}
          title="이전 주차"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {currentWeekNumber != null
            ? `${currentWeekNumber}주차 (${getDateRangeString()})`
            : getDateRangeString()}
        </span>
        <button
          onClick={handleNextWeek}
          disabled={!canGoNextWeek}
          className={cn(
            'p-1 rounded-full transition-colors',
            canGoNextWeek
              ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              : 'text-gray-300 cursor-not-allowed'
          )}
          title="다음 주차"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 날짜 그리드 - 동적 컬럼 수 (최대 10개) */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(weekDays.length, 10)}, minmax(0, 1fr))`,
        }}
      >
        {weekDays.map((day) => {
          const isSelected = day.date === selectedDate;
          const cycleLabel = getCycleLabel(day);
          const dayTypeLabel = getDayTypeLabel(day);
          const dayLabel = getDayLabel(day.date);
          const isSunday = dayLabel === '일';
          const isSaturday = dayLabel === '토';

          return (
            <DateCellWrapper
              key={day.date}
              date={day.date}
              className="rounded-lg"
            >
              <button
                onClick={() => onDateSelect(day.date)}
                className={cn(
                  'w-full flex flex-col items-center p-2 rounded-lg border transition-all min-h-[100px]',
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 hover:bg-emerald-100/60'
                    : day.isExclusionDay
                    ? 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100/60'
                    : day.rawDayType === 'review' || day.rawDayType === '복습일' || day.dayType === '복습일'
                    ? 'border-purple-200 bg-purple-50/50 hover:border-purple-300 hover:bg-purple-100/60'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  day.isToday && !isSelected && !day.isExclusionDay && 'border-blue-300 bg-blue-50/50 hover:bg-blue-100/50'
                )}
                title={day.isExclusionDay ? `${day.exclusionType}${day.exclusionReason ? `: ${day.exclusionReason}` : ''}` : undefined}
              >
                {/* day_type 라벨 */}
                {dayTypeLabel && (
                  <span
                    className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded',
                      day.isExclusionDay
                        ? 'bg-orange-100 text-orange-700'
                        : day.rawDayType === 'review' || day.rawDayType === '복습일' || day.dayType === '복습일'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    {dayTypeLabel}
                  </span>
                )}

                {/* 요일 + 날짜 */}
                <div className="flex flex-col items-center mt-1">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isSunday ? 'text-red-500' : isSaturday ? 'text-blue-500' : 'text-gray-600'
                    )}
                  >
                    {dayLabel}
                  </span>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      isSelected ? 'text-blue-600' : 'text-gray-900'
                    )}
                  >
                    {new Date(day.date + 'T00:00:00').getDate()}
                  </span>
                </div>

                {/* 사이클 라벨 (D1, D2, R1) */}
                {cycleLabel && !day.isExclusionDay && (
                  <span
                    className={cn(
                      'text-xs font-medium mt-0.5',
                      day.rawDayType === 'review' || day.rawDayType === '복습일' || day.dayType === '복습일'
                        ? 'text-purple-600'
                        : 'text-blue-600'
                    )}
                  >
                    {cycleLabel}
                  </span>
                )}

                {/* 플랜 진행 상태: 완료/미완료 개수 */}
                {!day.isExclusionDay && day.totalPlans > 0 && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    <span className="flex items-center gap-0.5">
                      <span className="text-green-500">✓</span>
                      <span className="text-gray-600">{day.completedPlans}</span>
                    </span>
                    {day.totalPlans - day.completedPlans > 0 && (
                      <span className="flex items-center gap-0.5">
                        <span className="text-gray-400">○</span>
                        <span className="text-gray-600">{day.totalPlans - day.completedPlans}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* 제외일 사유 - 플랜 상태와 동일한 스타일 */}
                {day.isExclusionDay && (
                  <div className="mt-1 text-xs text-orange-600 text-center truncate max-w-full px-1">
                    {day.exclusionReason || day.exclusionType}
                  </div>
                )}

                {/* 오늘 표시 */}
                {day.isToday && (
                  <span className="text-[10px] text-blue-500 font-medium mt-0.5">오늘</span>
                )}
              </button>
            </DateCellWrapper>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> 완료
        </span>
        <span className="flex items-center gap-1">
          <span className="text-gray-400">○</span> 미완료
        </span>
        <span className="flex items-center gap-1">
          <span className="text-blue-600 font-medium">D</span> 학습일
        </span>
        <span className="flex items-center gap-1">
          <span className="text-purple-600 font-medium">R</span> 복습일
        </span>
      </div>
    </div>
  );
});
