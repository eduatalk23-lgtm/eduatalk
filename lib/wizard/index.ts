/**
 * 통합 위저드 모듈
 *
 * 모든 위저드 관련 유틸리티를 통합 export합니다.
 *
 * @module lib/wizard
 */

// 타입
export type {
  WizardMode,
  StepStatus,
  WizardStepDefinition,
  BaseWizardData,
  FullWizardData,
  QuickWizardData,
  ContentAddWizardData,
  UnifiedWizardData,
  FieldError,
  ValidationResult,
  StepValidator,
  WizardAction,
  WizardContextValue,
  FreeLearningType,
  StudyType,
  RangeUnit,
  ExclusionItem,
  AcademyScheduleItem,
  TimeSettings,
  ContentItem,
  InheritedTemplateSettings,
  // 관리자 위저드 타입
  AdminWizardMode,
  AdminWizardData,
  AdminParticipant,
  BatchPlanWizardData,
  RescheduleWizardData,
  CampTemplateWizardData,
  BatchOperationResult,
} from "./types";

// Context & Provider
export {
  UnifiedWizardProvider,
  useWizard,
  useWizardData,
  useWizardNavigation,
  useWizardValidation,
} from "./UnifiedWizardContext";

export type { UnifiedWizardProviderProps } from "./UnifiedWizardContext";

// 단계 정의
export {
  FULL_MODE_STEPS,
  QUICK_MODE_STEPS,
  CONTENT_ADD_MODE_STEPS,
  // 관리자 모드 단계
  BATCH_PLAN_MODE_STEPS,
  RESCHEDULE_MODE_STEPS,
  CAMP_TEMPLATE_MODE_STEPS,
  // 유틸리티
  getStepsForMode,
  findStepById,
  getNextStep,
  getPrevStep,
  getFirstStepId,
  getStepIdByNumber,
} from "./stepDefinitions";

// 검증 유틸리티
export {
  createValidator,
  validateRequired,
  validateDateRange,
  validateMinLength,
  validateMaxLength,
  combineValidators,
  createFullModeValidators,
  createQuickModeValidators,
  createContentAddModeValidators,
} from "./validation";

// 초기 데이터 생성
export {
  createFullWizardData,
  createQuickWizardData,
  createContentAddWizardData,
  // 관리자 모드
  createBatchPlanWizardData,
  createRescheduleWizardData,
  createCampTemplateWizardData,
  // 유틸리티
  restoreFromDraft,
  serializeWizardData,
  deserializeWizardData,
} from "./initialData";

export type {
  CreateFullWizardDataOptions,
  CreateQuickWizardDataOptions,
  CreateContentAddWizardDataOptions,
  // 관리자 모드
  CreateBatchPlanWizardDataOptions,
  CreateRescheduleWizardDataOptions,
  CreateCampTemplateWizardDataOptions,
} from "./initialData";

// UI 컴포넌트
export {
  // Progress
  WizardProgress,
  SimpleProgressBar,
  // Navigation
  WizardNavigation,
  KeyboardHints,
  // Skeleton
  SkeletonLine,
  SkeletonCard,
  WizardStepSkeleton,
  FormSkeleton,
  ContentSelectionSkeleton,
  SchedulePreviewSkeleton,
  SummarySkeleton,
  ResultSkeleton,
  // Field Error
  WizardFieldError,
  WizardErrorList,
  WizardWarningList,
  FieldWrapper,
  ErrorBadge,
  EnhancedFieldError,
  ActionableErrorList,
  SuccessMessage,
  // Step Wrapper
  WizardStepWrapper,
  StepErrorBoundary,
  StepHeader,
  StepSection,
  StepActions,
  // 관리자 컴포넌트
  AdminWizardProgress,
  ParticipantSelector,
  BatchOperationStatus,
  BatchOperationsSummary,
} from "./components";

export type {
  WizardProgressProps,
  SimpleProgressBarProps,
  WizardNavigationProps,
  KeyboardHintsProps,
  SkeletonLineProps,
  SkeletonCardProps,
  WizardStepSkeletonProps,
  WizardFieldErrorProps,
  WizardErrorListProps,
  WizardWarningListProps,
  FieldWrapperProps,
  ErrorBadgeProps,
  EnhancedFieldErrorProps,
  ActionableErrorListProps,
  SuccessMessageProps,
  WizardStepWrapperProps,
  StepHeaderProps,
  StepSectionProps,
  StepActionsProps,
  // 관리자 컴포넌트
  AdminWizardProgressProps,
  ParticipantSelectorProps,
  BatchOperationStatusProps,
  BatchOperationsSummaryProps,
} from "./components";

// 레거시 어댑터
export {
  useLegacyPlanWizardBridge,
  unifiedToLegacy,
  legacyToUnified,
  isLastStep,
  calculateProgress,
} from "./adapters";

export type {
  WizardStep,
  LegacyPlanWizardState,
  LegacyPlanWizardActions,
  LegacyPlanWizardBridge,
} from "./adapters";

// 드래프트 저장 서비스
export {
  DraftStorageService,
  draftStorage,
} from "./services";

export type {
  DraftMetadata,
  StoredDraft,
  DraftStorageOptions,
} from "./services";

// 비동기 검증 서비스
export {
  AsyncValidationService,
  asyncValidation,
  createApiValidator,
  createUniquenessValidator,
  createConditionalAsyncValidator,
} from "./services";

export type {
  AsyncValidationStatus,
  AsyncValidationResult,
  AsyncValidator,
  AsyncValidationConfig,
} from "./services";

// 드래프트 관련 훅
export { useAutoSave, useDraftRestore } from "./hooks";

export type {
  AutoSaveStatus,
  UseAutoSaveOptions,
  UseAutoSaveResult,
  DraftRestoreStatus,
  UseDraftRestoreOptions,
  UseDraftRestoreResult,
} from "./hooks";

// 비동기 검증 훅
export { useAsyncValidation, useFieldAsyncValidation } from "./hooks";

export type {
  UseAsyncValidationOptions,
  UseAsyncValidationResult,
  FieldValidationState,
  UseFieldAsyncValidationOptions,
  UseFieldAsyncValidationResult,
} from "./hooks";

// 단계 분기 서비스
export {
  StepBranchingService,
  createModeBasedRules,
  createOptionalStepRule,
  createDependencyRule,
} from "./services";

export type {
  BranchConditionResult,
  StepBranchRule,
  BranchPath,
  StepVisibility,
  StepBranchingConfig,
  StepFlowState,
} from "./services";

// 단계 분기 훅
export {
  useStepBranching,
  useConditionalStep,
  useStepDependency,
} from "./hooks";

export type {
  UseStepBranchingOptions,
  UseStepBranchingResult,
  UseConditionalStepOptions,
  UseStepDependencyOptions,
} from "./hooks";

// 위저드 분석 서비스
export {
  WizardAnalyticsService,
  wizardAnalytics,
} from "./services";

export type {
  AnalyticsEventType,
  AnalyticsEvent,
  StepTiming,
  ValidationErrorInfo,
  NavigationFlow,
  SessionSummary,
  AnalyticsConfig,
} from "./services";

// 위저드 분석 훅
export {
  useWizardAnalytics,
  useStepTiming,
  useValidationAnalytics,
} from "./hooks";

export type {
  UseWizardAnalyticsOptions,
  UseWizardAnalyticsResult,
  UseStepTimingOptions,
  UseValidationAnalyticsOptions,
} from "./hooks";
