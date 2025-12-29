"use client";

/**
 * useWizardAnalytics - 위저드 분석 훅
 *
 * 위저드 사용 분석 데이터 수집 및 조회를 위한 훅
 *
 * @module lib/wizard/hooks/useWizardAnalytics
 */

import { useEffect, useCallback, useRef, useMemo } from "react";
import {
  WizardAnalyticsService,
  wizardAnalytics as defaultService,
  type AnalyticsEvent,
  type AnalyticsEventType,
  type StepTiming,
  type ValidationErrorInfo,
  type NavigationFlow,
  type SessionSummary,
  type AnalyticsConfig,
} from "../services/analytics";
import type { UnifiedWizardData, WizardMode, FieldError } from "../types";

// ============================================
// 타입 정의
// ============================================

export interface UseWizardAnalyticsOptions {
  /** 분석 서비스 인스턴스 */
  service?: WizardAnalyticsService;
  /** 서비스 설정 */
  config?: AnalyticsConfig;
  /** 위저드 모드 */
  wizardMode: WizardMode;
  /** 현재 단계 ID */
  currentStepId: string;
  /** 사용자 ID */
  userId?: string;
  /** 자동 단계 추적 */
  autoTrackSteps?: boolean;
  /** 브라우저 종료 시 자동 포기 기록 */
  trackAbandonOnUnload?: boolean;
}

export interface UseWizardAnalyticsResult {
  /** 세션 요약 */
  summary: SessionSummary;
  /** 모든 이벤트 */
  events: AnalyticsEvent[];
  /** 단계별 타이밍 */
  stepTimings: StepTiming[];
  /** 검증 에러 목록 */
  validationErrors: ValidationErrorInfo[];
  /** 네비게이션 흐름 */
  navigationFlows: NavigationFlow[];
  /** 평균 단계 소요 시간 */
  averageStepDuration: number;
  /** 가장 오래 머문 단계 */
  longestStep: StepTiming | null;
  /** 가장 많은 에러가 발생한 필드 */
  mostErrorProneField: ValidationErrorInfo | null;
  /** 위저드 시작 */
  startWizard: () => void;
  /** 위저드 완료 */
  completeWizard: (finalData?: Record<string, unknown>) => void;
  /** 위저드 포기 */
  abandonWizard: (reason?: string) => void;
  /** 다음 네비게이션 기록 */
  trackNavigateNext: (fromStepId: string, toStepId: string) => void;
  /** 이전 네비게이션 기록 */
  trackNavigatePrev: (fromStepId: string, toStepId: string) => void;
  /** 점프 네비게이션 기록 */
  trackNavigateJump: (fromStepId: string, toStepId: string) => void;
  /** 검증 에러 기록 */
  trackValidationError: (fieldPath: string, message: string) => void;
  /** 검증 에러 일괄 기록 */
  trackValidationErrors: (errors: FieldError[]) => void;
  /** 검증 성공 기록 */
  trackValidationSuccess: () => void;
  /** 드래프트 저장 기록 */
  trackDraftSave: (draftId: string) => void;
  /** 드래프트 복원 기록 */
  trackDraftRestore: (draftId: string) => void;
  /** 커스텀 이벤트 기록 */
  trackCustomEvent: (name: string, data?: Record<string, unknown>) => void;
  /** 특정 타입의 이벤트 조회 */
  getEventsByType: (type: AnalyticsEventType) => AnalyticsEvent[];
  /** 특정 단계 타이밍 조회 */
  getStepTiming: (stepId: string) => StepTiming | null;
  /** 세션 리셋 */
  resetSession: () => void;
}

// ============================================
// 메인 훅
// ============================================

