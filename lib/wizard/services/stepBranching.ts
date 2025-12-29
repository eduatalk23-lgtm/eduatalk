/**
 * Step Branching Service
 *
 * 위저드 단계 분기 로직을 관리하는 서비스
 * 조건부 단계, 동적 흐름, 스킵 로직 지원
 *
 * @module lib/wizard/services/stepBranching
 */

import type { UnifiedWizardData, WizardStepDefinition } from "../types";

// ============================================
// 타입 정의
// ============================================

/**
 * 분기 조건 평가 결과
 */
export interface BranchConditionResult {
  /** 조건 충족 여부 */
  satisfied: boolean;
  /** 조건 미충족 시 사유 */
  reason?: string;
}

/**
 * 단계 분기 규칙
 */
export interface StepBranchRule<T extends UnifiedWizardData = UnifiedWizardData> {
  /** 규칙 ID */
  id: string;
  /** 대상 단계 ID */
  stepId: string;
  /** 조건 함수 */
  condition: (data: T) => BranchConditionResult | boolean;
  /** 조건 충족 시 동작 */
  action: "show" | "hide" | "skip" | "require";
  /** 우선순위 (낮을수록 먼저 평가) */
  priority?: number;
  /** 설명 */
  description?: string;
}

/**
 * 분기 경로 정의
 */
export interface BranchPath<T extends UnifiedWizardData = UnifiedWizardData> {
  /** 경로 ID */
  id: string;
  /** 경로 이름 */
  name: string;
  /** 경로 선택 조건 */
  condition: (data: T) => boolean;
  /** 이 경로에 포함된 단계 ID들 */
  stepIds: string[];
  /** 제외할 단계 ID들 */
  excludeStepIds?: string[];
}

/**
 * 단계 가시성 상태
 */
export interface StepVisibility {
  /** 단계 ID */
  stepId: string;
  /** 표시 여부 */
  visible: boolean;
  /** 스킵 여부 */
  skipped: boolean;
  /** 필수 여부 */
  required: boolean;
  /** 적용된 규칙들 */
  appliedRules: string[];
  /** 숨김/스킵 사유 */
  reason?: string;
}

/**
 * 분기 서비스 설정
 */
export interface StepBranchingConfig {
  /** 기본 가시성 */
  defaultVisibility?: boolean;
  /** 디버그 모드 */
  debug?: boolean;
}

/**
 * 단계 흐름 상태
 */
export interface StepFlowState {
  /** 현재 활성 경로 */
  activePath: string | null;
  /** 가시적 단계들 */
  visibleSteps: string[];
  /** 스킵된 단계들 */
  skippedSteps: string[];
  /** 필수 단계들 */
  requiredSteps: string[];
  /** 전체 단계 가시성 맵 */
  stepVisibilities: Map<string, StepVisibility>;
}

// ============================================
// 클래스 정의
// ============================================

/**
 * StepBranchingService
 *
 * 위저드 단계 분기를 관리하는 서비스
 */
export class StepBranchingService<T extends UnifiedWizardData = UnifiedWizardData> {
  private rules: Map<string, StepBranchRule<T>> = new Map();
  private paths: Map<string, BranchPath<T>> = new Map();
  private steps: WizardStepDefinition[] = [];
  private config: Required<StepBranchingConfig>;

  constructor(
    steps: WizardStepDefinition[],
    config: StepBranchingConfig = {}
  ) {
    this.steps = steps;
    this.config = {
      defaultVisibility: config.defaultVisibility ?? true,
      debug: config.debug ?? false,
    };
  }

  // ============================================
  // 규칙 관리
  // ============================================

  /**
   * 분기 규칙 등록
   */
  addRule(rule: StepBranchRule<T>): void {
    this.rules.set(rule.id, rule);
    this.log(`규칙 등록: ${rule.id} (단계: ${rule.stepId}, 동작: ${rule.action})`);
  }

  /**
   * 여러 규칙 일괄 등록
   */
  addRules(rules: StepBranchRule<T>[]): void {
    for (const rule of rules) {
      this.addRule(rule);
    }
  }

  /**
   * 규칙 제거
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.log(`규칙 제거: ${ruleId}`);
  }

  /**
   * 모든 규칙 제거
   */
  clearRules(): void {
    this.rules.clear();
    this.log("모든 규칙 제거됨");
  }

  // ============================================
  // 경로 관리
  // ============================================

  /**
   * 분기 경로 등록
   */
  addPath(path: BranchPath<T>): void {
    this.paths.set(path.id, path);
    this.log(`경로 등록: ${path.id} (${path.name})`);
  }

  /**
   * 여러 경로 일괄 등록
   */
  addPaths(paths: BranchPath<T>[]): void {
    for (const path of paths) {
      this.addPath(path);
    }
  }

  /**
   * 경로 제거
   */
  removePath(pathId: string): void {
    this.paths.delete(pathId);
    this.log(`경로 제거: ${pathId}`);
  }

  // ============================================
  // 상태 평가
  // ============================================

