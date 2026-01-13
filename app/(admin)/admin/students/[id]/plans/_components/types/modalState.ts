/**
 * Modal State Types for AdminPlanManagement
 *
 * useReducer 패턴을 사용하여 모달 상태 관리를 단순화합니다.
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/types/modalState
 */

/**
 * 가능한 모달 타입
 */
export type ModalType =
  | 'addContent'
  | 'addAdHoc'
  | 'redistribute'
  | 'shortcutsHelp'
  | 'aiPlan'
  | 'createWizard'
  | 'optimization'
  | 'quickPlan'
  | 'edit'
  | 'reorder'
  | 'conditionalDelete'
  | 'template'
  | 'moveToGroup'
  | 'copy'
  | 'status'
  | 'bulkEdit'
  | 'unifiedAdd'
  | 'planGroupManage'
  | 'contentDependency'
  | 'batchOperations';

/**
 * 모달 상태
 */
export interface ModalState {
  addContent: boolean;
  addAdHoc: boolean;
  redistribute: boolean;
  shortcutsHelp: boolean;
  aiPlan: boolean;
  createWizard: boolean;
  optimization: boolean;
  quickPlan: boolean;
  edit: boolean;
  reorder: boolean;
  conditionalDelete: boolean;
  template: boolean;
  moveToGroup: boolean;
  copy: boolean;
  status: boolean;
  bulkEdit: boolean;
  unifiedAdd: boolean;
  planGroupManage: boolean;
  contentDependency: boolean;
  batchOperations: boolean;
}

/**
 * 모달 액션 타입
 */
export type ModalAction =
  | { type: 'OPEN_MODAL'; payload: ModalType }
  | { type: 'CLOSE_MODAL'; payload: ModalType }
  | { type: 'CLOSE_ALL' };

/**
 * 초기 모달 상태
 */
export const initialModalState: ModalState = {
  addContent: false,
  addAdHoc: false,
  redistribute: false,
  shortcutsHelp: false,
  aiPlan: false,
  createWizard: false,
  optimization: false,
  quickPlan: false,
  edit: false,
  reorder: false,
  conditionalDelete: false,
  template: false,
  moveToGroup: false,
  copy: false,
  status: false,
  bulkEdit: false,
  unifiedAdd: false,
  planGroupManage: false,
  contentDependency: false,
  batchOperations: false,
};

/**
 * 모달 리듀서
 */
export function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_MODAL':
      return { ...state, [action.payload]: true };
    case 'CLOSE_MODAL':
      return { ...state, [action.payload]: false };
    case 'CLOSE_ALL':
      return { ...initialModalState };
    default:
      return state;
  }
}

/**
 * 모달 상태 키-타입 매핑 (기존 변수명 → 모달 타입)
 */
export const modalKeyMap: Record<string, ModalType> = {
  showAddContentModal: 'addContent',
  showAddAdHocModal: 'addAdHoc',
  showRedistributeModal: 'redistribute',
  showShortcutsHelp: 'shortcutsHelp',
  showAIPlanModal: 'aiPlan',
  showCreateWizard: 'createWizard',
  showOptimizationPanel: 'optimization',
  showQuickPlanModal: 'quickPlan',
  showEditModal: 'edit',
  showReorderModal: 'reorder',
  showConditionalDeleteModal: 'conditionalDelete',
  showTemplateModal: 'template',
  showMoveToGroupModal: 'moveToGroup',
  showCopyModal: 'copy',
  showStatusModal: 'status',
  showBulkEditModal: 'bulkEdit',
  showUnifiedAddModal: 'unifiedAdd',
  showPlanGroupManageModal: 'planGroupManage',
  showContentDependencyModal: 'contentDependency',
  showBatchOperationsModal: 'batchOperations',
};
