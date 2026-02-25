'use client';

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import {
  Plus,
  Wand2,
  LineChart,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { MiniMonthCalendar } from './MiniMonthCalendar';
import {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanModal,
} from './context/AdminPlanContext';
import { useOverdueCalendarEvents } from '@/lib/hooks/useCalendarEventQueries';
import { calendarEventsToOverduePlans } from '@/lib/domains/calendar/adapters';
import { startOfMonth } from 'date-fns';
import { useAdminCalendarData } from './calendar-views/_hooks/useAdminCalendarData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  studentCalendarsQueryOptions,
  calendarEventKeys,
} from '@/lib/query-options/calendarEvents';
import { EVENT_COLOR_PALETTE } from './utils/eventColors';
import { updateCalendarAction, deleteCalendarCascadeAction } from '@/lib/domains/calendar/actions/calendars';
import { useToast } from '@/components/ui/ToastProvider';
import type { Calendar } from '@/lib/domains/calendar/types';

/**
 * Google Calendar 스타일 사이드바 (심플 4섹션)
 *
 * 1. 만들기 버튼 (드롭다운)
 * 2. MiniCalendar (월간)
 * 3. 내 캘린더 (멀티 캘린더 토글)
 * 4. 미완료 플랜 목록 (collapsible)
 *
 * 탭/필터/더보기는 CalendarTopBar로 이동
 */
