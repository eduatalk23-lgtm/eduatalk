'use client';

import { useState, useTransition, useMemo, useCallback, useEffect, memo } from 'react';
import { startOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { DroppableContainer } from './dnd';
import { usePlanToast } from './PlanToast';
import { useDailyCalendarEvents } from '@/lib/hooks/useCalendarEventQueries';
import {
  calendarEventsToDailyPlans,
  calendarEventsToAdHocPlans,
  calendarEventsToNonStudyItems,
  calendarEventsToAllDayItems,
} from '@/lib/domains/calendar/adapters';
import { detectTimeConflicts } from '@/lib/domains/admin-plan/utils/conflictDetection';
import type { NonStudyItem } from '@/lib/query-options/adminDock';
import { deletePlan, movePlanToContainer } from '@/lib/domains/calendar/actions/legacyBridge';
import { useUndo } from './UndoSnackbar';
import { NonStudyTimeEditModal } from './modals/NonStudyTimeEditModal';
import { CollapsedDockCard } from './CollapsedDockCard';
import { DailyDockGridView } from './DailyDockGridView';
import { WeeklyGridView } from './WeeklyGridView';
import AdminMonthView from './calendar-views/AdminMonthView';
import { useAdminCalendarData } from './calendar-views/_hooks/useAdminCalendarData';
import type { ExclusionsByDate } from './calendar-views/_types/adminCalendar';
import type { ContentTypeFilter } from './AdminPlanManagement';
import type { PlanStatus } from '@/lib/types/plan';
import type { CalendarPlan } from './calendar-views/_types/adminCalendar';
import { CalendarNavHeader, type CalendarView } from './CalendarNavHeader';

/** 스켈레톤 로딩 UI용 상수 배열 (매 렌더마다 새 배열 생성 방지) */
const SKELETON_ITEMS = [1, 2] as const;

interface DailyDockProps {
  studentId: string;
  tenantId: string;
  /** 플래너 ID (플래너 기반 필터링용) */
  plannerId?: string;
  selectedDate: string;
  /** 선택된 플랜 그룹 ID (null = 전체 보기) */
  selectedGroupId?: string | null;
  /** 콘텐츠 유형 필터 */
  contentTypeFilter?: ContentTypeFilter;
  onEdit?: (planId: string) => void;
  onStatusChange?: (planId: string, currentStatus: PlanStatus, title: string) => void;
  /** 전체 새로고침 (기본) */
  onRefresh: () => void;
  /** Daily + Weekly만 새로고침 (컨테이너 이동 시 사용) */
  onRefreshDailyAndWeekly?: () => void;
  /** 빈 시간 슬롯에 새 플랜 생성 */
  onCreatePlanAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  /** SSR 프리페치된 데이터 */
  initialData?: {
    plans?: import('@/lib/query-options/adminDock').DailyPlan[];
    adHocPlans?: import('@/lib/query-options/adminDock').AdHocPlan[];
    nonStudyItems?: import('@/lib/query-options/adminDock').NonStudyItem[];
  };
  /** 축소 상태 여부 (가로 아코디언 레이아웃용) */
  isCollapsed?: boolean;
  /** 확장 클릭 핸들러 (축소 상태에서만 사용) */
  onExpand?: () => void;
  /** 날짜 변경 핸들러 (주간 그리드 뷰에서 날짜 클릭 시) */
  onDateChange?: (date: string) => void;
  /** 삭제 핸들러 (EventPopover에서 사용) */
  onDelete?: (planId: string, isAdHoc: boolean) => void;
  /** 외부 제어 캘린더 뷰 (PlannerTab에서 리프팅) */
  calendarView?: CalendarView;
  /** 캘린더 뷰 변경 콜백 */
  onCalendarViewChange?: (view: CalendarView) => void;
  /** CalendarNavHeader 숨김 (CalendarTopBar가 대신 사용될 때) */
  hideNavHeader?: boolean;
  /** 플래너 제외일 데이터 (월간 뷰에서 사용) */
  plannerExclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
}

/**
 * DailyDock - 일일 플랜 Dock 컴포넌트
 *
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const DailyDock = memo(function DailyDock({
  studentId,
  tenantId,
  plannerId,
  selectedDate,
  selectedGroupId,
  contentTypeFilter = 'all',
  onEdit,
  onStatusChange,
  onRefresh,
  onRefreshDailyAndWeekly,
  onCreatePlanAtSlot,
  initialData,
  isCollapsed = false,
  onExpand,
  onDateChange,
  onDelete,
  calendarView: calendarViewProp,
  onCalendarViewChange: onCalendarViewChangeProp,
  hideNavHeader = false,
  plannerExclusions,
  searchQuery,
}: DailyDockProps) {
  // 캘린더 이벤트 1회 fetch → 어댑터로 레거시 타입 변환
  const { events, isLoading } = useDailyCalendarEvents(studentId, plannerId, selectedDate);
  const allPlans = useMemo(() => calendarEventsToDailyPlans(events), [events]);
  const adHocPlans = useMemo(() => calendarEventsToAdHocPlans(events), [events]);
  const nonStudyItems = useMemo(() => calendarEventsToNonStudyItems(events), [events]);
  const allDayItems = useMemo(() => calendarEventsToAllDayItems(events), [events]);

  // 캘린더 뷰: controlled (PlannerTab에서 제어) / uncontrolled (내부 상태)
  const [internalView, setInternalView] = useState<CalendarView>('weekly');

  // props 우선, 없으면 내부 상태
  const calendarView = calendarViewProp ?? internalView;

  const handleInternalViewChange = useCallback((view: CalendarView) => {
    setInternalView(view);
    localStorage.setItem('dailyDock_viewLayout', view);
  }, []);

  const handleCalendarViewChange = onCalendarViewChangeProp ?? handleInternalViewChange;

  // 주간뷰 날짜 클릭 → 해당 날짜의 일일뷰로 전환
  const handleSwitchToDaily = useCallback((date: string) => {
    onDateChange?.(date);
    handleCalendarViewChange('daily');
  }, [onDateChange, handleCalendarViewChange]);

  // localStorage 복원 (controlled일 때 건너뜀)
  useEffect(() => {
    if (calendarViewProp !== undefined) return;
    const saved = localStorage.getItem('dailyDock_viewLayout');

    // 기존 값 마이그레이션
    if (saved === 'list' || saved === 'grid') {
      setInternalView('daily');
      localStorage.setItem('dailyDock_viewLayout', 'daily');
    } else if (saved === 'weeklyGrid') {
      setInternalView('weekly');
      localStorage.setItem('dailyDock_viewLayout', 'weekly');
    } else if (saved === 'daily' || saved === 'weekly' || saved === 'month') {
      setInternalView(saved as CalendarView);
    }
    // saved가 null이면 기본값 'weekly' 유지
  }, [calendarViewProp]);

  // 월간 뷰 데이터 (항상 호출하되, React Query 캐싱으로 효율적)
  const currentMonth = useMemo(
    () => startOfMonth(new Date(selectedDate + 'T00:00:00')),
    [selectedDate]
  );

  const { plansByDate: monthlyPlansByDate, isLoading: isMonthlyLoading } = useAdminCalendarData({
    studentId,
    currentMonth,
    plannerId,
  });

  // 월간 뷰용 그룹 필터링
  const filteredMonthlyPlansByDate = useMemo(() => {
    if (!selectedGroupId) return monthlyPlansByDate;
    const filtered: typeof monthlyPlansByDate = {};
    for (const [date, plans] of Object.entries(monthlyPlansByDate)) {
      const groupPlans = plans.filter(p => p.plan_group_id === selectedGroupId);
      if (groupPlans.length > 0) filtered[date] = groupPlans;
    }
    return filtered;
  }, [monthlyPlansByDate, selectedGroupId]);

  // 제외일 데이터 변환 (plannerExclusions → ExclusionsByDate)
  const exclusionsByDate = useMemo<ExclusionsByDate>(() => {
    if (!plannerExclusions) return {};
    const map: Record<string, { exclusion_type: string; reason: string | null }> = {};
    for (const exc of plannerExclusions) {
      map[exc.exclusionDate] = {
        exclusion_type: exc.exclusionType,
        reason: exc.reason ?? null,
      };
    }
    return map as ExclusionsByDate;
  }, [plannerExclusions]);

  // 검색 하이라이트 플랜 ID 계산 (월간 뷰)
  const highlightedPlanIds = useMemo(() => {
    if (!searchQuery) return undefined;
    const query = searchQuery.toLowerCase();
    const ids = new Set<string>();

    const matchPlan = (plan: CalendarPlan) => {
      const fields = [
        plan.content_title,
        plan.custom_title,
        plan.content_subject,
        plan.content_subject_category,
      ];
      return fields.some((f) => f?.toLowerCase().includes(query));
    };

    for (const plans of Object.values(monthlyPlansByDate)) {
      for (const plan of plans) {
        if (matchPlan(plan)) ids.add(plan.id);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [searchQuery, monthlyPlansByDate]);

  // 그룹 필터링 적용
  const groupFilteredPlans = useMemo(() => {
    if (selectedGroupId === null || selectedGroupId === undefined) return allPlans;
    return allPlans.filter(plan => plan.plan_group_id === selectedGroupId);
  }, [allPlans, selectedGroupId]);

  // 콘텐츠 유형 필터 적용
  const plans = useMemo(() => {
    if (contentTypeFilter === 'all') return groupFilteredPlans;
    return groupFilteredPlans.filter(plan => plan.content_type === contentTypeFilter);
  }, [groupFilteredPlans, contentTypeFilter]);

  // 재정렬에 필요한 훅들
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();
  const { pushUndoable } = useUndo();

  // 시간 충돌 감지 (필터링된 플랜 기준)
  const conflictMap = useMemo(() => {
    const timeSlots = allPlans.map((plan) => ({
      id: plan.id,
      title: plan.content_title ?? plan.custom_title ?? '플랜',
      startTime: plan.start_time ?? null,
      endTime: plan.end_time ?? null,
    }));
    return detectTimeConflicts(timeSlots);
  }, [allPlans]);

  // 비학습시간 편집 모달 상태
  const [editingNonStudy, setEditingNonStudy] = useState<{
    open: boolean;
    item: NonStudyItem | null;
    sourceIndex?: number;
    initialStartTime?: string;
  }>({ open: false, item: null });

  // 비학습시간 클릭 핸들러
  const handleNonStudyTimeClick = useCallback((item: NonStudyItem, sourceIndex?: number) => {
    setEditingNonStudy({ open: true, item, sourceIndex });
  }, []);

  // 비학습시간 편집 성공 핸들러
  const handleNonStudyEditSuccess = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  const handleMoveToWeekly = async (planId: string) => {
    startTransition(async () => {
      const result = await movePlanToContainer({
        planId,
        targetContainer: 'weekly',
        skipRevalidation: true,
      });

      if (!result.success) {
        showToast(result.error ?? '주간 플랜으로 이동 실패', 'error');
        return;
      }

      showToast('주간 플랜으로 이동했습니다.', 'success');
      // 타겟 새로고침: Daily + Weekly만 (Unfinished는 영향 없음)
      (onRefreshDailyAndWeekly ?? onRefresh)();
    });
  };

  // 즉시 삭제 + Undo 스낵바 (calendar soft-delete → undo는 restoreEvent)
  const handleDeleteRequest = (planId: string, isAdHoc = false) => {
    startTransition(async () => {
      const result = await deletePlan({
        planId,
        isAdHoc,
        skipRevalidation: true,
      });

      if (!result.success) {
        showToast(result.error ?? '삭제 실패', 'error');
        return;
      }

      onRefresh();

      pushUndoable({
        type: 'delete-plan',
        planId,
        isAdHoc,
        description: '플랜이 삭제되었습니다.',
      });
    });
  };

  const totalCount = plans.length + adHocPlans.length;

  // 완료된 플랜 수 메모이제이션
  const completedCount = useMemo(
    () =>
      plans.filter((p) => p.status === 'completed').length +
      adHocPlans.filter((p) => p.status === 'completed').length,
    [plans, adHocPlans]
  );

  // 축소 상태 (가로 아코디언 레이아웃)
  if (isCollapsed) {
    return (
      <CollapsedDockCard
        type="daily"
        icon="📦"
        title="오늘"
        count={totalCount}
        completedCount={completedCount}
        onClick={onExpand ?? (() => {})}
      />
    );
  }

  return (
    <DroppableContainer id="daily" className="h-full">
      <div
        className={cn(
          'bg-blue-50 rounded-lg border border-blue-200 h-full flex flex-col',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
      {/* Google Calendar 스타일 네비게이션 헤더 (CalendarTopBar 사용 시 숨김) */}
      {!hideNavHeader && (
        <CalendarNavHeader
          activeView={calendarView}
          onViewChange={handleCalendarViewChange}
          selectedDate={selectedDate}
          onNavigate={onDateChange ?? (() => {})}
          totalCount={totalCount}
          completedCount={completedCount}
        />
      )}

      <AnimatePresence mode="wait">
        {/* 일간 그리드 뷰 */}
        {calendarView === 'daily' && !isLoading && (
          <motion.div
            key="daily"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden"
          >
            <DailyDockGridView
              plans={plans}
              adHocPlans={adHocPlans}
              nonStudyItems={nonStudyItems}
              selectedDate={selectedDate}
              conflictMap={conflictMap}
              studentId={studentId}
              tenantId={tenantId}
              plannerId={plannerId}
              planGroupId={selectedGroupId}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onMoveToWeekly={handleMoveToWeekly}
              onRefresh={onRefresh}
              onNonStudyClick={handleNonStudyTimeClick}
              onCreatePlanAtSlot={onCreatePlanAtSlot}
              onDelete={(planId, isAdHoc) => {
                if (onDelete) {
                  onDelete(planId, isAdHoc);
                } else {
                  handleDeleteRequest(planId, isAdHoc);
                }
              }}
              searchQuery={searchQuery}
              allDayItems={allDayItems}
            />
          </motion.div>
        )}

        {/* 일간 로딩 상태 */}
        {calendarView === 'daily' && isLoading && (
          <div key="daily-loading" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {SKELETON_ITEMS.map((i) => (
                <div key={i} className="h-16 bg-blue-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* 주간 그리드 뷰 */}
        {calendarView === 'weekly' && (
          <motion.div
            key="weekly"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden"
          >
            <WeeklyGridView
              studentId={studentId}
              tenantId={tenantId}
              plannerId={plannerId}
              selectedDate={selectedDate}
              selectedGroupId={selectedGroupId}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onMoveToWeekly={handleMoveToWeekly}
              onRefresh={onRefresh}
              onDateChange={onDateChange ?? (() => {})}
              onNonStudyClick={handleNonStudyTimeClick}
              onCreatePlanAtSlot={onCreatePlanAtSlot}
              onDelete={(planId, isAdHoc) => {
                if (onDelete) {
                  onDelete(planId, isAdHoc);
                } else {
                  handleDeleteRequest(planId, isAdHoc);
                }
              }}
              searchQuery={searchQuery}
              onSwitchToDaily={handleSwitchToDaily}
            />
          </motion.div>
        )}

        {/* 월간 뷰 */}
        {calendarView === 'month' && !isMonthlyLoading && (
          <motion.div
            key="month"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden"
          >
            <AdminMonthView
              studentId={studentId}
              tenantId={tenantId}
              plannerId={plannerId ?? ''}
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              onDateSelect={onDateChange ?? (() => {})}
              onMonthChange={() => {}}
              plansByDate={filteredMonthlyPlansByDate}
              exclusionsByDate={exclusionsByDate}
              dailySchedulesByDate={{}}
              onPlanClick={(planId) => onEdit?.(planId)}
              onPlanEdit={(planId) => onEdit?.(planId)}
              onPlanDelete={() => {}}
              onExclusionToggle={() => {}}
              onRefresh={onRefresh}
              highlightedPlanIds={highlightedPlanIds}
            />
          </motion.div>
        )}

        {/* 월간 뷰 로딩 */}
        {calendarView === 'month' && isMonthlyLoading && (
          <div key="month-loading" className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>
      </div>

      {/* 비학습시간 편집 모달 */}
      {editingNonStudy.item && plannerId && (
        <NonStudyTimeEditModal
          isOpen={editingNonStudy.open}
          onClose={() => {
            setEditingNonStudy({ open: false, item: null });
          }}
          item={editingNonStudy.item}
          sourceIndex={editingNonStudy.sourceIndex}
          plannerId={plannerId}
          selectedDate={selectedDate}
          onSuccess={handleNonStudyEditSuccess}
          initialStartTime={editingNonStudy.initialStartTime}
        />
      )}
    </DroppableContainer>
  );
});
