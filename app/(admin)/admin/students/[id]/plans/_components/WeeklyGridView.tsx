'use client';

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { WeeklyGridColumn } from './WeeklyGridColumn';
import { WeeklyGridHeader } from './WeeklyGridHeader';
import { EventDetailPopover } from './items/EventDetailPopover';
import { useEventDetailPopover } from './hooks/useEventDetailPopover';
import { RecurringEditChoiceModal, type RecurringEditScope } from './modals/RecurringEditChoiceModal';
import { deleteRecurringEvent, updateRecurringEvent, createRecurringException } from '@/lib/domains/calendar/actions/calendarEventActions';
import { AllDayItemBar } from './items/AllDayItemBar';
import { useWeeklyGridData, type DayColumnData } from './hooks/useWeeklyGridData';
import { useTwoWeekGridData } from './hooks/useTwoWeekGridData';
import { useDragToCreate } from './hooks/useDragToCreate';
import { useCrossDayDrag } from './hooks/useCrossDayDrag';
import { usePopoverPosition } from './hooks/usePopoverPosition';
import { InlineQuickCreate } from './items/InlineQuickCreate';
import { formatDayHeader } from './utils/weekDateUtils';
import {
  timeToMinutes,
  minutesToTime,
  assignLevels,
  computeLayoutPosition,
  PX_PER_MINUTE,
  SNAP_MINUTES,
  TIME_GUTTER_WIDTH,
  SINGLE_RIGHT_GUTTER_PCT,
} from './utils/timeGridUtils';
import {
  resolveLogicalMinutes,
  resolvePhysicalTime,
  logicalMinutesToPx,
  pxToLogicalMinutes,
  getLogicalDayTotalHeight,
  getLogicalHourLabels,
  formatLogicalHourLabel,
  physicalMinToLogical,
  LOGICAL_DISPLAY_RANGE,
  DEAD_ZONE_COLLAPSED_PX,
  DEAD_ZONE_END,
  EXTENSION_ZONE_START,
  EXTENSION_ZONE_END,
  type LogicalDayConfig,
} from './utils/logicalDayUtils';
import { useDeadZoneCollapse } from './hooks/useDeadZoneCollapse';
import { DeadZoneBar } from './items/DeadZoneBar';
import { useResizable } from './hooks/useResizable';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { useGridKeyboardNav } from './hooks/useGridKeyboardNav';
import { updateItemTime } from '@/lib/domains/calendar/actions/calendarEventActions';
import { useUndo } from './UndoSnackbar';
import { usePlanToast } from './PlanToast';
import { useOptimisticCalendarUpdate } from '@/lib/hooks/useOptimisticCalendarUpdate';
import { toPlanItemData, type PlanItemData } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';
import { resolveCalendarColors } from './utils/subjectColors';
import { cn } from '@/lib/cn';
import { OffScreenEventHint } from './items/OffScreenEventHint';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useAdminPlanBasic } from './context/AdminPlanBasicContext';
import type { AllDayItem } from '@/lib/query-options/adminDock';
import type { EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';
import { getHolidayAllDayItems } from '@/lib/domains/calendar/koreanHolidays';
import { useAdminPlanFilter } from './context/AdminPlanContext';

interface WeeklyGridViewProps {
  studentId: string;
  tenantId: string;
  /** 캘린더 ID */
  calendarId?: string;
  selectedDate: string;
  selectedGroupId?: string | null;
  displayRange?: { start: string; end: string };
  onEdit?: (planId: string, entityType?: 'event' | 'consultation') => void;
  onRefresh: () => void;
  onDateChange: (date: string) => void;
  onCreatePlanAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  onDelete?: (planId: string) => void;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
  /** 날짜 클릭 시 일일뷰로 전환 */
  onSwitchToDaily?: (date: string) => void;
  /** 멀티 캘린더 모드: 표시할 캘린더 ID 목록 */
  visibleCalendarIds?: string[] | null;
  /** 줌 적용 pxPerMinute (기본 PX_PER_MINUTE) */
  pxPerMinute?: number;
  /** 더블클릭/상세설정 → 이벤트 편집 모달 열기 */
  onOpenEventEditNew?: (params: { date?: string; endDate?: string; startTime?: string; endTime?: string; title?: string; description?: string; label?: string; subject?: string; rrule?: string | null }) => void;
  /** 상담 편집 모달 열기 */
  onOpenConsultationEditNew?: (params: { date?: string; startTime?: string; endTime?: string; studentId?: string; sessionType?: string; consultationMode?: string; title?: string; description?: string; meetingLink?: string; visitor?: string }) => void;
  /** 캘린더 설정의 기본 이벤트 시간 (분) */
  defaultEstimatedMinutes?: number | null;
  /** 캘린더 설정의 기본 알림 (분 단위 배열) */
  defaultReminderMinutes?: number[] | null;
  /** 커스텀 뷰 일수 (2~7, 기본 7) */
  customDayCount?: number;
  /** 2주간 스택 뷰 모드 (데스크톱 전용) */
  biweeklyMode?: boolean;
}

type OffScreenHintData = {
  direction: 'above' | 'below';
  timeRange: string;
  eventCount: number;
  targetMinutes: number;
};

export const WeeklyGridView = memo(function WeeklyGridView({
  studentId,
  tenantId,
  calendarId: calendarIdProp,
  selectedDate,
  selectedGroupId,
  displayRange = LOGICAL_DISPLAY_RANGE,
  onEdit,
  onRefresh,
  onDateChange,
  onCreatePlanAtSlot,
  onDelete,
  searchQuery,
  onSwitchToDaily,
  visibleCalendarIds,
  pxPerMinute: ppmProp,
  onOpenEventEditNew,
  onOpenConsultationEditNew,
  defaultEstimatedMinutes,
  defaultReminderMinutes,
  customDayCount = 7,
  biweeklyMode = false,
}: WeeklyGridViewProps) {
  const router = useRouter();
  const ppm = ppmProp ?? PX_PER_MINUTE;
  const { isCollapsed: deadZoneCollapsed, toggle: toggleDeadZone } = useDeadZoneCollapse();
  const { pushUndoable } = useUndo();
  const { showToast } = usePlanToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Biweekly 스크롤 동기화용 refs
  const week1GridRef = useRef<HTMLDivElement>(null);
  const week2GridRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const { pullDistance: wPullDistance, pullProgress: wPullProgress, isRefreshing: wIsRefreshing, isPulling: wIsPulling } = usePullToRefresh({
    containerRef: scrollContainerRef,
    onRefresh,
    enabled: true,
  });
  useGridKeyboardNav(scrollContainerRef);
  const columnRefsMap = useRef(new Map<string, HTMLDivElement>());

  // 논리적 하루 설정
  const logicalConfig: LogicalDayConfig = useMemo(
    () => ({ deadZoneCollapsed, pxPerMinute: ppm }),
    [deadZoneCollapsed, ppm],
  );
  const totalHeight = getLogicalDayTotalHeight(logicalConfig);

  // Calendar-First: Context에서 calendarId 직접 사용 (브릿지 훅 제거)
  const { selectedCalendarId, selectedCalendarSettings, isAdminMode } = useAdminPlanBasic();
  const resolvedCalendarId = calendarIdProp || selectedCalendarId || undefined;
  const weekStartsOn = selectedCalendarSettings?.weekStartsOn ?? 0;

  // 데이터 로딩: biweeklyMode 분기 (두 훅 모두 호출 — React 훅 규칙)
  const weeklyData = useWeeklyGridData(
    biweeklyMode ? '' : studentId, selectedDate, resolvedCalendarId,
    biweeklyMode ? null : visibleCalendarIds, weekStartsOn, customDayCount,
  );
  const biweeklyData = useTwoWeekGridData(
    biweeklyMode ? studentId : '', selectedDate, resolvedCalendarId,
    biweeklyMode ? visibleCalendarIds : null, weekStartsOn,
  );

  const {
    allWeekDates,
    rawDayDataMap,
    calendarId,
    isAnyLoading,
    invalidateDate,
    invalidateAll,
    biweeklyWeek1Dates,
    biweeklyWeek2Dates,
  } = useMemo(() => {
    if (biweeklyMode) {
      return {
        allWeekDates: biweeklyData.allDates,
        rawDayDataMap: biweeklyData.dayDataMap,
        calendarId: biweeklyData.calendarId,
        isAnyLoading: biweeklyData.isAnyLoading,
        invalidateDate: biweeklyData.invalidateDate,
        invalidateAll: biweeklyData.invalidateAll,
        biweeklyWeek1Dates: biweeklyData.week1Dates,
        biweeklyWeek2Dates: biweeklyData.week2Dates,
      };
    }
    return {
      allWeekDates: weeklyData.weekDates,
      rawDayDataMap: weeklyData.dayDataMap,
      calendarId: weeklyData.calendarId,
      isAnyLoading: weeklyData.isAnyLoading,
      invalidateDate: weeklyData.invalidateDate,
      invalidateAll: weeklyData.invalidateAll,
      biweeklyWeek1Dates: weeklyData.weekDates,
      biweeklyWeek2Dates: [] as string[],
    };
  }, [biweeklyMode, weeklyData, biweeklyData]);

  const { optimisticStatusChange, optimisticColorChange, optimisticTimeChange, optimisticDateMove, optimisticDelete, revalidate } =
    useOptimisticCalendarUpdate(calendarId, visibleCalendarIds);

  // 공휴일 AllDayItems 주입
  const { showHolidays, calendarColorMap } = useAdminPlanFilter();

  // 현재 캘린더의 프리뷰 색상 (drag-to-create, quick-create 등)
  const previewColor = calendarColorMap.get(calendarId ?? '') ?? '#039be5';
  const previewColors = resolveCalendarColors(null, previewColor, 'confirmed', false);
  const dayDataMap = useMemo(() => {
    if (!showHolidays) return rawDayDataMap;
    const holidayItems = getHolidayAllDayItems(allWeekDates);
    if (holidayItems.length === 0) return rawDayDataMap;
    const holidayByDate = new Map(holidayItems.map(h => [h.startDate, h]));
    const merged = new Map(rawDayDataMap);
    for (const [date, dayData] of merged) {
      const holiday = holidayByDate.get(date);
      if (holiday) {
        merged.set(date, { ...dayData, allDayItems: [holiday, ...dayData.allDayItems] });
      }
    }
    return merged;
  }, [rawDayDataMap, showHolidays, allWeekDates]);

  // 모바일 3일 뷰: customDayCount가 7(기본)일 때만 모바일 축소 적용 (biweeklyMode에서는 비활성)
  const isMobile = useIsMobile();
  const weekDates = useMemo(() => {
    if (biweeklyMode) return allWeekDates; // biweekly: 14일 전체
    if (customDayCount < 7) return allWeekDates;
    if (!isMobile) return allWeekDates;
    const idx = allWeekDates.indexOf(selectedDate);
    if (idx === -1) return allWeekDates.slice(0, 3);
    const start = Math.max(0, Math.min(idx - 1, allWeekDates.length - 3));
    return allWeekDates.slice(start, start + 3);
  }, [isMobile, allWeekDates, selectedDate, customDayCount, biweeklyMode]);

  // 시간 라벨 (논리적 시간 기반)
  const hourLabels = useMemo(
    () => getLogicalHourLabels(deadZoneCollapsed),
    [deadZoneCollapsed],
  );

  // 현재 시간 인디케이터 (논리적 좌표)
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const [nowLogicalDate, setNowLogicalDate] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const physicalMin = now.getHours() * 60 + now.getMinutes();
      setNowMinutes(physicalMin);
      // 논리적 날짜 계산 (00:00~00:59 → 전날)
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const timeHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const { logicalDate } = resolveLogicalMinutes(todayStr, timeHHMM);
      setNowLogicalDate(logicalDate);
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  // ---------- 이벤트 시작 분(minutes) 추출 헬퍼 ----------
  const getEventStartMinutes = useCallback(
    (dates: string[]): number[] => {
      const mins: number[] = [];
      for (const d of dates) {
        const dd = dayDataMap.get(d);
        if (!dd) continue;
        for (const p of dd.plans) {
          if (p.start_time) mins.push(timeToMinutes(p.start_time.substring(0, 5)));
        }
        for (const c of dd.customItems) {
          if (c.startTime) mins.push(timeToMinutes(c.startTime.substring(0, 5)));
        }
      }
      return mins.sort((a, b) => a - b);
    },
    [dayDataMap],
  );

  // ---------- 자동 스크롤 (최초 마운트 시에만) ----------
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (nowMinutes == null || hasScrolledRef.current) return;

    // biweeklyMode: 스마트 초기 스크롤 (Method C)
    if (biweeklyMode) {
      if (isAnyLoading) return; // 데이터 로딩 완료 대기
      if (!week1GridRef.current || !week2GridRef.current) return;

      const w2Events = getEventStartMinutes(biweeklyWeek2Dates);
      const w1Events = getEventStartMinutes(biweeklyWeek1Dates);

      let targetMinutes: number | null = null;

      // 1. 현재 시각 ±2시간 이내 가장 가까운 이벤트
      const allEvents = [...w1Events, ...w2Events].sort((a, b) => a - b);
      const nearby = allEvents.filter(m => Math.abs(m - nowMinutes) <= 120);
      if (nearby.length > 0) {
        const closest = nearby.reduce((best, m) =>
          Math.abs(m - nowMinutes) < Math.abs(best - nowMinutes) ? m : best
        );
        targetMinutes = Math.min(closest, nowMinutes);
      }

      // 2. 이번 주(week2) 첫 이벤트
      if (targetMinutes == null && w2Events.length > 0) {
        targetMinutes = w2Events[0];
      }

      // 3. 저번 주(week1) 첫 이벤트
      if (targetMinutes == null && w1Events.length > 0) {
        targetMinutes = w1Events[0];
      }

      // 스크롤 위치 결정: 이벤트 기반 or 현재 시각 fallback
      const scrollTarget = targetMinutes != null
        ? Math.max(0, logicalMinutesToPx(physicalMinToLogical(targetMinutes), logicalConfig) - 30 * ppm)
        : Math.max(0, logicalMinutesToPx(physicalMinToLogical(nowMinutes), logicalConfig) - 200);

      isSyncingRef.current = true;
      week1GridRef.current.scrollTop = scrollTarget;
      week2GridRef.current.scrollTop = scrollTarget;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { isSyncingRef.current = false; });
      });
      hasScrolledRef.current = true;
      return;
    }

    // 기존 단일 주 자동 스크롤 (논리적 좌표)
    if (!scrollContainerRef.current) return;
    const logicalNow = physicalMinToLogical(nowMinutes);
    const scrollTarget = logicalMinutesToPx(logicalNow, logicalConfig) - 200;
    scrollContainerRef.current.scrollTop = Math.max(0, scrollTarget);
    hasScrolledRef.current = true;
  }, [nowMinutes, logicalConfig, ppm, biweeklyMode, isAnyLoading, biweeklyWeek1Dates, biweeklyWeek2Dates, getEventStartMinutes]);

  // ---------- Biweekly 스크롤 동기화 ----------
  useEffect(() => {
    if (!biweeklyMode) return;
    const w1 = week1GridRef.current;
    const w2 = week2GridRef.current;
    if (!w1 || !w2) return;

    let rafId = 0;

    const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      // rAF로 감싸서 forced reflow 방지 (scrollTop 직접 대입은 동기 레이아웃 강제)
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // dead zone 토글 시 높이 불일치 방어: 비율 기반 동기화
        const sourceMax = source.scrollHeight - source.clientHeight;
        const targetMax = target.scrollHeight - target.clientHeight;
        if (sourceMax > 0 && targetMax > 0 && Math.abs(sourceMax - targetMax) > 10) {
          target.scrollTop = Math.round((source.scrollTop / sourceMax) * targetMax);
        } else {
          target.scrollTop = source.scrollTop;
        }
        requestAnimationFrame(() => { isSyncingRef.current = false; });
      });
    };

    const onW1Scroll = syncScroll(w1, w2);
    const onW2Scroll = syncScroll(w2, w1);

    w1.addEventListener('scroll', onW1Scroll, { passive: true });
    w2.addEventListener('scroll', onW2Scroll, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      w1.removeEventListener('scroll', onW1Scroll);
      w2.removeEventListener('scroll', onW2Scroll);
    };
  }, [biweeklyMode]);

  // ---------- 화면 밖 이벤트 힌트 ----------
  const [hintScrollTop, setHintScrollTop] = useState(0);
  const [hintContainerHeight, setHintContainerHeight] = useState(0);

  // 스크롤/리사이즈 추적 (week1GridRef 기준 — 양쪽 동기화되므로 하나만 추적)
  // rAF 기반 debounce: 스크롤 중 매 프레임이 아닌, 한 프레임당 최대 1회 state 업데이트
  useEffect(() => {
    if (!biweeklyMode) return;
    const el = week1GridRef.current;
    if (!el) return;

    let lastCommittedScrollTop = 0;
    let pendingRafId = 0;
    let latestScrollTop = 0;

    const flushScrollState = () => {
      pendingRafId = 0;
      if (Math.abs(latestScrollTop - lastCommittedScrollTop) >= 20) {
        lastCommittedScrollTop = latestScrollTop;
        setHintScrollTop(latestScrollTop);
      }
    };

    const onScroll = () => {
      latestScrollTop = el.scrollTop;
      if (!pendingRafId) {
        pendingRafId = requestAnimationFrame(flushScrollState);
      }
    };

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHintContainerHeight(entry.contentRect.height);
      }
    });

    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(el);
    // 초기값 설정
    setHintScrollTop(el.scrollTop);
    setHintContainerHeight(el.clientHeight);

    return () => {
      cancelAnimationFrame(pendingRafId);
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [biweeklyMode]);

  // 힌트 데이터 계산
  // 뷰포트 가장자리에서 30분 분량(30*ppm px) 이상 떨어진 이벤트만 "화면 밖"으로 판정
  // — 가장자리 근처 이벤트는 사실상 보이거나 살짝 스크롤로 확인 가능
  const computeHints = useCallback(
    (dates: string[]): { above: OffScreenHintData | null; below: OffScreenHintData | null } => {
      if (!biweeklyMode || hintContainerHeight === 0) return { above: null, below: null };

      const edgePx = 30 * ppm;
      const aboveMins: number[] = [];
      const belowMins: number[] = [];
      const aboveEdge = hintScrollTop - edgePx;
      const belowEdge = hintScrollTop + hintContainerHeight + edgePx;

      for (const d of dates) {
        const dd = dayDataMap.get(d);
        if (!dd) continue;
        for (const p of dd.plans) {
          if (!p.start_time) continue;
          const m = timeToMinutes(p.start_time.substring(0, 5));
          const px = logicalMinutesToPx(physicalMinToLogical(m), logicalConfig);
          if (px < aboveEdge) aboveMins.push(m);
          else if (px > belowEdge) belowMins.push(m);
        }
        for (const c of dd.customItems) {
          if (!c.startTime) continue;
          const m = timeToMinutes(c.startTime.substring(0, 5));
          const px = logicalMinutesToPx(physicalMinToLogical(m), logicalConfig);
          if (px < aboveEdge) aboveMins.push(m);
          else if (px > belowEdge) belowMins.push(m);
        }
      }

      const makeHint = (mins: number[], dir: 'above' | 'below'): OffScreenHintData | null => {
        if (mins.length === 0) return null;
        const sorted = [...mins].sort((a, b) => a - b);
        const earliest = minutesToTime(sorted[0]);
        const latest = minutesToTime(sorted[sorted.length - 1]);
        const timeRange = sorted.length === 1 ? earliest : `${earliest}~${latest}`;
        return { direction: dir, timeRange, eventCount: sorted.length, targetMinutes: sorted[0] };
      };

      return { above: makeHint(aboveMins, 'above'), below: makeHint(belowMins, 'below') };
    },
    [biweeklyMode, dayDataMap, logicalConfig, ppm, hintScrollTop, hintContainerHeight],
  );

  const week1Hints = useMemo(() => computeHints(biweeklyWeek1Dates), [computeHints, biweeklyWeek1Dates]);
  const week2Hints = useMemo(() => computeHints(biweeklyWeek2Dates), [computeHints, biweeklyWeek2Dates]);

  const handleHintClick = useCallback(
    (targetMinutes: number) => {
      const scrollTarget = Math.max(0, logicalMinutesToPx(physicalMinToLogical(targetMinutes), logicalConfig) - 60 * ppm);
      isSyncingRef.current = true;
      if (week1GridRef.current) week1GridRef.current.scrollTop = scrollTarget;
      if (week2GridRef.current) week2GridRef.current.scrollTop = scrollTarget;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { isSyncingRef.current = false; });
      });
    },
    [logicalConfig, ppm],
  );

  // 퀵생성 후 하이라이트 (2초 자동 해제)
  const [newlyCreatedPlanId, setNewlyCreatedPlanId] = useState<string | null>(null);
  useEffect(() => {
    if (!newlyCreatedPlanId) return;
    const timer = setTimeout(() => setNewlyCreatedPlanId(null), 2000);
    return () => clearTimeout(timer);
  }, [newlyCreatedPlanId]);

  // 논리적 좌표 기반 nowTop
  const nowLogicalMinutes = useMemo(() => {
    if (nowMinutes == null) return null;
    return physicalMinToLogical(nowMinutes);
  }, [nowMinutes]);

  const nowTop = useMemo(() => {
    if (nowLogicalMinutes == null) return null;
    if (nowLogicalMinutes < 0 || nowLogicalMinutes > EXTENSION_ZONE_END) return null;
    return logicalMinutesToPx(nowLogicalMinutes, logicalConfig);
  }, [nowLogicalMinutes, logicalConfig]);

  // 새벽 구간(01:00~07:00) 전체 이벤트 수 (접기 바 배지용)
  const deadZoneEventCount = useMemo(() => {
    let count = 0;
    for (const date of weekDates) {
      const dd = dayDataMap.get(date);
      if (!dd) continue;
      for (const p of dd.plans) {
        if (!p.start_time) continue;
        const logMin = physicalMinToLogical(timeToMinutes(p.start_time.substring(0, 5)));
        if (logMin >= 0 && logMin < DEAD_ZONE_END) count++;
      }
    }
    return count;
  }, [weekDates, dayDataMap]);

  // 주간뷰 리사이즈
  const [resizingPlanId, setResizingPlanId] = useState<string | null>(null);
  const [resizingDate, setResizingDate] = useState<string | null>(null);
  const [resizingEdge, setResizingEdge] = useState<'top' | 'bottom'>('bottom');

  // resizingBlock 탐색: 리사이즈 중인 플랜의 블록 정보를 dayDataMap에서 찾기
  // ★ plans(study)와 customItems(custom) 모두 검색 — 모든 event_type의 리사이즈 지원
  const resizingBlock = useMemo(() => {
    if (!resizingPlanId || !resizingDate) return null;
    const dayData = dayDataMap.get(resizingDate);
    if (!dayData) return null;

    // 1) DailyPlan (study 이벤트) 검색
    const dailyPlan = dayData.plans.find(p => p.id === resizingPlanId);
    if (dailyPlan && dailyPlan.start_time) {
      const startLogical = physicalMinToLogical(timeToMinutes(dailyPlan.start_time.substring(0, 5)));
      const endLogical = physicalMinToLogical(dailyPlan.end_time ? timeToMinutes(dailyPlan.end_time.substring(0, 5)) : timeToMinutes(dailyPlan.start_time.substring(0, 5)) + 60);
      const topPx = logicalMinutesToPx(startLogical, logicalConfig);
      const bottomPx = logicalMinutesToPx(endLogical, logicalConfig);
      return { height: bottomPx - topPx, startMin: startLogical, endMin: endLogical, plan: toPlanItemData(dailyPlan, 'plan') };
    }

    // 2) PlanItemData (custom 이벤트) 검색
    const customPlan = dayData.customItems.find(p => p.id === resizingPlanId);
    if (customPlan && customPlan.startTime) {
      const startLogical = physicalMinToLogical(timeToMinutes(customPlan.startTime.substring(0, 5)));
      const endLogical = physicalMinToLogical(customPlan.endTime ? timeToMinutes(customPlan.endTime.substring(0, 5)) : timeToMinutes(customPlan.startTime.substring(0, 5)) + 60);
      const topPx = logicalMinutesToPx(startLogical, logicalConfig);
      const bottomPx = logicalMinutesToPx(endLogical, logicalConfig);
      return { height: bottomPx - topPx, startMin: startLogical, endMin: endLogical, plan: customPlan };
    }

    return null;
  }, [resizingPlanId, resizingDate, dayDataMap, logicalConfig, ppm]);

  const { currentHeight: resizeHeight, isResizing, resizeHandleProps: rawResizeHandleProps } = useResizable({
    initialHeight: resizingBlock?.height ?? 60,
    minHeight: SNAP_MINUTES * ppm,
    maxHeight: resizingBlock
      ? resizingEdge === 'top'
        ? logicalMinutesToPx(resizingBlock.startMin, logicalConfig) + resizingBlock.height  // top: 위로 확장 한계
        : totalHeight - logicalMinutesToPx(resizingBlock.startMin, logicalConfig)           // bottom: 아래로 확장 한계
      : totalHeight,
    snapIncrement: SNAP_MINUTES * ppm,
    edge: resizingEdge,
    onResizeEnd: useCallback(async (newHeightPx: number) => {
      // ★ trailing click 방지: 리사이즈 종료 후 브라우저가 발생시키는 click 이벤트를
      // 한 번 소비하여 handleGridClick(퀵생성)과의 경합 방지
      const container = scrollContainerRef.current;
      if (container) {
        const swallowClick = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        container.addEventListener('click', swallowClick, { capture: true, once: true });
        setTimeout(() => container.removeEventListener('click', swallowClick, { capture: true }), 300);
      }

      if (!resizingBlock || !resizingPlanId || !resizingDate || !calendarId) return;
      const newDurationMinutes = newHeightPx / ppm;
      const currentEdge = resizingEdge;

      // resizingBlock.plan은 PlanItemData (study/custom 모두 통합)
      const plan = resizingBlock.plan;
      const prevStartTime = plan.startTime!.substring(0, 5);
      const prevEndTime = plan.endTime?.substring(0, 5) ?? resolvePhysicalTime(resizingDate, resizingBlock.startMin + 60).physicalTimeHHMM;
      const prevDuration = resizingBlock.height / ppm;

      let newStartLogical: number;
      let newEndLogical: number;

      if (currentEdge === 'top') {
        // 상단 리사이즈: 종료 시간 유지, 시작 시간 변경
        newEndLogical = resizingBlock.endMin;
        newStartLogical = resizingBlock.endMin - newDurationMinutes;
      } else {
        // 하단 리사이즈: 시작 시간 유지, 종료 시간 변경
        newStartLogical = resizingBlock.startMin;
        newEndLogical = resizingBlock.startMin + newDurationMinutes;
      }

      // 논리적 분 → 물리적 날짜+시간
      const startPhysical = resolvePhysicalTime(resizingDate, newStartLogical);
      const endPhysical = resolvePhysicalTime(resizingDate, newEndLogical);
      const newStartTime = startPhysical.physicalTimeHHMM;
      const newEndTime = endPhysical.physicalTimeHHMM;

      // 반복 이벤트 가상 인스턴스: exception 생성 (GCal 동작 — "이 이벤트만")
      const isRecurring = !!(plan.rrule || plan.recurringEventId);
      const isRecurringInstance = isRecurring && !plan.isException;
      const rollback = optimisticTimeChange(resizingPlanId, resizingDate, newStartTime, newEndTime, newDurationMinutes);
      try {
        if (isRecurringInstance) {
          const parentId = plan.recurringEventId ?? resizingPlanId;
          const startAt = `${resizingDate}T${newStartTime}:00+09:00`;
          const endAt = `${resizingDate}T${newEndTime}:00+09:00`;

          const result = await createRecurringException({
            parentEventId: parentId,
            instanceDate: resizingDate,
            overrides: {
              start_at: startAt,
              end_at: endAt,
            },
          });
          if (!result.success) {
            rollback();
            showToast(result.error || '반복 일정 리사이즈 실패', 'error');
            return;
          }
        } else {
          await updateItemTime({
            studentId, calendarId, planDate: resizingDate,
            itemId: resizingPlanId, itemType: 'plan',
            newStartTime, newEndTime,
            estimatedMinutes: newDurationMinutes,
          });
        }
        revalidate();
        // exception 생성 시 undo 불가 (새 ID로 생성되므로 부모 ID로 되돌릴 수 없음)
        if (!isRecurringInstance) {
          pushUndoable({
            type: 'resize',
            planId: resizingPlanId,
            studentId,
            calendarId,
            planDate: resizingDate,
            prev: { startTime: prevStartTime, endTime: prevEndTime, estimatedMinutes: prevDuration },
            description: '리사이즈 완료',
          });
        }
      } catch {
        rollback();
        showToast('리사이즈 실패', 'error');
      }
      setResizingPlanId(null);
      setResizingDate(null);
    }, [resizingBlock, resizingPlanId, resizingDate, studentId, calendarId, resizingEdge, optimisticTimeChange, revalidate, pushUndoable, showToast]),
  });

  // ★ Bug Fix: 리사이즈 상태 안전 정리
  // useResizable의 isResizing이 false로 전환되었지만 resizingPlanId가 남아있으면
  // (mouseup 누락, 포커스 이탈 등 엣지 케이스) 강제 정리
  //
  // 주의: resizeStartingRef 가드 — makeWeeklyResizeHandleProps에서 상태 설정 후
  // rAF에서 useResizable.startResize가 실행되기 전에 이 effect가 먼저 실행됨.
  // 이때 isResizing=false, resizingPlanId=set → 잘못된 정리 방지
  const resizeStartingRef = useRef(false);

  useEffect(() => {
    if (resizeStartingRef.current) {
      resizeStartingRef.current = false;
      return; // 리사이즈 시작 직후 첫 렌더 → 건너뜀
    }
    if (!isResizing && resizingPlanId) {
      setResizingPlanId(null);
      setResizingDate(null);
    }
  }, [isResizing, resizingPlanId]);

  // cancelPendingDrag를 ref로 추출 — crossDayDrag보다 먼저 선언 가능
  const cancelPendingDragRef = useRef<(() => void) | null>(null);

  const makeWeeklyResizeHandleProps = useCallback(
    (planId: string, date: string, edge: 'top' | 'bottom') => ({
      onMouseDown: (e: React.MouseEvent) => {
        cancelPendingDragRef.current?.();
        resizeStartingRef.current = true; // safety effect 가드
        setResizingPlanId(planId);
        setResizingDate(date);
        setResizingEdge(edge);
        requestAnimationFrame(() => { rawResizeHandleProps.onMouseDown(e); });
      },
      onTouchStart: (e: React.TouchEvent) => {
        cancelPendingDragRef.current?.();
        resizeStartingRef.current = true; // safety effect 가드
        setResizingPlanId(planId);
        setResizingDate(date);
        setResizingEdge(edge);
        requestAnimationFrame(() => { rawResizeHandleProps.onTouchStart(e); });
      },
    }),
    [rawResizeHandleProps],
  );

  // EventDetailPopover (useEventDetailPopover 훅)
  // ★ Bug Fix: React 18 batching race condition
  // 문제: mousedown(외부 클릭) → closePopover() → React batch re-render → click(handleGridClick)
  //       이 시점에 isPopoverOpen은 이미 false → guard 실패 → 퀵생성 열림
  // 해결: onMouseDown 시점에 popover 상태를 캡처하고, onClick에서 확인
  //       → React 이벤트 델리게이션은 document 리스너보다 먼저 실행되므로
  //         mousedown에서 isPopoverOpen은 아직 true (popover close 전)
  const popoverOpenOnMouseDownRef = useRef(false);

  const { showPopover, closePopover: rawClosePopover, isPopoverOpen, popoverProps, recurringModalState, closeRecurringModal } = useEventDetailPopover({
    onEdit: (id, et) => { onEdit?.(id, et); },
    onDelete: (id) => { onDelete?.(id); },
    onQuickStatusChange: (planId, newStatus, prevStatus, instanceDate) => {
      handleQuickStatusChange(planId, newStatus, prevStatus, instanceDate);
    },
    onColorChange: async (planId, color) => {
      const rollback = optimisticColorChange(planId, color);
      const { updateEventColor } = await import('@/lib/domains/calendar/actions/calendarEventActions');
      const result = await updateEventColor(planId, color);
      if (result?.success === false) {
        rollback();
      } else {
        revalidate();
      }
    },
    onDisable: async (id) => {
      const rollback = optimisticDelete(id);
      try {
        const { deleteCalendarEventAction } = await import('@/lib/domains/admin-plan/actions/calendarEvents');
        await deleteCalendarEventAction(id);
        revalidate();
        pushUndoable({
          type: 'delete-plan',
          planId: id,
          description: '비학습 시간이 비활성화되었습니다.',
        });
      } catch {
        rollback();
      }
    },
    onConsultationStatusChange: async (eventId: string, status: 'completed' | 'no_show' | 'cancelled' | 'scheduled') => {
      const { updateScheduleStatus } = await import('@/lib/domains/consulting/actions/schedule');
      await updateScheduleStatus(eventId, status, studentId, status === 'cancelled');
      revalidate();
    },
    isAdminMode,
  });

  const closePopover = rawClosePopover;

  // 빈 영역 클릭 → 인라인 퀵 생성
  const [quickCreateState, setQuickCreateState] = useState<{
    slot: EmptySlot;
    date: string;
    virtualRect: { x: number; y: number; width: number; height: number };
    isAllDay?: boolean;
  } | null>(null);
  const quickCreateOpenRef = useRef(false);
  /** 더블클릭 판별을 위한 싱글클릭 지연 타이머 */
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag-to-Create (퀵생성보다 먼저 선언 → clearDragPreview 참조 가능)
  const { dragState, previewStyle, clearDragPreview } = useDragToCreate({
    containerRef: scrollContainerRef,
    displayRange,
    pxPerMinute: ppm,
    snapMinutes: SNAP_MINUTES,
    deadZoneCollapsed,
    enabled: !!calendarId && !isPopoverOpen && !quickCreateState && !isResizing,
    onDragEnd: useCallback(
      (date: string, startLogicalMin: number, endLogicalMin: number) => {
        if (!calendarId) return;
        // 논리적 분 → 물리적 날짜+시간
        const startPhysical = resolvePhysicalTime(date, startLogicalMin);
        const endPhysical = resolvePhysicalTime(date, endLogicalMin);
        const slot: EmptySlot = {
          startTime: startPhysical.physicalTimeHHMM,
          endTime: endPhysical.physicalTimeHHMM,
          durationMinutes: endLogicalMin - startLogicalMin,
        };
        // 컬럼 위치 기반 virtualRect
        const colEl = scrollContainerRef.current?.querySelector(
          `[data-column-date="${date}"]`,
        ) as HTMLElement | null;
        const colRect = colEl?.getBoundingClientRect();
        const startPx = logicalMinutesToPx(startLogicalMin, logicalConfig);
        const containerRect = scrollContainerRef.current?.getBoundingClientRect();
        quickCreateOpenRef.current = true;
        setQuickCreateState({
          slot,
          date: startPhysical.physicalDate,
          virtualRect: {
            x: colRect ? colRect.left + colRect.width / 2 : 56,
            y: containerRect ? containerRect.top + startPx - (scrollContainerRef.current?.scrollTop ?? 0) : 0,
            width: 0,
            height: 0,
          },
        });
      },
      [calendarId, logicalConfig],
    ),
  });

  // Floating UI 포지셔닝
  const { refs: quickCreateRefs, floatingStyles: quickCreateStyles, isPositioned: isQcPositioned } =
    usePopoverPosition({
      virtualRect: quickCreateState?.virtualRect ?? null,
      placement: 'right-start',
      open: !!quickCreateState,
    });

  // 퀵생성 닫기 헬퍼 (ref + state 동기화 + 드래그 프리뷰 정리)
  const closeQuickCreate = useCallback(() => {
    quickCreateOpenRef.current = false;
    setQuickCreateState(null);
    clearDragPreview();
  }, [clearDragPreview]);

  // 새벽 접기 토글 (퀵생성/드래그 프리뷰를 먼저 닫아 stale virtualRect 방지)
  const handleToggleDeadZone = useCallback(() => {
    closeQuickCreate();
    toggleDeadZone();
  }, [closeQuickCreate, toggleDeadZone]);

  const handleBlockClick = useCallback(
    (plan: PlanItemData, anchorRect: DOMRect) => {
      closeQuickCreate(); // 퀵생성 닫기 (상호 배타)
      showPopover(plan, anchorRect);
    },
    [closeQuickCreate, showPopover],
  );

  // 클릭 타이머 cleanup
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  // 그리드 외부 클릭 시 퀵생성 닫기 (사이드바, 헤더 등)
  useEffect(() => {
    if (!quickCreateOpenRef.current) return;

    const handleDocumentClick = (e: MouseEvent) => {
      // floating 팝오버 내부 클릭 무시
      const floatingEl = quickCreateRefs.floating.current;
      if (floatingEl?.contains(e.target as Node)) return;
      // fallback: floating ref가 아직 세팅 안 됐을 때 data attribute로 체크
      if ((e.target as HTMLElement).closest?.('[data-quick-create]')) return;
      // 그리드 내부 클릭은 handleGridClick이 처리
      if (scrollContainerRef.current?.contains(e.target as Node)) return;
      closeQuickCreate();
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [quickCreateState, closeQuickCreate, quickCreateRefs.floating]);

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-grid-block]') ||
          (e.target as HTMLElement).closest('[data-dead-zone-bar]')) return;
      if (!calendarId) return;

      // 이미 열려있으면 닫기만 하고 리턴 (ref로 즉시 확인 → 클로저/리렌더 무관)
      if (quickCreateOpenRef.current) {
        closeQuickCreate();
        return;
      }

      // EventDetailPopover가 열려있거나 "mousedown 시점에 열려있었으면" 퀵생성 열지 않음
      // ★ React 이벤트 델리게이션(root) → document 리스너(popover close) 순서이므로
      //   onMouseDown 시점에 캡처한 isPopoverOpen은 아직 true (popover close 전)
      if (isPopoverOpen || popoverOpenOnMouseDownRef.current) {
        popoverOpenOnMouseDownRef.current = false;
        closePopover();
        return;
      }

      // 이전 클릭 타이머 취소
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      // 어떤 컬럼인지 판별
      const columnEl = (e.target as HTMLElement).closest('[data-column-date]') as HTMLElement | null;
      if (!columnEl) return;
      const clickDate = columnEl.getAttribute('data-column-date');
      if (!clickDate) return;

      // 클릭 위치 → 논리적 분 → 물리적 시간 (컬럼 기반)
      const colRect = columnEl.getBoundingClientRect();
      const offsetY = e.clientY - colRect.top;
      const clickedLogicalMin = pxToLogicalMinutes(offsetY, logicalConfig);
      const snappedStart = Math.floor(clickedLogicalMin / SNAP_MINUTES) * SNAP_MINUTES;
      const clickDuration = defaultEstimatedMinutes ?? 60;
      const snappedEnd = Math.min(snappedStart + clickDuration, EXTENSION_ZONE_END);
      const startPhysical = resolvePhysicalTime(clickDate, snappedStart);
      const endPhysical = resolvePhysicalTime(clickDate, snappedEnd);
      const clientX = e.clientX;
      const clientY = e.clientY;

      // 더블클릭 판별 대기 (250ms) — GCal: 싱글클릭 = 퀵생성, 더블클릭 = 전체편집
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        const slot: EmptySlot = {
          startTime: startPhysical.physicalTimeHHMM,
          endTime: endPhysical.physicalTimeHHMM,
          durationMinutes: snappedEnd - snappedStart,
        };
        quickCreateOpenRef.current = true;
        setQuickCreateState({
          slot,
          date: startPhysical.physicalDate,
          virtualRect: { x: clientX, y: clientY, width: 0, height: 0 },
        });
      }, 250);
    },
    [calendarId, logicalConfig, ppm, closeQuickCreate, closePopover, isPopoverOpen, defaultEstimatedMinutes],
  );

  // 더블클릭 → 이벤트 편집 모달 (Google Calendar 스타일)
  const handleGridDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-grid-block]') ||
          (e.target as HTMLElement).closest('[data-dead-zone-bar]')) return;
      if (!calendarId) return;

      // 싱글클릭 퀵생성 타이머 취소
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      closeQuickCreate();

      const columnEl = (e.target as HTMLElement).closest('[data-column-date]') as HTMLElement | null;
      if (!columnEl) return;
      const clickDate = columnEl.getAttribute('data-column-date');
      if (!clickDate) return;

      const colRect = columnEl.getBoundingClientRect();
      const offsetY = e.clientY - colRect.top;
      const clickedLogicalMin = pxToLogicalMinutes(offsetY, logicalConfig);
      const snappedStart = Math.floor(clickedLogicalMin / SNAP_MINUTES) * SNAP_MINUTES;
      const dbClickDuration = defaultEstimatedMinutes ?? 60;
      const snappedEnd = Math.min(snappedStart + dbClickDuration, EXTENSION_ZONE_END);
      const dblStartPhysical = resolvePhysicalTime(clickDate, snappedStart);
      const dblEndPhysical = resolvePhysicalTime(clickDate, snappedEnd);

      if (onOpenEventEditNew) {
        onOpenEventEditNew({
          date: dblStartPhysical.physicalDate,
          startTime: dblStartPhysical.physicalTimeHHMM,
          endTime: dblEndPhysical.physicalTimeHHMM,
        });
      } else {
        const params = new URLSearchParams({
          date: dblStartPhysical.physicalDate,
          startTime: dblStartPhysical.physicalTimeHHMM,
          endTime: dblEndPhysical.physicalTimeHHMM,
        });
        if (calendarId) params.set('calendarId', calendarId);
        router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
      }
    },
    [calendarId, logicalConfig, ppm, studentId, router, onOpenEventEditNew, closeQuickCreate, defaultEstimatedMinutes],
  );

  // M-1: 모바일 롱프레스 → 전체 편집 모달 (더블클릭 대체)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<{ x: number; y: number; date: string } | null>(null);
  const longPressActivatedRef = useRef(false);
  const LONG_PRESS_THRESHOLD = 15; // px

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPosRef.current = null;
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const handleGridTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-grid-block]') ||
          (e.target as HTMLElement).closest('[data-dead-zone-bar]')) return;
      if (!calendarId || isResizing || isPopoverOpen || quickCreateState || dragState) return;
      if (!e.touches || e.touches.length === 0) return;

      // touchstart 시점에 컬럼(날짜)을 캡처 (500ms 후 stale 좌표 방지)
      const columnEl = (e.target as HTMLElement).closest('[data-column-date]') as HTMLElement | null;
      if (!columnEl) return;
      const touchDate = columnEl.getAttribute('data-column-date');
      if (!touchDate) return;

      longPressActivatedRef.current = false;
      const touch = e.touches[0];
      longPressPosRef.current = { x: touch.clientX, y: touch.clientY, date: touchDate };

      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        const pos = longPressPosRef.current;
        longPressPosRef.current = null;
        if (!pos || !scrollContainerRef.current) return;

        // 싱글클릭 퀵생성 타이머 취소
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        closeQuickCreate();

        // 시간 슬롯 계산 (컬럼 기반, 논리적 좌표)
        const colEl = scrollContainerRef.current.querySelector(`[data-column-date="${pos.date}"]`) as HTMLElement | null;
        const colRect = colEl?.getBoundingClientRect();
        const offsetY = colRect ? pos.y - colRect.top : 0;
        const clickedLogicalMin = pxToLogicalMinutes(offsetY, logicalConfig);
        const snappedStart = Math.floor(clickedLogicalMin / SNAP_MINUTES) * SNAP_MINUTES;
        const longPressDuration = defaultEstimatedMinutes ?? 60;
        const snappedEnd = Math.min(snappedStart + longPressDuration, EXTENSION_ZONE_END);

        // 햅틱 피드백 (유효한 슬롯 확인 후)
        if (navigator.vibrate) navigator.vibrate(10);
        longPressActivatedRef.current = true;

        const lpStartPhysical = resolvePhysicalTime(pos.date, snappedStart);
        const lpEndPhysical = resolvePhysicalTime(pos.date, snappedEnd);

        if (onOpenEventEditNew) {
          onOpenEventEditNew({
            date: lpStartPhysical.physicalDate,
            startTime: lpStartPhysical.physicalTimeHHMM,
            endTime: lpEndPhysical.physicalTimeHHMM,
          });
        } else {
          const params = new URLSearchParams({
            date: lpStartPhysical.physicalDate,
            startTime: lpStartPhysical.physicalTimeHHMM,
            endTime: lpEndPhysical.physicalTimeHHMM,
          });
          if (calendarId) params.set('calendarId', calendarId);
          router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
        }
      }, 500);
    },
    [calendarId, logicalConfig, ppm, studentId, router, onOpenEventEditNew, closeQuickCreate, isResizing, isPopoverOpen, quickCreateState, dragState],
  );

  const handleGridTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!longPressPosRef.current) return;
      if (e.touches.length > 1) { clearLongPress(); return; } // 멀티터치(핀치) 취소
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - longPressPosRef.current.x);
      const dy = Math.abs(touch.clientY - longPressPosRef.current.y);
      if (dx > LONG_PRESS_THRESHOLD || dy > LONG_PRESS_THRESHOLD) clearLongPress();
    },
    [clearLongPress],
  );

  const handleGridTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressActivatedRef.current) {
        e.preventDefault(); // 후속 click 이벤트 방지 (이중 액션 차단)
        longPressActivatedRef.current = false;
      }
      clearLongPress();
    },
    [clearLongPress],
  );

  // 종일 영역 클릭 → 종일 모드 퀵생성
  const handleAllDayQuickCreate = useCallback(
    (date: string, anchorRect: DOMRect) => {
      if (quickCreateOpenRef.current) { closeQuickCreate(); return; }
      // popover가 열려있었으면 닫기만 하고 퀵생성은 열지 않음 (GCal 동작)
      if (isPopoverOpen || popoverOpenOnMouseDownRef.current) {
        popoverOpenOnMouseDownRef.current = false;
        closePopover();
        return;
      }

      const allDaySlot: EmptySlot = { startTime: '00:00', endTime: '23:59', durationMinutes: 1439 };
      quickCreateOpenRef.current = true;
      setQuickCreateState({
        slot: allDaySlot,
        date,
        virtualRect: {
          x: anchorRect.left + anchorRect.width / 2,
          y: anchorRect.bottom,
          width: 0,
          height: 0,
        },
        isAllDay: true,
      });
    },
    [closeQuickCreate, isPopoverOpen, closePopover],
  );

  // 종일 이벤트 클릭 → EventDetailPopover (GCal 스타일)
  const handleAllDayItemClick = useCallback(
    (item: AllDayItem, anchorRect: DOMRect) => {
      // 공휴일은 DB 레코드가 없으므로 popover 불필요 (title tooltip으로 충분)
      if (item.type === 'holiday') return;

      // 퀵생성 닫기
      if (quickCreateOpenRef.current) closeQuickCreate();

      // AllDayItem → PlanItemData 변환 (팝오버 표시용 최소 데이터)
      const planItem: PlanItemData = {
        id: item.id,
        type: 'plan',
        title: item.label,
        status: 'pending',
        isCompleted: false,
        planDate: item.startDate,
        startTime: item.startTime ?? null,
        endTime: item.endTime ?? null,
        label: item.exclusionType ?? item.label ?? '기타',
        isExclusion: !!item.exclusionType,
        isTask: false,
        // multi-day timed: 종료 날짜 정보 (팝오버에서 날짜 범위 표시용)
        endDate: item.endDate,
      };
      showPopover(planItem, anchorRect);
    },
    [closeQuickCreate, showPopover],
  );

  // Cross-Day Drag (옵티미스틱: 드롭 즉시 이동 반영)
  // BUG FIX: 리사이즈 중에는 드래그 비활성화 (리사이즈 ↔ 드래그 충돌 방지)
  const crossDayDrag = useCrossDayDrag({
    columnRefs: columnRefsMap,
    scrollContainerRef,
    displayRange,
    pxPerMinute: ppm,
    snapMinutes: SNAP_MINUTES,
    deadZoneCollapsed,
    enabled: !!calendarId && !isResizing,
    studentId,
    calendarId: calendarId ?? '',
    onMoveComplete: useCallback(
      () => {
        revalidate();
      },
      [revalidate],
    ),
    onBeforeMove: useCallback(
      (params: {
        planId: string;
        sourceDate: string;
        targetDate: string;
        newStartTime: string;
        newEndTime: string;
        durationMinutes: number;
      }) => {
        const { planId, sourceDate, targetDate, newStartTime, newEndTime, durationMinutes } = params;
        if (sourceDate !== targetDate) {
          return optimisticDateMove(planId, sourceDate, targetDate, newStartTime, newEndTime, durationMinutes);
        }
        return optimisticTimeChange(planId, sourceDate, newStartTime, newEndTime, durationMinutes);
      },
      [optimisticDateMove, optimisticTimeChange],
    ),
    onUndoPush: pushUndoable,
    onError: useCallback((msg: string) => showToast(msg, 'error'), [showToast]),
  });
  // Ref 동기화: makeWeeklyResizeHandleProps에서 사용
  cancelPendingDragRef.current = crossDayDrag.cancelPendingDrag;

  // 퀵 상태 변경 (옵티미스틱: 즉시 색상 반영)
  const handleQuickStatusChange = useCallback(
    async (planId: string, newStatus: PlanStatus, prevStatus?: PlanStatus, instanceDate?: string) => {
      const rollback = optimisticStatusChange(planId, newStatus);
      const { updatePlanStatus } = await import(
        '@/lib/domains/calendar/actions/calendarEventActions'
      );
      const result = await updatePlanStatus({ planId, status: newStatus, skipRevalidation: true, instanceDate });
      if (result.success) {
        revalidate();
        if (prevStatus) {
          pushUndoable({
            type: 'status-change',
            planId,
            prevStatus,
            description: '상태가 변경되었습니다.',
          });
        }
      } else {
        rollback();
      }
    },
    [optimisticStatusChange, revalidate, pushUndoable],
  );

  // 반복 이벤트 scope 선택 핸들러
  const handleRecurringScopeSelect = useCallback(
    async (scope: RecurringEditScope) => {
      if (!recurringModalState) return;
      const { mode, planId, instanceDate } = recurringModalState;
      closeRecurringModal();

      if (mode === 'delete') {
        const result = await deleteRecurringEvent({
          eventId: planId,
          scope,
          instanceDate,
        });
        if (result.success) {
          revalidate();
          // 부모 ID 추적 (exception인 경우 recurringEventId 사용)
          const parentId = result.deletedEventIds.length > 0 && scope === 'all'
            ? result.deletedEventIds[0]
            : planId;
          pushUndoable({
            type: 'recurring-delete',
            scope,
            parentEventId: parentId,
            instanceDate,
            previousExdates: result.previousExdates,
            previousRrule: result.previousRrule,
            deletedEventIds: result.deletedEventIds,
            description: scope === 'all'
              ? '모든 반복 일정이 삭제되었습니다.'
              : scope === 'this_and_following'
                ? '이후 반복 일정이 삭제되었습니다.'
                : '반복 일정이 삭제되었습니다.',
          });
        } else {
          showToast(result.error ?? '삭제에 실패했습니다.', 'error');
        }
      } else {
        // 반복 이벤트 편집: instanceDate 포함하여 전체 페이지로 이동
        const editParams = new URLSearchParams({ instanceDate });
        if (calendarId) editParams.set('calendarId', calendarId);
        router.push(`/admin/students/${studentId}/plans/event/${planId}/edit?${editParams}`);
      }
    },
    [recurringModalState, closeRecurringModal, revalidate, pushUndoable, showToast, router, studentId, calendarId],
  );

  // 컬럼 ref 등록
  const setColumnRef = useCallback(
    (date: string) => (el: HTMLDivElement | null) => {
      if (el) {
        columnRefsMap.current.set(date, el);
      } else {
        columnRefsMap.current.delete(date);
      }
    },
    [],
  );

  // ★ 프리뷰 블록의 겹침 레이아웃 계산 (Google Calendar 스타일)
  // 기존 이벤트 목록에 프리뷰를 가상 아이템으로 추가 → assignLevels로 겹침 컬럼 배치
  const previewOverlapLayout = useMemo(() => {
    const previewDate = dragState?.date ?? (quickCreateState && !dragState ? quickCreateState.date : null);
    if (!previewDate) return null;

    const startMin = dragState
      ? dragState.startMinutes
      : timeToMinutes(quickCreateState!.slot.startTime);
    const endMin = dragState
      ? dragState.endMinutes
      : timeToMinutes(quickCreateState!.slot.endTime);
    if (endMin <= startMin) return null;

    const dayData = dayDataMap.get(previewDate);
    // 기존 이벤트 세그먼트 수집
    const existingItems: { id: string; startMinutes: number; endMinutes: number }[] = [];
    if (dayData) {
      for (const p of dayData.plans) {
        if (p.start_time && p.end_time) {
          existingItems.push({
            id: p.id,
            startMinutes: timeToMinutes(p.start_time),
            endMinutes: timeToMinutes(p.end_time),
          });
        }
      }
      for (const c of dayData.customItems) {
        if (c.startTime && c.endTime) {
          existingItems.push({
            id: c.id,
            startMinutes: timeToMinutes(c.startTime),
            endMinutes: timeToMinutes(c.endTime),
          });
        }
      }
      for (const ns of dayData.nonStudyItems) {
        if (ns.startTime && ns.endTime) {
          existingItems.push({
            id: ns.id,
            startMinutes: timeToMinutes(ns.startTime),
            endMinutes: timeToMinutes(ns.endTime),
          });
        }
      }
    }

    // 프리뷰를 가상 아이템으로 추가
    const PREVIEW_ID = '__preview__';
    const allItems = [...existingItems, { id: PREVIEW_ID, startMinutes: startMin, endMinutes: endMin }];
    const withLevels = assignLevels(allItems);
    const preview = withLevels.find(item => item.id === PREVIEW_ID);
    if (!preview) return null;

    const pos = computeLayoutPosition(preview.level, preview.totalLevels, preview.expandedSpan);
    return { left: pos.left, width: pos.width };
  }, [dragState, quickCreateState, dayDataMap]);

  return (
    <div
      className="flex flex-col h-full"
      onMouseDown={() => {
        // ★ popover 상태를 mousedown 시점에 캡처 (header + allday + grid 공통)
        // React 이벤트 델리게이션이 document 리스너(popover close)보다 먼저 실행되므로
        // isPopoverOpen은 아직 true (popover의 click-outside가 close 하기 전)
        popoverOpenOnMouseDownRef.current = isPopoverOpen;
      }}
    >
      {/* 헤더 + 종일 영역: biweekly에서는 스크롤 안으로 이동하므로 여기서는 일반 모드만 */}
      {!biweeklyMode && (
        <div className="flex-shrink-0" style={{ overflowX: 'hidden', overflowY: 'auto', scrollbarGutter: 'stable' }}>
          <WeeklyGridHeader
            weekDates={weekDates}
            selectedDate={selectedDate}
            dayDataMap={dayDataMap}
            onDateChange={onDateChange}
            onSwitchToDaily={onSwitchToDaily}
            showHolidays={showHolidays}
          />

          {/* 종일 이벤트 영역 */}
          <AllDayRow
            weekDates={weekDates}
            dayDataMap={dayDataMap}
            calendarId={calendarId}
            calendarColorMap={calendarColorMap}
            previewColor={previewColor}
            onAllDayQuickCreate={handleAllDayQuickCreate}
            onAllDayItemClick={handleAllDayItemClick}
            quickCreateDate={quickCreateState?.isAllDay ? quickCreateState.date : null}
            isQuickCreateAllDay={!!quickCreateState?.isAllDay}
          />
        </div>
      )}

      {/* 스크롤 컨테이너 (scrollbar-gutter: stable로 헤더와 동일한 스크롤바 공간) */}
      <div
        ref={scrollContainerRef}
        role="grid"
        aria-label={biweeklyMode ? '2주간 캘린더 그리드' : `주간 캘린더 그리드 (${weekDates.length}일)`}
        aria-colcount={biweeklyMode ? 7 : weekDates.length}
        aria-busy={isAnyLoading}
        data-scroll-area={!biweeklyMode || undefined}
        className="flex-1 relative overflow-x-hidden scroll-gpu"
        style={{ overflowY: 'auto', scrollbarGutter: 'stable' }}
        onClick={handleGridClick}
        onDoubleClick={handleGridDoubleClick}
        onTouchStart={handleGridTouchStart}
        onTouchMove={handleGridTouchMove}
        onTouchEnd={handleGridTouchEnd}
      >
        {/* Pull-to-Refresh 인디케이터 */}
        {(wIsPulling || wIsRefreshing) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-transform duration-100"
            style={{ top: `${wPullDistance - 36}px` }}
          >
            <div className="w-9 h-9 rounded-full bg-[var(--color-background)] shadow-lg border border-[rgb(var(--color-secondary-200))] flex items-center justify-center">
              {wIsRefreshing ? (
                <div className="w-4 h-4 rounded-full border-2 border-[rgb(var(--color-primary-500))] border-t-transparent animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4 text-[var(--text-secondary)] transition-transform duration-100"
                  style={{ transform: `rotate(${wPullProgress * 180}deg)` }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              )}
            </div>
          </div>
        )}
        {isAnyLoading && !biweeklyMode && (
          <div className="absolute inset-0 bg-[rgb(var(--color-secondary-50))]/60 z-40 pointer-events-none">
            <div className="flex h-full" style={{ paddingLeft: TIME_GUTTER_WIDTH, paddingRight: '0.5rem' }}>
              <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDates.length}, 1fr)` }}>
              {Array.from({ length: weekDates.length }).map((_, col) => (
                <div key={col} className="border-r border-[rgb(var(--color-secondary-100))]/50 px-0.5 pt-16 space-y-3">
                  <div className="h-14 bg-[rgb(var(--color-secondary-200))]/60 rounded animate-pulse mx-0.5" />
                  <div className="h-8 bg-[rgb(var(--color-secondary-200))]/40 rounded animate-pulse mx-0.5" />
                  <div className="h-20 bg-[rgb(var(--color-secondary-200))]/50 rounded animate-pulse mx-0.5 mt-8" />
                </div>
              ))}
              </div>
            </div>
          </div>
        )}

        {/* biweekly 모드: 50:50 분할, 각 주가 독립 스크롤 */}
        {biweeklyMode ? (
          <div className="flex flex-col h-full">
            {[biweeklyWeek1Dates, biweeklyWeek2Dates].map((wkDates, weekIdx) => (
              <div
                key={weekIdx}
                className={cn(
                  'flex-1 min-h-0 flex flex-col',
                  weekIdx === 0 && 'border-b-2 border-[rgb(var(--color-primary-200))]',
                )}
              >
                {/* 주차 헤더 + 종일 (고정) */}
                <div className="flex-shrink-0" style={{ overflowX: 'hidden', overflowY: 'auto', scrollbarGutter: 'stable' }}>
                  <WeeklyGridHeader
                    weekDates={wkDates}
                    selectedDate={selectedDate}
                    dayDataMap={dayDataMap}
                    onDateChange={onDateChange}
                    onSwitchToDaily={onSwitchToDaily}
                    showHolidays={showHolidays}
                  />
                  <AllDayRow
                    weekDates={wkDates}
                    dayDataMap={dayDataMap}
                    calendarId={calendarId}
                    calendarColorMap={calendarColorMap}
                    previewColor={previewColor}
                    onAllDayQuickCreate={handleAllDayQuickCreate}
                    onAllDayItemClick={handleAllDayItemClick}
                    quickCreateDate={quickCreateState?.isAllDay ? quickCreateState.date : null}
                    isQuickCreateAllDay={!!quickCreateState?.isAllDay}
                  />
                </div>

                {/* 시간 그리드 래퍼 (힌트 오버레이 포함) */}
                <div className="flex-1 min-h-0 relative">
                  {/* 위쪽 힌트 pill */}
                  {(() => {
                    const hints = weekIdx === 0 ? week1Hints : week2Hints;
                    return hints.above && (
                      <OffScreenEventHint
                        direction="above"
                        timeRange={hints.above.timeRange}
                        eventCount={hints.above.eventCount}
                        onClick={() => handleHintClick(hints.above!.targetMinutes)}
                      />
                    );
                  })()}

                  {/* 스크롤 가능 시간 그리드 */}
                  <div
                    ref={weekIdx === 0 ? week1GridRef : week2GridRef}
                    data-scroll-area
                    className="absolute inset-0 overflow-x-hidden scroll-gpu"
                    style={{ overflowY: 'auto', scrollbarGutter: 'stable' }}
                  >
                    <div className="flex pr-2 relative" style={{ height: `${totalHeight}px` }}>
                      {/* 새벽 접기 바 — 전체 너비 1회 */}
                      <div data-dead-zone-bar className="absolute left-0 right-0 z-[6]" style={{ top: 0 }}>
                        <DeadZoneBar
                          eventCount={deadZoneEventCount}
                          isCollapsed={deadZoneCollapsed}
                          onToggle={handleToggleDeadZone}
                          height={deadZoneCollapsed ? DEAD_ZONE_COLLAPSED_PX : 24}
                        />
                      </div>

                      {/* 시간 거터 */}
                      <div
                        className="shrink-0 relative border-r border-[rgb(var(--color-secondary-200))]"
                        style={{ width: TIME_GUTTER_WIDTH }}
                      >
                        {hourLabels.map((logicalHour) => {
                          const logicalMin = logicalHour * 60;
                          const top = logicalMinutesToPx(logicalMin, logicalConfig);
                          return (
                            <div key={`w${weekIdx}-h${logicalHour}`}>
                              <div
                                className="absolute right-2 text-[11px] text-[var(--text-tertiary)] font-medium tabular-nums -translate-y-1/2"
                                style={{ top: `${top}px` }}
                              >
                                {formatLogicalHourLabel(logicalHour)}
                              </div>
                              <div
                                className="absolute h-px bg-[rgb(var(--color-secondary-200))]"
                                style={{ top: `${top}px`, right: '-4px', width: '12px' }}
                              />
                            </div>
                          );
                        })}

                        {/* "다음날" 라벨 — 자정 위치 */}
                        <div
                          className="absolute right-2 text-[11px] text-orange-500 dark:text-orange-400 font-medium -translate-y-1/2"
                          style={{ top: `${logicalMinutesToPx(EXTENSION_ZONE_START, logicalConfig)}px` }}
                        >
                          다음날
                        </div>
                        <div
                          className="absolute h-px bg-orange-300 dark:bg-orange-600"
                          style={{ top: `${logicalMinutesToPx(EXTENSION_ZONE_START, logicalConfig)}px`, right: '-4px', width: '12px' }}
                        />
                      </div>

                      {/* 7 컬럼 */}
                      <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        {wkDates.map((date) => {
                          const dayData = dayDataMap.get(date);
                          const header = formatDayHeader(date);
                          return (
                            <WeeklyGridColumn
                              key={date}
                              ref={setColumnRef(date)}
                              date={date}
                              plans={dayData?.plans ?? []}
                              customItems={dayData?.customItems ?? []}
                              nonStudyItems={dayData?.nonStudyItems ?? []}
                              displayRange={displayRange}
                              deadZoneCollapsed={deadZoneCollapsed}
                              onToggleDeadZone={handleToggleDeadZone}
                              isToday={header.isToday}
                              isPast={header.isPast}
                              nowTop={(nowLogicalDate === date) ? nowTop : undefined}
                              onBlockClick={handleBlockClick}
                              onEdit={onEdit}
                              searchQuery={searchQuery}
                              highlightedPlanId={newlyCreatedPlanId}
                              draggingPlanId={crossDayDrag.draggingPlanId}
                              isDragTarget={crossDayDrag.targetDate === date}
                              enableHover={!!calendarId && !quickCreateState && !isPopoverOpen && !crossDayDrag.draggingPlanId && !dragState && !isResizing}
                              onCrossDayDragStart={calendarId ? crossDayDrag.startDrag : undefined}
                              makeResizeHandleProps={calendarId ? makeWeeklyResizeHandleProps : undefined}
                              resizingPlanId={resizingPlanId}
                              resizeHeight={resizeHeight}
                              resizingEdge={resizingEdge}
                              pxPerMinute={ppm}
                              suppressBlockHover={!!quickCreateState || !!dragState}
                              calendarColorMap={calendarColorMap}
                              isAdminMode={isAdminMode}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 아래쪽 힌트 pill */}
                  {(() => {
                    const hints = weekIdx === 0 ? week1Hints : week2Hints;
                    return hints.below && (
                      <OffScreenEventHint
                        direction="below"
                        timeRange={hints.below.timeRange}
                        eventCount={hints.below.eventCount}
                        onClick={() => handleHintClick(hints.below!.targetMinutes)}
                      />
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 기존 단일 주 렌더링 */
          <div className="flex pr-2 relative" style={{ height: `${totalHeight}px` }}>
            {/* 새벽 접기 바 — 시간 거터 포함 전체 너비 1회만 렌더링 */}
            <div
              data-dead-zone-bar
              className="absolute left-0 right-0 z-[6]"
              style={{ top: 0 }}
            >
              <DeadZoneBar
                eventCount={deadZoneEventCount}
                isCollapsed={deadZoneCollapsed}
                onToggle={handleToggleDeadZone}
                height={deadZoneCollapsed ? DEAD_ZONE_COLLAPSED_PX : 24}
              />
            </div>

            {/* 시간 거터 */}
            <div
              className="shrink-0 relative border-r border-[rgb(var(--color-secondary-200))]"
              style={{ width: TIME_GUTTER_WIDTH }}
            >
              {hourLabels.map((logicalHour) => {
                const logicalMin = logicalHour * 60;
                const top = logicalMinutesToPx(logicalMin, logicalConfig);
                return (
                  <div key={logicalHour}>
                    <div
                      className="absolute right-2 text-[11px] text-[var(--text-tertiary)] font-medium tabular-nums -translate-y-1/2"
                      style={{ top: `${top}px` }}
                    >
                      {formatLogicalHourLabel(logicalHour)}
                    </div>
                    {/* 시간 눈금 tick mark */}
                    <div
                      className="absolute h-px bg-[rgb(var(--color-secondary-200))]"
                      style={{ top: `${top}px`, right: '-4px', width: '12px' }}
                    />
                  </div>
                );
              })}

              {/* "다음날" 라벨 — 자정(logicalMin 1380) 위치, 시간 라벨 대체 */}
              <div
                className="absolute right-2 text-[11px] text-orange-500 dark:text-orange-400 font-medium -translate-y-1/2"
                style={{ top: `${logicalMinutesToPx(EXTENSION_ZONE_START, logicalConfig)}px` }}
              >
                다음날
              </div>
              <div
                className="absolute h-px bg-orange-300 dark:bg-orange-600"
                style={{ top: `${logicalMinutesToPx(EXTENSION_ZONE_START, logicalConfig)}px`, right: '-4px', width: '12px' }}
              />
            </div>

            {/* 7개 컬럼 — CSS Grid로 헤더/종일 영역과 컬럼 정렬 일치 */}
            <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDates.length}, 1fr)` }}>
            {weekDates.map((date) => {
              const dayData = dayDataMap.get(date);
              const header = formatDayHeader(date);

              return (
                <WeeklyGridColumn
                  key={date}
                  ref={setColumnRef(date)}
                  date={date}
                  plans={dayData?.plans ?? []}
                  customItems={dayData?.customItems ?? []}
                  nonStudyItems={dayData?.nonStudyItems ?? []}
                  displayRange={displayRange}
                  deadZoneCollapsed={deadZoneCollapsed}
                  onToggleDeadZone={handleToggleDeadZone}
                  isToday={header.isToday}
                  isPast={header.isPast}
                  nowTop={(nowLogicalDate === date) ? nowTop : undefined}
                  onBlockClick={handleBlockClick}
                  onEdit={onEdit}
                  searchQuery={searchQuery}
                  highlightedPlanId={newlyCreatedPlanId}
                  draggingPlanId={crossDayDrag.draggingPlanId}
                  isDragTarget={crossDayDrag.targetDate === date}
                  enableHover={!!calendarId && !quickCreateState && !isPopoverOpen && !crossDayDrag.draggingPlanId && !dragState && !isResizing}
                  onCrossDayDragStart={calendarId ? crossDayDrag.startDrag : undefined}
                  makeResizeHandleProps={calendarId ? makeWeeklyResizeHandleProps : undefined}
                  resizingPlanId={resizingPlanId}
                  resizeHeight={resizeHeight}
                  resizingEdge={resizingEdge}
                  pxPerMinute={ppm}
                  suppressBlockHover={!!quickCreateState || !!dragState}
                  calendarColorMap={calendarColorMap}
                  isAdminMode={isAdminMode}
                />
              );
            })}
            </div>
          </div>
        )}

          {/* Drag-to-Create 프리뷰 — 컬럼 내부에 portal 방식으로 배치 */}
          {dragState && previewStyle && (() => {
            const colEl = scrollContainerRef.current?.querySelector(
              `[data-column-date="${dragState.date}"]`
            ) as HTMLElement | null;
            if (!colEl) return null;
            const colRect = colEl.getBoundingClientRect();
            const overlapLeft = previewOverlapLayout ? (previewOverlapLayout.left / 100) * colRect.width : 0;
            const overlapWidth = previewOverlapLayout ? (previewOverlapLayout.width / 100) * colRect.width : colRect.width;
            const topPx = logicalMinutesToPx(dragState.startMinutes, logicalConfig);
            const bottomPx = logicalMinutesToPx(dragState.endMinutes, logicalConfig);
            const heightPx = Math.max(bottomPx - topPx, 2);
            // 논리적 분 → 물리적 시간 표시 (프리뷰 라벨용)
            const previewStart = resolvePhysicalTime(dragState.date, dragState.startMinutes);
            const previewEnd = resolvePhysicalTime(dragState.date, dragState.endMinutes);
            return createPortal(
              <div
                className="absolute rounded-lg z-[45] pointer-events-none shadow-sm overflow-hidden"
                style={{
                  top: `${topPx}px`,
                  height: `${heightPx}px`,
                  left: `${overlapLeft}px`,
                  width: `${overlapWidth}px`,
                  backgroundColor: previewColors.bgHex,
                  border: '1px solid white',
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColors.barHex }} />
                <div className="pl-3 py-0.5 flex flex-col">
                  <span className={cn('text-xs font-medium', previewColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>(제목 없음)</span>
                  <span className={cn('text-[10px]', previewColors.textIsWhite ? 'text-white/70' : 'text-gray-600 dark:text-gray-400')}>
                    {previewStart.physicalTimeHHMM} – {previewEnd.physicalTimeHHMM}
                  </span>
                </div>
              </div>,
              colEl,
            );
          })()}

          {/* 퀵생성 임시 슬롯 블록 — 컬럼 내부에 portal 방식으로 배치 */}
          {quickCreateState && !dragState && !quickCreateState.isAllDay && (() => {
            const colEl = scrollContainerRef.current?.querySelector(
              `[data-column-date="${quickCreateState.date}"]`
            ) as HTMLElement | null;
            if (!colEl) return null;
            const colRect = colEl.getBoundingClientRect();
            const startLogical = physicalMinToLogical(timeToMinutes(quickCreateState.slot.startTime));
            const endLogical = physicalMinToLogical(timeToMinutes(quickCreateState.slot.endTime));
            const slotTopPx = logicalMinutesToPx(startLogical, logicalConfig);
            const slotBottomPx = logicalMinutesToPx(endLogical, logicalConfig);
            const blockLeft = previewOverlapLayout ? (previewOverlapLayout.left / 100) * colRect.width : 0;
            const blockWidth = previewOverlapLayout ? (previewOverlapLayout.width / 100) * colRect.width : colRect.width;
            return createPortal(
              <div
                className="absolute rounded-lg z-[45] pointer-events-none shadow-sm overflow-hidden"
                style={{
                  top: `${slotTopPx}px`,
                  height: `${Math.max(slotBottomPx - slotTopPx, 2)}px`,
                  left: `${blockLeft}px`,
                  width: `${blockWidth}px`,
                  backgroundColor: previewColors.bgHex,
                  border: '1px solid white',
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColors.barHex }} />
                <div className="pl-3 py-0.5">
                  <span className={cn('text-xs font-medium', previewColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>(제목 없음)</span>
                </div>
              </div>,
              colEl,
            );
          })()}

          {/* Cross-Day 고스트 블록 — 대상 컬럼에 portal 배치 */}
          {crossDayDrag.ghost && (() => {
            const g = crossDayDrag.ghost;
            const ghostColors = resolveCalendarColors(g.plan.color, calendarColorMap.get(g.plan.calendarId ?? ''), g.plan.status, g.plan.isCompleted);
            const tier = g.height >= 45 ? 'long' : g.height >= 30 ? 'medium' : 'short';
            const textColor = ghostColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100';
            const ghostTargetDate = crossDayDrag.targetDate;
            const ghostColEl = ghostTargetDate
              ? scrollContainerRef.current?.querySelector(`[data-column-date="${ghostTargetDate}"]`) as HTMLElement | null
              : null;
            const ghostEl = (
              <div
                className={cn(
                  'absolute rounded-lg overflow-hidden pointer-events-none z-30',
                  'shadow-lg',
                  'animate-ghost-enter',
                )}
                style={{
                  top: `${g.top}px`,
                  height: `${g.height}px`,
                  left: 0,
                  width: '100%',
                  backgroundColor: ghostColors.bgHex,
                  border: '1px solid white',
                }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: ghostColors.barHex }}
                />

                {tier === 'short' ? (
                  <div className="pr-1.5 py-0.5 h-full flex items-center min-w-0 pl-3">
                    <span className={cn('text-[10px] font-medium truncate leading-none', textColor)}>
                      {g.plan.title}
                    </span>
                  </div>
                ) : (
                  <div className="pr-1.5 py-0.5 h-full flex flex-col justify-center min-w-0 pl-3 overflow-hidden">
                    <span className={cn('text-xs font-medium truncate leading-tight', textColor)}>
                      {g.plan.title}
                    </span>
                    <span className={cn('text-[10px] tabular-nums opacity-80 truncate', textColor)}>
                      {g.startTime} – {g.endTime}
                    </span>
                    {tier === 'long' && g.plan.subject && (
                      <span className={cn('text-[10px] truncate opacity-70', textColor)}>
                        {g.plan.subject}
                      </span>
                    )}
                  </div>
                )}

                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                  <span className="bg-[rgb(var(--color-secondary-900))] text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {g.startTime} – {g.endTime}
                  </span>
                </div>
              </div>
            );
            return ghostColEl ? createPortal(ghostEl, ghostColEl) : ghostEl;
          })()}

      </div>

      {/* 인라인 퀵 생성 (Portal) */}
      {quickCreateState && calendarId && createPortal(
        <div
          ref={quickCreateRefs.setFloating}
          style={quickCreateStyles}
          data-quick-create
          className={cn('z-[9999] transition-opacity duration-150', isQcPositioned ? 'opacity-100' : 'opacity-0')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[rgb(var(--color-secondary-50))] rounded-2xl shadow-lg border border-[rgb(var(--color-secondary-200))]">
            <InlineQuickCreate
              slot={quickCreateState.slot}
              initialMode={quickCreateState.isAllDay ? 'allDay' : 'timed'}
              studentId={studentId}
              tenantId={tenantId}
              calendarId={calendarId}
              calendarName={selectedCalendarSettings?.name}
              calendarColorHex={calendarColorMap.get(calendarId ?? '') ?? undefined}
              planDate={quickCreateState.date}
              planGroupId={selectedGroupId}
              defaultEstimatedMinutes={defaultEstimatedMinutes}
              defaultReminderMinutes={defaultReminderMinutes}
              onSuccess={(createdInfo) => {
                onRefresh();
                if (createdInfo) {
                  setNewlyCreatedPlanId(createdInfo.planId);
                  const targetPx = logicalMinutesToPx(physicalMinToLogical(timeToMinutes(createdInfo.startTime)), logicalConfig);
                  const scrollTarget = Math.max(0, targetPx - 100);
                  setTimeout(() => {
                    if (biweeklyMode) {
                      // biweekly: 양쪽 주 그리드 동시 스크롤 (sync 리스너 간섭 방지)
                      isSyncingRef.current = true;
                      week1GridRef.current?.scrollTo({ top: scrollTarget, behavior: 'smooth' });
                      week2GridRef.current?.scrollTo({ top: scrollTarget, behavior: 'smooth' });
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => { isSyncingRef.current = false; });
                      });
                    } else {
                      scrollContainerRef.current?.scrollTo({ top: scrollTarget, behavior: 'smooth' });
                    }
                  }, 300);
                }
              }}
              onClose={closeQuickCreate}
              onOpenFullModal={(slot, formData) => {
                if (onOpenEventEditNew && quickCreateState) {
                  onOpenEventEditNew({
                    date: quickCreateState.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    title: formData?.title,
                    description: formData?.description,
                    label: formData?.label,
                    subject: formData?.subject,
                    rrule: formData?.rrule,
                  });
                } else if (calendarId && quickCreateState) {
                  const params = new URLSearchParams({
                    date: quickCreateState.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    calendarId,
                  });
                  router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
                } else {
                  onCreatePlanAtSlot?.(slot.startTime, slot.endTime);
                }
                closeQuickCreate();
              }}
              onOpenConsultationModal={onOpenConsultationEditNew ? (slot, extra) => {
                if (quickCreateState) {
                  onOpenConsultationEditNew({
                    date: quickCreateState.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    studentId: extra?.studentId,
                    sessionType: extra?.sessionType,
                    consultationMode: extra?.consultationMode,
                    title: extra?.title,
                    description: extra?.description,
                    meetingLink: extra?.meetingLink,
                    visitor: extra?.visitor,
                  });
                }
                closeQuickCreate();
              } : undefined}
            />
          </div>
        </div>,
        document.body
      )}

      {/* EventDetailPopover (portal) */}
      {popoverProps && <EventDetailPopover {...popoverProps} onClose={closePopover} />}

      {/* 반복 이벤트 scope 선택 모달 */}
      {recurringModalState && (
        <RecurringEditChoiceModal
          isOpen={recurringModalState.isOpen}
          onClose={closeRecurringModal}
          mode={recurringModalState.mode}
          onSelect={handleRecurringScopeSelect}
          exceptionCount={recurringModalState.exceptionCount}
        />
      )}
    </div>
  );
});

