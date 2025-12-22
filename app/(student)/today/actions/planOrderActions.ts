/**
 * planOrderActions.ts - 플랜 순서 관련 Server Actions
 *
 * 이 파일은 lib/domains/today의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/today에서 직접 import 사용을 권장합니다.
 */

export type { PlanOrderUpdate } from "@/lib/domains/today";

export { updatePlanOrder } from "@/lib/domains/today";
