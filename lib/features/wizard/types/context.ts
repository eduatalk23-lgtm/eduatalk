/**
 * Wizard Context Types
 *
 * 4-Layer Context 패턴을 위한 Context 값 타입 정의
 * - Data Context: 위자드 데이터 상태
 * - Step Context: 단계 네비게이션 상태
 * - Validation Context: 검증 상태
 *
 * @module lib/features/wizard/types/context
 */

import type { ReactNode } from "react";
import type { WizardConfig, WizardStep } from "./base";
import type { BaseWizardData } from "./data";
import type { WizardAction } from "./actions";

// ============================================
// Wizard State
// ============================================

/**
 * 위자드 전체 상태
 */
export interface WizardState<TData extends BaseWizardData = BaseWizardData> {
  // 데이터
  wizardData: TData;
  initialWizardData: TData;

  // 네비게이션
  currentStep: WizardStep;

  // 검증
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: Map<string, string>;

  // 상태 플래그
  draftGroupId: string | null;
  createdGroupId: string | null;
  isSubmitting: boolean;
  isDirty: boolean;
  error: string | null;
}

// ============================================
// Data Context
// ============================================

/**
 * Data Context 값 타입
 *
 * 위자드 데이터 상태 및 업데이트 메서드를 제공합니다.
 * 데이터 변경만 구독하는 컴포넌트에서 사용합니다.
 */
export interface WizardDataContextValue<TData extends BaseWizardData = BaseWizardData> {
  /** 현재 위자드 데이터 */
  wizardData: TData;
  /** 초기 위자드 데이터 (dirty 상태 감지용) */
  initialWizardData: TData;
  /** 임시 저장된 그룹 ID */
  draftGroupId: string | null;
  /** 생성된 그룹 ID */
  createdGroupId: string | null;
  /** 데이터가 변경되었는지 여부 */
  isDirty: boolean;
  /** 제출 중인지 여부 */
  isSubmitting: boolean;
  /** 에러 메시지 */
  error: string | null;

  // 업데이트 메서드
  /** 데이터 부분 업데이트 */
  updateData: (updates: Partial<TData>) => void;
  /** 함수를 통한 데이터 업데이트 (이전 상태 기반) */
  updateDataFn: (fn: (prev: TData) => Partial<TData>) => void;
  /** Draft ID 설정 */
  setDraftId: (id: string | null) => void;
  /** 생성된 그룹 ID 설정 */
  setCreatedGroupId: (id: string | null) => void;
  /** 제출 상태 설정 */
  setSubmitting: (isSubmitting: boolean) => void;
  /** 에러 설정 */
  setError: (error: string | null) => void;
  /** Dirty 상태 리셋 (저장 후 호출) */
  resetDirtyState: () => void;
  /** 전체 리셋 */
  reset: () => void;
}

// ============================================
// Step Context
// ============================================

/**
 * Step Context 값 타입
 *
 * 단계 네비게이션 상태 및 메서드를 제공합니다.
 * 네비게이션 컨트롤만 필요한 컴포넌트에서 사용합니다.
 */
export interface WizardStepContextValue {
  /** 현재 단계 */
  currentStep: WizardStep;
  /** 총 단계 수 */
  totalSteps: number;
  /** 단계 레이블 */
  stepLabels: string[];
  /** 다음 단계 가능 여부 */
  canGoNext: boolean;
  /** 이전 단계 가능 여부 */
  canGoPrev: boolean;

  // 네비게이션 메서드
  /** 다음 단계로 이동 */
  nextStep: () => void;
  /** 이전 단계로 이동 */
  prevStep: () => void;
  /** 특정 단계로 이동 */
  setStep: (step: WizardStep) => void;
}

// ============================================
// Validation Context
// ============================================

/**
 * Validation Context 값 타입
 *
 * 검증 상태 및 에러 관리 메서드를 제공합니다.
 * 에러 표시만 필요한 컴포넌트에서 사용합니다.
 */
export interface WizardValidationContextValue {
  /** 전역 검증 에러 목록 */
  validationErrors: string[];
  /** 전역 검증 경고 목록 */
  validationWarnings: string[];
  /** 필드별 에러 (field -> error message) */
  fieldErrors: Map<string, string>;
  /** 에러가 있는지 여부 */
  hasErrors: boolean;
  /** 경고가 있는지 여부 */
  hasWarnings: boolean;

  // 에러 관리 메서드
  /** 전역 에러 설정 */
  setErrors: (errors: string[]) => void;
  /** 전역 경고 설정 */
  setWarnings: (warnings: string[]) => void;
  /** 필드 에러 설정 */
  setFieldError: (field: string, error: string) => void;
  /** 여러 필드 에러 일괄 설정 */
  setFieldErrors: (errors: Map<string, string>) => void;
  /** 특정 필드 에러 제거 */
  clearFieldError: (field: string) => void;
  /** 모든 검증 상태 초기화 */
  clearValidation: () => void;

  // UX 헬퍼
  /** 첫 번째 에러 필드로 스크롤 */
  scrollToFirstError?: () => void;
  /** 첫 번째 에러 필드 ID 반환 */
  getFirstErrorField?: () => string | null;
}

// ============================================
// Combined Context (하위 호환성)
// ============================================

/**
 * 통합 Context 값 타입
 *
 * 기존 usePlanWizard/useAdminWizard 훅과의 하위 호환성을 위해 유지합니다.
 * 새로운 코드에서는 개별 Context 사용을 권장합니다.
 *
 * @deprecated 성능 최적화를 위해 개별 Context 훅 사용을 권장합니다.
 */
export interface WizardContextValue<TData extends BaseWizardData = BaseWizardData>
  extends WizardDataContextValue<TData>,
    Omit<WizardStepContextValue, "totalSteps" | "stepLabels" | "canGoNext" | "canGoPrev">,
    Omit<WizardValidationContextValue, "hasErrors" | "hasWarnings"> {
  /** 전체 상태 */
  state: WizardState<TData>;
  /** 디스패치 함수 */
  dispatch: React.Dispatch<WizardAction<TData>>;
}

// ============================================
// Provider Props
// ============================================

/**
 * Wizard Provider Props
 */
export interface WizardProviderProps<TData extends BaseWizardData = BaseWizardData> {
  children: ReactNode;
  /** 위자드 설정 */
  config: WizardConfig;
  /** 초기 데이터 */
  initialData?: Partial<TData>;
  /** 초기 단계 */
  initialStep?: WizardStep;
  /** 초기 Draft ID */
  initialDraftId?: string | null;
}

// ============================================
// Factory Return Type
// ============================================

/**
 * createWizardProvider 팩토리 반환 타입
 */
export interface WizardProviderFactory<TData extends BaseWizardData> {
  /** Provider 컴포넌트 */
  WizardProvider: React.FC<Omit<WizardProviderProps<TData>, "config">>;
  /** Data Context 훅 */
  useWizardData: () => WizardDataContextValue<TData>;
  /** Step Context 훅 */
  useWizardStep: () => WizardStepContextValue;
  /** Validation Context 훅 */
  useWizardValidation: () => WizardValidationContextValue;
  /** 통합 Context 훅 (deprecated) */
  useWizard: () => WizardContextValue<TData>;
  /** Config 접근 */
  config: WizardConfig;
}
