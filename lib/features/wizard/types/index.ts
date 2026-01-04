/**
 * Wizard Types - Public API
 *
 * 위자드 관련 모든 타입의 중앙 export 포인트입니다.
 *
 * @module lib/features/wizard/types
 */

// ============================================
// Base Types
// ============================================

export type {
  WizardRole,
  WizardMode,
  WizardStep,
  WizardFeatures,
  WizardConfig,
  PlanPurpose,
  ContentType,
  SubjectType,
  SchedulerType,
  StudentLevel,
  ExclusionType,
  ScheduleSource,
} from "./base";

export {
  STUDENT_WIZARD_CONFIG,
  ADMIN_WIZARD_CONFIG,
  QUICK_WIZARD_CONFIG,
  WIZARD_STEPS,
  TIMING,
} from "./base";

// ============================================
// Data Types
// ============================================

export type {
  // Time types
  TimeRange,
  WizardTimeSettings,
  // Schedule types
  WizardExclusion,
  WizardAcademySchedule,
  WizardSchedulerOptions,
  // Content types
  WizardContent,
  WizardRecommendedContent,
  // Allocation types
  WizardSubjectAllocation,
  WizardContentAllocation,
  // Slot types
  SlotType,
  SelfStudyPurpose,
  SlotTimeConstraint,
  WizardContentSlot,
  // Schedule summary types
  WizardScheduleSummary,
  WizardTimeSlot,
  WizardDailySchedule,
  // Template types
  TemplateLockedFieldsStep1,
  TemplateLockedFields,
  // Main data types
  BaseWizardData,
  StudentWizardDataExtensions,
  AdminWizardDataExtensions,
  StudentWizardData,
  AdminWizardData,
  UnifiedWizardData,
} from "./data";

export {
  isStudentWizardData,
  isAdminWizardData,
  createDefaultBaseWizardData,
  createDefaultStudentWizardData,
  createDefaultAdminWizardData,
} from "./data";

// ============================================
// Action Types
// ============================================

export type {
  DataAction,
  StepAction,
  ValidationAction,
  WizardAction,
} from "./actions";

export {
  DATA_ACTION_TYPES,
  STEP_ACTION_TYPES,
  VALIDATION_ACTION_TYPES,
  isDataAction,
  isStepAction,
  isValidationAction,
} from "./actions";

// ============================================
// Context Types
// ============================================

export type {
  WizardState,
  WizardDataContextValue,
  WizardStepContextValue,
  WizardValidationContextValue,
  WizardContextValue,
  WizardProviderProps,
  WizardProviderFactory,
} from "./context";
