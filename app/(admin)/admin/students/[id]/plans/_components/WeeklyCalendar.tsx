'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { DroppableDateCell } from './dnd';

interface WeeklyCalendarProps {
  studentId: string;
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

interface DaySummary {
  date: string;
  totalPlans: number;
  completedPlans: number;
  isReviewDay: boolean;
  isToday: boolean;
}

export function WeeklyCalendar({
  studentId,
  selectedDate,
  onDateSelect,
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

      const today = new Date().toISOString().split('T')[0];

      // 7일간의 날짜 생성
      const days: DaySummary[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        days.push({
          date: dateStr,
          totalPlans: 0,
          completedPlans: 0,
          isReviewDay: i === 6, // 일요일을 복습일로 가정
          isToday: dateStr === today,
        });
      }

      // 플랜 데이터 조회
      const weekStartStr = days[0].date;
      const weekEndStr = days[6].date;

      const { data: plans } = await supabase
        .from('student_plan')
        .select('plan_date, status')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .eq('container_type', 'daily')
        .gte('plan_date', weekStartStr)
        .lte('plan_date', weekEndStr);

      // 날짜별로 집계
      for (const plan of plans ?? []) {
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
  }, [studentId, selectedDate]);

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
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  day.isToday && !isSelected && 'border-blue-300 bg-blue-50/50'
                )}
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
                  {day.isReviewDay ? (
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

                {/* 오늘 표시 */}
                {day.isToday && (
                  <span className="text-[10px] text-blue-500 font-medium">오늘</span>
                )}
              </button>
            </DroppableDateCell>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="text-green-500">✓</span> 완료
        </span>
        <span className="flex items-center gap-1">
          <span className="text-amber-500">◐</span> 진행중
        </span>
        <span className="flex items-center gap-1">
          <span className="text-purple-600 font-medium">R</span> 복습일
        </span>
      </div>
    </div>
  );
}
