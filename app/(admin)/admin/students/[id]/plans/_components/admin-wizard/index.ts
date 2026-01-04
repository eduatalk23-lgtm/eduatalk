/**
 * Admin Wizard 모듈
 *
 * 7단계 플랜 생성 위저드
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard
 */

// 7단계 위저드
export { AdminPlanCreationWizard7Step } from './AdminPlanCreationWizard7Step';

// Context 및 Hooks
export {
  AdminWizardProvider,
  useAdminWizard,
  useAdminWizardData,
  useAdminWizardStep,
  useAdminWizardValidation,
} from './_context';

// 자동 저장 훅
export { useAdminAutoSave } from './hooks/useAdminAutoSave';

// 공통 컴포넌트
export { AdminStepErrorBoundary } from './common/AdminStepErrorBoundary';
export { AutoSaveIndicator } from './common/AutoSaveIndicator';

// 타입
export type { AdminPlanCreationWizardProps } from './_context/types';
