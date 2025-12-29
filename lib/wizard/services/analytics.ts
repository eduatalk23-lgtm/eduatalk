/**
 * Wizard Analytics Service
 *
 * 위저드 사용 분석을 위한 서비스
 * 단계별 시간 추적, 사용자 행동 분석, 이벤트 수집 지원
 *
 * @module lib/wizard/services/analytics
 */

import type { UnifiedWizardData, WizardMode } from "../types";

// ============================================
// 타입 정의
// ============================================

/**
 * 분석 이벤트 타입
 */
export type AnalyticsEventType =
  | "wizard_started"
  | "wizard_completed"
  | "wizard_abandoned"
  | "step_entered"
  | "step_exited"
  | "step_completed"
  | "step_skipped"
  | "navigation_next"
  | "navigation_prev"
  | "navigation_jump"
  | "validation_error"
  | "validation_success"
  | "draft_saved"
  | "draft_restored"
  | "custom";

/**
 * 분석 이벤트
 */
export interface AnalyticsEvent {
  /** 이벤트 ID */
  id: string;
  /** 이벤트 타입 */
  type: AnalyticsEventType;
  /** 위저드 모드 */
  wizardMode: WizardMode;
  /** 세션 ID */
  sessionId: string;
  /** 현재 단계 ID */
  stepId?: string;
  /** 타임스탬프 */
  timestamp: number;
  /** 추가 데이터 */
  data?: Record<string, unknown>;
  /** 사용자 ID */
  userId?: string;
}

/**
 * 단계 타이밍 정보
 */
export interface StepTiming {
  /** 단계 ID */
  stepId: string;
  /** 진입 시간 */
  enteredAt: number;
  /** 종료 시간 */
  exitedAt?: number;
  /** 체류 시간 (ms) */
  duration?: number;
  /** 완료 여부 */
  completed: boolean;
  /** 방문 횟수 */
  visitCount: number;
}

/**
 * 검증 에러 정보
 */
export interface ValidationErrorInfo {
  /** 단계 ID */
  stepId: string;
  /** 필드 경로 */
  fieldPath: string;
  /** 에러 메시지 */
  message: string;
  /** 발생 횟수 */
  count: number;
  /** 첫 발생 시간 */
  firstOccurredAt: number;
  /** 마지막 발생 시간 */
  lastOccurredAt: number;
}

/**
 * 네비게이션 흐름
 */
export interface NavigationFlow {
  /** 출발 단계 */
  fromStepId: string;
  /** 도착 단계 */
  toStepId: string;
  /** 이동 횟수 */
  count: number;
  /** 평균 소요 시간 */
  avgDuration: number;
}

/**
 * 세션 요약
 */
export interface SessionSummary {
  /** 세션 ID */
  sessionId: string;
  /** 위저드 모드 */
  wizardMode: WizardMode;
  /** 시작 시간 */
  startedAt: number;
  /** 종료 시간 */
  endedAt?: number;
  /** 총 소요 시간 */
  totalDuration?: number;
  /** 완료 여부 */
  completed: boolean;
  /** 방문한 단계 수 */
  stepsVisited: number;
  /** 완료한 단계 수 */
  stepsCompleted: number;
  /** 총 검증 에러 수 */
  validationErrors: number;
  /** 드래프트 저장 횟수 */
  draftSaves: number;
  /** 사용자 ID */
  userId?: string;
}

/**
 * 분석 설정
 */
export interface AnalyticsConfig {
  /** 이벤트 수집 활성화 */
  enabled?: boolean;
  /** 디버그 모드 */
  debug?: boolean;
  /** 최대 이벤트 보관 수 */
  maxEvents?: number;
  /** 이벤트 전송 함수 */
  sendEvent?: (event: AnalyticsEvent) => Promise<void>;
  /** 배치 전송 활성화 */
  batchMode?: boolean;
  /** 배치 크기 */
  batchSize?: number;
  /** 배치 전송 간격 (ms) */
  batchInterval?: number;
  /** 사용자 식별 함수 */
  getUserId?: () => string | undefined;
}

// ============================================
// 상수
// ============================================

