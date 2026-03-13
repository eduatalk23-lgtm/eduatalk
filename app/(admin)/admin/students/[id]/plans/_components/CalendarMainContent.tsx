'use client';

import { useMemo, useCallback } from 'react';
import { DailyDock } from './DailyDock';
import { SettingsTab, AnalyticsTab, ProgressTab, HistoryTab } from './tabs';
import { SearchResultsView } from './calendar-views/SearchResultsView';
import { EventDetailPopover } from './items/EventDetailPopover';
import { useEventDetailPopover } from './hooks/useEventDetailPopover';
import type { CalendarView } from './CalendarNavHeader';
import type { PlanStatus } from '@/lib/types/plan';
import {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanActions,
} from './context/AdminPlanContext';
import { usePlanTabState, type PlanTabKey } from './hooks/usePlanTabState';
import { useCalendarSwipeNavigation } from './hooks/useCalendarSwipeNavigation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';

interface CalendarMainContentProps {
  calendarView: CalendarView;
  onCalendarViewChange: (view: CalendarView) => void;
  customDayCount?: number;
  onCustomDayCountChange?: (count: number) => void;
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
  customDayCount = 7,
  onCustomDayCountChange,
}: CalendarMainContentProps) {
  const { activeTab } = usePlanTabState();

  const {
    studentId,
    tenantId,
    selectedCalendarId,
    calendarDateTimeSlots,
    calendarExclusions,
    initialDockData,
    initialDate,
  } = useAdminPlanBasic();

  const {
    selectedGroupId,
    selectedDate,
    handleDateChange,
    searchQuery,
    setSearchQuery,
    resolvedVisibleCalendarIds,
    calendarColorMap,
    handleRefresh,
    refreshDailyAndWeekly,
  } = useAdminPlanFilter();

  const {
    handleOpenEdit,
    handleOpenStatusChange,
    handleCreatePlanAtSlot,
    handleOpenEventEditNew,
    handleOpenConsultationEditNew,
  } = useAdminPlanActions();

  // DailyDock initialData (날짜 변경 시 undefined)
  const useInitialData = selectedDate === initialDate;
  const dailyInitialData = useMemo(() => {
    if (!useInitialData) return undefined;
    return {
      plans: initialDockData?.dailyPlans,
    };
  }, [useInitialData, initialDockData?.dailyPlans]);

  const isMobile = useIsMobile();
  const { swipeHandlers } = useCalendarSwipeNavigation({
    activeView: calendarView,
    selectedDate,
    onNavigate: handleDateChange,
    isMobile3Day: isMobile && calendarView === 'weekly' && customDayCount === 7,
    customDayCount,
  });

  // 검색 결과 뷰용 EventDetailPopover
  const { showPopover, popoverProps } = useEventDetailPopover({
    onEdit: handleOpenEdit,
    onQuickStatusChange: useCallback(
      (planId: string, _newStatus: PlanStatus, prevStatus: PlanStatus) => {
        // handleOpenStatusChange: (planId, currentStatus, title)
        handleOpenStatusChange(planId, prevStatus, '');
      },
      [handleOpenStatusChange],
    ),
    onConsultationStatusChange: useCallback(
      async (eventId: string, status: 'completed' | 'no_show' | 'cancelled' | 'scheduled') => {
        const { updateScheduleStatus } = await import('@/lib/domains/consulting/actions/schedule');
        await updateScheduleStatus(eventId, status, studentId, status === 'cancelled');
      },
      [studentId],
    ),
  });

  // 검색어가 있으면 캘린더 그리드를 검색 결과 리스트로 대체 (GCal 패턴)
  const isSearchActive = !!(searchQuery && searchQuery.trim().length > 0);

  if (activeTab === 'planner') {
    if (isSearchActive && selectedCalendarId) {
      return (
        <div className="h-full flex flex-col">
          <SearchResultsView
            searchQuery={searchQuery}
            studentId={studentId}
            calendarId={selectedCalendarId}
            onPlanClick={showPopover}
            onDateSelect={(date) => {
              handleDateChange(date);
              setSearchQuery('');
            }}
            calendarColorMap={calendarColorMap}
          />
          {popoverProps && <EventDetailPopover {...popoverProps} />}
        </div>
      );
    }

    return (
      <div className="h-full overflow-hidden" {...swipeHandlers}>
        <DailyDock
          studentId={studentId}
          tenantId={tenantId}
          calendarId={selectedCalendarId ?? undefined}
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
          onCalendarViewChange={onCalendarViewChange}
          hideNavHeader
          calendarExclusions={calendarExclusions}
          searchQuery={searchQuery}
          visibleCalendarIds={resolvedVisibleCalendarIds}
          onOpenEventEditNew={handleOpenEventEditNew}
          onOpenConsultationEditNew={handleOpenConsultationEditNew}
          customDayCount={customDayCount}
          onCustomDayCountChange={onCustomDayCountChange}
        />
      </div>
    );
  }

  // 비-플래너 탭 렌더링
  // settings 탭은 자체 스크롤을 관리하므로 overflow 제거 + padding 없음
  if (activeTab === 'settings') {
    return (
      <div className="h-full">
        <TabRenderer activeTab={activeTab} />
      </div>
    );
  }

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
