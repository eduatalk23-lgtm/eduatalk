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
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onQuickStatusChange?: (
    planId: string,
    newStatus: PlanStatus,
    prevStatus: PlanStatus,
  ) => void;
  onColorChange?: (planId: string, color: string | null) => void;
  /** 비학습 이벤트 비활성화 (soft delete) */
  onDisable?: (id: string) => void;
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
        onQuickStatusChange(planId, newStatus, state.plan.status);
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
    ? {
        plan: state.plan,
        anchorRect: state.anchorRect,
        onClose: closePopover,
        onEdit,
        onDelete,
        onQuickStatusChange: onQuickStatusChange ? handleQuickStatusChange : undefined,
        onColorChange,
        onDisable,
        onRecurringDelete: handleRecurringDelete,
        onRecurringEdit: handleRecurringEdit,
      }
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
