"use client";

/**
 * P3 개선: 플랜 생성 진행률 React 훅
 *
 * 플랜 생성 중 진행 상태를 관리하고 UI에 반영합니다.
 *
 * @module lib/hooks/usePlanGenerationProgress
 */

import { useState, useCallback, useRef } from "react";
import {
  PlanGenerationStep,
  PlanGenerationProgress,
  PlanGenerationProgressTracker,
  STEP_MESSAGES,
} from "@/lib/plan/progress";

/**
 * 플랜 생성 진행률 훅 반환 타입
 */
export interface UsePlanGenerationProgressReturn {
  /** 현재 진행 상태 */
  progress: PlanGenerationProgress;
  /** 진행 중 여부 */
  isInProgress: boolean;
  /** 완료 여부 */
  isCompleted: boolean;
  /** 오류 발생 여부 */
  hasError: boolean;
  /** 진행률 추적기 */
  tracker: PlanGenerationProgressTracker;
  /** 진행 시작 */
  start: () => void;
  /** 진행 초기화 */
  reset: () => void;
}

/**
 * 초기 진행 상태
 */
const INITIAL_PROGRESS: PlanGenerationProgress = {
  currentStep: PlanGenerationStep.INITIALIZING,
  overallProgress: 0,
  stepProgress: 0,
  message: STEP_MESSAGES[PlanGenerationStep.INITIALIZING],
};

/**
 * 플랜 생성 진행률 관리 훅
 *
 * @example
 * ```tsx
 * function PlanGenerator() {
 *   const { progress, isInProgress, tracker, start, reset } = usePlanGenerationProgress();
 *
 *   const handleGenerate = async () => {
 *     start();
 *     try {
 *       tracker.update(PlanGenerationStep.VALIDATING, 0);
 *       await validateInputs();
 *       tracker.update(PlanGenerationStep.VALIDATING, 100);
 *
 *       tracker.nextStep();
 *       await loadContents();
 *       // ...
 *
 *       tracker.complete();
 *     } catch (error) {
 *       tracker.setError('GENERATION_FAILED', error.message);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <ProgressBar value={progress.overallProgress} />
 *       <p>{progress.message}</p>
 *       {isInProgress && <Spinner />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlanGenerationProgress(): UsePlanGenerationProgressReturn {
  const [progress, setProgress] = useState<PlanGenerationProgress>(INITIAL_PROGRESS);

  const trackerRef = useRef<PlanGenerationProgressTracker | null>(null);

  // 진행 상태 콜백
  const handleProgressUpdate = useCallback((newProgress: PlanGenerationProgress) => {
    setProgress(newProgress);
  }, []);

  // 트래커 초기화 (lazy)
  if (!trackerRef.current) {
    trackerRef.current = new PlanGenerationProgressTracker(handleProgressUpdate);
  }

  const start = useCallback(() => {
    trackerRef.current?.update(PlanGenerationStep.INITIALIZING, 0);
  }, []);

  const reset = useCallback(() => {
    setProgress(INITIAL_PROGRESS);
    trackerRef.current = new PlanGenerationProgressTracker(handleProgressUpdate);
  }, [handleProgressUpdate]);

  const isInProgress =
    progress.currentStep !== PlanGenerationStep.COMPLETED &&
    progress.currentStep !== PlanGenerationStep.ERROR &&
    progress.currentStep !== PlanGenerationStep.INITIALIZING;

  const isCompleted = progress.currentStep === PlanGenerationStep.COMPLETED;
  const hasError = progress.currentStep === PlanGenerationStep.ERROR;

  return {
    progress,
    isInProgress,
    isCompleted,
    hasError,
    tracker: trackerRef.current,
    start,
    reset,
  };
}
