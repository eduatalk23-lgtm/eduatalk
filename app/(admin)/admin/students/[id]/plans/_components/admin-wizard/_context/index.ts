/**
 * Admin Wizard Context 모듈
 *
 * Phase 2: 4-Layer Context 패턴 구현
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context
 */

// 메인 Provider 및 통합 Hook
export {
  AdminWizardProvider,
  AdminWizardContext,
  useAdminWizard,
  useAdminWizardData,
  useAdminWizardStep,
  useAdminWizardValidation,
} from "./AdminWizardContext";

// 개별 Context (직접 사용 시)
export {
  AdminWizardDataContext,
  AdminWizardDataProvider,
} from "./AdminWizardDataContext";

export {
  AdminWizardStepContext,
  AdminWizardStepProvider,
} from "./AdminWizardStepContext";

export {
  AdminWizardValidationContext,
  AdminWizardValidationProvider,
} from "./AdminWizardValidationContext";

// 타입
export type {
  // 기본 타입
  WizardStep,
  PlanPurpose,
  ContentType,
  SubjectType,
  // 콘텐츠 타입
  SelectedContent,
  StudentContent,
  // 스케줄 타입
  ExclusionSchedule,
  AcademySchedule,
  TimeSettings,
  SchedulerOptions,
  // 배분 타입
  SubjectAllocation,
  ContentAllocation,
  // Wizard 데이터
  AdminWizardData,
  AdminWizardState,
  // 액션 타입
  DataAction,
  StepAction,
  ValidationAction,
  AdminWizardAction,
  // Context Value 타입
  AdminWizardDataContextValue,
  AdminWizardStepContextValue,
  AdminWizardValidationContextValue,
  // Props 타입
  AdminWizardProviderProps,
  AdminPlanCreationWizardProps,
} from "./types";

// Type Guards
export { isDataAction, isStepAction, isValidationAction } from "./types";
