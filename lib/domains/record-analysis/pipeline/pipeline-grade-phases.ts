// ============================================
// Grade Pipeline Phase Executor (학년별 파이프라인)
// GradePhase 1: competency_setek
// GradePhase 2: competency_changche
// GradePhase 3: competency_haengteuk (+ 집계)
// GradePhase 4: setek_guide + slot_generation (병렬)
// GradePhase 5: changche_guide
// GradePhase 6: haengteuk_guide → analysis 모드 최종 상태
// GradePhase 7: draft_generation (설계 모드 전용)
// GradePhase 8: draft_analysis (설계 모드 전용) → design 모드 최종 상태
// ============================================

import type { PipelineContext, GradePipelineTaskKey } from "./pipeline-types";
import { GRADE_PIPELINE_TASK_KEYS, GRADE_TASK_PREREQUISITES } from "./pipeline-types";
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
  runDraftGenerationForGrade,
  runDraftGenerationChunkForGrade,
  runDraftAnalysisForGrade,
  runDraftAnalysisChunkForGrade,
  runDraftRefinementForGrade,
  runDraftRefinementChunkForGrade,
  runCrossSubjectThemeExtractionForGrade,
} from "./pipeline-task-runners";

// ============================================
// 선행 태스크 실패 시 자동 스킵 가드
// ============================================

/**
 * 선행 태스크가 실패했으면 해당 태스크를 failed로 마킹하고 true를 반환.
 * 호출부에서 true이면 태스크 실행을 건너뛴다.
 */
function skipIfPrereqFailed(
  ctx: PipelineContext,
  taskKey: GradePipelineTaskKey,
): boolean {
  if (ctx.tasks[taskKey] === "completed") return true;

  const prereqs = GRADE_TASK_PREREQUISITES[taskKey];
  if (!prereqs) return false;

  const failed = prereqs.filter((p) => ctx.tasks[p] === "failed");
  if (failed.length === 0) return false;

  ctx.tasks[taskKey] = "failed";
  ctx.errors[taskKey] = `선행 태스크 실패로 건너뜀: ${failed.join(", ")}`;
  return true;
}

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
  if (await checkCancelled(ctx)) {
    return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

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
// Grade Phase 4: 과목 교차 테마 추출(P3.5 → 직렬) + 세특 가이드 + 슬롯 생성 (병렬)
// ============================================

export async function executeGradePhase4(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  // ── Blueprint ctx 캐시 (설계 모드 P4~P7 프롬프트 주입용, 2026-04-16 D 결정 5) ──
  // 설계 모드(design) 진입 시 1회만 로드, analysis 모드는 스킵.
  // 로드 실패는 graceful degradation — blueprint 없이도 가이드 생성은 계속.
  if (ctx.gradeMode === "design" && !ctx.blueprint) {
    const { loadBlueprintForStudent } = await import("../blueprint/loader");
    const loaded = await loadBlueprintForStudent(ctx.studentId, ctx.tenantId);
    if (loaded) {
      ctx.blueprint = loaded;
    }
  }

  // ── P3.5: 과목 교차 테마 추출 (선행 P1-P3 완료 후 1회) ──
  // - guides 호출 전에 직렬 실행하여 ctx.gradeThemes를 미리 채운다.
  // - 실패해도 후속 가이드는 themes 없이 진행 (graceful degradation).
  // - prereq 실패(ctx.tasks.competency_*)이면 skipIfPrereqFailed가 failed로 마킹.
  const skipTheme = skipIfPrereqFailed(ctx, "cross_subject_theme_extraction");
  if (!skipTheme && ctx.tasks["cross_subject_theme_extraction"] !== "completed") {
    await runTaskWithState(ctx, "cross_subject_theme_extraction", () =>
      runCrossSubjectThemeExtractionForGrade(ctx),
    );
    if (await checkCancelled(ctx)) return;
  }

  const skipGuide = skipIfPrereqFailed(ctx, "setek_guide");
  const skipSlot = skipIfPrereqFailed(ctx, "slot_generation");

  const tasks: Promise<void>[] = [];
  if (!skipGuide) {
    tasks.push(runTaskWithState(ctx, "setek_guide", () => runSetekGuideForGrade(ctx)));
  }
  if (!skipSlot) {
    tasks.push(runTaskWithState(ctx, "slot_generation", () => runSlotGenerationForGrade(ctx)));
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  } else {
    // 모든 태스크 스킵 — 상태 DB 반영
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results, ctx.errors,
    );
  }
}

