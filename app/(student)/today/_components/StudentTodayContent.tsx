'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { HorizontalDockLayout } from '@/components/planner/HorizontalDockLayout';
import { WeeklyCalendar } from '@/components/planner/WeeklyCalendar';
import { usePlanRealtimeUpdates } from '@/lib/realtime/usePlanRealtimeUpdates';
import {
  fetchPlannerScheduleAction,
  type PlannerScheduleData,
} from '@/lib/domains/admin-plan/actions/plannerScheduleQuery';
import type { Planner } from '@/lib/domains/admin-plan/actions/planners';
import type { PrefetchedDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';
import { StudentPlanProvider, useStudentPlan } from './context/StudentPlanContext';
import { StudentPlannerSelector } from './StudentPlannerSelector';
import { StudentDailyDock } from './StudentDailyDock';
import { StudentWeeklyDock } from './StudentWeeklyDock';
import { StudentUnfinishedDock } from './StudentUnfinishedDock';
import { DailySummaryBar } from './DailySummaryBar';

interface StudentTodayContentProps {
  studentId: string;
  tenantId: string;
  planners: Planner[];
  initialPlannerId?: string;
  initialDate: string;
  initialDockData?: PrefetchedDockData;
  /** SSR 시점의 플래너 스케줄 데이터 (초기 로딩 최적화) */
  initialScheduleData?: PlannerScheduleData;
}

export function StudentTodayContent(props: StudentTodayContentProps) {
  return (
    <StudentPlanProvider
      studentId={props.studentId}
      tenantId={props.tenantId}
      planners={props.planners}
      initialPlannerId={props.initialPlannerId}
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
  initialScheduleData?: PlannerScheduleData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    studentId,
    planners,
    selectedPlannerId,
    setSelectedPlannerId,
    selectedDate,
    setSelectedDate,
    expandedDock,
    setExpandedDock,
    initialPlannerId,
  } = useStudentPlan();

  // 플래너 스케줄 데이터를 React Query로 관리 (플래너 전환 시 자동 갱신)
  const { data: scheduleData } = useQuery({
    queryKey: ['plannerSchedule', selectedPlannerId, studentId],
    queryFn: () => fetchPlannerScheduleAction(selectedPlannerId!, studentId),
    enabled: !!selectedPlannerId,
    // SSR 데이터는 초기 플래너에만 적용
    initialData: selectedPlannerId === initialPlannerId ? initialScheduleData : undefined,
    staleTime: 5 * 60 * 1000,
    // 플래너 전환 시 이전 데이터를 유지하여 로딩 깜빡임 방지
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
  const updateUrl = useCallback((plannerId?: string, date?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (plannerId) params.set('plannerId', plannerId);
    if (date) params.set('date', date);
    router.replace(`/today?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handlePlannerChange = useCallback((id: string) => {
    setSelectedPlannerId(id);
    updateUrl(id, selectedDate);
  }, [setSelectedPlannerId, updateUrl, selectedDate]);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    updateUrl(selectedPlannerId, date);
  }, [setSelectedDate, updateUrl, selectedPlannerId]);

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더: 플래너 선택 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">오늘의 학습</h1>
        <StudentPlannerSelector
          planners={planners}
          selectedPlannerId={selectedPlannerId}
          onSelect={handlePlannerChange}
        />
      </div>

      {/* 주간 캘린더 */}
      <WeeklyCalendar
        studentId={studentId}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        plannerId={selectedPlannerId}
        dailySchedules={effectiveDailySchedules}
        exclusions={scheduleData?.exclusions}
      />

      {/* 일간 요약 */}
      <DailySummaryBar />

      {/* 3-Dock 아코디언 레이아웃 */}
      <HorizontalDockLayout
        expandedDock={expandedDock}
        unfinished={
          <StudentUnfinishedDock
            isCollapsed={expandedDock !== 'unfinished'}
            onExpand={() => setExpandedDock('unfinished')}
          />
        }
        daily={
          <StudentDailyDock
            isCollapsed={expandedDock !== 'daily'}
            onExpand={() => setExpandedDock('daily')}
          />
        }
        weekly={
          <StudentWeeklyDock
            isCollapsed={expandedDock !== 'weekly'}
            onExpand={() => setExpandedDock('weekly')}
          />
        }
      />
    </div>
  );
}
