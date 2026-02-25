"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DailyDock } from "../DailyDock";
import { WeeklyCalendar } from "../WeeklyCalendar";
import { PlanGroupSummaryCard } from "../PlanGroupSummaryCard";
import { AllGroupsSummaryCard } from "../AllGroupsSummaryCard";
import type { CalendarView } from "../CalendarNavHeader";
import {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanActions,
} from "../context/AdminPlanContext";

interface PlannerTabProps {
  tab: "planner";
}

/**
 * 플래너 탭 컴포넌트 (메인 Dock 뷰)
 *
 * 포함 컴포넌트:
 * - UnfinishedDock: 미완료 플랜
 * - WeeklyCalendar: 주간 캘린더 미니뷰
 * - PlanGroupSummaryCard: 특정 플랜 그룹 요약 (그룹 선택 시)
 * - AllGroupsSummaryCard: 전체 플랜 그룹 통합 요약 (전체 보기 시)
 * - DailyDock: 일일 플랜
 * - WeeklyDock: 주간 플랜
 *
 * 성능 최적화:
 * - useAdminPlanBasic: 정적 정보 (studentId, planner data)
 * - useAdminPlanFilter: 필터 상태 (date, group)
 * - useAdminPlanActions: 핸들러 함수
 * - Modal Context 미사용 → 모달 상태 변경 시 리렌더링 없음
 */
export function PlannerTab({ tab: _tab }: PlannerTabProps) {
  // 캘린더 뷰 상태 (리프팅: DailyDock에서 PlannerTab으로)
  const [calendarView, setCalendarView] = useState<CalendarView>('weekly');

  // localStorage 복원 + 마이그레이션
  useEffect(() => {
    const saved = localStorage.getItem('dailyDock_viewLayout');
    if (saved === 'weeklyGrid') {
      setCalendarView('weekly');
      localStorage.setItem('dailyDock_viewLayout', 'weekly');
    } else if (saved === 'daily' || saved === 'weekly' || saved === 'month') {
      setCalendarView(saved as CalendarView);
    }
    // 레거시 'list'/'grid' 값은 'daily'로 마이그레이션
    if (saved === 'list' || saved === 'grid') {
      setCalendarView('daily');
      localStorage.setItem('dailyDock_viewLayout', 'daily');
    }
  }, []);

  const handleCalendarViewChange = useCallback((view: CalendarView) => {
    setCalendarView(view);
    localStorage.setItem('dailyDock_viewLayout', view);
  }, []);

  // 분리된 Context 사용 (Modal 제외 → 모달 열림/닫힘에 리렌더링 안 함)
  const {
    studentId,
    tenantId,
    selectedCalendarId,
    activePlanGroupId,
    allPlanGroups,
    calendarDailySchedules,
    calendarExclusions,
    calendarCalculatedSchedule,
    calendarDateTimeSlots,
    initialDockData,
    initialDate,
  } = useAdminPlanBasic();

  const {
    selectedGroupId,
    selectedDate,
    handleDateChange,
    handleRefresh,
    refreshDailyAndWeekly,
    refreshDailyAndUnfinished,
  } = useAdminPlanFilter();

  const {
    handleOpenRedistribute,
    handleOpenEdit,
    handleOpenReorder,
    handleOpenMoveToGroup,
    handleOpenCopy,
    handleOpenStatusChange,
    handleCreatePlanAtSlot,
  } = useAdminPlanActions();

  // 플래너 레벨 스케줄 우선 사용 (플랜 그룹 없어도 주차/일차 표시)
  // useMemo로 참조 안정화 → WeeklyCalendar 내부 useMemo/useEffect 연쇄 무효화 방지
  const effectiveDailySchedules = useMemo(
    () =>
      calendarCalculatedSchedule
        ? [calendarCalculatedSchedule]
        : calendarDailySchedules,
    [calendarCalculatedSchedule, calendarDailySchedules]
  );

  // 선택된 플랜 그룹의 기간 정보 추출 (전체 보기 시 전체 기간)
  const selectedPlanGroup = selectedGroupId
    ? allPlanGroups?.find((group) => group.id === selectedGroupId)
    : null;

  // 전체 보기 시 모든 그룹의 기간을 포함
  const periodStart = selectedPlanGroup?.periodStart
    ?? allPlanGroups?.reduce<string | undefined>((earliest, group) => {
        if (!group.periodStart) return earliest;
        if (!earliest || group.periodStart < earliest) return group.periodStart;
        return earliest;
      }, undefined);

  const periodEnd = selectedPlanGroup?.periodEnd
    ?? allPlanGroups?.reduce<string | undefined>((latest, group) => {
        if (!group.periodEnd) return latest;
        if (!latest || group.periodEnd > latest) return group.periodEnd;
        return latest;
      }, undefined);

  // initialDockData는 initialDate에 대한 데이터이므로, selectedDate가 변경되면 무시
  const useInitialData = selectedDate === initialDate;

  // DailyDock initialData (참조 안정화, 날짜가 변경되면 undefined)
  const dailyInitialData = useMemo(() => {
    if (!useInitialData) return undefined;
    return {
      plans: initialDockData?.dailyPlans,
    };
  }, [useInitialData, initialDockData?.dailyPlans]);

  return (
    <div className="space-y-4">
      {/* 일간 뷰일 때만 미니캘린더 + 요약카드 표시 */}
      {calendarView === 'daily' && (
        <>
          <WeeklyCalendar
            studentId={studentId}
            selectedDate={selectedDate}
            onDateSelect={handleDateChange}
            calendarId={selectedCalendarId ?? undefined}
            selectedGroupId={selectedGroupId}
            dailySchedules={effectiveDailySchedules}
            exclusions={calendarExclusions}
            periodStart={periodStart}
            periodEnd={periodEnd}
          />

          {selectedGroupId ? (
            <PlanGroupSummaryCard
              planGroupId={selectedGroupId}
              tenantId={tenantId}
            />
          ) : (
            selectedCalendarId && (
              <AllGroupsSummaryCard
                calendarId={selectedCalendarId ?? undefined}
                tenantId={tenantId}
              />
            )
          )}
        </>
      )}

      {/* 풀사이즈 DailyDock (일간/주간/월간 뷰 전환은 DailyDock 내부에서 처리) */}
      <div className="h-[calc(100dvh-16rem)] min-h-[400px]">
        <DailyDock
          studentId={studentId}
          tenantId={tenantId}
          selectedDate={selectedDate}
          selectedGroupId={selectedGroupId}
          onEdit={handleOpenEdit}
          onStatusChange={handleOpenStatusChange}
          onRefresh={handleRefresh}
          onRefreshDailyAndWeekly={refreshDailyAndWeekly}
          onCreatePlanAtSlot={handleCreatePlanAtSlot}
          initialData={dailyInitialData}
          onDateChange={handleDateChange}
          calendarView={calendarView}
          onCalendarViewChange={handleCalendarViewChange}
        />
      </div>
    </div>
  );
}
