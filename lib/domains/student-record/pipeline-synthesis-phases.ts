// ============================================
// Synthesis Pipeline Phase Executor (종합 파이프라인)
// 모든 Grade Pipeline 완료 후 실행
// SynthPhase 1: storyline_generation
// SynthPhase 2: edge_computation + guide_matching
// SynthPhase 3: ai_diagnosis + course_recommendation
// SynthPhase 4: bypass_analysis
// SynthPhase 5: activity_summary + ai_strategy
// SynthPhase 6: interview_generation + roadmap_generation → 최종 상태
// ============================================

import type { PipelineContext } from "./pipeline-types";
import { SYNTHESIS_PIPELINE_TASK_KEYS } from "./pipeline-types";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import type { PersistedEdge } from "./edge-repository";
import type { CrossRefEdge } from "./cross-reference";
import {
  runTaskWithState,
  checkCancelled,
  updatePipelineState,
} from "./pipeline-executor";
import {
  runStorylineGeneration,
  runEdgeComputation,
  runGuideMatching,
  runAiDiagnosis,
  runCourseRecommendation,
  runBypassAnalysis,
  runActivitySummary,
  runAiStrategy,
  runInterviewGeneration,
  runRoadmapGeneration,
} from "./pipeline-task-runners";

// ============================================
// 헬퍼: DB에서 영속화된 edges 로드
// ============================================

async function loadComputedEdges(
  ctx: PipelineContext,
): Promise<PersistedEdge[] | CrossRefEdge[]> {
  const { findEdges } = await import("./edge-repository");
  return findEdges(ctx.studentId, ctx.tenantId);
}

// ============================================
// 헬퍼: coursePlanData DB 재조회
// ============================================

async function refreshCoursePlanData(ctx: PipelineContext): Promise<void> {
  const { data: refreshedPlans } = await ctx.supabase
    .from("student_course_plans")
    .select(
      `*, subject:subject_id ( id, name, subject_type:subject_type_id ( name ), subject_group:subject_group_id ( name ) )`,
    )
    .eq("student_id", ctx.studentId)
    .order("grade")
    .order("semester")
    .order("priority", { ascending: false })
    .returns<import("./course-plan/types").CoursePlanWithSubject[]>();

  if (refreshedPlans) {
    ctx.coursePlanData = {
      plans: refreshedPlans,
    };
  }
}

// ============================================
// Synthesis Phase 1: 통합 입력 빌드 + 스토리라인
// ============================================

export async function executeSynthesisPhase1(
  ctx: PipelineContext,
): Promise<void> {
  // 통합 입력 빌더: 학년별 분석/설계 데이터를 1회 조합하여 ctx에 저장
  if (!ctx.unifiedInput) {
    try {
      const { buildUnifiedGradeInput } = await import("./pipeline-unified-input");
      ctx.unifiedInput = await buildUnifiedGradeInput({
        studentId: ctx.studentId,
        tenantId: ctx.tenantId,
        studentGrade: ctx.snapshot?.grade ?? 1,
        supabase: ctx.supabase,
      });
    } catch {
      // unifiedInput 빌드 실패 시 기존 플로우로 폴백 (치명적이지 않음)
    }
  }

  await runTaskWithState(ctx, "storyline_generation", () =>
    runStorylineGeneration(ctx),
  );
}

// ============================================
// Synthesis Phase 2: 연결 그래프 + 가이드 매칭
// ============================================

export async function executeSynthesisPhase2(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  await runTaskWithState(ctx, "edge_computation", () =>
    runEdgeComputation(ctx),
  );

  if (await checkCancelled(ctx)) return;

  await runTaskWithState(ctx, "guide_matching", () =>
    runGuideMatching(ctx),
  );
}

// ============================================
// Synthesis Phase 3: 진단 + 수강 추천
// ============================================

export async function executeSynthesisPhase3(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  if (!ctx.neisGrades?.length) {
    // NEIS 학년 없음: course_recommendation 선행 → coursePlanData 재조회 → diagnosis
    await runTaskWithState(ctx, "course_recommendation", () =>
      runCourseRecommendation(ctx),
    );
    await refreshCoursePlanData(ctx);
    const edges: PersistedEdge[] | CrossRefEdge[] = [];
    await runTaskWithState(ctx, "ai_diagnosis", () =>
      runAiDiagnosis(ctx, edges, null),
    );
  } else {
    // NEIS 학년 있음: diagnosis + course_recommendation 병렬
    const edges = await loadComputedEdges(ctx);
    await Promise.allSettled([
      runTaskWithState(ctx, "ai_diagnosis", () =>
        runAiDiagnosis(ctx, edges, null),
      ),
      runTaskWithState(ctx, "course_recommendation", () =>
        runCourseRecommendation(ctx),
      ),
    ]);
    await refreshCoursePlanData(ctx);
  }
}

// ============================================
// Synthesis Phase 4: 우회학과 분석
// ============================================

export async function executeSynthesisPhase4(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  await runTaskWithState(ctx, "bypass_analysis", () =>
    runBypassAnalysis(ctx),
  );
}

// ============================================
// Synthesis Phase 5: 활동 요약 + 보완 전략
// ============================================

export async function executeSynthesisPhase5(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  const edges = await loadComputedEdges(ctx);
  await Promise.allSettled([
    runTaskWithState(ctx, "activity_summary", () =>
      runActivitySummary(ctx, edges),
    ),
    runTaskWithState(ctx, "ai_strategy", () => runAiStrategy(ctx)),
  ]);
}

// ============================================
// Synthesis Phase 6: 면접 + 로드맵 → 최종 상태
// ============================================

export async function executeSynthesisPhase6(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  await Promise.allSettled([
    runTaskWithState(ctx, "interview_generation", () =>
      runInterviewGeneration(ctx),
    ),
    runTaskWithState(ctx, "roadmap_generation", () =>
      runRoadmapGeneration(ctx),
    ),
  ]);

  // Synthesis pipeline 최종 상태 판정
  const allCompleted = SYNTHESIS_PIPELINE_TASK_KEYS.every(
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
