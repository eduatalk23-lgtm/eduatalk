"use client";

/**
 * useStepBranching - 위저드 단계 분기 훅
 *
 * 조건부 단계 표시/숨김, 동적 흐름 관리를 위한 훅
 *
 * @module lib/wizard/hooks/useStepBranching
 */

import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import {
  StepBranchingService,
  type StepBranchRule,
  type BranchPath,
  type StepFlowState,
  type StepVisibility,
} from "../services/stepBranching";
import type { UnifiedWizardData, WizardStepDefinition } from "../types";

// ============================================
// 타입 정의
// ============================================

export interface UseStepBranchingOptions<T extends UnifiedWizardData> {
  /** 위저드 단계 정의 */
  steps: WizardStepDefinition[];
  /** 현재 위저드 데이터 */
  data: T;
  /** 초기 분기 규칙 */
  rules?: StepBranchRule<T>[];
  /** 분기 경로 */
  paths?: BranchPath<T>[];
  /** 완료된 단계 ID 목록 */
  completedStepIds?: string[];
  /** 기본 가시성 */
  defaultVisibility?: boolean;
  /** 디버그 모드 */
  debug?: boolean;
  /** 흐름 변경 콜백 */
  onFlowChange?: (flow: StepFlowState) => void;
}

export interface UseStepBranchingResult<T extends UnifiedWizardData> {
  /** 현재 흐름 상태 */
  flow: StepFlowState;
  /** 가시적 단계 목록 */
  visibleSteps: WizardStepDefinition[];
  /** 현재 진행률 (0-100) */
  progress: number;
  /** 특정 단계 가시성 확인 */
  isStepVisible: (stepId: string) => boolean;
  /** 특정 단계 스킵 여부 확인 */
  isStepSkipped: (stepId: string) => boolean;
  /** 특정 단계 필수 여부 확인 */
  isStepRequired: (stepId: string) => boolean;
  /** 특정 단계 접근 가능 여부 확인 */
  isStepAccessible: (stepId: string) => boolean;
  /** 단계 가시성 상세 정보 */
  getStepVisibility: (stepId: string) => StepVisibility | null;
  /** 다음 유효 단계 */
  getNextStep: (currentStepId: string) => string | null;
  /** 이전 유효 단계 */
  getPrevStep: (currentStepId: string) => string | null;
  /** 필수 단계 목록 */
  requiredSteps: string[];
  /** 활성 경로 ID */
  activePathId: string | null;
  /** 분기 규칙 추가 */
  addRule: (rule: StepBranchRule<T>) => void;
  /** 분기 규칙 제거 */
  removeRule: (ruleId: string) => void;
  /** 분기 경로 추가 */
  addPath: (path: BranchPath<T>) => void;
  /** 분기 경로 제거 */
  removePath: (pathId: string) => void;
  /** 흐름 재평가 */
  reevaluate: () => void;
}

// ============================================
// 메인 훅
// ============================================

