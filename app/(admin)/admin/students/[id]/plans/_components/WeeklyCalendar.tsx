'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableDateCell } from './dnd';
import { buildDayTypesFromDailySchedule, type DayType } from '@/lib/date/calendarDayTypes';
import { formatDateString } from '@/lib/date/calendarUtils';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import type { DailyScheduleInfo } from '@/lib/types/plan';
import type { TimeSlot } from '@/lib/types/plan-generation';
import { MiniTimelineBar } from './MiniTimelineBar';

interface WeeklyCalendarProps {
  studentId: string;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  plannerId?: string;
  /** 플랜 그룹의 daily_schedule (1730 Timetable 방법론 준수) */
  dailySchedules?: DailyScheduleInfo[][];
  /** 플래너 제외일 목록 */
  exclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  /** 날짜별 시간대 타임슬롯 (학습시간, 점심시간, 학원일정 등) */
  dateTimeSlots?: Record<string, TimeSlot[]>;
  /** 타임라인 클릭 시 상세 모달 열기 */
  onTimelineClick?: (date: string) => void;
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
  // 1730 Timetable 주기 정보
  weekNumber?: number | null;
  cycleDayNumber?: number | null;
}

export function WeeklyCalendar({
  studentId,
  selectedDate,
  onDateSelect,
  plannerId,
  dailySchedules,
  exclusions,
  dateTimeSlots,
  onTimelineClick,
}: WeeklyCalendarProps) {
  const [weekDays, setWeekDays] = useState<DaySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchWeekData() {
      const supabase = createSupabaseBrowserClient();

      // 선택된 날짜 기준 주간 계산
      const selected = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = selected.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(selected);
      weekStart.setDate(selected.getDate() + mondayOffset);

      const today = getTodayInTimezone();

      // 1730 Timetable 방법론: buildDayTypesFromDailySchedule 사용
      // exclusions를 underscore 형식으로 변환 (buildDayTypesFromDailySchedule 함수 규격 맞춤)
      const formattedExclusions = exclusions?.map((exc) => ({
        exclusion_date: exc.exclusionDate,
        exclusion_type: exc.exclusionType,
        reason: exc.reason,
      }));

      // 날짜별 타입 정보 맵 생성
      const dayTypeMap = buildDayTypesFromDailySchedule(
        dailySchedules ?? [],
        formattedExclusions
      );

      // 날짜별 주기 정보 맵 생성 (dailySchedules에서 추출)
      const cycleInfoMap = new Map<string, { weekNumber?: number | null; cycleDayNumber?: number | null }>();
      if (dailySchedules) {
        for (const scheduleArray of dailySchedules) {
          for (const schedule of scheduleArray) {
            if (schedule.date && (schedule.week_number != null || schedule.cycle_day_number != null)) {
              cycleInfoMap.set(schedule.date, {
                weekNumber: schedule.week_number,
                cycleDayNumber: schedule.cycle_day_number,
              });
            }
          }
        }
      }

      // 7일간의 날짜 생성
      const days: DaySummary[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = formatDateString(date);

        // dayTypeMap에서 해당 날짜의 타입 정보 가져오기
        const dayTypeInfo = dayTypeMap.get(dateStr);
        const dayType = dayTypeInfo?.type ?? 'normal';
        const isExclusionDay = dayType === '지정휴일' || dayType === '휴가' || dayType === '개인일정';

        // 주기 정보 가져오기
        const cycleInfo = cycleInfoMap.get(dateStr);

        days.push({
          date: dateStr,
          totalPlans: 0,
          completedPlans: 0,
          dayType,
          dayTypeLabel: dayTypeInfo?.label,
          isExclusionDay,
          exclusionType: dayTypeInfo?.exclusion?.exclusion_type,
          exclusionReason: dayTypeInfo?.exclusion?.reason ?? undefined,
          isToday: dateStr === today,
          weekNumber: cycleInfo?.weekNumber,
          cycleDayNumber: cycleInfo?.cycleDayNumber,
        });
      }

      // 플랜 데이터 조회
      const weekStartStr = days[0].date;
      const weekEndStr = days[6].date;

      // plannerId가 있으면 plan_groups 조인하여 필터링
      type PlanData = { plan_date: string; status: string };
      let plans: PlanData[] = [];

      if (plannerId) {
        const { data } = await supabase
          .from('student_plan')
          .select('plan_date, status, plan_groups!inner(planner_id)')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .eq('container_type', 'daily')
          .gte('plan_date', weekStartStr)
          .lte('plan_date', weekEndStr)
          .eq('plan_groups.planner_id', plannerId);
        plans = (data ?? []) as unknown as PlanData[];
      } else {
        const { data } = await supabase
          .from('student_plan')
          .select('plan_date, status')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .eq('container_type', 'daily')
          .gte('plan_date', weekStartStr)
          .lte('plan_date', weekEndStr);
        plans = (data ?? []) as PlanData[];
      }

      // 날짜별로 집계
      for (const plan of plans) {
        const day = days.find((d) => d.date === plan.plan_date);
        if (day) {
          day.totalPlans++;
          if (plan.status === 'completed') {
            day.completedPlans++;
          }
        }
      }

      setWeekDays(days);
      setIsLoading(false);
    }

    fetchWeekData();
  }, [studentId, selectedDate, plannerId, dailySchedules, exclusions]);

  const getDayLabel = (index: number) => {
    const labels = ['월', '화', '수', '목', '금', '토', '일'];
    return labels[index];
  };

  const getStatusIcon = (day: DaySummary) => {
    if (day.totalPlans === 0) return null;
    if (day.completedPlans === day.totalPlans) return '✓';
    if (day.completedPlans > 0) return '◐';
    return null;
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-500 mb-3">📅 캘린더 뷰</h3>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => {
          const isSelected = day.date === selectedDate;
          const statusIcon = getStatusIcon(day);

          return (
            <DroppableDateCell
              key={day.date}
              date={day.date}
              className="rounded-lg"
            >
              <button
                onClick={() => onDateSelect(day.date)}
                className={cn(
                  'w-full flex flex-col items-center p-2 rounded-lg border transition-all',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : day.isExclusionDay
                    ? 'border-orange-300 bg-orange-50 hover:border-orange-400'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  day.isToday && !isSelected && !day.isExclusionDay && 'border-blue-300 bg-blue-50/50'
                )}
                title={day.isExclusionDay ? `${day.exclusionType}${day.exclusionReason ? `: ${day.exclusionReason}` : ''}` : undefined}
              >
                {/* 요일 */}
                <span
                  className={cn(
                    'text-xs font-medium',
                    index === 6 ? 'text-red-500' : index === 5 ? 'text-blue-500' : 'text-gray-600'
                  )}
                >
                  {getDayLabel(index)}
                </span>

                {/* 날짜 */}
                <span
                  className={cn(
                    'text-lg font-bold mt-1',
                    isSelected ? 'text-blue-600' : 'text-gray-900'
                  )}
                >
                  {new Date(day.date + 'T00:00:00').getDate()}
                </span>

                {/* 상태 아이콘 또는 플랜 수 */}
                <div className="mt-1 h-5">
                  {day.isExclusionDay ? (
                    <span className="text-xs text-orange-600 font-medium" title={day.exclusionReason ?? day.exclusionType}>
                      {day.exclusionType === '휴가' ? '🏖' : day.exclusionType === '개인사정' ? '📅' : '⛔'}
                    </span>
                  ) : day.dayType === '복습일' ? (
                    <span className="text-xs text-purple-600 font-medium">R</span>
                  ) : statusIcon ? (
                    <span
                      className={cn(
                        'text-sm',
                        statusIcon === '✓' ? 'text-green-500' : 'text-amber-500'
                      )}
                    >
                      {statusIcon}
                    </span>
                  ) : day.totalPlans > 0 ? (
                    <span className="text-xs text-gray-500">
                      {day.completedPlans}/{day.totalPlans}
                    </span>
                  ) : null}
                </div>

                {/* 주차/일차 정보 (학습일/복습일인 경우에만) */}
                {day.weekNumber != null && day.cycleDayNumber != null && (
                  <span className="text-[9px] text-gray-400 mt-0.5">
                    {day.weekNumber}주{day.cycleDayNumber}일
                  </span>
                )}

                {/* 오늘 표시 */}
                {day.isToday && (
                  <span className="text-[10px] text-blue-500 font-medium">오늘</span>
                )}

                {/* 타임라인 바 */}
                {dateTimeSlots?.[day.date] && dateTimeSlots[day.date].length > 0 && (
                  <MiniTimelineBar
                    timeSlots={dateTimeSlots[day.date]}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTimelineClick?.(day.date);
                    }}
                    className="mt-1 w-full"
                  />
                )}
              </button>
            </DroppableDateCell>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> 완료
        </span>
        <span className="flex items-center gap-1">
          <span className="text-amber-500">◐</span> 진행중
        </span>
        <span className="flex items-center gap-1">
          <span className="text-purple-600 font-medium">R</span> 복습일
        </span>
        <span className="flex items-center gap-1">
          <span className="text-orange-600">⛔</span> 제외일
        </span>
      </div>
    </div>
  );
}
