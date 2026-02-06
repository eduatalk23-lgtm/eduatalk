'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HorizontalDockLayout } from '@/components/planner/HorizontalDockLayout';
import { WeeklyCalendar } from '@/components/planner/WeeklyCalendar';
import { usePlanRealtimeUpdates } from '@/lib/realtime/usePlanRealtimeUpdates';
import type { Planner } from '@/lib/domains/admin-plan/actions/planners';
import type { PrefetchedDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';
import type { DailyScheduleInfo } from '@/lib/types/plan';
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
  /** 플래너별 daily_schedule (WeeklyCalendar용) */
  plannerDailySchedules?: DailyScheduleInfo[][];
  /** 플래너 제외일 */
  plannerExclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
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
        plannerDailySchedules={props.plannerDailySchedules}
        plannerExclusions={props.plannerExclusions}
      />
    </StudentPlanProvider>
  );
}

function StudentTodayContentInner({
  plannerDailySchedules,
  plannerExclusions,
}: {
  plannerDailySchedules?: DailyScheduleInfo[][];
  plannerExclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
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
  } = useStudentPlan();

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
        dailySchedules={plannerDailySchedules}
        exclusions={plannerExclusions}
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