// ============================================
// Grade Phase 5: 창체 가이드
// ============================================

export async function executeGradePhase5(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  if (skipIfPrereqFailed(ctx, "changche_guide")) {
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results, ctx.errors,
    );
    return;
  }

  await runTaskWithState(ctx, "changche_guide", () =>
    runChangcheGuideForGrade(ctx),
  );
}

// ============================================
// Grade Phase 6: 행특 가이드 → analysis 모드 최종 상태
// ============================================

export async function executeGradePhase6(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  if (skipIfPrereqFailed(ctx, "haengteuk_guide")) {
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results, ctx.errors,
    );
  } else {
    await runTaskWithState(ctx, "haengteuk_guide", () =>
      runHaengteukGuideForGrade(ctx),
    );
  }

  // Analysis 모드는 Phase 6이 최종 Phase — 완료/실패 상태 판정.
  // (설계 모드는 Phase 9에서 판정하므로 여기서는 건너뜀)
  // draft_generation / draft_analysis / draft_refinement 는 설계 모드 전용이므로
  // analysis 모드 완료 판정에서 제외한다.
  if (ctx.gradeMode === "analysis") {
    const allCompleted = GRADE_PIPELINE_TASK_KEYS.every((k) => {
      if (k === "draft_generation" || k === "draft_analysis" || k === "draft_refinement") return true;
      // cross_subject_theme_extraction은 옵션 enhancement — 실패해도 분석 모드 완료 판정에 영향 없음
      if (k === "cross_subject_theme_extraction") return true;
      return ctx.tasks[k] === "completed";
    });
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
}

// ============================================
// Grade Phase 7: 가안 생성 (설계 모드 전용)
// ============================================

export async function executeGradePhase7(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<{ completed: boolean; hasMore: boolean; chunkProcessed: number; totalUncached: number }> {
  if (await checkCancelled(ctx)) {
    return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  // 청크 모드 (B6, B5 패턴 이식)
  if (chunkOpts?.chunkSize != null) {
    if (skipIfPrereqFailed(ctx, "draft_generation")) {
      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId, "running",
        ctx.tasks, ctx.previews, ctx.results, ctx.errors,
      );
      return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
    }

    const existingStatus = ctx.tasks["draft_generation"];
    if (existingStatus !== "running") {
      ctx.tasks["draft_generation"] = "running";
    }

    try {
      const result = await runDraftGenerationChunkForGrade(ctx, chunkOpts.chunkSize);

      if (result.preview) ctx.previews["draft_generation"] = result.preview;

      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId,
        "running",
        ctx.tasks,
        ctx.previews,
        ctx.results ?? {},
        ctx.errors ?? {},
        false,
      );

      if (!result.hasMore) {
        ctx.tasks["draft_generation"] = "completed";
        await updatePipelineState(
          ctx.supabase as SupabaseAdminClient,
          ctx.pipelineId, "running",
          ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors ?? {}, false,
        );
      }

      return {
        completed: !result.hasMore,
        hasMore: result.hasMore,
        chunkProcessed: result.chunkProcessed,
        totalUncached: result.totalUncached,
      };
    } catch (err) {
      ctx.tasks["draft_generation"] = "failed";
      ctx.errors = ctx.errors ?? {};
      ctx.errors["draft_generation"] = err instanceof Error ? err.message : String(err);
      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId, "running",
        ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors, false,
      );
      throw err;
    }
  }

  // 단일 호출 (기존 동작 유지 — 호환성)
  if (skipIfPrereqFailed(ctx, "draft_generation")) {
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results, ctx.errors,
    );
    return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  await runTaskWithState(ctx, "draft_generation", () =>
    runDraftGenerationForGrade(ctx),
  );
  return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
}

// ============================================
// Grade Phase 8: 가안 분석 (설계 모드 전용)
// ============================================

