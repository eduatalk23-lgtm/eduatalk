/**
 * P3 개선: 플랜 생성 단계별 진행률 시스템
 *
 * 플랜 생성 중 각 단계별 진행 상황을 추적하고 사용자에게 제공합니다.
 *
 * @module lib/plan/progress
 */

/**
 * 플랜 생성 단계
 */
export enum PlanGenerationStep {
  /** 초기화 - 데이터 검증 준비 */
  INITIALIZING = "initializing",
  /** 검증 중 - 입력 데이터 유효성 검사 */
  VALIDATING = "validating",
  /** 콘텐츠 로드 중 - 메타데이터 및 소요시간 정보 로드 */
  LOADING_CONTENT = "loading_content",
  /** 스케줄 계산 중 - 날짜/시간 슬롯 계산 */
  CALCULATING_SCHEDULE = "calculating_schedule",
  /** 플랜 생성 중 - 일별 플랜 생성 */
  GENERATING = "generating",
  /** 저장 중 - 데이터베이스 저장 */
  SAVING = "saving",
  /** 완료 */
  COMPLETED = "completed",
  /** 오류 발생 */
  ERROR = "error",
}

/**
 * 각 단계별 메시지
 */
export const STEP_MESSAGES: Record<PlanGenerationStep, string> = {
  [PlanGenerationStep.INITIALIZING]: "플랜 생성을 준비하고 있습니다...",
  [PlanGenerationStep.VALIDATING]: "입력 정보를 검증하고 있습니다...",
  [PlanGenerationStep.LOADING_CONTENT]: "콘텐츠 정보를 불러오고 있습니다...",
  [PlanGenerationStep.CALCULATING_SCHEDULE]: "스케줄을 계산하고 있습니다...",
  [PlanGenerationStep.GENERATING]: "학습 계획을 생성하고 있습니다...",
  [PlanGenerationStep.SAVING]: "생성된 플랜을 저장하고 있습니다...",
  [PlanGenerationStep.COMPLETED]: "플랜 생성이 완료되었습니다!",
  [PlanGenerationStep.ERROR]: "오류가 발생했습니다.",
};

/**
 * 각 단계별 진행률 가중치 (합계 100)
 */
const STEP_WEIGHTS: Record<PlanGenerationStep, number> = {
  [PlanGenerationStep.INITIALIZING]: 5,
  [PlanGenerationStep.VALIDATING]: 10,
  [PlanGenerationStep.LOADING_CONTENT]: 20,
  [PlanGenerationStep.CALCULATING_SCHEDULE]: 25,
  [PlanGenerationStep.GENERATING]: 25,
  [PlanGenerationStep.SAVING]: 15,
  [PlanGenerationStep.COMPLETED]: 0,
  [PlanGenerationStep.ERROR]: 0,
};

/**
 * 단계 순서
 */
const STEP_ORDER: PlanGenerationStep[] = [
  PlanGenerationStep.INITIALIZING,
  PlanGenerationStep.VALIDATING,
  PlanGenerationStep.LOADING_CONTENT,
  PlanGenerationStep.CALCULATING_SCHEDULE,
  PlanGenerationStep.GENERATING,
  PlanGenerationStep.SAVING,
  PlanGenerationStep.COMPLETED,
];

/**
 * 플랜 생성 진행 상태
 */
export interface PlanGenerationProgress {
  /** 현재 단계 */
  currentStep: PlanGenerationStep;
  /** 전체 진행률 (0-100) */
  overallProgress: number;
  /** 현재 단계 내 진행률 (0-100) */
  stepProgress: number;
  /** 사용자에게 표시할 메시지 */
  message: string;
  /** 상세 정보 (선택적) */
  details?: string;
  /** 오류 정보 (오류 발생 시) */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 진행 상태 콜백 타입
 */
export type ProgressCallback = (progress: PlanGenerationProgress) => void;

/**
 * 진행률 추적기 클래스
 */
export class PlanGenerationProgressTracker {
  private currentStep: PlanGenerationStep = PlanGenerationStep.INITIALIZING;
  private stepProgress: number = 0;
  private callback?: ProgressCallback;

