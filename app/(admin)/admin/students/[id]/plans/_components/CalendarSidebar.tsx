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
  Check,
  Pencil,
  XCircle,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { MiniMonthCalendar } from './MiniMonthCalendar';
import {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanModal,
} from './context/AdminPlanContext';
import { useAdminPlanActions } from './context/AdminPlanActionsContext';
import { useOverdueCalendarEvents } from '@/lib/hooks/useCalendarEventQueries';
import { calendarEventToPlanItemData } from '@/lib/domains/calendar/adapters';
import { startOfMonth, isYesterday, isThisWeek } from 'date-fns';
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
import type { PlanItemData } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';
import { useEventDetailPopover } from './hooks/useEventDetailPopover';
import { EventDetailPopover } from './items/EventDetailPopover';
import { RecurringEditChoiceModal, type RecurringEditScope } from './modals/RecurringEditChoiceModal';
import { useOptimisticCalendarUpdate } from '@/lib/hooks/useOptimisticCalendarUpdate';
import { updatePlanStatus, deletePlan, deleteRecurringEvent } from '@/lib/domains/calendar/actions/calendarEventActions';
import { useUndo } from './UndoSnackbar';
import { usePlanToast } from './PlanToast';
import { Dialog } from '@/components/ui/Dialog';

/** 사이드바 미완료 섹션 최대 표시 개수 */
const MAX_SIDEBAR_OVERDUE = 20;

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
    tenantId,
    selectedCalendarId,
    canCreatePlans,
    viewMode,
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

  // personal 모드(관리자 본인 캘린더)면 테넌트 캘린더 포함, 학생 캘린더 조회 시 제외
  const { data: allCalendars = [] } = useQuery({
    ...studentCalendarsQueryOptions(studentId, viewMode === 'personal' ? tenantId : undefined),
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

  // 미완료 플랜 쿼리 — PlanItemData로 직접 변환 (EventDetailPopover 호환)
  const { events: overdueEvents, isLoading: overdueLoading } =
    useOverdueCalendarEvents(studentId, selectedCalendarId ?? undefined);
  const overduePlanItems = useMemo(
    () =>
      overdueEvents
        .filter((e) => e.is_task === true && !e.is_all_day)
        .map(calendarEventToPlanItemData),
    [overdueEvents],
  );

  // 날짜 기반 그룹핑 + 사이드바 표시 개수 제한
  const overdueGroups = useMemo(
    () => groupOverdueByDate(overduePlanItems),
    [overduePlanItems],
  );
  const truncatedGroups = useMemo(() => {
    let remaining = MAX_SIDEBAR_OVERDUE;
    const result: OverdueGroup[] = [];
    for (const group of overdueGroups) {
      if (remaining <= 0) break;
      const visibleItems = group.items.slice(0, remaining);
      remaining -= visibleItems.length;
      result.push({ label: group.label, items: visibleItems, totalCount: group.items.length });
    }
    return result;
  }, [overdueGroups]);

  // EventDetailPopover 통합
  const { handleOpenEdit } = useAdminPlanActions();
  const { pushUndoable } = useUndo();
  const { showToast } = usePlanToast();
  const { optimisticStatusChange, optimisticDelete, revalidate } =
    useOptimisticCalendarUpdate(selectedCalendarId ?? undefined);

  const handleOverdueStatusChange = useCallback(
    async (planId: string, newStatus: PlanStatus, prevStatus?: PlanStatus, instanceDate?: string) => {
      const rollback = optimisticStatusChange(planId, newStatus);
      const result = await updatePlanStatus({
        planId,
        status: newStatus,
        skipRevalidation: true,
        instanceDate,
      });
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
        showToast(result.error ?? '상태 변경 실패', 'error');
      }
    },
    [optimisticStatusChange, revalidate, pushUndoable, showToast],
  );

  const handleOverdueDelete = useCallback(
    async (planId: string) => {
      const rollback = optimisticDelete(planId);
      const result = await deletePlan({ planId, skipRevalidation: true });
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
    },
    [optimisticDelete, revalidate, pushUndoable, showToast],
  );

  const { showPopover, popoverProps, recurringModalState, closeRecurringModal } =
    useEventDetailPopover({
      onEdit: (id, et) => handleOpenEdit(id, et),
      onDelete: handleOverdueDelete,
      onQuickStatusChange: handleOverdueStatusChange,
      onConsultationStatusChange: async (eventId: string, status: 'completed' | 'no_show' | 'cancelled' | 'scheduled') => {
        const { updateScheduleStatus } = await import('@/lib/domains/consulting/actions/schedule');
        await updateScheduleStatus(eventId, status, studentId, status === 'cancelled');
        revalidate();
      },
    });

  // 반복 이벤트 scope 선택 핸들러
  const handleRecurringScopeSelect = useCallback(
    async (scope: RecurringEditScope) => {
      if (!recurringModalState) return;
      const { mode, planId, instanceDate } = recurringModalState;
      closeRecurringModal();

      if (mode === 'delete') {
        const rollback = optimisticDelete(planId);
        const result = await deleteRecurringEvent({
          eventId: planId,
          instanceDate,
          scope,
        });
        if (result.success) {
          revalidate();
          pushUndoable({
            type: 'recurring-delete',
            scope,
            parentEventId: planId,
            instanceDate,
            previousExdates: result.previousExdates,
            deletedEventIds: result.deletedEventIds,
            previousRrule: result.previousRrule,
            description: '반복 이벤트가 삭제되었습니다.',
          });
        } else {
          rollback();
          showToast(result.error ?? '삭제 실패', 'error');
        }
      } else if (mode === 'edit') {
        // 편집: 이벤트 편집 모달로 열기 (instanceDate 포함)
        handleOpenEdit(planId, undefined, instanceDate);
      }
    },
    [recurringModalState, closeRecurringModal, optimisticDelete, revalidate, pushUndoable, showToast, handleOpenEdit],
  );

  // 우클릭 컨텍스트 메뉴 상태
  const [overdueContextMenu, setOverdueContextMenu] = useState<{
    plan: PlanItemData;
    rect: DOMRect;
  } | null>(null);

  // 전체 목록 모달
  const [showOverdueDialog, setShowOverdueDialog] = useState(false);

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
                ? 'bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] text-[var(--text-secondary)] hover:shadow-lg hover:bg-[rgb(var(--color-secondary-100))]'
                : 'bg-[rgb(var(--color-secondary-100))] text-[rgb(var(--color-secondary-400))] cursor-not-allowed'
            )}
          >
            <Plus className="w-5 h-5 text-[rgb(var(--color-info-600))]" />
            만들기
          </button>
          {showCreateMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={handleCreateMenuClose} />
              <div className="absolute left-0 top-full mt-1 w-52 bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={() => { openUnifiedModal('quick'); handleCreateMenuClose(); }}
                  disabled={viewMode === 'student'}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[rgb(var(--color-secondary-100))] text-left text-[var(--text-secondary)]",
                    viewMode === 'student' && "opacity-40 cursor-not-allowed hover:bg-transparent"
                  )}
                  title={viewMode === 'student' ? '준비 중인 기능입니다' : undefined}
                >
                  <Plus className="w-4 h-4 text-[var(--text-tertiary)]" />
                  플랜 추가
                  <kbd className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-[rgb(var(--color-secondary-100))] text-[rgb(var(--color-secondary-400))] px-1.5 py-0.5 rounded">Q</kbd>
                </button>
                <button
                  onClick={() => { setShowCreateWizard(true); handleCreateMenuClose(); }}
                  disabled={!canCreatePlans}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[rgb(var(--color-secondary-100))] text-left text-[var(--text-secondary)] disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 text-[var(--text-tertiary)]" />
                  플랜 그룹
                  <kbd className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-[rgb(var(--color-secondary-100))] text-[rgb(var(--color-secondary-400))] px-1.5 py-0.5 rounded">C</kbd>
                </button>
                <hr className="my-1 border-[rgb(var(--color-secondary-200))]" />
                <button
                  onClick={() => { setShowAIPlanModal(true); handleCreateMenuClose(); }}
                  disabled={!canCreatePlans}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[rgb(var(--color-secondary-100))] text-left text-[var(--text-secondary)] disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4 text-info-600" />
                  AI 생성
                  <kbd className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-[rgb(var(--color-secondary-100))] text-[rgb(var(--color-secondary-400))] px-1.5 py-0.5 rounded">I</kbd>
                </button>
                <button
                  onClick={() => { setShowOptimizationPanel(true); handleCreateMenuClose(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[rgb(var(--color-secondary-100))] text-left text-[var(--text-secondary)]"
                >
                  <LineChart className="w-4 h-4 text-success-600" />
                  AI 분석
                  <kbd className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-[rgb(var(--color-secondary-100))] text-[rgb(var(--color-secondary-400))] px-1.5 py-0.5 rounded">O</kbd>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 캘린더 미선택 안내 */}
      {!selectedCalendarId && (
        <div className="px-3 mb-3">
          <div className="p-2 bg-[rgb(var(--color-warning-50))] border border-[rgb(var(--color-warning-200))] rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-[rgb(var(--color-warning-600))]" />
            <span className="text-xs text-[rgb(var(--color-warning-700))]">
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
          <hr className="mx-3 border-[rgb(var(--color-secondary-200))] mb-3" />
          <div className="px-3 mb-3">
            <button
              onClick={() => setIsCalendarsOpen(!isCalendarsOpen)}
              className="flex items-center gap-1 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 hover:text-[var(--text-secondary)]"
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
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[rgb(var(--color-secondary-100))] cursor-pointer group"
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
                            isVisible ? 'border-transparent' : 'border-[rgb(var(--color-secondary-300))] bg-[rgb(var(--color-secondary-50))]'
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
                        <p className="text-xs text-[var(--text-secondary)] truncate">
                          {cal.summary}
                        </p>
                      </div>
                      {cal.is_primary && (
                        <span className="text-[9px] text-[rgb(var(--color-secondary-400))] flex-shrink-0">기본</span>
                      )}
                      {/* 3점 메뉴 (hover 시 표시) */}
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-[rgb(var(--color-secondary-200))]"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenuCal({ calendar: cal, rect: e.currentTarget.getBoundingClientRect() });
                        }}
                      >
                        <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)]" viewBox="0 0 16 16" fill="currentColor">
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

      <hr className="mx-3 border-[rgb(var(--color-secondary-200))] mb-3" />

      {/* 4. 미완료 플랜 섹션 (collapsible, 그룹핑 + 인라인 완료 + Popover) */}
      <div className="px-3 flex-1 min-h-0 flex flex-col">
        <button
          onClick={() => setIsUnfinishedOpen(!isUnfinishedOpen)}
          className="flex items-center gap-1 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1 hover:text-[var(--text-secondary)]"
        >
          {isUnfinishedOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          미완료 ({overduePlanItems.length})
        </button>

        {isUnfinishedOpen && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {overdueLoading ? (
              <div className="space-y-1">
                {[1, 2].map((i) => (
                  <div key={i} className="h-8 bg-[rgb(var(--color-secondary-100))] rounded animate-pulse" />
                ))}
              </div>
            ) : overduePlanItems.length === 0 ? (
              <p className="text-xs text-[rgb(var(--color-secondary-400))] py-2">미완료 플랜 없음</p>
            ) : (
              <>
                {truncatedGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 pt-2 pb-0.5">
                      {group.label} ({group.totalCount ?? group.items.length})
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((plan) => (
                        <OverdueItem
                          key={plan.id}
                          plan={plan}
                          onClick={(e) => {
                            showPopover(plan, e.currentTarget.getBoundingClientRect());
                          }}
                          onCheckboxChange={() => {
                            handleOverdueStatusChange(plan.id, 'completed', plan.status);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setOverdueContextMenu({
                              plan,
                              rect: e.currentTarget.getBoundingClientRect(),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {overduePlanItems.length > MAX_SIDEBAR_OVERDUE && (
                  <button
                    onClick={() => setShowOverdueDialog(true)}
                    className="text-xs text-[rgb(var(--color-info-600))] hover:text-[rgb(var(--color-info-700))] px-2 py-1.5 w-full text-left"
                  >
                    +{overduePlanItems.length - MAX_SIDEBAR_OVERDUE}개 더 보기
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 미완료 EventDetailPopover */}
      {popoverProps && <EventDetailPopover {...popoverProps} />}

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

      {/* 미완료 컨텍스트 메뉴 */}
      {overdueContextMenu && (
        <OverdueContextMenu
          anchorRect={overdueContextMenu.rect}
          onClose={() => setOverdueContextMenu(null)}
          onComplete={() => {
            handleOverdueStatusChange(overdueContextMenu.plan.id, 'completed', overdueContextMenu.plan.status);
            setOverdueContextMenu(null);
          }}
          onEdit={() => {
            handleOpenEdit(overdueContextMenu.plan.id);
            setOverdueContextMenu(null);
          }}
          onCancel={() => {
            handleOverdueStatusChange(overdueContextMenu.plan.id, 'cancelled', overdueContextMenu.plan.status);
            setOverdueContextMenu(null);
          }}
        />
      )}

      {/* 전체 미완료 목록 모달 */}
      <OverdueListDialog
        open={showOverdueDialog}
        onOpenChange={setShowOverdueDialog}
        items={overduePlanItems}
        onItemClick={(plan, rect) => {
          showPopover(plan, rect);
        }}
        onCheckboxChange={(plan) => {
          handleOverdueStatusChange(plan.id, 'completed', plan.status);
        }}
        handleDateChange={handleDateChange}
      />

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
        className="fixed z-[100] bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] rounded-lg shadow-xl py-1 w-56"
        style={{ top: menuTop, left: menuLeft }}
      >
        {/* 이 항목만 표시 */}
        <button
          onClick={onShowOnlyThis}
          className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-[rgb(var(--color-secondary-400))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          이 항목만 표시
        </button>

        <hr className="my-1 border-[rgb(var(--color-secondary-200))]" />

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
              className="w-full rounded border border-[rgb(var(--color-secondary-300))] bg-[rgb(var(--color-secondary-50))] text-[var(--text-primary)] px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <div className="flex justify-end gap-1 mt-1.5">
              <button
                onClick={() => { setIsRenaming(false); setRenameValue(calendar.summary ?? ''); }}
                className="px-2 py-0.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded hover:bg-[rgb(var(--color-secondary-100))]"
              >
                취소
              </button>
              <button
                onClick={handleRename}
                disabled={isRenameSaving || !renameValue.trim()}
                className="px-2 py-0.5 text-xs text-[rgb(var(--color-info-600))] hover:text-[rgb(var(--color-info-700))] rounded hover:bg-[rgb(var(--color-info-50))] disabled:opacity-50"
              >
                {isRenameSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsRenaming(true)}
            className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-[rgb(var(--color-secondary-400))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            이름 변경
          </button>
        )}

        {/* 설정 및 공유 */}
        <button
          onClick={handleGoToSettings}
          className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-[rgb(var(--color-secondary-400))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          설정 및 공유
        </button>

        <hr className="my-1 border-[rgb(var(--color-secondary-200))]" />

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
                    isSelected && 'ring-2 ring-offset-1 ring-[rgb(var(--color-secondary-400))] ring-offset-[rgb(var(--color-secondary-800))]',
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
        <hr className="my-1 border-[rgb(var(--color-secondary-200))]" />
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isPrimary}
          className={cn(
            'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
            isPrimary
              ? 'text-[rgb(var(--color-secondary-300))] cursor-not-allowed'
              : 'text-[rgb(var(--color-error-600))] hover:bg-[rgb(var(--color-error-50))]',
          )}
          title={isPrimary ? '기본 캘린더는 삭제할 수 없습니다' : undefined}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          삭제
          {isPrimary && <span className="ml-auto text-[10px] text-[rgb(var(--color-secondary-300))]">(기본)</span>}
        </button>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => !isDeleting && setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-[360px] rounded-xl bg-[rgb(var(--color-secondary-50))] p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">캘린더 삭제</h3>
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">
              <strong>&quot;{calendar.summary}&quot;</strong> 캘린더를 삭제하시겠습니까?
            </p>
            <p className="mt-1 text-xs text-[rgb(var(--color-error-500))]">
              포함된 모든 플랜 그룹, 이벤트가 함께 삭제되며 복구할 수 없습니다.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-tertiary)] hover:bg-[rgb(var(--color-secondary-100))] disabled:opacity-50"
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
          className="flex items-center gap-1 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider hover:text-[var(--text-secondary)]"
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
          className="p-0.5 rounded hover:bg-[rgb(var(--color-secondary-200))] transition-colors"
          title="캘린더 추가"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        </button>
      </div>

      {/* 드롭다운 메뉴 (fixed, sidebar overflow 탈출) */}
      {addMenuRect && (
        <div
          ref={addMenuRef}
          className="fixed z-[100] w-48 bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] rounded-lg shadow-xl py-1"
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
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] text-left"
          >
            <Plus className="w-4 h-4 text-[rgb(var(--color-secondary-400))]" />
            새 캘린더 만들기
          </button>
          <button
            disabled
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[rgb(var(--color-secondary-400))] text-left cursor-not-allowed"
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
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[rgb(var(--color-secondary-100))] cursor-pointer">
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
                  showHolidays ? 'border-transparent' : 'border-[rgb(var(--color-secondary-300))] bg-[rgb(var(--color-secondary-50))]'
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
            <span className="text-xs text-[var(--text-secondary)]">대한민국의 휴일</span>
          </label>
        </div>
      )}
    </>
  );
}

// ============================================
// 미완료 섹션 하위 컴포넌트 & 유틸리티
// ============================================

/** 날짜 기반 그룹핑 (어제 / 이번 주 / 그 이전) */
interface OverdueGroup {
  label: string;
  items: PlanItemData[];
  /** 그룹 전체 개수 (truncated 시 원본 개수 보존용) */
  totalCount?: number;
}

function groupOverdueByDate(items: PlanItemData[]): OverdueGroup[] {
  const yesterday: PlanItemData[] = [];
  const thisWeek: PlanItemData[] = [];
  const older: PlanItemData[] = [];

  for (const item of items) {
    if (!item.planDate) {
      older.push(item);
      continue;
    }
    const d = new Date(item.planDate + 'T00:00:00');
    if (isYesterday(d)) {
      yesterday.push(item);
    } else if (isThisWeek(d, { weekStartsOn: 1 })) {
      thisWeek.push(item);
    } else {
      older.push(item);
    }
  }

  const groups: OverdueGroup[] = [];
  if (yesterday.length > 0) groups.push({ label: '어제', items: yesterday });
  if (thisWeek.length > 0) groups.push({ label: '이번 주', items: thisWeek });
  if (older.length > 0) groups.push({ label: '그 이전', items: older });
  return groups;
}

/** 미완료 항목 (인라인 체크박스 + 클릭/우클릭) */
function OverdueItem({
  plan,
  onClick,
  onCheckboxChange,
  onContextMenu,
}: {
  plan: PlanItemData;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCheckboxChange: () => void;
  onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-[rgb(var(--color-secondary-100))] cursor-pointer group"
      title={plan.title}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* 인라인 체크박스 (task만) */}
      {plan.isTask ? (
        <button
          className="flex-shrink-0 w-4 h-4 rounded border border-[rgb(var(--color-secondary-300))] hover:border-[rgb(var(--color-info-500))] hover:bg-[rgb(var(--color-info-50))] flex items-center justify-center transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onCheckboxChange();
          }}
          title="완료 처리"
        >
          <Check className="w-2.5 h-2.5 text-transparent group-hover:text-[rgb(var(--color-secondary-300))]" />
        </button>
      ) : (
        <span
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            plan.status === 'in_progress' ? 'bg-blue-400' : 'bg-gray-300',
          )}
        />
      )}
      <span className="truncate text-[var(--text-secondary)] flex-1">
        {plan.title}
      </span>
      {plan.planDate && (
        <span className="text-[10px] text-[rgb(var(--color-secondary-400))] flex-shrink-0">
          {formatShortDate(plan.planDate)}
        </span>
      )}
    </div>
  );
}

/** 짧은 날짜 표시 (3/8) */
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 미완료 컨텍스트 메뉴 */
function OverdueContextMenu({
  anchorRect,
  onClose,
  onComplete,
  onEdit,
  onCancel,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const menuTop = Math.min(anchorRect.bottom + 4, window.innerHeight - 150);
  const menuLeft = Math.min(anchorRect.left, window.innerWidth - 180);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-200))] rounded-lg shadow-xl py-1 w-44"
      style={{ top: menuTop, left: menuLeft }}
    >
      <button
        onClick={onComplete}
        className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] flex items-center gap-2"
      >
        <Check className="w-4 h-4 text-[rgb(var(--color-success-600))]" />
        완료 처리
      </button>
      <button
        onClick={onEdit}
        className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] flex items-center gap-2"
      >
        <Pencil className="w-4 h-4 text-[rgb(var(--color-secondary-400))]" />
        편집
      </button>
      <hr className="my-1 border-[rgb(var(--color-secondary-200))]" />
      <button
        onClick={onCancel}
        className="w-full px-3 py-2 text-left text-sm text-[rgb(var(--color-error-600))] hover:bg-[rgb(var(--color-error-50))] flex items-center gap-2"
      >
        <XCircle className="w-4 h-4" />
        취소 처리
      </button>
    </div>
  );
}