export async function executeGradePhase8(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<{ completed: boolean; hasMore: boolean; chunkProcessed: number; totalUncached: number }> {
  if (await checkCancelled(ctx)) {
    return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  // 청크 모드
  if (chunkOpts?.chunkSize != null) {
    if (skipIfPrereqFailed(ctx, "draft_analysis")) {
      // 선행 실패로 스킵 — P9 가 최종이므로 여기서는 상태만 업데이트
      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId, "running",
        ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors ?? {}, false,
      );
      return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
    }

    const existingStatus = ctx.tasks["draft_analysis"];
    if (existingStatus !== "running") {
      ctx.tasks["draft_analysis"] = "running";
    }

    try {
      const result = await runDraftAnalysisChunkForGrade(ctx, chunkOpts.chunkSize);

      if (result.preview) ctx.previews["draft_analysis"] = result.preview;

      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId,
        "running",
        ctx.tasks,
        ctx.previews,
        ctx.results ?? {},
        ctx.errors ?? {},
        false,
      );

      if (!result.hasMore) {
        ctx.tasks["draft_analysis"] = "completed";
        await updatePipelineState(
          ctx.supabase as SupabaseAdminClient,
          ctx.pipelineId, "running",
          ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors ?? {}, false,
        );
      }

      return {
        completed: !result.hasMore,
        hasMore: result.hasMore,
        chunkProcessed: result.chunkProcessed,
        totalUncached: result.totalUncached,
      };
    } catch (err) {
      ctx.tasks["draft_analysis"] = "failed";
      ctx.errors = ctx.errors ?? {};
      ctx.errors["draft_analysis"] = err instanceof Error ? err.message : String(err);
      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId, "running",
        ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors, false,
      );
      throw err;
    }
  }

  // 단일 호출 (기존 동작 유지 — 호환성)
  if (!skipIfPrereqFailed(ctx, "draft_analysis")) {
    await runTaskWithState(ctx, "draft_analysis", () =>
      runDraftAnalysisForGrade(ctx),
    );
  }
  return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
}

// ============================================
// Grade Phase 9: 가안 개선 (설계 모드 전용, Phase 5 Sprint 1) → 최종 상태
// ============================================

export async function executeGradePhase9(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<{ completed: boolean; hasMore: boolean; chunkProcessed: number; totalUncached: number }> {
  if (await checkCancelled(ctx)) {
    return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  // 청크 모드
  if (chunkOpts?.chunkSize != null) {
    if (skipIfPrereqFailed(ctx, "draft_refinement")) {
      // 선행 실패로 스킵 — 최종 상태 판정 후 종료
      await finalizeDesignModeStatus(ctx);
      return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
    }

    const existingStatus = ctx.tasks["draft_refinement"];
    if (existingStatus !== "running") {
      ctx.tasks["draft_refinement"] = "running";
    }

    try {
      const result = await runDraftRefinementChunkForGrade(ctx, chunkOpts.chunkSize);

      if (result.preview) ctx.previews["draft_refinement"] = result.preview;

      if (result.result) {
        ctx.results ??= {};
        ctx.results["draft_refinement"] = {
          ...(ctx.results["draft_refinement"] as Record<string, unknown> ?? {}),
          ...result.result,
        };
      }

      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId,
        "running",
        ctx.tasks,
        ctx.previews,
        ctx.results ?? {},
        ctx.errors ?? {},
        false,
      );

      if (!result.hasMore) {
        ctx.tasks["draft_refinement"] = "completed";
        await finalizeDesignModeStatus(ctx);
      }

      return {
        completed: !result.hasMore,
        hasMore: result.hasMore,
        chunkProcessed: result.chunkProcessed,
        totalUncached: result.totalUncached,
      };
    } catch (err) {
      ctx.tasks["draft_refinement"] = "failed";
      ctx.errors = ctx.errors ?? {};
      ctx.errors["draft_refinement"] = err instanceof Error ? err.message : String(err);
      await finalizeDesignModeStatus(ctx);
      throw err;
    }
  }

  // 단일 호출 (기존 동작 유지 — 호환성)
  if (!skipIfPrereqFailed(ctx, "draft_refinement")) {
    await runTaskWithState(ctx, "draft_refinement", () =>
      runDraftRefinementForGrade(ctx),
    );
  }
  await finalizeDesignModeStatus(ctx);
  return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
}

async function finalizeDesignModeStatus(ctx: PipelineContext): Promise<void> {
  const allCompleted = GRADE_PIPELINE_TASK_KEYS.every((k) => {
    if (k === "cross_subject_theme_extraction") return true;
    return ctx.tasks[k] === "completed";
  });

  await updatePipelineState(
    ctx.supabase as SupabaseAdminClient,
    ctx.pipelineId,
    allCompleted ? "completed" : "failed",
    ctx.tasks,
    ctx.previews,
    ctx.results ?? {},
    ctx.errors ?? {},
    true,
  );
}