/**
 * useWizardAnalytics
 *
 * 위저드 사용 분석을 관리하는 훅
 *
 * @example
 * ```tsx
 * function MyWizard() {
 *   const { data, currentStep, goToStep } = useWizard<FullWizardData>();
 *
 *   const {
 *     summary,
 *     stepTimings,
 *     trackNavigateNext,
 *     trackValidationErrors,
 *     completeWizard,
 *   } = useWizardAnalytics({
 *     wizardMode: data.mode,
 *     currentStepId: currentStep.id,
 *     config: {
 *       sendEvent: async (event) => {
 *         await fetch('/api/analytics', {
 *           method: 'POST',
 *           body: JSON.stringify(event),
 *         });
 *       },
 *     },
 *   });
 *
 *   const handleNext = () => {
 *     const nextStepId = getNextStepId(currentStep.id);
 *     trackNavigateNext(currentStep.id, nextStepId);
 *     goToStep(nextStepId);
 *   };
 *
 *   const handleSubmit = async () => {
 *     await submitWizard(data);
 *     completeWizard({ submittedData: data });
 *   };
 *
 *   return (
 *     <div>
 *       <p>총 {summary.stepsVisited}개 단계 방문</p>
 *       <p>평균 단계 소요시간: {averageStepDuration}ms</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWizardAnalytics(
  options: UseWizardAnalyticsOptions
): UseWizardAnalyticsResult {
  const {
    service: providedService,
    config,
    wizardMode,
    currentStepId,
    userId,
    autoTrackSteps = true,
    trackAbandonOnUnload = true,
  } = options;

  // 서비스 인스턴스
  const serviceRef = useRef<WizardAnalyticsService | null>(null);
  if (!serviceRef.current) {
    if (providedService) {
      serviceRef.current = providedService;
    } else if (config) {
      serviceRef.current = new WizardAnalyticsService({
        ...config,
        getUserId: config.getUserId ?? (() => userId),
      });
    } else {
      serviceRef.current = defaultService;
    }
  }
  const service = serviceRef.current;

  // 이전 단계 ID 추적
  const prevStepIdRef = useRef<string | null>(null);
  const isStartedRef = useRef(false);

  // 위저드 시작 처리
  useEffect(() => {
    if (!isStartedRef.current) {
      service.startWizard(wizardMode, currentStepId);
      isStartedRef.current = true;
    }
  }, [service, wizardMode, currentStepId]);

  // 자동 단계 추적
  useEffect(() => {
    if (!autoTrackSteps) return;
    if (!isStartedRef.current) return;

    if (prevStepIdRef.current && prevStepIdRef.current !== currentStepId) {
      service.enterStep(currentStepId);
    }

    prevStepIdRef.current = currentStepId;
  }, [service, currentStepId, autoTrackSteps]);

  // 브라우저 종료 시 포기 기록
  useEffect(() => {
    if (!trackAbandonOnUnload) return;

    const handleBeforeUnload = () => {
      service.abandonWizard("browser_unload");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [service, trackAbandonOnUnload]);

  // 정리
  useEffect(() => {
    return () => {
      // 완료되지 않은 경우 포기로 처리하지 않음 (컴포넌트 언마운트일 수 있음)
    };
  }, []);

  // 콜백 함수들
  const startWizard = useCallback(() => {
    service.startWizard(wizardMode, currentStepId);
    isStartedRef.current = true;
  }, [service, wizardMode, currentStepId]);

  const completeWizard = useCallback(
    (finalData?: Record<string, unknown>) => {
      service.completeWizard(finalData);
    },
    [service]
  );

  const abandonWizard = useCallback(
    (reason?: string) => {
      service.abandonWizard(reason);
    },
    [service]
  );

  const trackNavigateNext = useCallback(
    (fromStepId: string, toStepId: string) => {
      service.navigateNext(fromStepId, toStepId);
    },
    [service]
  );

  const trackNavigatePrev = useCallback(
    (fromStepId: string, toStepId: string) => {
      service.navigatePrev(fromStepId, toStepId);
    },
    [service]
  );

  const trackNavigateJump = useCallback(
    (fromStepId: string, toStepId: string) => {
      service.navigateJump(fromStepId, toStepId);
    },
    [service]
  );

  const trackValidationError = useCallback(
    (fieldPath: string, message: string) => {
      service.recordValidationError(currentStepId, fieldPath, message);
    },
    [service, currentStepId]
  );

  const trackValidationErrors = useCallback(
    (errors: FieldError[]) => {
      for (const error of errors) {
        service.recordValidationError(currentStepId, error.field, error.message);
      }
    },
    [service, currentStepId]
  );

  const trackValidationSuccess = useCallback(() => {
    service.recordValidationSuccess(currentStepId);
  }, [service, currentStepId]);

  const trackDraftSave = useCallback(
    (draftId: string) => {
      service.recordDraftSave(draftId);
    },
    [service]
  );

  const trackDraftRestore = useCallback(
    (draftId: string) => {
      service.recordDraftRestore(draftId);
    },
    [service]
  );

  const trackCustomEvent = useCallback(
    (name: string, data?: Record<string, unknown>) => {
      service.trackCustomEvent(name, data);
    },
    [service]
  );

  const getEventsByType = useCallback(
    (type: AnalyticsEventType): AnalyticsEvent[] => {
      return service.getEventsByType(type);
    },
    [service]
  );

  const getStepTiming = useCallback(
    (stepId: string): StepTiming | null => {
      return service.getStepTiming(stepId);
    },
    [service]
  );

  const resetSession = useCallback(() => {
    service.resetSession();
    isStartedRef.current = false;
    prevStepIdRef.current = null;
  }, [service]);

  // 메모이제이션된 값들
  const summary = useMemo(() => service.getSessionSummary(), [service]);
  const events = useMemo(() => service.getEvents(), [service]);
  const stepTimings = useMemo(() => service.getStepTimings(), [service]);
  const validationErrors = useMemo(
    () => service.getValidationErrors(),
    [service]
  );
  const navigationFlows = useMemo(
    () => service.getNavigationFlows(),
    [service]
  );
  const averageStepDuration = useMemo(
    () => service.getAverageStepDuration(),
    [service]
  );
  const longestStep = useMemo(() => service.getLongestStep(), [service]);
  const mostErrorProneField = useMemo(
    () => service.getMostErrorProneField(),
    [service]
  );

  return {
    summary,
    events,
    stepTimings,
    validationErrors,
    navigationFlows,
    averageStepDuration,
    longestStep,
    mostErrorProneField,
    startWizard,
    completeWizard,
    abandonWizard,
    trackNavigateNext,
    trackNavigatePrev,
    trackNavigateJump,
    trackValidationError,
    trackValidationErrors,
    trackValidationSuccess,
    trackDraftSave,
    trackDraftRestore,
    trackCustomEvent,
    getEventsByType,
    getStepTiming,
    resetSession,
  };
}

// ============================================
// 간편 훅들
// ============================================

export interface UseStepTimingOptions {
  /** 분석 서비스 */
  service?: WizardAnalyticsService;
  /** 단계 ID */
  stepId: string;
}

