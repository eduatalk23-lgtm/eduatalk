// ============================================
// Grade Pipeline Phase Executor (학년별 파이프라인)
// GradePhase 1: competency_setek
// GradePhase 2: competency_changche
// GradePhase 3: competency_haengteuk (+ 집계)
// GradePhase 4: setek_guide + slot_generation (병렬)
// GradePhase 5: changche_guide
// GradePhase 6: haengteuk_guide → 최종 상태
// ============================================

import type { PipelineContext } from "./pipeline-types";
import { GRADE_PIPELINE_TASK_KEYS } from "./pipeline-types";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import {
  runTaskWithState,
  checkCancelled,
  updatePipelineState,
} from "./pipeline-executor";
import {
  runCompetencySetekForGrade,
  runCompetencySetekChunkForGrade,
  runCompetencyChangcheForGrade,
  runCompetencyChangcheChunkForGrade,
  runCompetencyHaengteukForGrade,
  runCompetencyHaengteukChunkForGrade,
  runSetekGuideForGrade,
  runSlotGenerationForGrade,
  runChangcheGuideForGrade,
  runHaengteukGuideForGrade,
} from "./pipeline-task-runners";

// ============================================
// 청크 실행 결과 타입
// ============================================

export interface PhaseChunkResult {
  completed: boolean;
  hasMore: boolean;
  chunkProcessed: number;
  totalUncached: number;
}

// ============================================
// Grade Phase 1: 세특 역량 분석 (청크 지원)
// ============================================

export async function executeGradePhase1(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<PhaseChunkResult> {
  // 이미 완료
  if (ctx.tasks["competency_setek"] === "completed") {
    return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  if (chunkOpts?.chunkSize != null) {
    // ── 청크 경로: runTaskWithState 우회, 상태 직접 관리 ──
    const startMs = Date.now();

    // 첫 청크이면 running 마킹
    if (ctx.tasks["competency_setek"] !== "running") {
      ctx.tasks["competency_setek"] = "running";
      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId, "running",
        ctx.tasks, ctx.previews, ctx.results, ctx.errors,
      );
    }

    try {
      const result = await runCompetencySetekChunkForGrade(ctx, chunkOpts.chunkSize);

      if (!result.hasMore) {
        // 마지막 청크 — completed 마킹
        ctx.tasks["competency_setek"] = "completed";
        ctx.previews["competency_setek"] = result.preview;
        ctx.results["competency_setek"] = {
          ...(typeof result.result === "object" && result.result != null ? result.result as Record<string, unknown> : {}),
          elapsedMs: Date.now() - startMs,
        };
      } else {
        // 중간 청크 — preview만 업데이트
        ctx.previews["competency_setek"] = result.preview;
      }

      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId, "running",
        ctx.tasks, ctx.previews, ctx.results, ctx.errors,
      );

      return {
        completed: !result.hasMore,
        hasMore: result.hasMore,
        chunkProcessed: result.chunkProcessed,
        totalUncached: result.totalUncached,
      };
    } catch (err) {
      ctx.tasks["competency_setek"] = "failed";
      const msg = err instanceof Error ? err.message : String(err);
      ctx.errors["competency_setek"] = msg;
      ctx.results["competency_setek"] = { elapsedMs: Date.now() - startMs };
      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId, "running",
        ctx.tasks, ctx.previews, ctx.results, ctx.errors,
      );
      return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
    }
  }

  // ── 기존 경로 (청크 미사용) ──
  await runTaskWithState(ctx, "competency_setek", () =>
    runCompetencySetekForGrade(ctx),
  );
  return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
}

// ============================================
// Grade Phase 2: 창체 역량 분석 (청크 지원)
// ============================================

