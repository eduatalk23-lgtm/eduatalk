'use client';

import { memo } from 'react';
import { WeeklyCalendar as SharedWeeklyCalendar } from '@/components/planner/WeeklyCalendar';
import type { DailyScheduleInfo } from '@/lib/types/plan';

interface WeeklyCalendarProps {
  studentId: string;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  plannerId?: string;
  selectedGroupId?: string | null;
  dailySchedules?: DailyScheduleInfo[][];
  exclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  plannerPeriodStart?: string;
  plannerPeriodEnd?: string;
}

/**
 * Admin WeeklyCalendar - 3-Dock 아코디언 구조에서는 DnD를 독 내부로 제한하므로
 * 위클리 캘린더 날짜 셀에 드롭 기능을 제공하지 않음 (기본 래퍼 사용).
 */
export const WeeklyCalendar = memo(function WeeklyCalendar(props: WeeklyCalendarProps) {
  return (
    <SharedWeeklyCalendar
      {...props}
    />
  );
});
