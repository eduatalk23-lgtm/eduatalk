'use client';

import { useState, useTransition, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { startOfMonth, addMonths, startOfWeek, endOfWeek, endOfMonth, format, addDays } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { DroppableContainer } from './dnd';
import { usePlanToast } from './PlanToast';
import { useDailyCalendarEvents } from '@/lib/hooks/useCalendarEventQueries';
import { useAdminPlanBasic } from './context/AdminPlanBasicContext';
import {
  dailyCalendarEventsQueryOptions,
  weeklyCalendarEventsQueryOptions,
  multiDailyCalendarEventsQueryOptions,
  multiWeeklyCalendarEventsQueryOptions,
  monthlyCalendarEventsQueryOptions,
} from '@/lib/query-options/calendarEvents';
import {
  calendarEventsToDailyPlans,
  calendarEventsToCustomPlanItems,
  calendarEventsToNonStudyPlanItems,
  calendarEventsToAllDayItems,
} from '@/lib/domains/calendar/adapters';
import { deletePlan } from '@/lib/domains/calendar/actions/calendarEventActions';
import { useOptimisticCalendarUpdate } from '@/lib/hooks/useOptimisticCalendarUpdate';
import { useUndo } from './UndoSnackbar';
import { DailyDockGridView } from './DailyDockGridView';
import { WeeklyGridView } from './WeeklyGridView';
import AdminMonthView from './calendar-views/AdminMonthView';
import AdminYearView from './calendar-views/AdminYearView';
import { AdminAgendaView } from './calendar-views/AdminAgendaView';
import { useAdminCalendarData } from './calendar-views/_hooks/useAdminCalendarData';
import type { ExclusionsByDate } from './calendar-views/_types/adminCalendar';
import type { PlanStatus } from '@/lib/types/plan';
import { CalendarNavHeader, type CalendarView } from './CalendarNavHeader';
import { getWeekRangeSunSat, shiftMonth, shiftDay, shiftWeek, shiftCustomDays } from './utils/weekDateUtils';
import { formatDateString } from '@/lib/date/calendarUtils';
import { usePinchZoom } from './hooks/usePinchZoom';
import { useCalendarSwipeNavigation } from './hooks/useCalendarSwipeNavigation';
import { useEventReminders } from '@/lib/domains/calendar/reminders';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { getHolidayAllDayItems } from '@/lib/domains/calendar/koreanHolidays';
import { useAdminPlanFilter } from './context/AdminPlanContext';
import { Columns2, Minus, Plus } from 'lucide-react';

/** 스켈레톤 로딩 UI용 상수 배열 (매 렌더마다 새 배열 생성 방지) */
const SKELETON_ITEMS = [1, 2] as const;

/** 날짜 네비게이션 슬라이드 + 페이드 애니메이션 */
const SLIDE_OFFSET = 40; // px
const slideVariants = {
  enter: (dir: 'next' | 'prev' | 'none') => ({
    x: dir === 'next' ? SLIDE_OFFSET : dir === 'prev' ? -SLIDE_OFFSET : 0,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 'next' | 'prev' | 'none') => ({
    x: dir === 'next' ? -SLIDE_OFFSET : dir === 'prev' ? SLIDE_OFFSET : 0,
    opacity: 0,
  }),
};
const slideTransition = { duration: 0.15, ease: 'easeInOut' as const };

interface DailyDockProps {
  studentId: string;
  tenantId: string;
  /** Calendar-First: 캘린더 ID (context에서도 가져오지만 독립 사용 시 직접 전달) */
  calendarId?: string;
  selectedDate: string;
  /** 선택된 플랜 그룹 ID (null = 전체 보기) */
  selectedGroupId?: string | null;
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
    nonStudyItems?: import('@/lib/types/planItem').PlanItemData[];
  };
  /** 날짜 변경 핸들러 (주간 그리드 뷰에서 날짜 클릭 시) */
  onDateChange?: (date: string) => void;
  /** 삭제 핸들러 (EventPopover에서 사용) */
  onDelete?: (planId: string) => void;
  /** 외부 제어 캘린더 뷰 (PlannerTab에서 리프팅) */
  calendarView?: CalendarView;
  /** 캘린더 뷰 변경 콜백 */
  onCalendarViewChange?: (view: CalendarView) => void;
  /** CalendarNavHeader 숨김 (CalendarTopBar가 대신 사용될 때) */
  hideNavHeader?: boolean;
  /** 플래너 제외일 데이터 (월간 뷰에서 사용) */
  calendarExclusions?: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
  /** 멀티 캘린더 모드: 표시할 캘린더 ID 목록 */
  visibleCalendarIds?: string[] | null;
  /** 더블클릭/상세설정 → 이벤트 편집 모달 열기 */
  onOpenEventEditNew?: (params: { date?: string; startTime?: string; endTime?: string }) => void;
  /** 주간 뷰 커스텀 일수 (2~7, 기본 7) */
  customDayCount?: number;
  onCustomDayCountChange?: (count: number) => void;
}

/**
 * DailyDock - 일일 플랜 Dock 컴포넌트
 *
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const DailyDock = memo(function DailyDock({
  studentId,
  tenantId,
  selectedDate,
  selectedGroupId,
  onEdit,
  onStatusChange,
  onRefresh,
  onRefreshDailyAndWeekly,
  onCreatePlanAtSlot,
  initialData,
  onDateChange,
  onDelete,
  calendarView: calendarViewProp,
  onCalendarViewChange: onCalendarViewChangeProp,
  hideNavHeader = false,
  calendarExclusions,
  searchQuery,
  visibleCalendarIds,
  onOpenEventEditNew,
  customDayCount = 7,
  onCustomDayCountChange,
}: DailyDockProps) {
  const router = useRouter();
  // 핀치/스크롤 줌
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const { zoomLevel, pxPerMinute, zoomIn, zoomOut, resetZoom, minZoom, maxZoom } = usePinchZoom(zoomContainerRef);

  // Calendar-First: Context에서 calendarId 직접 사용 (브릿지 훅 제거)
  const { selectedCalendarId, selectedCalendarSettings, isAdminMode } = useAdminPlanBasic();
  const calendarId = selectedCalendarId ?? undefined;
  const weekStartsOn = selectedCalendarSettings?.weekStartsOn ?? 0;

  // 캘린더 이벤트 1회 fetch → 어댑터로 레거시 타입 변환 (멀티 캘린더 지원)
  const { events, isLoading } = useDailyCalendarEvents(studentId, calendarId, selectedDate, visibleCalendarIds);
  const { optimisticDelete, revalidate } = useOptimisticCalendarUpdate(calendarId);
  const allPlans = useMemo(() => calendarEventsToDailyPlans(events), [events]);
  const customItems = useMemo(() => calendarEventsToCustomPlanItems(events), [events]);
  const nonStudyItems = useMemo(() => calendarEventsToNonStudyPlanItems(events), [events]);
  const baseAllDayItems = useMemo(() => calendarEventsToAllDayItems(events), [events]);

  // 공휴일 캘린더 토글
  const { showHolidays, calendarColorMap } = useAdminPlanFilter();
  const allDayItems = useMemo(() => {
    if (!showHolidays) return baseAllDayItems;
    const holidayItems = getHolidayAllDayItems([selectedDate]);
    if (holidayItems.length === 0) return baseAllDayItems;
    return [...holidayItems, ...baseAllDayItems];
  }, [baseAllDayItems, showHolidays, selectedDate]);

  // 이벤트 리마인더 스케줄 (오늘 이벤트에 대해 클라이언트 사이드 알림)
  useEventReminders(events);

  // 날짜 네비게이션 방향 추적 (슬라이드 애니메이션용)
  const navDirectionRef = useRef<'next' | 'prev' | 'none'>('none');
  const prevDateRef = useRef(selectedDate);
  useEffect(() => {
    if (selectedDate > prevDateRef.current) navDirectionRef.current = 'next';
    else if (selectedDate < prevDateRef.current) navDirectionRef.current = 'prev';
    else navDirectionRef.current = 'none';
    prevDateRef.current = selectedDate;
  }, [selectedDate]);

  // 생성자 역할별 분할 보기 (선생님 | 학생)
  const [splitByCreator, setSplitByCreator] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('dailyDock_splitByCreator');
    if (saved === 'true') setSplitByCreator(true);
  }, []);
  const handleToggleSplit = useCallback(() => {
    setSplitByCreator((prev) => {
      const next = !prev;
      localStorage.setItem('dailyDock_splitByCreator', String(next));
      return next;
    });
  }, []);

  // 캘린더 뷰: controlled (PlannerTab에서 제어) / uncontrolled (내부 상태)
  const [internalView, setInternalView] = useState<CalendarView>('weekly');

  // props 우선, 없으면 내부 상태
  const calendarView = calendarViewProp ?? internalView;

  // 모바일 스와이프 네비게이션 (좌우 스와이프 → 기간 이동)
  const isMobile = useIsMobile();
  const { swipeHandlers } = useCalendarSwipeNavigation({
    activeView: calendarView,
    selectedDate,
    onNavigate: onDateChange ?? (() => {}),
    enabled: !!onDateChange,
    isMobile3Day: isMobile,
  });

  // S-1: 휠 네비게이션 (월간: 세로 휠 → 월 이동, 일간/주간: 가로 휠 → 일/주 이동)
  // 한 번의 휠 제스처당 정확히 1회만 이동 (idle 감지 후 다음 이동 허용)
  const monthWheelContainerRef = useRef<HTMLDivElement>(null);
  const wheelNavLocked = useRef(false);
  const wheelIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const container = monthWheelContainerRef.current;
    if (!container || !onDateChange) return;

    const unlockAfterIdle = () => {
      if (wheelIdleTimer.current) clearTimeout(wheelIdleTimer.current);
      wheelIdleTimer.current = setTimeout(() => {
        wheelNavLocked.current = false;
      }, 200);
    };

    const handleWheel = (e: WheelEvent) => {
      // 모달/팝업 내부 스크롤은 무시
      const target = e.target as HTMLElement;
      if (
        target.closest("[role='dialog']") ||
        target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }

      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      // 월간 뷰: 세로 휠 → 월 이동
      if (calendarView === 'month' && absY >= 30 && absY > absX) {
        e.preventDefault();
        unlockAfterIdle();
        if (wheelNavLocked.current) return;
        wheelNavLocked.current = true;
        const dir: 1 | -1 = e.deltaY > 0 ? 1 : -1;
        navDirectionRef.current = dir > 0 ? 'next' : 'prev';
        onDateChange(shiftMonth(selectedDate, dir));
        return;
      }

      // 일간/주간 뷰: 가로 휠 → 일/주 이동
      if ((calendarView === 'daily' || calendarView === 'weekly') && absX >= 30 && absX > absY * 1.5) {
        e.preventDefault();
        unlockAfterIdle();
        if (wheelNavLocked.current) return;
        wheelNavLocked.current = true;
        const dir: 1 | -1 = e.deltaX > 0 ? 1 : -1;
        navDirectionRef.current = dir > 0 ? 'next' : 'prev';

        if (calendarView === 'daily') {
          onDateChange(shiftDay(selectedDate, dir));
        } else {
          const dayCount = isMobile ? 3 : 7;
          onDateChange(dayCount === 7
            ? shiftWeek(selectedDate, dir)
            : shiftCustomDays(selectedDate, dir, dayCount)
          );
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelIdleTimer.current) clearTimeout(wheelIdleTimer.current);
    };
  }, [calendarView, selectedDate, onDateChange, isMobile]);

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

  // 월간뷰 더블클릭 → 이벤트 편집 모달 (캘린더만 있으면 가능)
  const handleMonthDoubleClick = useCallback((dateStr: string) => {
    if (!calendarId) return;
    if (onOpenEventEditNew) {
      onOpenEventEditNew({ date: dateStr, startTime: '09:00', endTime: '10:00' });
    } else if (calendarId) {
      const params = new URLSearchParams({
        date: dateStr,
        startTime: '09:00',
        endTime: '10:00',
      });
      router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
    }
  }, [calendarId, studentId, router, onOpenEventEditNew]);

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
    } else if (saved === 'daily' || saved === 'weekly' || saved === 'month' || saved === 'year' || saved === 'agenda') {
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
    calendarId,
    visibleCalendarIds,
  });

  // 연간 뷰 데이터 (yearMode: 1/1~12/31 범위, 연간 뷰일 때만 활성화)
  const currentYear = useMemo(
    () => new Date(selectedDate + 'T00:00:00').getFullYear(),
    [selectedDate]
  );

  const { plansByDate: yearlyPlansByDate, isLoading: isYearlyLoading } = useAdminCalendarData({
    studentId,
    currentMonth,
    calendarId,
    visibleCalendarIds,
    yearMode: true,
    enabled: calendarView === 'year',
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

  // 연간 뷰용 그룹 필터링
  const filteredYearlyPlansByDate = useMemo(() => {
    if (!selectedGroupId) return yearlyPlansByDate;
    const filtered: typeof yearlyPlansByDate = {};
    for (const [date, plans] of Object.entries(yearlyPlansByDate)) {
      const groupPlans = plans.filter(p => p.plan_group_id === selectedGroupId);
      if (groupPlans.length > 0) filtered[date] = groupPlans;
    }
    return filtered;
  }, [yearlyPlansByDate, selectedGroupId]);

  // 제외일 데이터 변환 (calendarExclusions → ExclusionsByDate)
  const exclusionsByDate = useMemo<ExclusionsByDate>(() => {
    if (!calendarExclusions) return {};
    const map: Record<string, { exclusion_type: string; reason: string | null }> = {};
    for (const exc of calendarExclusions) {
      map[exc.exclusionDate] = {
        exclusion_type: exc.exclusionType,
        reason: exc.reason ?? null,
      };
    }
    return map as ExclusionsByDate;
  }, [calendarExclusions]);

  // 인접 데이터 프리페치 (±1 day/week/month, 멀티 캘린더 대응)
  const queryClient = useQueryClient();
  const multiIds = visibleCalendarIds && visibleCalendarIds.length > 1 ? visibleCalendarIds : null;

  useEffect(() => {
    if (!calendarId) return;

    if (calendarView === 'daily') {
      const prev = formatDateString(addDays(new Date(selectedDate + 'T00:00:00'), -1));
      const next = formatDateString(addDays(new Date(selectedDate + 'T00:00:00'), 1));
      if (multiIds) {
        queryClient.prefetchQuery(multiDailyCalendarEventsQueryOptions(multiIds, prev));
        queryClient.prefetchQuery(multiDailyCalendarEventsQueryOptions(multiIds, next));
      } else {
        queryClient.prefetchQuery(dailyCalendarEventsQueryOptions(calendarId, prev));
        queryClient.prefetchQuery(dailyCalendarEventsQueryOptions(calendarId, next));
      }
    } else if (calendarView === 'weekly') {
      const prevWeekDate = formatDateString(addDays(new Date(selectedDate + 'T00:00:00'), -7));
      const nextWeekDate = formatDateString(addDays(new Date(selectedDate + 'T00:00:00'), 7));
      const prevRange = getWeekRangeSunSat(prevWeekDate);
      const nextRange = getWeekRangeSunSat(nextWeekDate);
      if (multiIds) {
        queryClient.prefetchQuery(multiWeeklyCalendarEventsQueryOptions(multiIds, prevRange.start, prevRange.end));
        queryClient.prefetchQuery(multiWeeklyCalendarEventsQueryOptions(multiIds, nextRange.start, nextRange.end));
      } else {
        queryClient.prefetchQuery(weeklyCalendarEventsQueryOptions(calendarId, prevRange.start, prevRange.end));
        queryClient.prefetchQuery(weeklyCalendarEventsQueryOptions(calendarId, nextRange.start, nextRange.end));
      }
    } else if ((calendarView === 'month' || calendarView === 'agenda') && calendarId) {
      const prevMonth = addMonths(currentMonth, -1);
      const nextMonth = addMonths(currentMonth, 1);
      for (const m of [prevMonth, nextMonth]) {
        const wso = weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        const mStart = startOfWeek(startOfMonth(m), { weekStartsOn: wso });
        const mEnd = endOfWeek(endOfMonth(m), { weekStartsOn: wso });
        queryClient.prefetchQuery(
          monthlyCalendarEventsQueryOptions(calendarId, format(mStart, 'yyyy-MM-dd'), format(mEnd, 'yyyy-MM-dd')),
        );
      }
    } else if (calendarView === 'year' && calendarId) {
      // 인접 연도 프리페치
      for (const offset of [-1, 1]) {
        const y = currentYear + offset;
        queryClient.prefetchQuery(
          monthlyCalendarEventsQueryOptions(calendarId, `${y}-01-01`, `${y}-12-31`),
        );
      }
    }
  }, [calendarId, calendarView, selectedDate, currentMonth, currentYear, studentId, queryClient, multiIds, weekStartsOn]);

  // 플랜 매칭 헬퍼 (검색 필터링 + 하이라이트 공용)
  const matchPlan = useCallback((plan: { content_title?: string | null; custom_title?: string | null; content_subject?: string | null; content_subject_category?: string | null }, query: string) => {
    const fields = [
      plan.content_title,
      plan.custom_title,
      plan.content_subject,
      plan.content_subject_category,
    ];
    return fields.some((f) => f?.toLowerCase().includes(query));
  }, []);

  // 검색 하이라이트 플랜 ID 계산 (월간 뷰 — 검색 시 매칭만 하이라이트)
  const highlightedPlanIds = useMemo(() => {
    if (!searchQuery) return undefined;
    const query = searchQuery.toLowerCase();
    const ids = new Set<string>();

    for (const plans of Object.values(monthlyPlansByDate)) {
      for (const plan of plans) {
        if (matchPlan(plan, query)) ids.add(plan.id);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [searchQuery, monthlyPlansByDate, matchPlan]);

  // 그룹 필터링 적용
  const groupFilteredPlans = useMemo(() => {
    if (selectedGroupId === null || selectedGroupId === undefined) return allPlans;
    return allPlans.filter(plan => plan.plan_group_id === selectedGroupId);
  }, [allPlans, selectedGroupId]);

  // 검색 필터링 적용 (GCal 방식: 비매칭 플랜 숨김)
  const plans = useMemo(() => {
    if (!searchQuery) return groupFilteredPlans;
    const query = searchQuery.toLowerCase();
    return groupFilteredPlans.filter(plan => matchPlan(plan, query));
  }, [groupFilteredPlans, searchQuery, matchPlan]);

  // 재정렬에 필요한 훅들
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();
  const { pushUndoable } = useUndo();

  // 즉시 삭제 + Undo 스낵바 (옵티미스틱: 즉시 사라짐 + 실패 시 롤백)
  const handleDeleteRequest = (planId: string) => {
    startTransition(async () => {
      const rollback = optimisticDelete(planId);
      const result = await deletePlan({
        planId,
        skipRevalidation: true,
      });

      if (!result.success) {
        rollback();
        showToast(result.error ?? '삭제 실패', 'error');
        return;
      }

      revalidate();

      pushUndoable({
        type: 'delete-plan',
        planId,
        description: '플랜이 삭제되었습니다.',
      });
    });
  };

  const totalCount = plans.length + customItems.length;

  // 완료된 플랜 수 메모이제이션
  const completedCount = useMemo(
    () =>
      plans.filter((p) => p.status === 'completed').length +
      customItems.filter((p) => p.isCompleted).length,
    [plans, customItems]
  );

  return (
    <DroppableContainer id="daily" className="h-full">
      <div
        ref={zoomContainerRef}
        className={cn(
          'bg-[rgb(var(--color-secondary-50))] rounded-lg border border-[rgb(var(--color-secondary-200))] h-full flex flex-col',
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
          customDayCount={customDayCount}
          onCustomDayCountChange={onCustomDayCountChange}
        />
      )}

      {/* 줌 컨트롤 + 분할 뷰 토글 (일간/주간 그리드뷰에서만 표시) */}
      {(calendarView === 'daily' || calendarView === 'weekly') && (
        <div className="flex items-center gap-1 px-2 pb-1 justify-end">
          {/* 분할 뷰 토글 (일간 뷰 + 데스크탑에서만) */}
          {calendarView === 'daily' && !isMobile && (
            <button
              type="button"
              onClick={handleToggleSplit}
              className={cn(
                'p-1 rounded transition-colors mr-1',
                splitByCreator
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  : 'hover:bg-[rgb(var(--color-secondary-200))] text-[var(--text-secondary)]'
              )}
              title={splitByCreator ? '통합 보기' : '역할별 분할 보기 (선생님 | 학생)'}
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomLevel <= minZoom}
            className="p-1 rounded hover:bg-[rgb(var(--color-secondary-200))] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="축소 (Ctrl+스크롤 다운)"
          >
            <Minus className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="text-[11px] text-[var(--text-tertiary)] font-medium tabular-nums px-1 rounded hover:bg-[rgb(var(--color-secondary-200))] transition-colors min-w-[36px] text-center"
            title="줌 초기화"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomLevel >= maxZoom}
            className="p-1 rounded hover:bg-[rgb(var(--color-secondary-200))] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="확대 (Ctrl+스크롤 업)"
          >
            <Plus className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </button>
        </div>
      )}

      <div ref={monthWheelContainerRef} className="flex-1 overflow-hidden flex flex-col" {...swipeHandlers}>
      <AnimatePresence mode="wait" custom={navDirectionRef.current}>
        {/* 일간 그리드 뷰 */}
        {calendarView === 'daily' && !isLoading && (
          <motion.div
            key={`daily-${selectedDate}`}
            custom={navDirectionRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="flex-1 overflow-hidden"
          >
            <DailyDockGridView
              plans={plans}
              customItems={customItems}
              nonStudyItems={nonStudyItems}
              selectedDate={selectedDate}
              studentId={studentId}
              tenantId={tenantId}
              planGroupId={selectedGroupId}
              calendarId={calendarId}
              onEdit={onEdit}
              onRefresh={onRefresh}
              onCreatePlanAtSlot={onCreatePlanAtSlot}
              onDelete={(planId) => {
                if (onDelete) {
                  onDelete(planId);
                } else {
                  handleDeleteRequest(planId);
                }
              }}
              searchQuery={searchQuery}
              allDayItems={allDayItems}
              isLoading={isLoading}
              pxPerMinute={pxPerMinute}
              onOpenEventEditNew={onOpenEventEditNew}
              defaultEstimatedMinutes={selectedCalendarSettings?.defaultEstimatedMinutes}
              defaultReminderMinutes={selectedCalendarSettings?.defaultReminderMinutes}
              showHolidays={showHolidays}
              calendarColorMap={calendarColorMap}
              calendarName={selectedCalendarSettings?.name}
              splitByCreator={splitByCreator && !isMobile}
              isAdminMode={isAdminMode}
            />
          </motion.div>
        )}

        {/* 일간 로딩 스켈레톤 (시간 그리드 형태) */}
        {calendarView === 'daily' && isLoading && (
          <div key="daily-loading" className="flex-1 overflow-y-auto">
            <div className="flex">
              {/* 시간 거터 스켈레톤 */}
              <div className="shrink-0 w-14 border-r border-[rgb(var(--color-secondary-200))] pt-4 space-y-[44px]">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-3 w-8 bg-[rgb(var(--color-secondary-200))]/60 rounded animate-pulse ml-auto mr-2" />
                ))}
              </div>
              {/* 이벤트 영역 스켈레톤 */}
              <div className="flex-1 pt-4 px-2 space-y-3">
                <div className="h-16 bg-[rgb(var(--color-primary-100))]/50 rounded animate-pulse" />
                <div className="h-10 bg-[rgb(var(--color-secondary-200))]/40 rounded animate-pulse" />
                <div className="h-24 bg-[rgb(var(--color-primary-100))]/40 rounded animate-pulse mt-6" />
                <div className="h-12 bg-[rgb(var(--color-secondary-200))]/30 rounded animate-pulse mt-4" />
              </div>
            </div>
          </div>
        )}

        {/* 주간 그리드 뷰 */}
        {calendarView === 'weekly' && (
          <motion.div
            key={`weekly-${selectedDate}`}
            custom={navDirectionRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="flex-1 overflow-hidden"
          >
            <WeeklyGridView
              studentId={studentId}
              tenantId={tenantId}
              calendarId={calendarId}
              selectedDate={selectedDate}
              selectedGroupId={selectedGroupId}
              onEdit={onEdit}
              onRefresh={onRefresh}
              onDateChange={onDateChange ?? (() => {})}
              onCreatePlanAtSlot={onCreatePlanAtSlot}
              onDelete={(planId) => {
                if (onDelete) {
                  onDelete(planId);
                } else {
                  handleDeleteRequest(planId);
                }
              }}
              searchQuery={searchQuery}
              onSwitchToDaily={handleSwitchToDaily}
              visibleCalendarIds={visibleCalendarIds}
              pxPerMinute={pxPerMinute}
              onOpenEventEditNew={onOpenEventEditNew}
              defaultEstimatedMinutes={selectedCalendarSettings?.defaultEstimatedMinutes}
              defaultReminderMinutes={selectedCalendarSettings?.defaultReminderMinutes}
              customDayCount={customDayCount}
            />
          </motion.div>
        )}

        {/* 월간 뷰 */}
        {calendarView === 'month' && !isMonthlyLoading && (
          <motion.div
            key={`month-${currentMonth.toISOString()}`}
            custom={navDirectionRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="flex-1 overflow-hidden"
          >
            <AdminMonthView
              studentId={studentId}
              tenantId={tenantId}
              calendarId={calendarId ?? ''}
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
              onDoubleClickDate={handleMonthDoubleClick}
              showHolidays={showHolidays}
            />
          </motion.div>
        )}

        {/* 월간 뷰 로딩 */}
        {calendarView === 'month' && isMonthlyLoading && (
          <div key="month-loading" className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-20 bg-[rgb(var(--color-secondary-100))] rounded animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* 일정 목록 (어젠다) 뷰 */}
        {calendarView === 'agenda' && !isMonthlyLoading && (
          <motion.div
            key={`agenda-${currentMonth.toISOString()}`}
            custom={navDirectionRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="flex-1 overflow-hidden"
          >
            <AdminAgendaView
              plansByDate={filteredMonthlyPlansByDate}
              onDateSelect={(date) => {
                onDateChange?.(date);
                handleCalendarViewChange('daily');
              }}
              highlightedPlanIds={highlightedPlanIds}
              showHolidays={showHolidays}
              calendarColorMap={calendarColorMap}
            />
          </motion.div>
        )}

        {/* 일정 목록 로딩 */}
        {calendarView === 'agenda' && isMonthlyLoading && (
          <div key="agenda-loading" className="flex-1 overflow-y-auto p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[rgb(var(--color-secondary-100))] animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 bg-[rgb(var(--color-secondary-200))] rounded animate-pulse" />
                  <div className="h-3 w-40 bg-[rgb(var(--color-secondary-100))] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 연간 뷰 */}
        {calendarView === 'year' && !isYearlyLoading && (
          <motion.div
            key={`year-${currentYear}`}
            custom={navDirectionRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="flex-1 overflow-hidden"
          >
            <AdminYearView
              currentYear={currentYear}
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                onDateChange?.(date);
                handleCalendarViewChange('daily');
              }}
              onMonthClick={(date) => {
                onDateChange?.(date);
                handleCalendarViewChange('month');
              }}
              plansByDate={filteredYearlyPlansByDate}
              weekStartsOn={weekStartsOn}
              showHolidays={showHolidays}
            />
          </motion.div>
        )}

        {/* 연간 뷰 로딩 */}
        {calendarView === 'year' && isYearlyLoading && (
          <div key="year-loading" className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-48 bg-[rgb(var(--color-secondary-100))] rounded animate-pulse" />
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>
      </div>
      </div>

      {/* 데스크톱 FAB 생성 버튼 — 모바일에서는 ChatFAB과 겹치므로 숨김, 타임슬롯 클릭으로 대체 */}
      {calendarId && (onCreatePlanAtSlot || onOpenEventEditNew) && (
        <button
          type="button"
          onClick={() => {
            if (calendarId && onCreatePlanAtSlot) {
              onCreatePlanAtSlot('09:00', '10:00');
            } else if (onOpenEventEditNew) {
              onOpenEventEditNew({ date: selectedDate, startTime: '09:00', endTime: '10:00' });
            }
          }}
          className="hidden md:flex fixed right-6 bottom-6 z-30 items-center justify-center w-14 h-14 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600 active:scale-95 transition-all"
          aria-label="새 일정 만들기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </DroppableContainer>
  );
});
