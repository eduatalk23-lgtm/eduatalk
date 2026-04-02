// ============================================
// Phase Executor 함수 모음 (Phase 분할 실행 지원)
// 각 Phase API route에서 호출하는 단위 실행 함수
// ============================================

import type { PipelineContext } from "./pipeline-types";
import { PIPELINE_TASK_KEYS } from "./pipeline-types";
import type { PipelineTaskResults } from "./pipeline-types";
import {
  runTaskWithState,
  checkCancelled,
  updatePipelineState,
} from "./pipeline-executor";
import {
  runCompetencyAnalysis,
  runStorylineGeneration,
  runEdgeComputation,
  runGuideMatching,
  runAiDiagnosis,
  runCourseRecommendation,
  runBypassAnalysis,
  runSetekGuide,
  runChangcheGuide,
  runHaengteukGuide,
  runActivitySummary,
  runAiStrategy,
  runInterviewGeneration,
  runRoadmapGeneration,
} from "./pipeline-task-runners";
import type { PersistedEdge } from "./edge-repository";
import type { CrossRefEdge } from "./cross-reference";
import { logActionDebug } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";

const LOG_CTX = { domain: "student-record", action: "pipeline-phases" };

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
// 헬퍼: coursePlanData DB 재조회 (prospective 모드용)
// pipeline.ts line 2006-2013 참고
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
    .order("priority", { ascending: false });

  if (refreshedPlans) {
    const { type: _type, ...rest } = await import("./course-plan/types").then(() => ({ type: null }));
    void _type; void rest;
    // 타입 import는 pipeline-types.ts의 PipelineContext.coursePlanData와 일치
    ctx.coursePlanData = {
      plans: refreshedPlans as unknown as import("./course-plan/types").CoursePlanWithSubject[],
    };
  }
}

// ============================================
// 헬퍼: 증분 캐시 최적화 (pipeline.ts line 1954-1993)
// competency_analysis 100% 캐시면 이전 파이프라인 결과 복원 후 true 반환
// ============================================

async function checkIncrementalCacheOptimization(
  ctx: PipelineContext,
): Promise<boolean> {
  const competencyResult = ctx.results.competency_analysis as
    | { allCached?: boolean }
    | undefined;

  // existingState 여부는 ctx.tasks 상태로 추론:
  // 이어서 실행된 경우 최소 1개 이상의 task가 이미 completed 상태
  const hasExistingCompletedTasks = PIPELINE_TASK_KEYS.some(
    (k) => k !== "competency_analysis" && ctx.tasks[k] === "completed",
  );

  if (!competencyResult?.allCached || hasExistingCompletedTasks) {
    return false;
  }

  // 이전 성공 파이프라인의 task_results 조회
  const { data: prevPipeline } = await ctx.supabase
    .from("student_record_analysis_pipelines")
    .select("tasks, task_previews, task_results")
    .eq("student_id", ctx.studentId)
    .eq("status", "completed")
    .neq("id", ctx.pipelineId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prevPipeline) return false;

  const prevTasks = (prevPipeline.tasks ?? {}) as Record<string, string>;
  const prevPreviews = (prevPipeline.task_previews ?? {}) as Record<string, string>;
  const prevResults = (prevPipeline.task_results ?? {}) as PipelineTaskResults;

  const phase23Keys = [
    "ai_diagnosis",
    "course_recommendation",
    "guide_matching",
    "bypass_analysis",
    "setek_guide",
    "activity_summary",
    "ai_strategy",
    "interview_generation",
    "roadmap_generation",
  ] as const;

  let allRestored = true;
  for (const key of phase23Keys) {
    if (prevTasks[key] === "completed") {
      ctx.tasks[key] = "completed";
      if (prevPreviews[key]) ctx.previews[key] = `[캐시] ${prevPreviews[key]}`;
      if (prevResults[key]) ctx.results[key] = prevResults[key];
    } else {
      allRestored = false;
    }
  }

  if (allRestored) {
    logActionDebug(
      LOG_CTX,
      `Pipeline ${ctx.pipelineId}: all records cached → restored ${phase23Keys.length} tasks from previous pipeline`,
    );
    const allCompleted = PIPELINE_TASK_KEYS.every(
      (k) => ctx.tasks[k] === "completed",
    );
    await updatePipelineState(
      ctx.supabase as import("@/lib/supabase/admin").SupabaseAdminClient,
      ctx.pipelineId,
      allCompleted ? "completed" : "failed",
      ctx.tasks,
      ctx.previews,
      ctx.results,
      ctx.errors,
      true,
    );
    return true;
  }

  return false;
}

// ============================================
// Phase 1: 역량 분석
// ============================================

export async function executePhase1(ctx: PipelineContext): Promise<void> {
  await runTaskWithState(ctx, "competency_analysis", () =>
    runCompetencyAnalysis(ctx),
  );
}

// ============================================
// Phase 2: 스토리라인
// ============================================