/**
 * useStepBranching
 *
 * 위저드 단계 분기를 관리하는 훅
 *
 * @example
 * ```tsx
 * function MyWizard() {
 *   const { data, currentStep, goToStep } = useWizard<FullWizardData>();
 *
 *   const {
 *     visibleSteps,
 *     progress,
 *     isStepVisible,
 *     getNextStep,
 *     getPrevStep,
 *   } = useStepBranching({
 *     steps: FULL_MODE_STEPS,
 *     data,
 *     rules: [
 *       // 블록셋이 선택되지 않으면 스케줄 단계 숨김
 *       StepBranchingService.createConditionalRule(
 *         "step-3",
 *         (d) => !!d.basicInfo?.blockSetId,
 *         "show"
 *       ),
 *       // 빠른 생성 모드면 검토 단계 스킵
 *       StepBranchingService.createConditionalRule(
 *         "step-5",
 *         (d) => d.mode === "quick",
 *         "skip"
 *       ),
 *     ],
 *   });
 *
 *   const handleNext = () => {
 *     const nextStepId = getNextStep(currentStep.id);
 *     if (nextStepId) goToStep(nextStepId);
 *   };
 *
 *   return (
 *     <div>
 *       <progress value={progress} max={100} />
 *       {visibleSteps.map(step => (
 *         <StepIndicator
 *           key={step.id}
 *           step={step}
 *           isActive={step.id === currentStep.id}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useStepBranching<T extends UnifiedWizardData>(
  options: UseStepBranchingOptions<T>
): UseStepBranchingResult<T> {
  const {
    steps,
    data,
    rules = [],
    paths = [],
    completedStepIds = [],
    defaultVisibility = true,
    debug = false,
    onFlowChange,
  } = options;

  // 서비스 인스턴스
  const serviceRef = useRef<StepBranchingService<T> | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new StepBranchingService<T>(steps, {
      defaultVisibility,
      debug,
    });

    // 초기 규칙 등록
    for (const rule of rules) {
      serviceRef.current.addRule(rule);
    }

    // 초기 경로 등록
    for (const path of paths) {
      serviceRef.current.addPath(path);
    }
  }
  const service = serviceRef.current;

  // 버전 관리 (규칙/경로 변경 감지)
  const [version, setVersion] = useState(0);

  // 흐름 상태 계산
  const flow = useMemo(() => {
    // version을 의존성에 포함하여 규칙/경로 변경 시 재계산
    void version;
    return service.evaluateFlow(data);
  }, [service, data, version]);

  // 가시적 단계 목록
  const visibleSteps = useMemo(() => {
    return service.getVisibleSteps(data);
  }, [service, data, version]);

  // 진행률 계산
  const progress = useMemo(() => {
    const currentStepId = data.currentStepId;
    return service.calculateProgress(currentStepId, data, completedStepIds);
  }, [service, data, completedStepIds, version]);

  // 흐름 변경 알림
  useEffect(() => {
    onFlowChange?.(flow);
  }, [flow, onFlowChange]);

  // 단계 가시성 확인
  const isStepVisible = useCallback(
    (stepId: string): boolean => {
      const visibility = flow.stepVisibilities.get(stepId);
      return visibility?.visible ?? false;
    },
    [flow]
  );

  // 단계 스킵 확인
  const isStepSkipped = useCallback(
    (stepId: string): boolean => {
      const visibility = flow.stepVisibilities.get(stepId);
      return visibility?.skipped ?? false;
    },
    [flow]
  );

  // 단계 필수 확인
  const isStepRequired = useCallback(
    (stepId: string): boolean => {
      const visibility = flow.stepVisibilities.get(stepId);
      return visibility?.required ?? false;
    },
    [flow]
  );

  // 단계 접근 가능 확인
  const isStepAccessible = useCallback(
    (stepId: string): boolean => {
      return service.isStepAccessible(stepId, data);
    },
    [service, data]
  );

  // 단계 가시성 상세 조회
  const getStepVisibility = useCallback(
    (stepId: string): StepVisibility | null => {
      return flow.stepVisibilities.get(stepId) ?? null;
    },
    [flow]
  );

  // 다음 단계
  const getNextStep = useCallback(
    (currentStepId: string): string | null => {
      return service.getNextVisibleStep(currentStepId, data);
    },
    [service, data]
  );

  // 이전 단계
  const getPrevStep = useCallback(
    (currentStepId: string): string | null => {
      return service.getPrevVisibleStep(currentStepId, data);
    },
    [service, data]
  );

  // 규칙 추가
  const addRule = useCallback(
    (rule: StepBranchRule<T>): void => {
      service.addRule(rule);
      setVersion((v) => v + 1);
    },
    [service]
  );

  // 규칙 제거
  const removeRule = useCallback(
    (ruleId: string): void => {
      service.removeRule(ruleId);
      setVersion((v) => v + 1);
    },
    [service]
  );

  // 경로 추가
  const addPath = useCallback(
    (path: BranchPath<T>): void => {
      service.addPath(path);
      setVersion((v) => v + 1);
    },
    [service]
  );

  // 경로 제거
  const removePath = useCallback(
    (pathId: string): void => {
      service.removePath(pathId);
      setVersion((v) => v + 1);
    },
    [service]
  );

  // 재평가 강제
  const reevaluate = useCallback((): void => {
    setVersion((v) => v + 1);
  }, []);

  return {
    flow,
    visibleSteps,
    progress,
    isStepVisible,
    isStepSkipped,
    isStepRequired,
    isStepAccessible,
    getStepVisibility,
    getNextStep,
    getPrevStep,
    requiredSteps: flow.requiredSteps,
    activePathId: flow.activePath,
    addRule,
    removeRule,
    addPath,
    removePath,
    reevaluate,
  };
}

// ============================================
// 간편 훅들
// ============================================

export interface UseConditionalStepOptions<T extends UnifiedWizardData> {
  /** 단계 ID */
  stepId: string;
  /** 표시 조건 */
  condition: (data: T) => boolean;
  /** 현재 데이터 */
  data: T;
}

/**
 * useConditionalStep
 *
 * 단일 단계의 조건부 표시를 위한 간편 훅
 */
export function useConditionalStep<T extends UnifiedWizardData>(
  options: UseConditionalStepOptions<T>
): {
  visible: boolean;
  reason: string | undefined;
} {
  const { stepId, condition, data } = options;

  const result = useMemo(() => {
    const satisfied = condition(data);
    return {
      visible: satisfied,
      reason: satisfied ? undefined : `조건 미충족 (${stepId})`,
    };
  }, [stepId, condition, data]);

  return result;
}

export interface UseStepDependencyOptions<T extends UnifiedWizardData> {
  /** 현재 단계 ID */
  stepId: string;
  /** 의존하는 단계 ID들 */
  dependsOn: string[];
  /** 완료된 단계 ID 목록 */
  completedSteps: string[];
  /** 현재 데이터 */
  data: T;
}

/**
 * useStepDependency
 *
 * 단계 의존성 확인을 위한 간편 훅
 */
export function useStepDependency<T extends UnifiedWizardData>(
  options: UseStepDependencyOptions<T>
): {
  canAccess: boolean;
  missingDependencies: string[];
} {
  const { dependsOn, completedSteps } = options;

  const result = useMemo(() => {
    const missing = dependsOn.filter((id) => !completedSteps.includes(id));
    return {
      canAccess: missing.length === 0,
      missingDependencies: missing,
    };
  }, [dependsOn, completedSteps]);

  return result;
}
