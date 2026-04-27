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
import { mergeTaskResult } from "./pipeline-helpers";
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
  runCompetencyVolunteerForGrade,
  runCompetencyAwardsForGrade,
  runDeriveMainThemeForGrade,
} from "./pipeline-task-runners";

// ============================================
// 선행 태스크 실패 시 자동 스킵 가드
// ============================================

/**
 * 선행 태스크가 실패했거나 이미 완료된 경우 true 반환.
 * 선행 실패 시 ctx.tasks/ctx.errors 에만 마킹 (DB write 없음, sync).
 *
 * - 이미 completed: 즉시 true
 * - 선행 failed: ctx 마킹 후 true
 * - 실행 가능: false
 *
 * 병렬 큐 경로(Phase 4)에서는 이 sync 버전을 사용하여 판정만 일괄 수행한 뒤
 * 최종 상태를 한 번만 persist. 직렬 경로에서는 {@link skipAndPersist} 사용.
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

/**
 * 직렬 Phase 의 표준 skip 헬퍼. 선행 실패 판정 + DB 상태 반영을 1회에 수행.
 * 호출부는 `if (await skipAndPersist(ctx, taskKey)) return;` 으로 early-return.
 *
 * 반환 true 의 의미: "이 태스크는 실행하지 않는다" (already completed 또는 prereq failed).
 * prereq failed 경우만 DB write 발생 — already completed 는 상태 변경 없음.
 */
async function skipAndPersist(
  ctx: PipelineContext,
  taskKey: GradePipelineTaskKey,
): Promise<boolean> {
  if (ctx.tasks[taskKey] === "completed") return true;

  if (!skipIfPrereqFailed(ctx, taskKey)) return false;

  await updatePipelineState(
    ctx.supabase as SupabaseAdminClient,
    ctx.pipelineId,
    "running",
    ctx.tasks,
    ctx.previews,
    ctx.results ?? {},
    ctx.errors ?? {},
  );
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

const EMPTY_CHUNK_RESULT: PhaseChunkResult = {
  completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0,
};
const COMPLETED_CHUNK_RESULT: PhaseChunkResult = {
  completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0,
};

// ============================================
// 청크 실행 헬퍼 — Phase 1/2/3/7/8 공통 패턴 추상화
// ============================================

interface ChunkRunnerOutput {
  hasMore: boolean;
  preview: string;
  result: unknown;
  chunkProcessed: number;
  totalUncached: number;
}

/**
 * 역량 분석 Phase (1/2/3) 의 청크 실행 표준.
 *
 * - 첫 청크 running 마킹 + persist
 * - 각 청크 preview 갱신 + persist
 * - 마지막 청크 completed 마킹 + result.spread + elapsedMs 기록
 * - 에러 시 failed 마킹 + persist + 빈 결과 반환 (swallow — 전체 파이프라인 계속)
 */
async function executeCompetencyChunk<K extends GradePipelineTaskKey>(
  ctx: PipelineContext,
  taskKey: K,
  chunkSize: number,
  chunkRunner: (ctx: PipelineContext, size: number) => Promise<ChunkRunnerOutput>,
): Promise<PhaseChunkResult> {
  const startMs = Date.now();

  if (ctx.tasks[taskKey] !== "running") {
    ctx.tasks[taskKey] = "running";
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results, ctx.errors,
    );
  }

  try {
    const result = await chunkRunner(ctx, chunkSize);

    if (!result.hasMore) {
      ctx.tasks[taskKey] = "completed";
      ctx.previews[taskKey] = result.preview;
      const prev = (typeof result.result === "object" && result.result != null)
        ? result.result as Record<string, unknown>
        : {};
      ctx.results[taskKey] = { ...prev, elapsedMs: Date.now() - startMs };
    } else {
      ctx.previews[taskKey] = result.preview;
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
    ctx.tasks[taskKey] = "failed";
    ctx.errors[taskKey] = err instanceof Error ? err.message : String(err);
    ctx.results[taskKey] = { elapsedMs: Date.now() - startMs };
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results, ctx.errors,
    );
    return EMPTY_CHUNK_RESULT;
  }
}

/**
 * Draft Phase (7/8) 의 청크 실행 표준.
 *
 * 역량 Phase 와 차이:
 * - running 마킹만, persist 별도 (청크 persist 때 일괄)
 * - preview 는 옵션 (runner 가 빈 결과 반환 가능)
 * - result 병합 없음 (final status 는 finalizeDesignModeStatus 가 담당)
 * - 에러 시 failed 마킹 + persist 후 **rethrow** (호출자에게 전파)
 */