const ALL_DAY_COLLAPSE_THRESHOLD = 3;

/**
 * 멀티데이 레이아웃 아이템
 * 그리드 행에서 각 아이템의 위치(colStart, colSpan)와 스팬 정보
 */
interface MultiDayLayoutItem {
  item: AllDayItem;
  row: number;
  colStart: number; // 0-indexed column start
  colSpan: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * 멀티데이 행 패킹 알고리즘
 *
 * 모든 종일 이벤트를 최소 행에 패킹합니다.
 * 멀티데이 이벤트는 여러 컬럼을 span하고,
 * 겹치지 않는 이벤트는 같은 행에 배치합니다.
 */
function packAllDayRows(
  weekDates: string[],
  dayDataMap: Map<string, DayColumnData>,
): MultiDayLayoutItem[] {
  const dateToCol = new Map(weekDates.map((d, i) => [d, i]));
  const numCols = weekDates.length;
  const firstDate = weekDates[0];
  const lastDate = weekDates[numCols - 1];

  // 모든 종일 아이템 수집 (중복 제거: 멀티데이 이벤트는 여러 날에 나타남)
  const seenIds = new Set<string>();
  const allItems: { item: AllDayItem; colStart: number; colSpan: number; continuesBefore: boolean; continuesAfter: boolean }[] = [];

  for (const date of weekDates) {
    const items = dayDataMap.get(date)?.allDayItems ?? [];
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      if (item.spanDays && item.spanDays > 1 && item.startDate && item.endDate) {
        // 멀티데이 이벤트
        const colStart = Math.max(0, dateToCol.get(item.startDate) ?? 0);
        const continuesBefore = item.startDate < firstDate;
        const continuesAfter = item.endDate > lastDate;
        const effectiveStart = continuesBefore ? 0 : colStart;
        const effectiveEndCol = continuesAfter ? numCols - 1 : (dateToCol.get(item.endDate) ?? numCols - 1);
        const colSpan = effectiveEndCol - effectiveStart + 1;
        allItems.push({ item, colStart: effectiveStart, colSpan, continuesBefore, continuesAfter });
      } else {
        // 단일 날짜 이벤트
        const col = dateToCol.get(date) ?? 0;
        allItems.push({ item, colStart: col, colSpan: 1, continuesBefore: false, continuesAfter: false });
      }
    }
  }