export async function executeGradePhase2(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };

  if (ctx.tasks["competency_changche"] === "completed") {
    return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  if (chunkOpts?.chunkSize != null) {
    const startMs = Date.now();
    if (ctx.tasks["competency_changche"] !== "running") {
      ctx.tasks["competency_changche"] = "running";
      await updatePipelineState(ctx.supabase as SupabaseAdminClient, ctx.pipelineId, "running", ctx.tasks, ctx.previews, ctx.results, ctx.errors);
    }
    try {
      const result = await runCompetencyChangcheChunkForGrade(ctx, chunkOpts.chunkSize);
      if (!result.hasMore) {
        ctx.tasks["competency_changche"] = "completed";
        ctx.previews["competency_changche"] = result.preview;
        ctx.results["competency_changche"] = {
          ...(typeof result.result === "object" && result.result != null ? result.result as Record<string, unknown> : {}),
          elapsedMs: Date.now() - startMs,
        };
      } else {
        ctx.previews["competency_changche"] = result.preview;
      }
      await updatePipelineState(ctx.supabase as SupabaseAdminClient, ctx.pipelineId, "running", ctx.tasks, ctx.previews, ctx.results, ctx.errors);
      return { completed: !result.hasMore, hasMore: result.hasMore, chunkProcessed: result.chunkProcessed, totalUncached: result.totalUncached };
    } catch (err) {
      ctx.tasks["competency_changche"] = "failed";
      ctx.errors["competency_changche"] = err instanceof Error ? err.message : String(err);
      ctx.results["competency_changche"] = { elapsedMs: Date.now() - startMs };
      await updatePipelineState(ctx.supabase as SupabaseAdminClient, ctx.pipelineId, "running", ctx.tasks, ctx.previews, ctx.results, ctx.errors);
      return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
    }
  }

  await runTaskWithState(ctx, "competency_changche", () => runCompetencyChangcheForGrade(ctx));
  return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
}

// ============================================
// Grade Phase 3: 행특 역량 분석 + 집계 (청크 지원)
// ============================================

export async function executeGradePhase3(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };

  if (ctx.tasks["competency_haengteuk"] === "completed") {
    return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  if (chunkOpts?.chunkSize != null) {
    const startMs = Date.now();
    if (ctx.tasks["competency_haengteuk"] !== "running") {
      ctx.tasks["competency_haengteuk"] = "running";
      await updatePipelineState(ctx.supabase as SupabaseAdminClient, ctx.pipelineId, "running", ctx.tasks, ctx.previews, ctx.results, ctx.errors);
    }
    try {
      const result = await runCompetencyHaengteukChunkForGrade(ctx, chunkOpts.chunkSize);
      if (!result.hasMore) {
        ctx.tasks["competency_haengteuk"] = "completed";
        ctx.previews["competency_haengteuk"] = result.preview;
        ctx.results["competency_haengteuk"] = {
          ...(typeof result.result === "object" && result.result != null ? result.result as Record<string, unknown> : {}),
          elapsedMs: Date.now() - startMs,
        };
      } else {
        ctx.previews["competency_haengteuk"] = result.preview;
      }
      await updatePipelineState(ctx.supabase as SupabaseAdminClient, ctx.pipelineId, "running", ctx.tasks, ctx.previews, ctx.results, ctx.errors);
      return { completed: !result.hasMore, hasMore: result.hasMore, chunkProcessed: result.chunkProcessed, totalUncached: result.totalUncached };
    } catch (err) {
      ctx.tasks["competency_haengteuk"] = "failed";
      ctx.errors["competency_haengteuk"] = err instanceof Error ? err.message : String(err);
      ctx.results["competency_haengteuk"] = { elapsedMs: Date.now() - startMs };
      await updatePipelineState(ctx.supabase as SupabaseAdminClient, ctx.pipelineId, "running", ctx.tasks, ctx.previews, ctx.results, ctx.errors);
      return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
    }
  }

  await runTaskWithState(ctx, "competency_haengteuk", () => runCompetencyHaengteukForGrade(ctx));
  return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
}

// ============================================
// Grade Phase 4: 세특 가이드 + 슬롯 생성 (병렬)
// ============================================

export async function executeGradePhase4(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  await Promise.allSettled([
    runTaskWithState(ctx, "setek_guide", () =>
      runSetekGuideForGrade(ctx),
    ),
    runTaskWithState(ctx, "slot_generation", () =>
      runSlotGenerationForGrade(ctx),
    ),
  ]);
}

// ============================================
// Grade Phase 5: 창체 가이드
// ============================================

export async function executeGradePhase5(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  await runTaskWithState(ctx, "changche_guide", () =>
    runChangcheGuideForGrade(ctx),
  );
}

// ============================================
// Grade Phase 6: 행특 가이드 → 최종 상태
// ============================================

export async function executeGradePhase6(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  await runTaskWithState(ctx, "haengteuk_guide", () =>
    runHaengteukGuideForGrade(ctx),
  );

  // Grade pipeline 최종 상태 판정
  const allCompleted = GRADE_PIPELINE_TASK_KEYS.every(
    (k) => ctx.tasks[k] === "completed",
  );

  await updatePipelineState(
    ctx.supabase as SupabaseAdminClient,
    ctx.pipelineId,
    allCompleted ? "completed" : "failed",
    ctx.tasks,
    ctx.previews,
    ctx.results ?? {},
    ctx.errors ?? {},
    true, // isFinal
  );
}