const DEFAULT_MAX_EVENTS = 1000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BATCH_INTERVAL = 5000;

// ============================================
// 유틸리티 함수
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// 클래스 정의
// ============================================

/**
 * WizardAnalyticsService
 *
 * 위저드 사용 분석을 수집하고 관리하는 서비스
 */
export class WizardAnalyticsService {
  private events: AnalyticsEvent[] = [];
  private stepTimings: Map<string, StepTiming> = new Map();
  private validationErrors: Map<string, ValidationErrorInfo> = new Map();
  private navigationFlows: Map<string, NavigationFlow> = new Map();
  private config: Required<AnalyticsConfig>;
  private sessionId: string;
  private wizardMode: WizardMode | null = null;
  private startedAt: number | null = null;
  private currentStepId: string | null = null;
  private batchQueue: AnalyticsEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private isCompleted = false;

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      debug: config.debug ?? false,
      maxEvents: config.maxEvents ?? DEFAULT_MAX_EVENTS,
      sendEvent: config.sendEvent ?? (async () => {}),
      batchMode: config.batchMode ?? false,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      batchInterval: config.batchInterval ?? DEFAULT_BATCH_INTERVAL,
      getUserId: config.getUserId ?? (() => undefined),
    };
    this.sessionId = generateSessionId();
  }

  // ============================================
  // 세션 관리
  // ============================================

  /**
   * 위저드 시작
   */
  startWizard(mode: WizardMode, initialStepId: string): void {
    this.wizardMode = mode;
    this.startedAt = Date.now();
    this.currentStepId = initialStepId;
    this.isCompleted = false;

    this.trackEvent("wizard_started", {
      initialStepId,
    });

    this.enterStep(initialStepId);
  }

  /**
   * 위저드 완료
   */
  completeWizard(finalData?: Record<string, unknown>): void {
    if (this.currentStepId) {
      this.exitStep(this.currentStepId, true);
    }

    this.isCompleted = true;

    this.trackEvent("wizard_completed", {
      totalDuration: this.startedAt ? Date.now() - this.startedAt : 0,
      stepsCompleted: this.getCompletedStepsCount(),
      ...finalData,
    });

    this.flushBatch();
  }

  /**
   * 위저드 포기
   */
  abandonWizard(reason?: string): void {
    if (this.currentStepId) {
      this.exitStep(this.currentStepId, false);
    }

    this.trackEvent("wizard_abandoned", {
      lastStepId: this.currentStepId,
      totalDuration: this.startedAt ? Date.now() - this.startedAt : 0,
      stepsCompleted: this.getCompletedStepsCount(),
      reason,
    });

    this.flushBatch();
  }

  /**
   * 새 세션 시작
   */
  resetSession(): void {
    this.sessionId = generateSessionId();
    this.events = [];
    this.stepTimings.clear();
    this.validationErrors.clear();
    this.navigationFlows.clear();
    this.startedAt = null;
    this.currentStepId = null;
    this.isCompleted = false;
  }

  // ============================================
  // 단계 추적
  // ============================================

  /**
   * 단계 진입
   */
  enterStep(stepId: string): void {
    const now = Date.now();

    // 기존 단계 종료
    if (this.currentStepId && this.currentStepId !== stepId) {
      this.exitStep(this.currentStepId, false);
    }

    // 타이밍 업데이트
    const existing = this.stepTimings.get(stepId);
    if (existing) {
      existing.enteredAt = now;
      existing.visitCount++;
    } else {
      this.stepTimings.set(stepId, {
        stepId,
        enteredAt: now,
        completed: false,
        visitCount: 1,
      });
    }

    this.currentStepId = stepId;

    this.trackEvent("step_entered", { stepId });
  }

  /**
   * 단계 종료
   */
  exitStep(stepId: string, completed: boolean): void {
    const timing = this.stepTimings.get(stepId);
    if (!timing) return;

    const now = Date.now();
    timing.exitedAt = now;
    timing.duration = now - timing.enteredAt;
    if (completed) {
      timing.completed = true;
    }

    this.trackEvent("step_exited", {
      stepId,
      duration: timing.duration,
      completed,
    });

    if (completed) {
      this.trackEvent("step_completed", { stepId });
    }
  }

  /**
   * 단계 스킵
   */
  skipStep(stepId: string, reason?: string): void {
    this.trackEvent("step_skipped", { stepId, reason });
  }

  // ============================================
  // 네비게이션 추적
  // ============================================

  /**
   * 다음 단계 이동
   */
  navigateNext(fromStepId: string, toStepId: string): void {
    this.recordNavigation(fromStepId, toStepId);
    this.trackEvent("navigation_next", { fromStepId, toStepId });
    this.enterStep(toStepId);
  }

  /**
   * 이전 단계 이동
   */
  navigatePrev(fromStepId: string, toStepId: string): void {
    this.recordNavigation(fromStepId, toStepId);
    this.trackEvent("navigation_prev", { fromStepId, toStepId });
    this.enterStep(toStepId);
  }

  /**
   * 특정 단계로 점프
   */
  navigateJump(fromStepId: string, toStepId: string): void {
    this.recordNavigation(fromStepId, toStepId);
    this.trackEvent("navigation_jump", { fromStepId, toStepId });
    this.enterStep(toStepId);
  }

  // ============================================
  // 검증 추적
  // ============================================

  /**
   * 검증 에러 기록
   */
  recordValidationError(
    stepId: string,
    fieldPath: string,
    message: string
  ): void {
    const key = `${stepId}:${fieldPath}`;
    const now = Date.now();

    const existing = this.validationErrors.get(key);
    if (existing) {
      existing.count++;
      existing.lastOccurredAt = now;
    } else {
      this.validationErrors.set(key, {
        stepId,
        fieldPath,
        message,
        count: 1,
        firstOccurredAt: now,
        lastOccurredAt: now,
      });
    }

    this.trackEvent("validation_error", { stepId, fieldPath, message });
  }

  /**
   * 검증 성공 기록
   */
  recordValidationSuccess(stepId: string): void {
    this.trackEvent("validation_success", { stepId });
  }

  // ============================================
  // 드래프트 추적
  // ============================================

  /**
   * 드래프트 저장 기록
   */
  recordDraftSave(draftId: string): void {
    this.trackEvent("draft_saved", { draftId });
  }

  /**
   * 드래프트 복원 기록
   */
  recordDraftRestore(draftId: string): void {
    this.trackEvent("draft_restored", { draftId });
  }

  // ============================================
  // 커스텀 이벤트
  // ============================================

  /**
   * 커스텀 이벤트 기록
   */
  trackCustomEvent(name: string, data?: Record<string, unknown>): void {
    this.trackEvent("custom", { eventName: name, ...data });
  }

  // ============================================
  // 분석 데이터 조회
  // ============================================

  /**
   * 모든 이벤트 조회
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * 특정 타입의 이벤트만 조회
   */
  getEventsByType(type: AnalyticsEventType): AnalyticsEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * 단계별 타이밍 정보
   */
  getStepTimings(): StepTiming[] {
    return Array.from(this.stepTimings.values());
  }

  /**
   * 특정 단계의 타이밍 정보
   */
  getStepTiming(stepId: string): StepTiming | null {
    return this.stepTimings.get(stepId) ?? null;
  }

  /**
   * 검증 에러 목록
   */
  getValidationErrors(): ValidationErrorInfo[] {
    return Array.from(this.validationErrors.values());
  }

  /**
   * 네비게이션 흐름
   */
  getNavigationFlows(): NavigationFlow[] {
    return Array.from(this.navigationFlows.values());
  }

  /**
   * 세션 요약
   */
  getSessionSummary(): SessionSummary {
    const now = Date.now();
    const totalDuration = this.startedAt ? now - this.startedAt : undefined;

    return {
      sessionId: this.sessionId,
      wizardMode: this.wizardMode ?? ("full" as WizardMode),
      startedAt: this.startedAt ?? now,
      endedAt: this.isCompleted ? now : undefined,
      totalDuration,
      completed: this.isCompleted,
      stepsVisited: this.stepTimings.size,
      stepsCompleted: this.getCompletedStepsCount(),
      validationErrors: this.getTotalValidationErrorCount(),
      draftSaves: this.getEventsByType("draft_saved").length,
      userId: this.config.getUserId(),
    };
  }

  /**
   * 평균 단계 소요 시간
   */
  getAverageStepDuration(): number {
    const timings = this.getStepTimings().filter((t) => t.duration);
    if (timings.length === 0) return 0;

    const total = timings.reduce((sum, t) => sum + (t.duration ?? 0), 0);
    return Math.round(total / timings.length);
  }

  /**
   * 가장 오래 머문 단계
   */
  getLongestStep(): StepTiming | null {
    let longest: StepTiming | null = null;

    for (const timing of this.stepTimings.values()) {
      if (timing.duration && (!longest || timing.duration > (longest.duration ?? 0))) {
        longest = timing;
      }
    }

    return longest;
  }

  /**
   * 가장 많은 에러가 발생한 필드
   */
  getMostErrorProneField(): ValidationErrorInfo | null {
    let most: ValidationErrorInfo | null = null;

    for (const error of this.validationErrors.values()) {
      if (!most || error.count > most.count) {
        most = error;
      }
    }

    return most;
  }

  // ============================================
  // 리소스 정리
  // ============================================

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.flushBatch();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.events = [];
    this.stepTimings.clear();
    this.validationErrors.clear();
    this.navigationFlows.clear();
  }

  // ============================================
  // Private 메서드
  // ============================================

  private trackEvent(
    type: AnalyticsEventType,
    data?: Record<string, unknown>
  ): void {
    if (!this.config.enabled) return;

    const event: AnalyticsEvent = {
      id: generateId(),
      type,
      wizardMode: this.wizardMode ?? ("full" as WizardMode),
      sessionId: this.sessionId,
      stepId: this.currentStepId ?? undefined,
      timestamp: Date.now(),
      data,
      userId: this.config.getUserId(),
    };

    // 이벤트 저장 (최대 개수 제한)
    this.events.push(event);
    if (this.events.length > this.config.maxEvents) {
      this.events.shift();
    }

    this.log(`이벤트: ${type}`, data);

    // 전송
    if (this.config.batchMode) {
      this.addToBatch(event);
    } else {
      this.sendEvent(event);
    }
  }

  private recordNavigation(fromStepId: string, toStepId: string): void {
    const key = `${fromStepId}->${toStepId}`;
    const timing = this.stepTimings.get(fromStepId);
    const duration = timing?.duration ?? 0;

    const existing = this.navigationFlows.get(key);
    if (existing) {
      existing.count++;
      existing.avgDuration =
        (existing.avgDuration * (existing.count - 1) + duration) /
        existing.count;
    } else {
      this.navigationFlows.set(key, {
        fromStepId,
        toStepId,
        count: 1,
        avgDuration: duration,
      });
    }

    // 이전 단계 종료 처리
    if (timing) {
      this.exitStep(fromStepId, false);
    }
  }

  private getCompletedStepsCount(): number {
    let count = 0;
    for (const timing of this.stepTimings.values()) {
      if (timing.completed) count++;
    }
    return count;
  }

  private getTotalValidationErrorCount(): number {
    let total = 0;
    for (const error of this.validationErrors.values()) {
      total += error.count;
    }
    return total;
  }

  private addToBatch(event: AnalyticsEvent): void {
    this.batchQueue.push(event);

    if (this.batchQueue.length >= this.config.batchSize) {
      this.flushBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.config.batchInterval);
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    for (const event of batch) {
      await this.sendEvent(event);
    }
  }

  private async sendEvent(event: AnalyticsEvent): Promise<void> {
    try {
      await this.config.sendEvent(event);
    } catch (error) {
      this.log("이벤트 전송 실패:", error);
    }
  }

  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[WizardAnalytics] ${message}`, data ?? "");
    }
  }
}

// ============================================
// 기본 인스턴스
// ============================================

/**
 * 기본 위저드 분석 서비스 인스턴스
 */
export const wizardAnalytics = new WizardAnalyticsService();