  constructor(callback?: ProgressCallback) {
    this.callback = callback;
  }

  /**
   * 진행 상태 업데이트
   */
  update(
    step: PlanGenerationStep,
    stepProgress: number = 0,
    details?: string
  ): void {
    this.currentStep = step;
    this.stepProgress = Math.min(100, Math.max(0, stepProgress));

    if (this.callback) {
      this.callback(this.getProgress(details));
    }
  }

  /**
   * 현재 단계 내 진행률만 업데이트
   */
  updateStepProgress(progress: number, details?: string): void {
    this.stepProgress = Math.min(100, Math.max(0, progress));

    if (this.callback) {
      this.callback(this.getProgress(details));
    }
  }

  /**
   * 다음 단계로 이동
   */
  nextStep(details?: string): void {
    const currentIndex = STEP_ORDER.indexOf(this.currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      this.currentStep = STEP_ORDER[currentIndex + 1];
      this.stepProgress = 0;

      if (this.callback) {
        this.callback(this.getProgress(details));
      }
    }
  }

  /**
   * 오류 상태로 전환
   */
  setError(code: string, message: string): void {
    this.currentStep = PlanGenerationStep.ERROR;
    this.stepProgress = 0;

    if (this.callback) {
      this.callback({
        ...this.getProgress(),
        error: { code, message },
      });
    }
  }

  /**
   * 완료 상태로 전환
   */
  complete(details?: string): void {
    this.currentStep = PlanGenerationStep.COMPLETED;
    this.stepProgress = 100;

    if (this.callback) {
      this.callback(this.getProgress(details));
    }
  }

  /**
   * 현재 진행 상태 조회
   */
  getProgress(details?: string): PlanGenerationProgress {
    return {
      currentStep: this.currentStep,
      overallProgress: this.calculateOverallProgress(),
      stepProgress: this.stepProgress,
      message: STEP_MESSAGES[this.currentStep],
      details,
    };
  }

  /**
   * 전체 진행률 계산
   */
  private calculateOverallProgress(): number {
    if (this.currentStep === PlanGenerationStep.COMPLETED) {
      return 100;
    }

    if (this.currentStep === PlanGenerationStep.ERROR) {
      return this.calculateBaseProgress();
    }

    const baseProgress = this.calculateBaseProgress();
    const currentWeight = STEP_WEIGHTS[this.currentStep] || 0;
    const stepContribution = (currentWeight * this.stepProgress) / 100;

    return Math.round(baseProgress + stepContribution);
  }

  /**
   * 현재 단계 이전까지의 누적 진행률 계산
   */
  private calculateBaseProgress(): number {
    const currentIndex = STEP_ORDER.indexOf(this.currentStep);
    let progress = 0;

    for (let i = 0; i < currentIndex; i++) {
      progress += STEP_WEIGHTS[STEP_ORDER[i]] || 0;
    }

    return progress;
  }
}

/**
 * 진행률 추적기 생성 헬퍼
 */
export function createProgressTracker(
  callback?: ProgressCallback
): PlanGenerationProgressTracker {
  return new PlanGenerationProgressTracker(callback);
}

/**
 * 단계별 예상 소요 시간 (밀리초)
 */
export const ESTIMATED_STEP_DURATION: Record<PlanGenerationStep, number> = {
  [PlanGenerationStep.INITIALIZING]: 500,
  [PlanGenerationStep.VALIDATING]: 1000,
  [PlanGenerationStep.LOADING_CONTENT]: 2000,
  [PlanGenerationStep.CALCULATING_SCHEDULE]: 3000,
  [PlanGenerationStep.GENERATING]: 3000,
  [PlanGenerationStep.SAVING]: 2000,
  [PlanGenerationStep.COMPLETED]: 0,
  [PlanGenerationStep.ERROR]: 0,
};

/**
 * 전체 예상 소요 시간 계산 (밀리초)
 */
export function getEstimatedTotalDuration(): number {
  return Object.values(ESTIMATED_STEP_DURATION).reduce((sum, d) => sum + d, 0);
}
