/**
 * Dynamic Modal Imports
 *
 * 모든 모달 컴포넌트의 동적 import를 중앙 집중화합니다.
 * 코드 스플리팅을 유지하면서 AdminPlanManagement의 코드를 간결하게 만듭니다.
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/dynamicModals
 */

import dynamic from 'next/dynamic';

// ============================================================
// 루트 레벨 모달 컴포넌트
// ============================================================

export const AddContentWizard = dynamic(
  () => import('./add-content-wizard').then((mod) => ({ default: mod.AddContentWizard })),
  { ssr: false }
);

export const AddAdHocModal = dynamic(
  () => import('./AddAdHocModal').then((mod) => ({ default: mod.AddAdHocModal })),
  { ssr: false }
);

export const RedistributeModal = dynamic(
  () => import('./RedistributeModal').then((mod) => ({ default: mod.RedistributeModal })),
  { ssr: false }
);

export const ShortcutsHelpModal = dynamic(
  () => import('./ShortcutsHelpModal').then((mod) => ({ default: mod.ShortcutsHelpModal })),
  { ssr: false }
);

export const AdminAIPlanModal = dynamic(
  () => import('./AdminAIPlanModal').then((mod) => ({ default: mod.AdminAIPlanModal })),
  { ssr: false }
);

export const AdminAIPlanModalV2 = dynamic(
  () => import('./AdminAIPlanModalV2').then((mod) => ({ default: mod.AdminAIPlanModalV2 })),
  { ssr: false }
);

export const AdminPlanCreationWizard7Step = dynamic(
  () => import('./admin-wizard').then((mod) => ({ default: mod.AdminPlanCreationWizard7Step })),
  { ssr: false }
);

export const AdminQuickPlanModal = dynamic(
  () => import('./AdminQuickPlanModal').then((mod) => ({ default: mod.AdminQuickPlanModal })),
  { ssr: false }
);

export const UnifiedPlanAddModal = dynamic(
  () => import('./UnifiedPlanAddModal').then((mod) => ({ default: mod.UnifiedPlanAddModal })),
  { ssr: false }
);

// PlanOptimizationPanel은 default export 사용
export const PlanOptimizationPanel = dynamic(
  () => import('./PlanOptimizationPanel'),
  { ssr: false }
);

// ============================================================
// modals/ 서브디렉토리 모달 컴포넌트
// ============================================================

export const EditPlanModal = dynamic(
  () => import('./modals/EditPlanModal').then((mod) => ({ default: mod.EditPlanModal })),
  { ssr: false }
);

export const ReorderPlansModal = dynamic(
  () => import('./modals/ReorderPlansModal').then((mod) => ({ default: mod.ReorderPlansModal })),
  { ssr: false }
);

export const ConditionalDeleteModal = dynamic(
  () => import('./modals/ConditionalDeleteModal').then((mod) => ({ default: mod.ConditionalDeleteModal })),
  { ssr: false }
);

export const PlanTemplateModal = dynamic(
  () => import('./modals/PlanTemplateModal').then((mod) => ({ default: mod.PlanTemplateModal })),
  { ssr: false }
);

export const MoveToGroupModal = dynamic(
  () => import('./modals/MoveToGroupModal').then((mod) => ({ default: mod.MoveToGroupModal })),
  { ssr: false }
);

export const CopyPlanModal = dynamic(
  () => import('./modals/CopyPlanModal').then((mod) => ({ default: mod.CopyPlanModal })),
  { ssr: false }
);

export const PlanStatusModal = dynamic(
  () => import('./modals/PlanStatusModal').then((mod) => ({ default: mod.PlanStatusModal })),
  { ssr: false }
);

export const BulkEditModal = dynamic(
  () => import('./modals/BulkEditModal').then((mod) => ({ default: mod.BulkEditModal })),
  { ssr: false }
);

export const PlanGroupDetailModal = dynamic(
  () => import('./modals/PlanGroupDetailModal').then((mod) => ({ default: mod.PlanGroupDetailModal })),
  { ssr: false }
);

export const PlanGroupEditModal = dynamic(
  () => import('./modals/PlanGroupEditModal').then((mod) => ({ default: mod.PlanGroupEditModal })),
  { ssr: false }
);

export const PlanGroupManageModal = dynamic(
  () => import('./modals/PlanGroupManageModal').then((mod) => ({ default: mod.PlanGroupManageModal })),
  { ssr: false }
);

export const ContentDependencyModal = dynamic(
  () => import('./modals/ContentDependencyModal').then((mod) => ({ default: mod.ContentDependencyModal })),
  { ssr: false }
);

export const BatchOperationsModal = dynamic(
  () => import('./modals/BatchOperationsModal').then((mod) => ({ default: mod.BatchOperationsModal })),
  { ssr: false }
);

export const AdminBlockSetCreateModal = dynamic(
  () => import('./modals/AdminBlockSetCreateModal').then((mod) => ({ default: mod.AdminBlockSetCreateModal })),
  { ssr: false }
);
