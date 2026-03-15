'use client';

import { useCallback, useState } from 'react';
import type { PlanItemData } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';
import type { EventDetailPopoverProps } from '../items/EventDetailPopover';

export interface RecurringModalState {
  isOpen: boolean;
  mode: 'edit' | 'delete';
  planId: string;
  instanceDate: string;
  exceptionCount?: number;
}

interface UseEventDetailPopoverOptions {
  onEdit?: (id: string, entityType?: 'event' | 'consultation') => void;
  onDelete?: (id: string) => void;
  onQuickStatusChange?: (
    planId: string,
    newStatus: PlanStatus,
    prevStatus: PlanStatus,
    instanceDate?: string,
  ) => void;
  onColorChange?: (planId: string, color: string | null) => void;
  /** 비학습 이벤트 비활성화 (soft delete) */
  onDisable?: (id: string) => void;
  /** 상담 상태 변경 (완료/미참석/취소/되돌리기) */
  onConsultationStatusChange?: (eventId: string, status: 'completed' | 'no_show' | 'cancelled' | 'scheduled') => void;
  /** admin/personal 모드면 true → 모든 이벤트 수정 가능 */
  isAdminMode?: boolean;
}

interface UseEventDetailPopoverReturn {
  /** GridPlanBlock의 onBlockClick에 직접 전달 */
  showPopover: (plan: PlanItemData, anchorRect: DOMRect) => void;
  closePopover: () => void;
  isPopoverOpen: boolean;
  /** EventDetailPopover에 스프레드: {...popoverProps} */
  popoverProps: EventDetailPopoverProps | null;
  /** 반복 이벤트 모달 상태 */
  recurringModalState: RecurringModalState | null;
  showRecurringModal: (mode: 'edit' | 'delete', planId: string, instanceDate: string, exceptionCount?: number) => void;
  closeRecurringModal: () => void;
}

export function useEventDetailPopover({
  onEdit,
  onDelete,
  onQuickStatusChange,
  onColorChange,
  onDisable,
  onConsultationStatusChange,
  isAdminMode = true,
}: UseEventDetailPopoverOptions): UseEventDetailPopoverReturn {
  const [state, setState] = useState<{ plan: PlanItemData; anchorRect: DOMRect } | null>(null);
  const [recurringModalState, setRecurringModalState] = useState<RecurringModalState | null>(null);

  const showPopover = useCallback((plan: PlanItemData, anchorRect: DOMRect) => {
    setState((prev) => {
      // 같은 이벤트 클릭 → 토글 (닫기)
      if (prev && prev.plan.id === plan.id) return null;
      return { plan, anchorRect };
    });
  }, []);

  const closePopover = useCallback(() => {
    setState(null);
  }, []);

  const showRecurringModal = useCallback((mode: 'edit' | 'delete', planId: string, instanceDate: string, exceptionCount?: number) => {
    setRecurringModalState({ isOpen: true, mode, planId, instanceDate, exceptionCount });
  }, []);

  const closeRecurringModal = useCallback(() => {
    setRecurringModalState(null);
  }, []);

  const handleQuickStatusChange = useCallback(
    (planId: string, newStatus: PlanStatus) => {
      if (onQuickStatusChange && state) {
        const instanceDate = state.plan.rrule ? state.plan.planDate : undefined;
        onQuickStatusChange(planId, newStatus, state.plan.status, instanceDate);
      }
    },
    [onQuickStatusChange, state],
  );

  // 반복 이벤트 감지 후 모달 트리거 콜백
  const handleRecurringDelete = useCallback(
    (planId: string, instanceDate: string) => {
      const exceptionCount = state?.plan.exdates?.length ?? 0;
      closePopover();
      showRecurringModal('delete', planId, instanceDate, exceptionCount);
    },
    [closePopover, showRecurringModal, state],
  );

  const handleRecurringEdit = useCallback(
    (planId: string, instanceDate: string) => {
      const exceptionCount = state?.plan.exdates?.length ?? 0;
      closePopover();
      showRecurringModal('edit', planId, instanceDate, exceptionCount);
    },
    [closePopover, showRecurringModal, state],
  );

  const popoverProps: EventDetailPopoverProps | null = state
    ? (() => {
        // 학생 모드에서 관리자가 만든 이벤트: 수정 불가, 완료 처리만 허용
        const canModify = isAdminMode || state.plan.creatorRole !== 'admin';
        return {
          plan: state.plan,
          anchorRect: state.anchorRect,
          onClose: closePopover,
          onEdit: canModify ? onEdit : undefined,
          onDelete: canModify ? onDelete : undefined,
          onQuickStatusChange: onQuickStatusChange ? handleQuickStatusChange : undefined,
          onColorChange: canModify ? onColorChange : undefined,
          onDisable: canModify ? onDisable : undefined,
          onConsultationStatusChange: canModify ? onConsultationStatusChange : undefined,
          onRecurringDelete: canModify ? handleRecurringDelete : undefined,
          onRecurringEdit: canModify ? handleRecurringEdit : undefined,
        };
      })()
    : null;

  return {
    showPopover,
    closePopover,
    isPopoverOpen: state !== null,
    popoverProps,
    recurringModalState,
    showRecurringModal,
    closeRecurringModal,
  };
}