async function executeDraftChunk<K extends GradePipelineTaskKey>(
  ctx: PipelineContext,
  taskKey: K,
  chunkSize: number,
  chunkRunner: (ctx: PipelineContext, size: number) => Promise<{
    hasMore: boolean;
    preview?: string;
    chunkProcessed: number;
    totalUncached: number;
  }>,
): Promise<PhaseChunkResult> {
  if (ctx.tasks[taskKey] !== "running") {
    ctx.tasks[taskKey] = "running";
  }

  try {
    const result = await chunkRunner(ctx, chunkSize);

    if (result.preview) ctx.previews[taskKey] = result.preview;

    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors ?? {}, false,
    );

    if (!result.hasMore) {
      ctx.tasks[taskKey] = "completed";
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
    ctx.tasks[taskKey] = "failed";
    ctx.errors = ctx.errors ?? {};
    ctx.errors[taskKey] = err instanceof Error ? err.message : String(err);
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors, false,
    );
    throw err;
  }
}

// ============================================
// Grade Phase 1: 세특 역량 분석 (청크 지원)
// ============================================

export async function executeGradePhase1(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) return EMPTY_CHUNK_RESULT;
  if (ctx.tasks["competency_setek"] === "completed") return COMPLETED_CHUNK_RESULT;

  if (chunkOpts?.chunkSize != null) {
    return executeCompetencyChunk(ctx, "competency_setek", chunkOpts.chunkSize, runCompetencySetekChunkForGrade);
  }

  await runTaskWithState(ctx, "competency_setek", () => runCompetencySetekForGrade(ctx));
  return COMPLETED_CHUNK_RESULT;
}

// ============================================
// Grade Phase 2: 창체 역량 분석 (청크 지원)
// ============================================

export async function executeGradePhase2(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) return EMPTY_CHUNK_RESULT;
  if (ctx.tasks["competency_changche"] === "completed") return COMPLETED_CHUNK_RESULT;

  if (chunkOpts?.chunkSize != null) {
    return executeCompetencyChunk(ctx, "competency_changche", chunkOpts.chunkSize, runCompetencyChangcheChunkForGrade);
  }

  await runTaskWithState(ctx, "competency_changche", () => runCompetencyChangcheForGrade(ctx));
  return COMPLETED_CHUNK_RESULT;
}

// ============================================
// Grade Phase 3: 행특 역량 분석 + 집계 (청크 지원)
// ============================================

export async function executeGradePhase3(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) return EMPTY_CHUNK_RESULT;
  if (ctx.tasks["competency_haengteuk"] === "completed") return COMPLETED_CHUNK_RESULT;

  if (chunkOpts?.chunkSize != null) {
    return executeCompetencyChunk(ctx, "competency_haengteuk", chunkOpts.chunkSize, runCompetencyHaengteukChunkForGrade);
  }

  await runTaskWithState(ctx, "competency_haengteuk", () => runCompetencyHaengteukForGrade(ctx));
  return COMPLETED_CHUNK_RESULT;
}

// ============================================
// Grade Phase 4: 과목 교차 테마 추출(P3.5 → 직렬) + 세특 가이드 + 슬롯 생성 (병렬)
// ============================================