export async function executePhase2(ctx: PipelineContext): Promise<void> {
  if (await checkCancelled(ctx)) return;
  await runTaskWithState(ctx, "storyline_generation", () =>
    runStorylineGeneration(ctx),
  );
}

// ============================================
// Phase 3: 연결 그래프 + 가이드 매칭
// ============================================

export async function executePhase3(ctx: PipelineContext): Promise<void> {
  if (await checkCancelled(ctx)) return;
  await runTaskWithState(ctx, "edge_computation", () =>
    runEdgeComputation(ctx),
  );
  if (await checkCancelled(ctx)) return;
  await runTaskWithState(ctx, "guide_matching", () => runGuideMatching(ctx));
}

// ============================================
// Phase 4: 진단 + 수강 추천
// 반환값 true = 캐시 최적화로 파이프라인 완료됨 (체이닝 불필요)
// ============================================

export async function executePhase4(ctx: PipelineContext): Promise<boolean> {
  if (await checkCancelled(ctx)) return false;

  // 증분 캐시 최적화: competency_analysis 100% 캐시면 후속 태스크 스킵
  const skipRemaining = await checkIncrementalCacheOptimization(ctx);
  if (skipRemaining) return true;

  if (ctx.pipelineMode === "prospective") {
    // Prospective: course_recommendation 선행 → coursePlanData 재조회 → diagnosis
    await runTaskWithState(ctx, "course_recommendation", () =>
      runCourseRecommendation(ctx),
    );
    await refreshCoursePlanData(ctx);
    const edges: PersistedEdge[] | CrossRefEdge[] = [];
    await runTaskWithState(ctx, "ai_diagnosis", () =>
      runAiDiagnosis(ctx, edges, null),
    );
  } else {
    // Analysis: diagnosis + course_recommendation 병렬
    const edges = await loadComputedEdges(ctx);
    await Promise.allSettled([
      runTaskWithState(ctx, "ai_diagnosis", () =>
        runAiDiagnosis(ctx, edges, null),
      ),
      runTaskWithState(ctx, "course_recommendation", () =>
        runCourseRecommendation(ctx),
      ),
    ]);
  }

  return false;
}

// ============================================
// Phase 5: 우회학과 + 세특 방향
// ============================================

export async function executePhase5(ctx: PipelineContext): Promise<void> {
  if (await checkCancelled(ctx)) return;

  if (ctx.pipelineMode === "prospective") {
    // prospective: bypass만 (setek은 Phase 6에서 학년별 루프)
    await runTaskWithState(ctx, "bypass_analysis", () =>
      runBypassAnalysis(ctx),
    );
  } else {
    // analysis: bypass + setek 병렬
    const edges = await loadComputedEdges(ctx);
    await Promise.allSettled([
      runTaskWithState(ctx, "bypass_analysis", () => runBypassAnalysis(ctx)),
      runTaskWithState(ctx, "setek_guide", () => runSetekGuide(ctx, edges)),
    ]);
  }
}

// ============================================
// Phase 6: 창체 + 행특 (+ prospective 학년별 루프)
// ============================================

