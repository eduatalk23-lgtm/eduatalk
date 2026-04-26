// ============================================
// resolveMidPlan — ctx.midPlan ?? ctx.results["_midPlan"] 폴백 헬퍼
//
// Phase 분할 실행 시 P3.5(MidPlanner)와 P4~P9/S3/S5/S6/S7 가 별 HTTP 요청일 수 있어
// ctx.midPlan 이 없을 때 task_results["_midPlan"] 에서 복원한다.
//
// 소비처: pipeline-task-runners-guide, pipeline-task-runners-draft-analysis,
//         pipeline-task-runners-draft-refinement, phase-s3/s5/s6/s7
// ============================================

import type { PipelineContext } from "../pipeline-types";
import type { MidPlan } from "./mid-pipeline-planner";

/**
 * PipelineContext 에서 MidPlan 을 해소한다.
 *
 * ctx.midPlan 을 우선 사용하고, 없으면 ctx.results["_midPlan"] 에서 복원.
 * 두 경로 모두 없으면 null 반환.
 */
export function resolveMidPlan(ctx: PipelineContext): MidPlan | null {
  return ctx.midPlan ?? ((ctx.results["_midPlan"] as MidPlan | null | undefined) ?? null);
}