export async function executeGradePhase4(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  // ── Step 1 (2026-04-24, 비선형 재조직): narrativeContext 격상 ──
  // Phase 1~3 완료 후 축적된 `ctx.belief.analysisContext` 를 기반으로
  // Priority Queue 선구체(`NarrativeContext`) 를 ctx 최상위에 세팅.
  // Phase 4 진입 시점이 "P1~P3 완료 직후 + P4 판정 전" 이라 적합.
  // Orient Phase MVP 가 prioritizedWeaknesses.length 로 modelTier 판정에 활용.
  if (!ctx.narrativeContext) {
    const { buildNarrativeContextFromAnalysisContext } = await import("./narrative-context");
    ctx.narrativeContext = buildNarrativeContextFromAnalysisContext(ctx.belief.analysisContext);
  }

  // ── Step 2 (2026-04-24): Orient Phase Planner MVP ──
  // Phase 4 진입 직전 학생 상태(belief) 를 읽고 skipTasks / modelTier 판정.
  // 규칙 기반 (LLM 호출 0회). 기본값은 현재 동작 유지 (fallback 안전망).
  if (!ctx.plannerDirective) {
    const { runOrientPhase } = await import("./pipeline-orient-phase");
    ctx.plannerDirective = await runOrientPhase(ctx);
  }

  // ── Blueprint ctx 캐시 (설계 모드 P4~P7 프롬프트 주입용, 2026-04-16 D 결정 5) ──
  // 설계 모드(design) 진입 시 1회만 로드, analysis 모드는 스킵.
  // 로드 실패는 graceful degradation — blueprint 없이도 가이드 생성은 계속.
  if (ctx.gradeMode === "design" && !ctx.belief.blueprint) {
    const { loadBlueprintForStudent } = await import("../blueprint/loader");
    const loaded = await loadBlueprintForStudent(ctx.studentId, ctx.tenantId);
    if (loaded) {
      ctx.belief.blueprint = loaded;
    }
    // 로드 실패(loaded === null/undefined): belief.blueprint 는 undefined 유지 (graceful)
  }

  // ── P3.5: 과목 교차 테마 추출 (선행 P1-P3 완료 후 1회) ──
  // - guides 호출 전에 직렬 실행하여 ctx.gradeThemes를 미리 채운다.
  // - 실패해도 후속 가이드는 themes 없이 진행 (graceful degradation).
  // - prereq 실패(ctx.tasks.competency_*)이면 skipIfPrereqFailed가 failed로 마킹.
  if (!skipIfPrereqFailed(ctx, "cross_subject_theme_extraction")) {
    await runTaskWithState(ctx, "cross_subject_theme_extraction", () =>
      runCrossSubjectThemeExtractionForGrade(ctx),
    );
    if (await checkCancelled(ctx)) return;
  }

  // ── β(A) 2026-04-24: MidPipeline Planner — P3.5 완료 직후, P4 진입 전 ──
  // ENABLE_MID_PIPELINE_PLANNER=false(기본) → null 즉시 반환, 파이프라인 무영향.
  // 이 시점엔 analysisContext(P1~P3) + gradeThemes(P3.5) + qualityPatterns(이전 run) 채워짐.
  // 이번 작업 범위: telemetry 전용(ctx.midPlan 저장). 가이드 러너 소비는 β+1.
  if (ctx.midPlan === undefined) {
    try {
      const { runMidPipelinePlanner } = await import("./orient/mid-pipeline-planner");
      ctx.midPlan = await runMidPipelinePlanner(ctx);
    } catch {
      // MidPlanner 실패는 파이프라인에 무영향 (best-effort)
      ctx.midPlan = null;
    }
    // telemetry 영속 — _analysisContext 패턴과 동일하게 task_results 에 저장
    if (ctx.midPlan !== null) {
      ctx.results["_midPlan"] = ctx.midPlan as unknown as Record<string, unknown>;
      await updatePipelineState(
        ctx.supabase as SupabaseAdminClient,
        ctx.pipelineId,
        "running",
        ctx.tasks,
        ctx.previews,
        ctx.results,
        ctx.errors,
      );
    }
  }

  // ── α1-2: 봉사 역량 태깅 (pre-task) ──
  // - 선행 없음(P1-P3와 독립). 학년 봉사 rows → community_caring 태깅 + recurringThemes.
  // - 실패해도 후속 가이드 계속 진행 (graceful). activity_tags(record_type='volunteer')만 기록.
  // - α1-3 VolunteerState 빌더가 activity_tags + volunteer 테이블에서 집계.
  if (!skipIfPrereqFailed(ctx, "competency_volunteer")) {
    await runTaskWithState(ctx, "competency_volunteer", () =>
      runCompetencyVolunteerForGrade(ctx),
    );
    if (await checkCancelled(ctx)) return;
  }

  // ── α1-4-b: 수상 역량 태깅 (pre-task) ──
  // - 선행 없음(P1-P3와 독립). 학년 수상 rows → leadership/career/inquiry 태깅 + recurringThemes.
  // - 실패해도 후속 가이드 계속 진행 (graceful). activity_tags(record_type='award')만 기록.
  // - α1-4-a collectAwardState 가 activity_tags + awards 테이블 + ctx.results 에서 집계.
  if (!skipIfPrereqFailed(ctx, "competency_awards")) {
    await runTaskWithState(ctx, "competency_awards", () =>
      runCompetencyAwardsForGrade(ctx),
    );
    if (await checkCancelled(ctx)) return;
  }

  // ── P3.6 (M1-c W1+W2, 2026-04-27): derive_main_theme — 메인 탐구주제 + cascadePlan ──
  // - competency_* 후행 (analysisContext + gradeThemes 충족 시점).
  // - hash 기반 staleness — 학생 입력 변경 없으면 LLM 호출 0회로 cache hit.
  // - graceful — 실패해도 가이드 진입 영향 없음. ctx.belief.mainTheme/cascadePlan 즉시 시딩.
  if (!skipIfPrereqFailed(ctx, "derive_main_theme")) {
    await runTaskWithState(ctx, "derive_main_theme", () =>
      runDeriveMainThemeForGrade(ctx),
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

  if (await skipAndPersist(ctx, "changche_guide")) return;

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

  if (!(await skipAndPersist(ctx, "haengteuk_guide"))) {
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
      // cross_subject_theme_extraction / competency_volunteer / competency_awards 는
      // 옵션 enhancement (P3.5 pre-task, graceful degradation) — 완료 판정에 영향 없음.
      if (k === "cross_subject_theme_extraction") return true;
      if (k === "competency_volunteer") return true;
      if (k === "competency_awards") return true;
      if (k === "derive_main_theme") return true; // M1-c W1: graceful — 완료 판정 영향 없음
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
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) return EMPTY_CHUNK_RESULT;

  // Step 2 (2026-04-24): Orient 판정으로 draft_generation skip 인 경우 early exit
  const { skipIfOrientSkipped: _orientSkipGen } = await import("./pipeline-orient-phase");
  if (_orientSkipGen(ctx, "draft_generation")) {
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors ?? {},
    );
    return COMPLETED_CHUNK_RESULT;
  }

  if (chunkOpts?.chunkSize != null) {
    if (await skipAndPersist(ctx, "draft_generation")) return COMPLETED_CHUNK_RESULT;
    return executeDraftChunk(ctx, "draft_generation", chunkOpts.chunkSize, runDraftGenerationChunkForGrade);
  }

  // 단일 호출 (기존 동작 유지 — 호환성)
  if (await skipAndPersist(ctx, "draft_generation")) return COMPLETED_CHUNK_RESULT;

  await runTaskWithState(ctx, "draft_generation", () =>
    runDraftGenerationForGrade(ctx),
  );
  return COMPLETED_CHUNK_RESULT;
}

// ============================================
// Grade Phase 8: 가안 분석 (설계 모드 전용)
// ============================================

export async function executeGradePhase8(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) return EMPTY_CHUNK_RESULT;

  // Step 2 (2026-04-24): Orient 판정으로 draft_analysis skip 인 경우 early exit
  const { skipIfOrientSkipped: _orientSkipAna } = await import("./pipeline-orient-phase");
  if (_orientSkipAna(ctx, "draft_analysis")) {
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId, "running",
      ctx.tasks, ctx.previews, ctx.results ?? {}, ctx.errors ?? {},
    );
    return COMPLETED_CHUNK_RESULT;
  }

  if (chunkOpts?.chunkSize != null) {
    if (await skipAndPersist(ctx, "draft_analysis")) return COMPLETED_CHUNK_RESULT;
    return executeDraftChunk(ctx, "draft_analysis", chunkOpts.chunkSize, runDraftAnalysisChunkForGrade);
  }

  // 단일 호출 (기존 동작 유지 — 호환성)
  if (!(await skipAndPersist(ctx, "draft_analysis"))) {
    await runTaskWithState(ctx, "draft_analysis", () =>
      runDraftAnalysisForGrade(ctx),
    );
  }
  return COMPLETED_CHUNK_RESULT;
}