  // 멀티데이 이벤트 우선 정렬 (span이 큰 것 먼저, 같으면 시작 컬럼 순)
  allItems.sort((a, b) => b.colSpan - a.colSpan || a.colStart - b.colStart);

  // 행 패킹: 각 행의 사용 컬럼 추적
  const rowOccupancy: boolean[][] = [];
  const result: MultiDayLayoutItem[] = [];

  for (const layoutItem of allItems) {
    const { colStart, colSpan } = layoutItem;
    let assignedRow = -1;

    // 첫 번째로 빈 행 찾기
    for (let r = 0; r < rowOccupancy.length; r++) {
      let fits = true;
      for (let c = colStart; c < colStart + colSpan; c++) {
        if (rowOccupancy[r][c]) { fits = false; break; }
      }
      if (fits) { assignedRow = r; break; }
    }

    if (assignedRow === -1) {
      assignedRow = rowOccupancy.length;
      rowOccupancy.push(new Array(numCols).fill(false));
    }

    // 컬럼 차지 표시
    for (let c = colStart; c < colStart + colSpan; c++) {
      rowOccupancy[assignedRow][c] = true;
    }

    result.push({ ...layoutItem, row: assignedRow });
  }

  return result;
}

/** 종일 이벤트 행 (멀티데이 스팬 지원) */
function AllDayRow({
  weekDates,
  dayDataMap,
  calendarId,
  calendarColorMap,
  previewColor,
  onAllDayQuickCreate,
  onAllDayItemClick,
  quickCreateDate,
  isQuickCreateAllDay,
}: {
  weekDates: string[];
  dayDataMap: Map<string, DayColumnData>;
  calendarId?: string;
  calendarColorMap?: Map<string, string>;
  previewColor?: string;
  onAllDayQuickCreate?: (date: string, anchorRect: DOMRect) => void;
  onAllDayItemClick?: (item: AllDayItem, anchorRect: DOMRect) => void;
  quickCreateDate?: string | null;
  isQuickCreateAllDay?: boolean;
}) {
  const [allDayExpanded, setAllDayExpanded] = useState(false);

  const layoutItems = useMemo(
    () => packAllDayRows(weekDates, dayDataMap),
    [weekDates, dayDataMap],
  );

  // 종일 퀵생성 프리뷰 색상
  const allDayPreviewColors = resolveCalendarColors(null, previewColor, 'confirmed', false);

  const totalRows = layoutItems.length > 0
    ? Math.max(...layoutItems.map((l) => l.row)) + 1
    : 0;

  const visibleRows =
    allDayExpanded || totalRows <= ALL_DAY_COLLAPSE_THRESHOLD
      ? totalRows
      : ALL_DAY_COLLAPSE_THRESHOLD;
  const showToggle = totalRows > ALL_DAY_COLLAPSE_THRESHOLD;
  const showOverflowRow = !allDayExpanded && totalRows > ALL_DAY_COLLAPSE_THRESHOLD;
  const previewExtra = isQuickCreateAllDay && quickCreateDate ? 22 : 0;
  const rowMinHeight = 8 + visibleRows * 24 + (showOverflowRow ? 18 : 0) + previewExtra;

  // 행 필터 (접힘 상태에서 visible 행만)
  const visibleLayoutItems = allDayExpanded
    ? layoutItems
    : layoutItems.filter((l) => l.row < visibleRows);

  return (
    <div className="border-b border-[rgb(var(--color-secondary-200))]">
      <div className="flex pr-2" style={{ minHeight: Math.max(28, rowMinHeight) }}>
        <div
          className="shrink-0 flex flex-col items-center gap-0.5 pr-2 pt-1 border-r border-[rgb(var(--color-secondary-200))]"
          style={{ width: TIME_GUTTER_WIDTH }}
        >
          <span className="text-[11px] text-[var(--text-tertiary)] font-medium">종일</span>
          {showToggle && (
            <button
              onClick={() => setAllDayExpanded((prev) => !prev)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors p-0.5"
              title={allDayExpanded ? '접기' : '펼치기'}
            >
              {allDayExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* 그리드 기반 종일 이벤트 영역 */}
        <div
          className="flex-1 relative"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${weekDates.length}, 1fr)`,
            gridTemplateRows: `repeat(${visibleRows}, 24px)${showOverflowRow ? ' 18px' : ''}${previewExtra ? ' 22px' : ''}`,
            gap: '1px 0',
            padding: '2px 0',
          }}
        >
          {/* 컬럼 배경 + 클릭 영역 */}
          {weekDates.map((date, colIdx) => (
            <div
              key={`allday-bg-${date}`}
              className={cn(
                colIdx < weekDates.length - 1
                  ? 'border-r border-[rgb(var(--color-secondary-200))]'
                  : '',
                calendarId && 'cursor-cell hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors',
              )}
              style={{
                gridColumn: colIdx + 1,
                gridRow: `1 / -1`,
              }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-allday-item]')) return;
                if (calendarId && onAllDayQuickCreate) {
                  onAllDayQuickCreate(date, e.currentTarget.getBoundingClientRect());
                }
              }}
            />
          ))}

          {/* 종일 이벤트 바 — 우측 거터: 시간 블록 이벤트(SINGLE_RIGHT_GUTTER_PCT%)와 동일 비율 */}
          {visibleLayoutItems.map((layout) => (
              <div
                key={layout.item.id}
                style={{
                  gridColumn: `${layout.colStart + 1} / span ${layout.colSpan}`,
                  gridRow: layout.row + 1,
                  zIndex: 1,
                }}
              >
                <div style={{ marginLeft: 2, marginRight: layout.continuesAfter ? 0 : `${SINGLE_RIGHT_GUTTER_PCT}%` }}>
                  <AllDayItemBar
                    item={layout.item}
                    calendarColor={calendarColorMap?.get(layout.item.calendarId ?? '')}
                    colSpan={layout.colSpan}
                    continuesBefore={layout.continuesBefore}
                    continuesAfter={layout.continuesAfter}
                    onClick={onAllDayItemClick}
                  />
                </div>
              </div>
          ))}

          {/* 오버플로 표시 */}
          {showOverflowRow && (
            <div
              style={{
                gridColumn: `1 / -1`,
                gridRow: visibleRows + 1,
                zIndex: 1,
              }}
              className="flex items-center justify-center"
            >
              <button
                className="text-[11px] text-[var(--text-tertiary)] hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setAllDayExpanded(true);
                }}
              >
                +{totalRows - visibleRows}행 더 보기
              </button>
            </div>
          )}

          {/* 종일 퀵생성 프리뷰 바 */}
          {quickCreateDate && isQuickCreateAllDay && (() => {
            const colIdx = weekDates.indexOf(quickCreateDate);
            if (colIdx === -1) return null;
            return (
              <div
                style={{
                  gridColumn: colIdx + 1,
                  gridRow: visibleRows + (showOverflowRow ? 2 : 1),
                  zIndex: 1,
                }}
              >
                <div style={{ marginLeft: 2, marginRight: `${SINGLE_RIGHT_GUTTER_PCT}%` }}>
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded animate-in fade-in-0 duration-150 pointer-events-none h-[22px]"
                    style={{ backgroundColor: allDayPreviewColors.bgHex }}
                  >
                    <span className={cn('font-medium truncate', allDayPreviewColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>
                      (제목 없음) 종일
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
