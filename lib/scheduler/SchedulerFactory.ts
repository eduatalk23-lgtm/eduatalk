/**
 * 스케줄러 Factory
 *
 * 스케줄러 선택 및 실행을 위한 Factory 패턴 구현입니다.
 * switch문 대신 Registry 패턴을 사용하여 확장성을 높입니다.
 *
 * @module lib/scheduler/SchedulerFactory
 */

import type { IScheduler, SchedulerInput, SchedulerOutput } from "./types";
import { Timetable1730Scheduler, DefaultScheduler } from "./schedulers";

// ============================================
// Scheduler Registry
// ============================================

/**
 * 스케줄러 레지스트리
 *
 * 순서가 중요합니다:
 * - 구체적인 스케줄러가 먼저 오고
 * - DefaultScheduler가 마지막 (catch-all fallback)
 */
const schedulerRegistry: IScheduler[] = [
  Timetable1730Scheduler,
  DefaultScheduler, // 항상 마지막 - 다른 스케줄러가 처리하지 않은 모든 타입 처리
];

// ============================================
// Factory Functions
// ============================================

/**
 * 주어진 스케줄러 타입을 처리할 수 있는 스케줄러 반환
 *
 * @param schedulerType - 스케줄러 타입
 * @returns 해당 타입을 처리할 수 있는 스케줄러
 */
export function getScheduler(
  schedulerType: string | null | undefined
): IScheduler {
  for (const scheduler of schedulerRegistry) {
    if (scheduler.canHandle(schedulerType)) {
      return scheduler;
    }
  }

  // DefaultScheduler의 canHandle이 catch-all이므로 여기에 도달하면 안 됨
  // 안전을 위해 DefaultScheduler 반환
  return DefaultScheduler;
}

/**
 * 스케줄러를 사용하여 플랜 생성
 *
 * 기존 switch문을 대체하는 메인 진입점입니다.
 *
 * @param schedulerType - 사용할 스케줄러 타입
 * @param input - 스케줄러 입력 데이터
 * @returns 생성된 플랜과 실패 원인
 *
 * @example
 * ```typescript
 * const result = generateScheduledPlans("1730_timetable", {
 *   availableDates,
 *   contentInfos,
 *   blocks,
 *   // ... other inputs
 * });
 *
 * console.log(result.plans);
 * console.log(result.failureReasons);
 * ```
 */
export function generateScheduledPlans(
  schedulerType: string | null | undefined,
  input: SchedulerInput
): SchedulerOutput {
  const scheduler = getScheduler(schedulerType);
  return scheduler.generate(input);
}

// ============================================
// Registry Management (for extensibility/testing)
// ============================================

/**
 * 새로운 스케줄러 등록
 *
 * 테스트나 플러그인 확장을 위해 런타임에 스케줄러를 추가합니다.
 * DefaultScheduler 앞에 삽입됩니다.
 *
 * @param scheduler - 등록할 스케줄러
 * @param priority - 삽입 위치 (기본: DefaultScheduler 앞)
 */
export function registerScheduler(
  scheduler: IScheduler,
  priority?: number
): void {
  // 기본값: DefaultScheduler 바로 앞에 삽입
  const index = priority ?? schedulerRegistry.length - 1;
  schedulerRegistry.splice(index, 0, scheduler);
}

/**
 * 등록된 모든 스케줄러 타입 반환
 *
 * @returns 등록된 스케줄러 타입 목록
 */
export function getRegisteredSchedulerTypes(): (string | null)[] {
  return schedulerRegistry.map((s) => s.type);
}

/**
 * 스케줄러 레지스트리 초기화 (테스트용)
 *
 * @internal 테스트에서만 사용
 */
export function resetSchedulerRegistry(): void {
  schedulerRegistry.length = 0;
  schedulerRegistry.push(Timetable1730Scheduler, DefaultScheduler);
}