// ============================================
// Grade Phase 9: 가안 개선 (설계 모드 전용, Phase 5 Sprint 1) → 최종 상태
// ============================================

export async function executeGradePhase9(
  ctx: PipelineContext,
  chunkOpts?: { chunkSize?: number },
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) return EMPTY_CHUNK_RESULT;

  // Step 2 (2026-04-24): Orient 판정으로 draft_refinement skip 인 경우 early exit
  const { skipIfOrientSkipped: _orientSkipRef } = await import("./pipeline-orient-phase");
  if (_orientSkipRef(ctx, "draft_refinement")) {
    await finalizeDesignModeStatus(ctx);
    return COMPLETED_CHUNK_RESULT;
  }

  // 청크 모드 — finalize + result merge 특이성으로 executeDraftChunk 미적용 (P7/P8 와 다름)
  if (chunkOpts?.chunkSize != null) {
    if (skipIfPrereqFailed(ctx, "draft_refinement")) {
      await finalizeDesignModeStatus(ctx);
      return COMPLETED_CHUNK_RESULT;
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
        mergeTaskResult(ctx.results, "draft_refinement", result.result);
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
  return COMPLETED_CHUNK_RESULT;
}

async function finalizeDesignModeStatus(ctx: PipelineContext): Promise<void> {
  const allCompleted = GRADE_PIPELINE_TASK_KEYS.every((k) => {
    // P3.5 pre-task (옵션 enhancement) — graceful degradation 대상은 완료 판정에서 제외.
    if (k === "cross_subject_theme_extraction") return true;
    if (k === "competency_volunteer") return true;
    if (k === "competency_awards") return true;
    if (k === "derive_main_theme") return true; // M1-c W1: graceful
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