export async function executePhase6(ctx: PipelineContext): Promise<void> {
  if (await checkCancelled(ctx)) return;

  if (ctx.pipelineMode === "prospective") {
    // prospective: 학년별 setek→changche→haengteuk 순차 루프
    // pipeline.ts line 2022-2098 로직
    const prospectiveBaseYear = calculateSchoolYear();
    const schoolYearsToGenerate: Array<{ grade: number; schoolYear: number }> =
      [];
    for (let g = ctx.studentGrade; g <= 3; g++) {
      schoolYearsToGenerate.push({
        grade: g,
        schoolYear: prospectiveBaseYear - ctx.studentGrade + g,
      });
    }

    try {
      const { requireAdminOrConsultant: reqAuth } = await import(
        "@/lib/auth/guards"
      );
      const { userId: guideUserId } = await reqAuth();
      const { fetchReportData: fetchReport } = await import("./report");

      for (const { grade: tGrade, schoolYear: tYear } of schoolYearsToGenerate) {
        // 세특 방향
        const { generateSetekGuide } = await import(
          "./llm/actions/generateSetekGuide"
        );
        await generateSetekGuide(ctx.studentId, [tGrade], undefined, tYear);

        // 창체 방향 (세특 컨텍스트 전달)
        const { generateProspectiveChangcheGuide } = await import(
          "./llm/actions/generateChangcheGuide"
        );
        const reportForChangche = await fetchReport(ctx.studentId);
        if (reportForChangche.success && reportForChangche.data) {
          const { data: setekCtxRows } = await ctx.supabase
            .from("student_record_setek_guides")
            .select("direction, keywords")
            .eq("student_id", ctx.studentId)
            .eq("tenant_id", ctx.tenantId)
            .eq("school_year", tYear)
            .eq("source", "ai")
            .limit(4);
          const setekCtx =
            setekCtxRows && setekCtxRows.length > 0
              ? `## 세특 방향 요약\n${setekCtxRows
                  .map(
                    (r) =>
                      `- ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
                  )
                  .join("\n")}`
              : undefined;
          await generateProspectiveChangcheGuide(
            ctx.studentId,
            ctx.tenantId,
            guideUserId,
            reportForChangche.data,
            ctx.coursePlanData,
            undefined,
            setekCtx,
            tYear,
          );
        }

        // 행특 방향 (창체 컨텍스트 전달)
        const { generateProspectiveHaengteukGuide } = await import(
          "./llm/actions/generateHaengteukGuide"
        );
        const reportForHaengteuk = await fetchReport(ctx.studentId);
        if (reportForHaengteuk.success && reportForHaengteuk.data) {
          const ACTIVITY_LABELS: Record<string, string> = {
            autonomy: "자율",
            club: "동아리",
            career: "진로",
          };
          const { data: changcheCtxRows } = await ctx.supabase
            .from("student_record_changche_guides")
            .select("activity_type, direction, keywords")
            .eq("student_id", ctx.studentId)
            .eq("tenant_id", ctx.tenantId)
            .eq("school_year", tYear)
            .eq("source", "ai")
            .limit(3);
          const changcheCtx =
            changcheCtxRows && changcheCtxRows.length > 0
              ? `## 창체 방향 요약\n${changcheCtxRows
                  .map(
                    (r) =>
                      `- ${ACTIVITY_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
                  )
                  .join("\n")}`
              : undefined;
          await generateProspectiveHaengteukGuide(
            ctx.studentId,
            ctx.tenantId,
            guideUserId,
            reportForHaengteuk.data,
            ctx.coursePlanData,
            undefined,
            changcheCtx,
            tYear,
          );
        }
      }

      ctx.tasks["setek_guide"] = "completed";
      ctx.previews["setek_guide"] = `${schoolYearsToGenerate.length}개 학년 세특 방향 생성`;
      ctx.tasks["changche_guide"] = "completed";
      ctx.previews["changche_guide"] = `${schoolYearsToGenerate.length}개 학년 창체 방향 생성`;
      ctx.tasks["haengteuk_guide"] = "completed";
      ctx.previews["haengteuk_guide"] = `${schoolYearsToGenerate.length}개 학년 행특 방향 생성`;
    } catch (guideErr) {
      const guideMsg =
        guideErr instanceof Error ? guideErr.message : "가이드 생성 실패";
      ctx.tasks["setek_guide"] =
        ctx.tasks["setek_guide"] === "completed" ? "completed" : "failed";
      if (ctx.tasks["setek_guide"] === "failed")
        ctx.errors["setek_guide"] = guideMsg;
      ctx.tasks["changche_guide"] =
        ctx.tasks["changche_guide"] === "completed" ? "completed" : "failed";
      if (ctx.tasks["changche_guide"] === "failed")
        ctx.errors["changche_guide"] = guideMsg;
      ctx.tasks["haengteuk_guide"] =
        ctx.tasks["haengteuk_guide"] === "completed" ? "completed" : "failed";
      if (ctx.tasks["haengteuk_guide"] === "failed")
        ctx.errors["haengteuk_guide"] = guideMsg;
    }

    // 상태 DB 저장
    await updatePipelineState(
      ctx.supabase as import("@/lib/supabase/admin").SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results,
      ctx.errors,
    );
  } else {
    // analysis: changche → haengteuk 순차
    const edges = await loadComputedEdges(ctx);
    await runTaskWithState(ctx, "changche_guide", () =>
      runChangcheGuide(ctx, edges),
    );
    if (await checkCancelled(ctx)) return;
    await runTaskWithState(ctx, "haengteuk_guide", () =>
      runHaengteukGuide(ctx, edges),
    );
  }
}

// ============================================
// Phase 7: 요약 + 전략
// ============================================

export async function executePhase7(ctx: PipelineContext): Promise<void> {
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
// Phase 8: 면접 + 로드맵 + 최종 상태 결정
// ============================================

export async function executePhase8(ctx: PipelineContext): Promise<void> {
  if (await checkCancelled(ctx)) return;
  await Promise.allSettled([
    runTaskWithState(ctx, "interview_generation", () =>
      runInterviewGeneration(ctx),
    ),
    runTaskWithState(ctx, "roadmap_generation", () =>
      runRoadmapGeneration(ctx),
    ),
  ]);

  // 최종 상태 결정
  const allCompleted = PIPELINE_TASK_KEYS.every(
    (k) => ctx.tasks[k] === "completed",
  );
  const finalStatus = allCompleted ? "completed" : "failed";
  await updatePipelineState(
    ctx.supabase as import("@/lib/supabase/admin").SupabaseAdminClient,
    ctx.pipelineId,
    finalStatus,
    ctx.tasks,
    ctx.previews,
    ctx.results,
    ctx.errors,
    true,
  );
}

