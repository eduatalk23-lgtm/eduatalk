/**
 * useModalSetters Hook
 *
 * 모달 상태 래퍼 함수들을 자동 생성하여 중복 코드를 제거합니다.
 * 기존 API(showXxxModal, setShowXxxModal)와 완벽히 호환됩니다.
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/hooks/useModalSetters
 */

import { useCallback, useMemo } from 'react';
import type { ModalType, ModalState, ModalAction } from '../types/modalState';

type ModalSetter = (show: boolean) => void;

/**
 * 모달 상태와 setter 함수들의 반환 타입
 */
export interface ModalSettersReturn {
  // Show states
  showAddContentModal: boolean;
  showAddAdHocModal: boolean;
  showRedistributeModal: boolean;
  showShortcutsHelp: boolean;
  showAIPlanModal: boolean;
  showCreateWizard: boolean;
  showOptimizationPanel: boolean;
  showQuickPlanModal: boolean;
  showEditModal: boolean;
  showReorderModal: boolean;
  showConditionalDeleteModal: boolean;
  showTemplateModal: boolean;
  showMoveToGroupModal: boolean;
  showCopyModal: boolean;
  showStatusModal: boolean;
  showBulkEditModal: boolean;
  showUnifiedAddModal: boolean;
  // Setters
  setShowAddContentModal: ModalSetter;
  setShowAddAdHocModal: ModalSetter;
  setShowRedistributeModal: ModalSetter;
  setShowShortcutsHelp: ModalSetter;
  setShowAIPlanModal: ModalSetter;
  setShowCreateWizard: ModalSetter;
  setShowOptimizationPanel: ModalSetter;
  setShowQuickPlanModal: ModalSetter;
  setShowEditModal: ModalSetter;
  setShowReorderModal: ModalSetter;
  setShowConditionalDeleteModal: ModalSetter;
  setShowTemplateModal: ModalSetter;
  setShowMoveToGroupModal: ModalSetter;
  setShowCopyModal: ModalSetter;
  setShowStatusModal: ModalSetter;
  setShowBulkEditModal: ModalSetter;
  setShowUnifiedAddModal: ModalSetter;
}

/**
 * 모달 타입과 기존 변수명 매핑
 */
const MODAL_MAPPINGS: Array<{ type: ModalType; showKey: keyof ModalSettersReturn; setKey: keyof ModalSettersReturn }> = [
  { type: 'addContent', showKey: 'showAddContentModal', setKey: 'setShowAddContentModal' },
  { type: 'addAdHoc', showKey: 'showAddAdHocModal', setKey: 'setShowAddAdHocModal' },
  { type: 'redistribute', showKey: 'showRedistributeModal', setKey: 'setShowRedistributeModal' },
  { type: 'shortcutsHelp', showKey: 'showShortcutsHelp', setKey: 'setShowShortcutsHelp' },
  { type: 'aiPlan', showKey: 'showAIPlanModal', setKey: 'setShowAIPlanModal' },
  { type: 'createWizard', showKey: 'showCreateWizard', setKey: 'setShowCreateWizard' },
  { type: 'optimization', showKey: 'showOptimizationPanel', setKey: 'setShowOptimizationPanel' },
  { type: 'quickPlan', showKey: 'showQuickPlanModal', setKey: 'setShowQuickPlanModal' },
  { type: 'edit', showKey: 'showEditModal', setKey: 'setShowEditModal' },
  { type: 'reorder', showKey: 'showReorderModal', setKey: 'setShowReorderModal' },
  { type: 'conditionalDelete', showKey: 'showConditionalDeleteModal', setKey: 'setShowConditionalDeleteModal' },
  { type: 'template', showKey: 'showTemplateModal', setKey: 'setShowTemplateModal' },
  { type: 'moveToGroup', showKey: 'showMoveToGroupModal', setKey: 'setShowMoveToGroupModal' },
  { type: 'copy', showKey: 'showCopyModal', setKey: 'setShowCopyModal' },
  { type: 'status', showKey: 'showStatusModal', setKey: 'setShowStatusModal' },
  { type: 'bulkEdit', showKey: 'showBulkEditModal', setKey: 'setShowBulkEditModal' },
  { type: 'unifiedAdd', showKey: 'showUnifiedAddModal', setKey: 'setShowUnifiedAddModal' },
];

/**
 * 모달 상태와 setter 함수들을 생성하는 커스텀 훅
 *
 * @param modals - useReducer로 관리되는 모달 상태
 * @param dispatchModal - 모달 액션 디스패치 함수
 * @returns 모달 show 상태와 setter 함수들
 *
 * @example
 * ```tsx
 * const [modals, dispatchModal] = useReducer(modalReducer, initialModalState);
 * const {
 *   showAddContentModal,
 *   setShowAddContentModal,
 *   // ... 나머지 모달들
 * } = useModalSetters(modals, dispatchModal);
 * ```
 */
export function useModalSetters(
  modals: ModalState,
  dispatchModal: React.Dispatch<ModalAction>
): ModalSettersReturn {
  // setter 생성 함수 (memoized)
  const createSetter = useCallback(
    (type: ModalType): ModalSetter => {
      return (show: boolean) => {
        dispatchModal({
          type: show ? 'OPEN_MODAL' : 'CLOSE_MODAL',
          payload: type,
        });
      };
    },
    [dispatchModal]
  );

  // 모든 setter를 한 번에 생성 (memoized)
  const setters = useMemo(() => {
    const result: Record<string, ModalSetter> = {};
    for (const mapping of MODAL_MAPPINGS) {
      result[mapping.setKey] = createSetter(mapping.type);
    }
    return result;
  }, [createSetter]);

  // show 상태 (modals가 변경될 때마다 업데이트)
  const showStates = useMemo(() => {
    const result: Record<string, boolean> = {};
    for (const mapping of MODAL_MAPPINGS) {
      result[mapping.showKey] = modals[mapping.type];
    }
    return result;
  }, [modals]);

  // 타입 안전성을 위해 unknown을 거쳐 변환
  return {
    ...showStates,
    ...setters,
  } as unknown as ModalSettersReturn;
}
