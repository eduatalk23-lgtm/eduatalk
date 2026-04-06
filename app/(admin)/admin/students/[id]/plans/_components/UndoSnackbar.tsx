'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePlanToast } from './PlanToast';
import type { UndoableAction } from './undoTypes';
import { restoreEvent, updateItemTime, updatePlanStatus, restoreRecurringDelete, restoreRecurrenceRemove, restoreDragRecurringInstance } from '@/lib/domains/calendar/actions/calendarEventActions';
import { movePlanToDate } from '@/lib/domains/admin-plan/actions/movePlanToDate';
import { adminDockKeys } from '@/lib/query-options/adminDock';
import { calendarEventKeys } from '@/lib/query-options/calendarEvents';
import { calendarViewKeys } from '@/lib/query-options/calendarViewQueryOptions';

const UNDO_TIMEOUT_MS = 5000;

// ============================================
// Context
// ============================================

interface UndoContextValue {
  pushUndoable: (action: UndoableAction) => void;
  dismissUndo: () => void;
  triggerUndo: () => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndo() {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
}

// ============================================
// Provider
// ============================================

interface UndoProviderProps {
  children: ReactNode;
}

export function UndoProvider({ children }: UndoProviderProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<UndoableAction | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const { showToast } = usePlanToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissUndo = useCallback(() => {
    clearTimer();
    setPending(null);
  }, [clearTimer]);

  const pushUndoable = useCallback(
    (action: UndoableAction) => {
      // 이전 undo 포기 (새 액션으로 교체)
      clearTimer();
      setPending(action);

      timerRef.current = setTimeout(() => {
        setPending(null);
      }, UNDO_TIMEOUT_MS);
    },
    [clearTimer],
  );

  const triggerUndo = useCallback(async () => {
    if (!pending || isUndoing) return;

    clearTimer();
    setIsUndoing(true);
    const action = pending;
    setPending(null);

    try {
      let result: { success: boolean; error?: string };

      switch (action.type) {
        case 'delete-plan':
          result = await restoreEvent(action.planId);
          break;
        case 'move-to-date':
          result = await movePlanToDate({
            planId: action.planId,
            studentId: action.studentId,
            targetDate: action.prev.date,
            newStartTime: action.prev.startTime,
            newEndTime: action.prev.endTime,
            estimatedMinutes: action.prev.estimatedMinutes,
          });
          break;
        case 'resize':
          result = await updateItemTime({
            studentId: action.studentId,
            calendarId: action.calendarId,
            planDate: action.planDate,
            itemId: action.planId,
            itemType: 'plan',
            newStartTime: action.prev.startTime,
            newEndTime: action.prev.endTime,
            estimatedMinutes: action.prev.estimatedMinutes,
          });
          break;
        case 'status-change':
          result = await updatePlanStatus({
            planId: action.planId,
            status: action.prevStatus,
            skipRevalidation: true,
          });
          break;
        case 'recurring-delete':
          result = await restoreRecurringDelete({
            scope: action.scope,
            parentEventId: action.parentEventId,
            instanceDate: action.instanceDate,
            previousExdates: action.previousExdates,
            previousRrule: action.previousRrule,
            deletedEventIds: action.deletedEventIds,
          });
          break;
        case 'recurrence-remove':
          result = await restoreRecurrenceRemove({
            eventId: action.eventId,
            previousRrule: action.previousRrule,
            previousExdates: action.previousExdates,
            deletedExceptionIds: action.deletedExceptionIds,
          });
          break;
        case 'undo-recurring-drag':
          result = await restoreDragRecurringInstance({
            exceptionEventId: action.exceptionEventId,
            parentEventId: action.parentEventId,
            instanceDate: action.instanceDate,
          });
          break;
      }

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: adminDockKeys.all });
        queryClient.invalidateQueries({ queryKey: calendarEventKeys.all });
        queryClient.invalidateQueries({ queryKey: calendarViewKeys.all });
        showToast('실행취소 완료', 'info');
      } else {
        showToast(result.error ?? '실행취소에 실패했습니다.', 'error');
      }
    } catch {
      showToast('실행취소 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsUndoing(false);
    }
  }, [pending, isUndoing, clearTimer, queryClient, showToast]);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return (
    <UndoContext.Provider value={{ pushUndoable, dismissUndo, triggerUndo }}>
      {children}
      <UndoSnackbar
        action={pending}
        isUndoing={isUndoing}
        onUndo={triggerUndo}
        onDismiss={dismissUndo}
      />
    </UndoContext.Provider>
  );
}

// ============================================
// Snackbar UI
// ============================================

interface UndoSnackbarProps {
  action: UndoableAction | null;
  isUndoing: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

function UndoSnackbar({ action, isUndoing, onUndo, onDismiss }: UndoSnackbarProps) {
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(UNDO_TIMEOUT_MS);
  const startTimeRef = useRef(0);

  // 액션 변경 시 타이머 리셋
  useEffect(() => {
    if (action) {
      remainingRef.current = UNDO_TIMEOUT_MS;
      startTimeRef.current = Date.now();
    }
  }, [action]);

  // 호버 시 타이머 pause/resume
  const handleMouseEnter = useCallback(() => {
    setPaused(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    remainingRef.current -= Date.now() - startTimeRef.current;
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPaused(false);
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, remainingRef.current);
  }, [onDismiss]);

  // 자동 dismiss 타이머 관리
  useEffect(() => {
    if (!action || paused) return;

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, remainingRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [action, paused, onDismiss]);

  if (!action) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative bg-gray-900 text-white rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[480px] overflow-hidden">
        <span className="text-sm flex-1 truncate">{action.description}</span>
        <button
          onClick={onUndo}
          disabled={isUndoing}
          className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 shrink-0"
        >
          {isUndoing ? '처리중...' : '실행취소'}
        </button>
        <button
          onClick={onDismiss}
          className="text-gray-400 dark:text-gray-500 hover:text-white transition-colors text-xs shrink-0"
          aria-label="닫기"
        >
          ✕
        </button>

        {/* 카운트다운 프로그레스 바 */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700">
          <div
            className="h-full bg-blue-400 origin-left"
            style={{
              animation: paused
                ? 'none'
                : `undo-countdown ${UNDO_TIMEOUT_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
