"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useTransition,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminPlanRealtime } from "@/lib/realtime";
import { useTargetedDockInvalidation } from "@/lib/hooks/useAdminDockQueries";
import { adminDockKeys } from "@/lib/query-options/adminDock";
import { studentCalendarsQueryOptions, calendarEventKeys } from "@/lib/query-options/calendarEvents";
import { calendarViewKeys } from "@/lib/query-options/calendarViewQueryOptions";
import { useAdminPlanBasic, type ViewMode } from "./AdminPlanBasicContext";
import { EVENT_COLOR_PALETTE, getEventColor } from "../utils/eventColors";

/**
 * Filter Context - 필터/선택 상태
 *
 * 포함: selectedDate, selectedGroupId, searchQuery
 * 변경 빈도: 중간 (사용자 필터 조작 시)
 *
 * 성능 최적화:
 * - handleRefresh: 모든 Dock 무효화 (전체 새로고침)
 * - refreshDaily: Daily Dock만 무효화
 * - refreshDailyAndWeekly: Daily + Weekly 무효화 (플랜 이동 시)
 */

export interface AdminPlanFilterContextValue {
  selectedDate: string;
  handleDateChange: (date: string) => void;
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  /** 플랜 검색 쿼리 (GCal 스타일 필터링) */
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** 멀티 캘린더: 표시할 캘린더 ID 목록 (null = 전체) — UI 토글 상태 */
  visibleCalendarIds: string[] | null;
  setVisibleCalendarIds: (ids: string[] | null) => void;
  /** 데이터 페칭용 해석된 캘린더 ID 목록 (null → 모든 캘린더 ID로 해석) */
  resolvedVisibleCalendarIds: string[] | null;
  /** 한국 공휴일 캘린더 표시 여부 */
  showHolidays: boolean;
  setShowHolidays: (show: boolean) => void;
  /** 캘린더별 색상 맵 (calendarId → hex) — 이벤트의 좌측 컬러 바에 사용 */
  calendarColorMap: Map<string, string>;
  /** 캘린더 색상 업데이트 (사이드바 컨텍스트 메뉴에서 호출) */
  updateCalendarColor: (calendarId: string, color: string) => Promise<void>;
  /** 모든 Dock 새로고침 (전체: 캐시 무효화 + router.refresh) */
  handleRefresh: () => void;
  /** React Query 캐시만 무효화 (router.refresh 없이) — transition 간섭 없이 즉시 refetch */
  invalidateQueries: () => void;
  /** Daily Dock만 새로고침 */
  refreshDaily: () => void;
  /** Daily + Weekly 새로고침 (플랜 이동 시) */
  refreshDailyAndWeekly: () => void;
  /** Daily + Unfinished 새로고침 (플랜 완료/취소 시) */
  refreshDailyAndUnfinished: () => void;
  isPending: boolean;
}

const AdminPlanFilterContext = createContext<AdminPlanFilterContextValue | null>(null);

interface AdminPlanFilterProviderProps {
  children: ReactNode;
  studentId: string;
  initialDate: string;
  viewMode?: ViewMode;
}

