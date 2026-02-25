'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { WeeklyCalendar } from '@/components/planner/WeeklyCalendar';
import { usePlanRealtimeUpdates } from '@/lib/realtime/usePlanRealtimeUpdates';
import {
  fetchCalendarScheduleAction,
  type CalendarScheduleData,
} from '@/lib/domains/admin-plan/actions/calendarScheduleQuery';
import type { CalendarSettings } from '@/lib/domains/admin-plan/types';
import type { PrefetchedDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';
import { StudentPlanProvider, useStudentPlan } from './context/StudentPlanContext';
import { StudentCalendarSelector } from './StudentPlannerSelector';
import { StudentDailyDock } from './StudentDailyDock';
import { DailySummaryBar } from './DailySummaryBar';

interface StudentTodayContentProps {
  studentId: string;
  tenantId: string;
  calendars: CalendarSettings[];
  initialCalendarId?: string;
  initialDate: string;
  initialDockData?: PrefetchedDockData;
  /** SSR 시점의 스케줄 데이터 (초기 로딩 최적화) */
  initialScheduleData?: CalendarScheduleData;
}

export function StudentTodayContent(props: StudentTodayContentProps) {
  return (
    <StudentPlanProvider
      studentId={props.studentId}
      tenantId={props.tenantId}
      calendars={props.calendars}
      initialCalendarId={props.initialCalendarId}
      initialDate={props.initialDate}
      initialDockData={props.initialDockData}
    >
      <StudentTodayContentInner
        initialScheduleData={props.initialScheduleData}
      />
    </StudentPlanProvider>
  );
}

function StudentTodayContentInner({
  initialScheduleData,
}: {
  initialScheduleData?: CalendarScheduleData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    studentId,
    calendars,
    selectedCalendarId,
    setSelectedCalendarId,
    selectedDate,
    setSelectedDate,
    initialCalendarId,
  } = useStudentPlan();

  // 캘린더 스케줄 데이터를 React Query로 관리 (캘린더 전환 시 자동 갱신)
  const { data: scheduleData } = useQuery({
    queryKey: ['calendarSchedule', selectedCalendarId, studentId],
    queryFn: () => fetchCalendarScheduleAction(selectedCalendarId!, studentId),
    enabled: !!selectedCalendarId,
    // SSR 데이터는 초기 캘린더에만 적용
    initialData: selectedCalendarId === initialCalendarId ? initialScheduleData : undefined,
    staleTime: 5 * 60 * 1000,
    // 캘린더 전환 시 이전 데이터를 유지하여 로딩 깜빡임 방지
    placeholderData: (prev) => prev,
  });

  // fallback: calculatedSchedule → dailySchedules
  const effectiveDailySchedules = useMemo(
    () =>
      scheduleData?.calculatedSchedule
        ? [scheduleData.calculatedSchedule]
        : scheduleData?.dailySchedules,
    [scheduleData]
  );

  // Realtime 구독
  usePlanRealtimeUpdates({
    planDate: selectedDate,
    userId: studentId,
  });

  // URL 동기화
  const updateUrl = useCallback((calendarId?: string, date?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (calendarId) params.set('calendarId', calendarId);
    else params.delete('calendarId');
    if (date) params.set('date', date);
    router.replace(`/today?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleCalendarChange = useCallback((id: string) => {
    setSelectedCalendarId(id);
    updateUrl(id, selectedDate);
  }, [setSelectedCalendarId, updateUrl, selectedDate]);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    updateUrl(selectedCalendarId, date);
  }, [setSelectedDate, updateUrl, selectedCalendarId]);

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더: 캘린더 선택 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">오늘의 학습</h1>
        <StudentCalendarSelector
          calendars={calendars}
          selectedCalendarId={selectedCalendarId}
          onSelect={handleCalendarChange}
        />
      </div>

      {/* 주간 캘린더 */}
      <WeeklyCalendar
        studentId={studentId}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        calendarId={selectedCalendarId}
        dailySchedules={effectiveDailySchedules}
        exclusions={scheduleData?.exclusions}
      />

      {/* 일간 요약 */}
      <DailySummaryBar />

      {/* 일일 플랜 */}
      <StudentDailyDock />
    </div>
  );
}
