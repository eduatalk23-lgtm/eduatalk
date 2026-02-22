'use client';

import { useMemo } from 'react';
import { DailyDock } from './DailyDock';
import { SettingsTab, AnalyticsTab, ProgressTab, HistoryTab } from './tabs';
import type { CalendarView } from './CalendarNavHeader';
import {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanActions,
} from './context/AdminPlanContext';
import { usePlanTabState, type PlanTabKey } from './hooks/usePlanTabState';
import { useCalendarSwipeNavigation } from './hooks/useCalendarSwipeNavigation';

interface CalendarMainContentProps {
  calendarView: CalendarView;
  onCalendarViewChange: (view: CalendarView) => void;
}

/**
 * 캘린더 메인 컨텐츠 영역
 *
 * - activeTab === 'planner': DailyDock (hideNavHeader) 으로 일간/주간/월간 뷰
 * - activeTab !== 'planner': 설정/분석/진도/히스토리 탭 렌더링
 */
export function CalendarMainContent({
  calendarView,
  onCalendarViewChange,
}: CalendarMainContentProps) {
  const { activeTab } = usePlanTabState();

  const {
    studentId,
    tenantId,
    selectedPlannerId,
    plannerDateTimeSlots,
    plannerExclusions,
    initialDockData,
    initialDate,
  } = useAdminPlanBasic();

  const {
    selectedGroupId,
    selectedDate,
    handleDateChange,
    contentTypeFilter,
    searchQuery,
    handleRefresh,
    refreshDailyAndWeekly,
  } = useAdminPlanFilter();

  const {
    handleOpenEdit,
    handleOpenStatusChange,
    handleCreatePlanAtSlot,
  } = useAdminPlanActions();

  // DailyDock initialData (날짜 변경 시 undefined)
  const useInitialData = selectedDate === initialDate;
  const dailyInitialData = useMemo(() => {
    if (!useInitialData) return undefined;
    return {
      plans: initialDockData?.dailyPlans,
      adHocPlans: initialDockData?.dailyAdHocPlans,
      nonStudyItems: initialDockData?.nonStudyItems,
    };
  }, [useInitialData, initialDockData?.dailyPlans, initialDockData?.dailyAdHocPlans, initialDockData?.nonStudyItems]);

  const { swipeHandlers } = useCalendarSwipeNavigation({
    activeView: calendarView,
    selectedDate,
    onNavigate: handleDateChange,
  });

  if (activeTab === 'planner') {
    return (
      <div className="h-full" {...swipeHandlers}>
        <DailyDock
          studentId={studentId}
          tenantId={tenantId}
          plannerId={selectedPlannerId}
          selectedDate={selectedDate}
          selectedGroupId={selectedGroupId}
          contentTypeFilter={contentTypeFilter}
          onEdit={handleOpenEdit}
          onStatusChange={handleOpenStatusChange}
          onRefresh={handleRefresh}
          onRefreshDailyAndWeekly={refreshDailyAndWeekly}
          onCreatePlanAtSlot={handleCreatePlanAtSlot}
          initialData={dailyInitialData}
          isCollapsed={false}
          onDateChange={handleDateChange}
          calendarView={calendarView}
          onCalendarViewChange={onCalendarViewChange}
          hideNavHeader
          plannerExclusions={plannerExclusions}
          searchQuery={searchQuery}
        />
      </div>
    );
  }

  // 비-플래너 탭 렌더링
  return (
    <div className="h-full overflow-y-auto p-4">
      <TabRenderer activeTab={activeTab} />
    </div>
  );
}

function TabRenderer({ activeTab }: { activeTab: PlanTabKey }) {
  switch (activeTab) {
    case 'settings':
      return <SettingsTab tab="settings" />;
    case 'analytics':
      return <AnalyticsTab tab="analytics" />;
    case 'progress':
      return <ProgressTab tab="progress" />;
    case 'history':
      return <HistoryTab tab="history" />;
    default:
      return null;
  }
}
