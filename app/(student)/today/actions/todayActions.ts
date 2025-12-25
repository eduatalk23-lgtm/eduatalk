/**
 * todayActions.ts - 오늘 학습 타이머 관련 Server Actions
 *
 * 이 파일은 lib/domains/today의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/today에서 직접 import 사용을 권장합니다.
 */

export type { PlanRecordPayload } from "@/lib/domains/today";

export {
  startPlan,
  completePlan,
  postponePlan,
  startTimer,
  endTimer,
  pausePlan,
  resumePlan,
  preparePlanCompletion,
} from "@/lib/domains/today";