export function CalendarSidebar() {
  const {
    studentId,
    selectedCalendarId,
    canCreatePlans,
  } = useAdminPlanBasic();

  const {
    selectedDate,
    handleDateChange,
    visibleCalendarIds,
    setVisibleCalendarIds,
    resolvedVisibleCalendarIds,
    showHolidays,
    setShowHolidays,
    calendarColorMap,
    updateCalendarColor,
  } = useAdminPlanFilter();

  const {
    openUnifiedModal,
    setShowCreateWizard,
    setShowAIPlanModal,
    setShowOptimizationPanel,
  } = useAdminPlanModal();

  // 만들기 드롭다운
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // 아코디언 섹션
  const [isUnfinishedOpen, setIsUnfinishedOpen] = useState(true);
  const [isCalendarsOpen, setIsCalendarsOpen] = useState(true);

  // 학생의 모든 캘린더 목록 조회 (멀티 캘린더 토글용)
  const { data: allCalendars = [] } = useQuery({
    ...studentCalendarsQueryOptions(studentId),
    enabled: !!studentId,
  });

  // 캘린더 토글 핸들러
  const handleCalendarToggle = useCallback(
    (calId: string, checked: boolean) => {
      if (!allCalendars.length) return;

      if (visibleCalendarIds === null) {
        const allIds = allCalendars.map((c) => c.id);
        if (checked) {
          setVisibleCalendarIds(allIds);
        } else {
          setVisibleCalendarIds(allIds.filter((id) => id !== calId));
        }
      } else {
        const next = checked
          ? [...visibleCalendarIds, calId]
          : visibleCalendarIds.filter((id) => id !== calId);

        if (next.length === allCalendars.length) {
          setVisibleCalendarIds(null);
        } else {
          setVisibleCalendarIds(next);
        }
      }
    },
    [allCalendars, visibleCalendarIds, setVisibleCalendarIds]
  );

  // 캘린더 컨텍스트 메뉴 상태
  const [contextMenuCal, setContextMenuCal] = useState<{
    calendar: Calendar;
    rect: DOMRect;
  } | null>(null);

  // 미니캘린더 이벤트 밀도
  const miniCalendarMonth = useMemo(
    () => startOfMonth(new Date(selectedDate + 'T00:00:00')),
    [selectedDate],
  );
  const { plansByDate: miniPlansByDate } = useAdminCalendarData({
    studentId,
    currentMonth: miniCalendarMonth,
    calendarId: selectedCalendarId ?? undefined,
    visibleCalendarIds: resolvedVisibleCalendarIds,
  });
  const eventDensityByDate = useMemo(() => {
    const density: Record<string, number> = {};
    for (const [date, plans] of Object.entries(miniPlansByDate)) {
      if (plans.length > 0) density[date] = plans.length;
    }
    return density;
  }, [miniPlansByDate]);

  // 미완료 플랜 쿼리
  const { events: overdueEvents, isLoading: overdueLoading } =
    useOverdueCalendarEvents(studentId, selectedCalendarId ?? undefined);
  const overduePlans = useMemo(
    () => calendarEventsToOverduePlans(overdueEvents),
    [overdueEvents],
  );

  const handleCreateMenuClose = useCallback(() => setShowCreateMenu(false), []);

  return (
    <div className="flex flex-col h-full py-3 w-[280px]">
      {/* 1. 만들기 버튼 */}
      <div className="px-3 mb-4">
        <div className="relative">
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            disabled={!canCreatePlans}
            className={cn(
              'flex items-center gap-2 w-full rounded-2xl px-5 py-3 text-sm font-medium shadow-md transition-all',
              canCreatePlans
                ? 'bg-white border border-gray-200 text-gray-700 hover:shadow-lg hover:bg-gray-50'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            <Plus className="w-5 h-5 text-blue-600" />
            만들기
          </button>
          {showCreateMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={handleCreateMenuClose} />
              <div className="absolute left-0 top-full mt-1 w-52 bg-white border rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={() => { openUnifiedModal('quick'); handleCreateMenuClose(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                  플랜 추가
                  <kbd className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Q</kbd>
                </button>
                <button
                  onClick={() => { setShowCreateWizard(true); handleCreateMenuClose(); }}
                  disabled={!canCreatePlans}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                  플랜 그룹
                  <kbd className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">G</kbd>
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => { setShowAIPlanModal(true); handleCreateMenuClose(); }}
                  disabled={!canCreatePlans}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4 text-info-600" />
                  AI 생성
                  <kbd className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">I</kbd>
                </button>
                <button
                  onClick={() => { setShowOptimizationPanel(true); handleCreateMenuClose(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-left"
                >
                  <LineChart className="w-4 h-4 text-success-600" />
                  AI 분석
                  <kbd className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">O</kbd>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 캘린더 미선택 안내 */}
      {!selectedCalendarId && (
        <div className="px-3 mb-3">
          <div className="p-2 bg-warning-50 border border-warning-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warning-600" />
            <span className="text-xs text-warning-700">
              캘린더를 찾을 수 없습니다
            </span>
          </div>
        </div>
      )}

      {/* 2. MiniCalendar (월간) */}
      <div className="px-3 mb-3">
        <MiniMonthCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateChange}
          eventDensityByDate={eventDensityByDate}
          showHolidays={showHolidays}
        />
      </div>

      {/* 3. 내 캘린더 토글 (멀티 캘린더) */}
      {allCalendars.length > 0 && (
        <>
          <hr className="mx-3 border-gray-200 mb-3" />
          <div className="px-3 mb-3">
            <button
              onClick={() => setIsCalendarsOpen(!isCalendarsOpen)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 hover:text-gray-700"
            >
              {isCalendarsOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              내 캘린더 ({allCalendars.length})
            </button>
            {isCalendarsOpen && (
              <div className="space-y-0.5">
                {allCalendars.map((cal) => {
                  const color = calendarColorMap.get(cal.id) ?? '#039be5';
                  const isVisible =
                    visibleCalendarIds === null || visibleCalendarIds.includes(cal.id);
                  return (
                    <label
                      key={cal.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer group"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenuCal({ calendar: cal, rect: e.currentTarget.getBoundingClientRect() });
                      }}
                    >
                      <span className="relative flex items-center justify-center w-4 h-4 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={(e) => handleCalendarToggle(cal.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <span
                          className={cn(
                            'w-4 h-4 rounded border-2 transition-colors',
                            isVisible ? 'border-transparent' : 'border-gray-300 bg-white'
                          )}
                          style={isVisible ? { backgroundColor: color, borderColor: color } : undefined}
                        >
                          {isVisible && (
                            <svg className="w-full h-full text-white" viewBox="0 0 16 16" fill="none">
                              <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 truncate">
                          {cal.summary}
                        </p>
                      </div>
                      {cal.is_primary && (
                        <span className="text-[9px] text-gray-400 flex-shrink-0">기본</span>
                      )}
                      {/* 3점 메뉴 (hover 시 표시) */}
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-gray-200"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenuCal({ calendar: cal, rect: e.currentTarget.getBoundingClientRect() });
                        }}
                      >
                        <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="8" cy="3" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="8" cy="13" r="1.5" />
                        </svg>
                      </button>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 다른 캘린더 — 공휴일 토글 + 캘린더 추가 (GCal 스타일) */}
      <div className="px-3 mb-3">
        <OtherCalendarsSection studentId={studentId} showHolidays={showHolidays} setShowHolidays={setShowHolidays} />
      </div>

      <hr className="mx-3 border-gray-200 mb-3" />

      {/* 4. 미완료 플랜 섹션 (collapsible) */}
      <div className="px-3 flex-1 min-h-0 flex flex-col">
        <button
          onClick={() => setIsUnfinishedOpen(!isUnfinishedOpen)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 hover:text-gray-700"
        >
          {isUnfinishedOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          미완료 ({overduePlans.length})
        </button>

        {isUnfinishedOpen && (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
            {overdueLoading ? (
              <div className="space-y-1">
                {[1, 2].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : overduePlans.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">미완료 플랜 없음</p>
            ) : (
              overduePlans.slice(0, 20).map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-50 cursor-default group"
                  title={plan.content_title ?? plan.custom_title ?? '플랜'}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      plan.status === 'in_progress' ? 'bg-blue-400' : 'bg-gray-300'
                    )}
                  />
                  <span className="truncate text-gray-700">
                    {plan.content_title ?? plan.custom_title ?? '플랜'}
                  </span>
                </div>
              ))
            )}
            {overduePlans.length > 20 && (
              <p className="text-xs text-gray-400 px-2">
                +{overduePlans.length - 20}개 더
              </p>
            )}
          </div>
        )}
      </div>

      {/* 캘린더 컨텍스트 메뉴 (GCal 스타일) */}
      {contextMenuCal && (
        <CalendarContextMenu
          calendar={contextMenuCal.calendar}
          studentId={studentId}
          anchorRect={contextMenuCal.rect}
          currentColor={calendarColorMap.get(contextMenuCal.calendar.id) ?? '#039be5'}
          onClose={() => setContextMenuCal(null)}
          onShowOnlyThis={() => {
            setVisibleCalendarIds([contextMenuCal.calendar.id]);
            setContextMenuCal(null);
          }}
          onColorChange={async (color) => {
            await updateCalendarColor(contextMenuCal.calendar.id, color);
            setContextMenuCal(null);
          }}
        />
      )}
    </div>
  );
}

/** 캘린더 컨텍스트 메뉴 (GCal 스타일: 이 항목만 표시 + 이름 변경 + 설정 + 색상 + 삭제) */
function CalendarContextMenu({
  calendar,
  studentId,
  anchorRect,
  currentColor,
  onClose,
  onShowOnlyThis,
  onColorChange,
}: {
  calendar: Calendar;
  studentId: string;
  anchorRect: DOMRect;
  currentColor: string;
  onClose: () => void;
  onShowOnlyThis: () => void;
  onColorChange: (color: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  // 인라인 이름 변경 상태
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(calendar.summary ?? '');
  const [isRenameSaving, startRenameSave] = useTransition();
  const renameInputRef = useRef<HTMLInputElement>(null);

  // 삭제 확인 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const isPrimary = !!(calendar.is_primary || calendar.is_student_primary);

  // 메뉴 외부 클릭으로 닫기 (삭제 확인 중에는 무시)
  useEffect(() => {
    if (showDeleteConfirm) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, showDeleteConfirm]);

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isRenaming) {
          setIsRenaming(false);
          setRenameValue(calendar.summary ?? '');
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, showDeleteConfirm, isRenaming, calendar.summary]);

  // 이름 변경 모드 진입 시 포커스
  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  // --- 핸들러 ---

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      showError('캘린더 이름을 입력해주세요.');
      return;
    }
    if (trimmed === calendar.summary) {
      setIsRenaming(false);
      return;
    }
    startRenameSave(async () => {
      try {
        await updateCalendarAction(calendar.id, { summary: trimmed });
        await queryClient.invalidateQueries({
          queryKey: calendarEventKeys.studentCalendars(studentId),
        });
        showSuccess('캘린더 이름이 변경되었습니다.');
        setIsRenaming(false);
        onClose();
      } catch {
        showError('이름 변경 중 오류가 발생했습니다.');
      }
    });
  };

  const handleGoToSettings = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'settings');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    onClose();
  };

  const handleDelete = () => {
    startDelete(async () => {
      try {
        const result = await deleteCalendarCascadeAction(calendar.id);
        await queryClient.invalidateQueries({
          queryKey: calendarEventKeys.studentCalendars(studentId),
        });
        showSuccess(
          `캘린더가 삭제되었습니다. (플랜 그룹 ${result.deletedPlanGroupsCount}개, 이벤트 ${result.deletedEventsCount}개 포함)`
        );
        onClose();
        // 삭제한 캘린더 뷰에 있었다면 학생 플랜 페이지로 이동
        if (pathname.includes(calendar.id)) {
          router.push(`/admin/students/${studentId}/plans`);
        }
      } catch {
        showError('캘린더 삭제 중 오류가 발생했습니다.');
        setShowDeleteConfirm(false);
      }
    });
  };

  // 메뉴 위치 계산 (viewport 내 보장)
  const menuTop = anchorRect.bottom + 4;
  const menuLeft = Math.min(anchorRect.left, window.innerWidth - 240);

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-56"
        style={{ top: menuTop, left: menuLeft }}
      >
        {/* 이 항목만 표시 */}
        <button
          onClick={onShowOnlyThis}
          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          이 항목만 표시
        </button>

        <hr className="my-1 border-gray-200" />

        {/* 이름 변경 */}
        {isRenaming ? (
          <div className="px-3 py-2">
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setIsRenaming(false);
                  setRenameValue(calendar.summary ?? '');
                }
              }}
              disabled={isRenameSaving}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-1 mt-1.5">
              <button
                onClick={() => { setIsRenaming(false); setRenameValue(calendar.summary ?? ''); }}
                className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleRename}
                disabled={isRenameSaving || !renameValue.trim()}
                className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50"
              >
                {isRenameSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsRenaming(true)}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            이름 변경
          </button>
        )}

        {/* 설정 및 공유 */}
        <button
          onClick={handleGoToSettings}
          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          설정 및 공유
        </button>

        <hr className="my-1 border-gray-200" />

        {/* 색상 팔레트 (6x4 그리드) — GCal 동일 구성 */}
        <div className="px-3 py-2">
          <div className="grid grid-cols-6 gap-1.5">
            {EVENT_COLOR_PALETTE.slice(0, 24).map((c) => {
              const isSelected = currentColor === c.hex || currentColor === c.key;
              return (
                <button
                  key={c.key}
                  title={c.label}
                  className={cn(
                    'w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center',
                    isSelected && 'ring-2 ring-offset-1 ring-gray-400',
                  )}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => onColorChange(c.key)}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="none">
                      <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 삭제 (기본 캘린더는 비활성화) */}
        <hr className="my-1 border-gray-200" />
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isPrimary}
          className={cn(
            'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
            isPrimary
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-red-600 hover:bg-red-50',
          )}
          title={isPrimary ? '기본 캘린더는 삭제할 수 없습니다' : undefined}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          삭제
          {isPrimary && <span className="ml-auto text-[10px] text-gray-300">(기본)</span>}
        </button>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => !isDeleting && setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-[360px] rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900">캘린더 삭제</h3>
            <p className="mt-2 text-sm text-gray-600">
              <strong>&quot;{calendar.summary}&quot;</strong> 캘린더를 삭제하시겠습니까?
            </p>
            <p className="mt-1 text-xs text-red-500">
              포함된 모든 플랜 그룹, 이벤트가 함께 삭제되며 복구할 수 없습니다.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** "다른 캘린더" 섹션 — GCal의 "Other calendars" 패턴 (+ 버튼 포함) */
function OtherCalendarsSection({
  studentId,
  showHolidays,
  setShowHolidays,
}: {
  studentId: string;
  showHolidays: boolean;
  setShowHolidays: (show: boolean) => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [addMenuRect, setAddMenuRect] = useState<DOMRect | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const HOLIDAY_COLOR = '#0b8043'; // GCal 기본 공휴일 색상 (basil green)

  // 메뉴 외부 클릭/ESC로 닫기
  useEffect(() => {
    if (!addMenuRect) return;
    const handleClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuRect(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddMenuRect(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [addMenuRect]);

  return (
    <>
      {/* 헤더: 라벨 + "+" 버튼 */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          다른 캘린더
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAddMenuRect(addMenuRect ? null : e.currentTarget.getBoundingClientRect());
          }}
          className="p-0.5 rounded hover:bg-gray-200 transition-colors"
          title="캘린더 추가"
        >
          <Plus className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {/* 드롭다운 메뉴 (fixed, sidebar overflow 탈출) */}
      {addMenuRect && (
        <div
          ref={addMenuRef}
          className="fixed z-[100] w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1"
          style={{
            top: addMenuRect.bottom + 4,
            left: Math.min(addMenuRect.right - 192, window.innerWidth - 200),
          }}
        >
          <button
            onClick={() => {
              router.push(`/admin/students/${studentId}/plans/calendar/new`);
              setAddMenuRect(null);
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
          >
            <Plus className="w-4 h-4 text-gray-400" />
            새 캘린더 만들기
          </button>
          <button
            disabled
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 text-left cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            관심 캘린더 탐색
          </button>
        </div>
      )}

      {isOpen && (
        <div className="space-y-0.5">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
            <span className="relative flex items-center justify-center w-4 h-4 flex-shrink-0">
              <input
                type="checkbox"
                checked={showHolidays}
                onChange={(e) => setShowHolidays(e.target.checked)}
                className="sr-only peer"
              />
              <span
                className={cn(
                  'w-4 h-4 rounded border-2 transition-colors',
                  showHolidays ? 'border-transparent' : 'border-gray-300 bg-white'
                )}
                style={showHolidays ? { backgroundColor: HOLIDAY_COLOR, borderColor: HOLIDAY_COLOR } : undefined}
              >
                {showHolidays && (
                  <svg className="w-full h-full text-white" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </span>
            <span className="text-xs text-gray-700">대한민국의 휴일</span>
          </label>
        </div>
      )}
    </>
  );
}