  /**
   * 현재 데이터 기반 단계 흐름 상태 계산
   */
  evaluateFlow(data: T): StepFlowState {
    const stepVisibilities = new Map<string, StepVisibility>();
    const visibleSteps: string[] = [];
    const skippedSteps: string[] = [];
    const requiredSteps: string[] = [];

    // 활성 경로 결정
    const activePath = this.determineActivePath(data);
    this.log(`활성 경로: ${activePath?.id ?? "없음"}`);

    // 각 단계 가시성 평가
    for (const step of this.steps) {
      const visibility = this.evaluateStepVisibility(step.id, data, activePath);
      stepVisibilities.set(step.id, visibility);

      if (visibility.visible && !visibility.skipped) {
        visibleSteps.push(step.id);
      }
      if (visibility.skipped) {
        skippedSteps.push(step.id);
      }
      if (visibility.required) {
        requiredSteps.push(step.id);
      }
    }

    return {
      activePath: activePath?.id ?? null,
      visibleSteps,
      skippedSteps,
      requiredSteps,
      stepVisibilities,
    };
  }

  /**
   * 특정 단계의 가시성 평가
   */
  evaluateStepVisibility(
    stepId: string,
    data: T,
    activePath?: BranchPath<T> | null
  ): StepVisibility {
    let visible = this.config.defaultVisibility;
    let skipped = false;
    let required = false;
    const appliedRules: string[] = [];
    let reason: string | undefined;

    // 경로 기반 가시성 결정
    if (activePath) {
      if (activePath.stepIds.includes(stepId)) {
        visible = true;
      } else if (activePath.excludeStepIds?.includes(stepId)) {
        visible = false;
        reason = `경로 "${activePath.name}"에서 제외됨`;
      }
    }

    // 규칙 기반 가시성 결정 (우선순위 순)
    const sortedRules = Array.from(this.rules.values())
      .filter((r) => r.stepId === stepId)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    for (const rule of sortedRules) {
      const result = this.evaluateCondition(rule.condition, data);

      if (result.satisfied) {
        appliedRules.push(rule.id);

        switch (rule.action) {
          case "show":
            visible = true;
            break;
          case "hide":
            visible = false;
            reason = result.reason ?? rule.description;
            break;
          case "skip":
            skipped = true;
            reason = result.reason ?? rule.description;
            break;
          case "require":
            required = true;
            break;
        }

        this.log(`규칙 적용: ${rule.id} → ${rule.action} (단계: ${stepId})`);
      }
    }

    return {
      stepId,
      visible,
      skipped,
      required,
      appliedRules,
      reason,
    };
  }

  /**
   * 다음 유효 단계 찾기
   */
  getNextVisibleStep(currentStepId: string, data: T): string | null {
    const flow = this.evaluateFlow(data);
    const currentIndex = flow.visibleSteps.indexOf(currentStepId);

    if (currentIndex === -1 || currentIndex >= flow.visibleSteps.length - 1) {
      return null;
    }

    return flow.visibleSteps[currentIndex + 1];
  }

  /**
   * 이전 유효 단계 찾기
   */
  getPrevVisibleStep(currentStepId: string, data: T): string | null {
    const flow = this.evaluateFlow(data);
    const currentIndex = flow.visibleSteps.indexOf(currentStepId);

    if (currentIndex <= 0) {
      return null;
    }

    return flow.visibleSteps[currentIndex - 1];
  }

  /**
   * 단계가 접근 가능한지 확인
   */
  isStepAccessible(stepId: string, data: T): boolean {
    const flow = this.evaluateFlow(data);
    return flow.visibleSteps.includes(stepId);
  }

  /**
   * 완료해야 할 필수 단계 목록
   */
  getRequiredSteps(data: T): string[] {
    const flow = this.evaluateFlow(data);
    return flow.requiredSteps;
  }

  /**
   * 현재 진행률 계산 (0-100)
   */
  calculateProgress(
    currentStepId: string,
    data: T,
    completedStepIds: string[] = []
  ): number {
    const flow = this.evaluateFlow(data);
    const totalSteps = flow.visibleSteps.length;

    if (totalSteps === 0) return 0;

    // 현재 단계까지의 진행률
    const currentIndex = flow.visibleSteps.indexOf(currentStepId);
    if (currentIndex === -1) return 0;

    // 완료된 단계 수 계산
    const completedCount = flow.visibleSteps.filter(
      (stepId) =>
        completedStepIds.includes(stepId) ||
        flow.visibleSteps.indexOf(stepId) < currentIndex
    ).length;

    return Math.round((completedCount / totalSteps) * 100);
  }

  /**
   * 유효 단계 목록 반환 (순서 유지)
   */
  getVisibleSteps(data: T): WizardStepDefinition[] {
    const flow = this.evaluateFlow(data);
    return this.steps.filter((step) => flow.visibleSteps.includes(step.id));
  }

  // ============================================
  // 편의 메서드
  // ============================================