/** 전체 미완료 목록 모달 */
function OverdueListDialog({
  open,
  onOpenChange,
  items,
  onItemClick,
  onCheckboxChange,
  handleDateChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PlanItemData[];
  onItemClick: (plan: PlanItemData, rect: DOMRect) => void;
  onCheckboxChange: (plan: PlanItemData) => void;
  handleDateChange: (date: string) => void;
}) {
  // 검색/정렬 상태는 모달 내부에서 관리 (닫으면 리셋)
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'subject'>('date');

  // 모달이 열릴 때 상태 리셋
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSortBy('date');
    }
  }, [open]);

  // 검색 필터
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.subject && p.subject.toLowerCase().includes(q)),
    );
  }, [items, searchQuery]);

  // 정렬
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'subject') {
      arr.sort((a, b) => (a.subject ?? '').localeCompare(b.subject ?? ''));
    } else {
      arr.sort((a, b) => (a.planDate ?? '').localeCompare(b.planDate ?? ''));
    }
    return arr;
  }, [filtered, sortBy]);

  // 그룹핑
  const groups = useMemo(() => groupOverdueByDate(sorted), [sorted]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`미완료 플랜 (${items.length}개)`}
      maxWidth="lg"
    >
      <div className="space-y-3">
        {/* 검색 + 정렬 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--color-secondary-400))]" />
            <input
              type="text"
              placeholder="제목 또는 과목 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[rgb(var(--color-secondary-200))] bg-[rgb(var(--color-secondary-50))] text-[var(--text-primary)] focus:border-[rgb(var(--color-info-500))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-info-500))]"
            />
          </div>
          <button
            onClick={() => setSortBy(sortBy === 'date' ? 'subject' : 'date')}
            className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-[rgb(var(--color-secondary-200))] bg-[rgb(var(--color-secondary-50))] text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortBy === 'date' ? '날짜순' : '과목순'}
          </button>
        </div>

        {/* 목록 */}
        <div className="max-h-[60vh] overflow-y-auto space-y-1">
          {sorted.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-secondary-400))] py-4 text-center">
              {searchQuery ? '검색 결과 없음' : '미완료 플랜 없음'}
            </p>
          ) : sortBy === 'subject' ? (
            // 과목순: 플랫 리스트
            sorted.map((plan) => (
              <OverdueDialogItem
                key={plan.id}
                plan={plan}
                onItemClick={onItemClick}
                onCheckboxChange={onCheckboxChange}
                handleDateChange={handleDateChange}
              />
            ))
          ) : (
            // 날짜순: 그룹핑
            groups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 pt-3 pb-1">
                  {group.label} ({group.items.length})
                </p>
                {group.items.map((plan) => (
                  <OverdueDialogItem
                    key={plan.id}
                    plan={plan}
                    onItemClick={onItemClick}
                    onCheckboxChange={onCheckboxChange}
                    handleDateChange={handleDateChange}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** 전체 목록 모달 내 아이템 */
function OverdueDialogItem({
  plan,
  onItemClick,
  onCheckboxChange,
  handleDateChange,
}: {
  plan: PlanItemData;
  onItemClick: (plan: PlanItemData, rect: DOMRect) => void;
  onCheckboxChange: (plan: PlanItemData) => void;
  handleDateChange: (date: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[rgb(var(--color-secondary-100))] cursor-pointer group"
      onClick={(e) => onItemClick(plan, e.currentTarget.getBoundingClientRect())}
    >
      {/* 체크박스 */}
      {plan.isTask && (
        <button
          className="flex-shrink-0 w-5 h-5 rounded border border-[rgb(var(--color-secondary-300))] hover:border-[rgb(var(--color-info-500))] hover:bg-[rgb(var(--color-info-50))] flex items-center justify-center transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onCheckboxChange(plan);
          }}
          title="완료 처리"
        >
          <Check className="w-3 h-3 text-transparent group-hover:text-[rgb(var(--color-secondary-300))]" />
        </button>
      )}

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate">{plan.title}</p>
        {plan.subject && (
          <p className="text-xs text-[var(--text-tertiary)]">{plan.subject}</p>
        )}
      </div>

      {/* 날짜 (클릭 시 캘린더 이동) */}
      {plan.planDate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDateChange(plan.planDate!);
          }}
          className="text-xs text-[rgb(var(--color-info-600))] hover:text-[rgb(var(--color-info-700))] hover:underline flex-shrink-0"
          title="이 날짜로 이동"
        >
          {formatShortDate(plan.planDate)}
        </button>
      )}

      {/* 시간 */}
      {plan.startTime && (
        <span className="text-xs text-[rgb(var(--color-secondary-400))] flex-shrink-0">
          {plan.startTime}
        </span>
      )}
    </div>
  );
}