/**
 * useStepTiming
 *
 * 특정 단계의 타이밍 정보를 추적하는 간편 훅
 */
export function useStepTiming(options: UseStepTimingOptions): {
  timing: StepTiming | null;
  duration: number;
  visitCount: number;
  isCompleted: boolean;
} {
  const { service = defaultService, stepId } = options;

  const timing = useMemo(
    () => service.getStepTiming(stepId),
    [service, stepId]
  );

  return {
    timing,
    duration: timing?.duration ?? 0,
    visitCount: timing?.visitCount ?? 0,
    isCompleted: timing?.completed ?? false,
  };
}

export interface UseValidationAnalyticsOptions {
  /** 분석 서비스 */
  service?: WizardAnalyticsService;
  /** 현재 단계 ID */
  currentStepId: string;
}

/**
 * useValidationAnalytics
 *
 * 검증 관련 분석을 위한 간편 훅
 */
export function useValidationAnalytics(
  options: UseValidationAnalyticsOptions
): {
  errors: ValidationErrorInfo[];
  totalErrorCount: number;
  mostErrorProneField: ValidationErrorInfo | null;
  trackError: (fieldPath: string, message: string) => void;
  trackSuccess: () => void;
} {
  const { service = defaultService, currentStepId } = options;

  const errors = useMemo(() => service.getValidationErrors(), [service]);

  const totalErrorCount = useMemo(() => {
    return errors.reduce((sum, e) => sum + e.count, 0);
  }, [errors]);

  const mostErrorProneField = useMemo(
    () => service.getMostErrorProneField(),
    [service]
  );

  const trackError = useCallback(
    (fieldPath: string, message: string) => {
      service.recordValidationError(currentStepId, fieldPath, message);
    },
    [service, currentStepId]
  );

  const trackSuccess = useCallback(() => {
    service.recordValidationSuccess(currentStepId);
  }, [service, currentStepId]);

  return {
    errors,
    totalErrorCount,
    mostErrorProneField,
    trackError,
    trackSuccess,
  };
}