  /**
   * 조건부 단계 규칙 생성 헬퍼
   */
  static createConditionalRule<T extends UnifiedWizardData>(
    stepId: string,
    condition: (data: T) => boolean,
    action: StepBranchRule<T>["action"] = "show",
    options: Partial<StepBranchRule<T>> = {}
  ): StepBranchRule<T> {
    return {
      id: options.id ?? `${stepId}-${action}-${Date.now()}`,
      stepId,
      condition,
      action,
      priority: options.priority,
      description: options.description,
    };
  }

  /**
   * 필드 기반 규칙 생성 헬퍼
   */
  static createFieldBasedRule<T extends UnifiedWizardData>(
    stepId: string,
    fieldPath: string,
    expectedValue: unknown,
    action: StepBranchRule<T>["action"] = "show",
    options: Partial<StepBranchRule<T>> = {}
  ): StepBranchRule<T> {
    return {
      id: options.id ?? `${stepId}-field-${fieldPath}`,
      stepId,
      condition: (data: T) => {
        const value = getNestedValue(data, fieldPath);
        return value === expectedValue;
      },
      action,
      priority: options.priority,
      description:
        options.description ?? `${fieldPath} === ${String(expectedValue)}`,
    };
  }

  /**
   * 다중 조건 규칙 생성 헬퍼
   */
  static createMultiConditionRule<T extends UnifiedWizardData>(
    stepId: string,
    conditions: Array<{
      check: (data: T) => boolean;
      reason?: string;
    }>,
    operator: "and" | "or",
    action: StepBranchRule<T>["action"] = "show",
    options: Partial<StepBranchRule<T>> = {}
  ): StepBranchRule<T> {
    return {
      id: options.id ?? `${stepId}-multi-${operator}`,
      stepId,
      condition: (data: T) => {
        const results = conditions.map((c) => ({
          satisfied: c.check(data),
          reason: c.reason,
        }));

        if (operator === "and") {
          const allSatisfied = results.every((r) => r.satisfied);
          const failedReason = results.find((r) => !r.satisfied)?.reason;
          return { satisfied: allSatisfied, reason: failedReason };
        } else {
          const anySatisfied = results.some((r) => r.satisfied);
          const satisfiedReason = results.find((r) => r.satisfied)?.reason;
          return { satisfied: anySatisfied, reason: satisfiedReason };
        }
      },
      action,
      priority: options.priority,
      description: options.description,
    };
  }

  // ============================================
  // Private 메서드
  // ============================================

  private determineActivePath(data: T): BranchPath<T> | null {
    for (const path of this.paths.values()) {
      if (path.condition(data)) {
        return path;
      }
    }
    return null;
  }

  private evaluateCondition(
    condition: StepBranchRule<T>["condition"],
    data: T
  ): BranchConditionResult {
    const result = condition(data);

    if (typeof result === "boolean") {
      return { satisfied: result };
    }

    return result;
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[StepBranching] ${message}`);
    }
  }
}

// ============================================
// 유틸리티 함수
// ============================================

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ============================================
// 사전 정의된 규칙 팩토리
// ============================================

/**
 * 모드 기반 규칙 생성
 */
export function createModeBasedRules<T extends UnifiedWizardData>(
  modeStepMap: Record<string, string[]>
): StepBranchRule<T>[] {
  const rules: StepBranchRule<T>[] = [];

  for (const [mode, stepIds] of Object.entries(modeStepMap)) {
    for (const stepId of stepIds) {
      rules.push({
        id: `mode-${mode}-${stepId}`,
        stepId,
        condition: (data) => data.mode === mode,
        action: "show",
        priority: 0,
        description: `모드 "${mode}"에서 표시`,
      });
    }
  }

  return rules;
}

/**
 * 선택적 단계 규칙 생성
 */
export function createOptionalStepRule<T extends UnifiedWizardData>(
  stepId: string,
  enabledField: string,
  options: Partial<StepBranchRule<T>> = {}
): StepBranchRule<T> {
  return {
    id: options.id ?? `optional-${stepId}`,
    stepId,
    condition: (data) => {
      const enabled = getNestedValue(data, enabledField);
      return !enabled;
    },
    action: "skip",
    priority: options.priority ?? 10,
    description: options.description ?? `${enabledField}가 비활성화되면 스킵`,
  };
}

/**
 * 의존성 기반 규칙 생성
 */
export function createDependencyRule<T extends UnifiedWizardData>(
  stepId: string,
  dependsOnStepId: string,
  completedStepsField: string,
  options: Partial<StepBranchRule<T>> = {}
): StepBranchRule<T> {
  return {
    id: options.id ?? `dep-${stepId}-on-${dependsOnStepId}`,
    stepId,
    condition: (data) => {
      const completedSteps = getNestedValue(data, completedStepsField) as
        | string[]
        | undefined;
      if (!completedSteps) return false;
      return !completedSteps.includes(dependsOnStepId);
    },
    action: "hide",
    priority: options.priority ?? 5,
    description: options.description ?? `${dependsOnStepId} 완료 후 표시`,
  };
}