export function AdminPlanFilterProvider({
  children,
  studentId,
  initialDate,
  viewMode = "admin",
}: AdminPlanFilterProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const { selectedCalendarId } = useAdminPlanBasic();

  // 상태 관리
  const [selectedDate, setSelectedDate] = useState(initialDate);
  // 기본값: 전체 보기 (null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  // 플랜 검색 쿼리
  const [searchQuery, setSearchQuery] = useState("");
  // 멀티 캘린더: 표시할 캘린더 ID 목록 (null = 전체)
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<string[] | null>(null);

  // personal 모드(관리자 본인 캘린더)면 테넌트 캘린더 포함, 학생 캘린더 조회 시 제외
  const { tenantId } = useAdminPlanBasic();
  const { data: allCalendars = [] } = useQuery({
    ...studentCalendarsQueryOptions(studentId, viewMode === 'personal' ? tenantId : undefined),
    enabled: !!studentId,
  });

  // 캘린더별 색상 맵 (calendarId → hex)
  // default_color는 팔레트 키('tomato') 또는 hex('#d50000')일 수 있으므로 항상 hex로 변환
  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>();
    allCalendars.forEach((cal, i) => {
      const raw = cal.default_color as string | null;
      const resolved = raw
        ? (getEventColor(raw)?.hex ?? raw)
        : EVENT_COLOR_PALETTE[i % EVENT_COLOR_PALETTE.length].hex;
      map.set(cal.id, resolved);
    });
    return map;
  }, [allCalendars]);

  // 캘린더 색상 업데이트
  const calQueryClient = useQueryClient();

  // studentId 변경 시 이전 학생의 in-flight 쿼리 취소는 StudentSwitcher가 담당
  // (navigation 전에 cancelQueries 호출 → 안전)
  // 여기서 useEffect로 취소하면 렌더 → 새 쿼리 시작 → effect 실행 → 새 쿼리 취소 순서 문제 발생

  const updateCalendarColor = useCallback(async (calendarId: string, color: string) => {
    try {
      const { updateCalendarAction } = await import("@/lib/domains/calendar/actions/calendars");
      await updateCalendarAction(calendarId, { defaultColor: color });
      // 캘린더 목록 캐시 무효화 → calendarColorMap 재계산
      calQueryClient.invalidateQueries({
        queryKey: calendarEventKeys.studentCalendars(studentId),
      });
    } catch {
      // 에러는 withErrorHandling이 처리
    }
  }, [calQueryClient, studentId]);

  // visibleCalendarIds = null 이면 "전체 보기" → 모든 캘린더 ID로 해석
  // 캘린더가 1개인 경우 null (단일 캘린더 쿼리 모드 유지)
  const resolvedVisibleCalendarIds = useMemo(() => {
    if (visibleCalendarIds !== null) return visibleCalendarIds;
    if (allCalendars.length <= 1) return null;
    return allCalendars.map(c => c.id);
  }, [visibleCalendarIds, allCalendars]);

  // 한국 공휴일 캘린더 표시 여부 (SSR-safe: 기본 true, useEffect로 localStorage 동기화)
  const [showHolidays, setShowHolidaysState] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem('calendar_showHolidays');
    if (saved === 'false') setShowHolidaysState(false);
  }, []);
  const setShowHolidays = useCallback((show: boolean) => {
    setShowHolidaysState(show);
    localStorage.setItem('calendar_showHolidays', String(show));
  }, []);

  // React Query 타겟 캐시 무효화
  const {
    invalidateDaily,
    invalidateOverdue,
    invalidateDailyAndOverdue,
    invalidateAll,
  } = useTargetedDockInvalidation();

  // 날짜 변경 핸들러 (클라이언트 중심: URL만 교체, React Query가 데이터 재조회)
  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);

      // personal 모드: /admin/calendar 경로 유지
      if (viewMode === "personal") {
        router.replace(`/admin/calendar?date=${date}`, { scroll: false });
        return;
      }

      // parent 모드: /parent/calendar 경로 유지 (studentId 쿼리 파라미터 포함)
      if (viewMode === "parent") {
        router.replace(`/parent/calendar?studentId=${studentId}&date=${date}`, { scroll: false });
        return;
      }

      // Admin calendar page (/admin/calendar?student=xxx):
      // URL만 동기화, 서버 컴포넌트 재실행 방지 (불필요한 auth 호출 제거)
      if (pathname === '/admin/calendar') {
        window.history.replaceState(null, '', `/admin/calendar?student=${studentId}&date=${date}`);
        return;
      }

      if (selectedCalendarId) {
        const basePath = viewMode === "student"
          ? `/plan/calendar`
          : `/admin/students/${studentId}/plans/calendar/${selectedCalendarId}`;
        router.replace(`${basePath}?date=${date}`, { scroll: false });
      } else {
        const basePath = viewMode === "student"
          ? `/plan/planner`
          : `/admin/students/${studentId}/plans`;
        router.replace(`${basePath}?date=${date}`, { scroll: false });
      }
    },
    [router, studentId, selectedCalendarId, viewMode, pathname]
  );

  // 전체 새로고침 핸들러 (모든 Dock)
  const handleRefresh = useCallback(() => {
    invalidateAll();
    startTransition(() => {
      router.refresh();
    });
  }, [router, invalidateAll]);

  // React Query 캐시만 무효화 (router.refresh 없이)
  // useTransition 내에서 호출 시 transition 간섭 없이 즉시 refetch 보장
  const invalidateQueries = invalidateAll;

  const effectiveFilterId = selectedCalendarId ?? undefined;

  // Daily Dock만 새로고침
  const refreshDaily = useCallback(() => {
    invalidateDaily(studentId, selectedDate, effectiveFilterId);
  }, [invalidateDaily, studentId, selectedDate, effectiveFilterId]);

  // Daily 새로고침 (플랜 이동 시)
  const refreshDailyAndWeekly = useCallback(() => {
    invalidateDaily(studentId, selectedDate, effectiveFilterId);
  }, [invalidateDaily, studentId, selectedDate, effectiveFilterId]);

  // Daily + Unfinished 새로고침 (플랜 완료/취소 시)
  const refreshDailyAndUnfinished = useCallback(() => {
    invalidateDailyAndOverdue(studentId, selectedDate, effectiveFilterId);
  }, [invalidateDailyAndOverdue, studentId, selectedDate, effectiveFilterId]);

  // 실시간 업데이트 구독 (전체 새로고침)
  useAdminPlanRealtime({
    studentId,
    onRefresh: handleRefresh,
    debounceMs: 1000,
  });

  const value = useMemo<AdminPlanFilterContextValue>(
    () => ({
      selectedDate,
      handleDateChange,
      selectedGroupId,
      setSelectedGroupId,
      searchQuery,
      setSearchQuery,
      visibleCalendarIds,
      setVisibleCalendarIds,
      resolvedVisibleCalendarIds,
      showHolidays,
      setShowHolidays,
      calendarColorMap,
      updateCalendarColor,
      handleRefresh,
      invalidateQueries,
      refreshDaily,
      refreshDailyAndWeekly,
      refreshDailyAndUnfinished,
      isPending,
    }),
    [
      selectedDate,
      handleDateChange,
      selectedGroupId,
      searchQuery,
      visibleCalendarIds,
      resolvedVisibleCalendarIds,
      showHolidays,
      setShowHolidays,
      calendarColorMap,
      updateCalendarColor,
      handleRefresh,
      invalidateQueries,
      refreshDaily,
      refreshDailyAndWeekly,
      refreshDailyAndUnfinished,
      isPending,
    ]
  );

  return (
    <AdminPlanFilterContext.Provider value={value}>
      {children}
    </AdminPlanFilterContext.Provider>
  );
}

export function useAdminPlanFilter() {
  const context = useContext(AdminPlanFilterContext);
  if (!context) {
    throw new Error("useAdminPlanFilter must be used within AdminPlanFilterProvider");
  }
  return context;
}
