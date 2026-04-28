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

import type { PipelineContext, SynthesisPipelineTaskKey } from "./pipeline-types";
import { SYNTHESIS_PIPELINE_TASK_KEYS, SYNTHESIS_TASK_PREREQUISITES, getTaskResult, setTaskResult } from "./pipeline-types";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import type { CrossRefEdge } from "@/lib/domains/student-record/cross-reference";
import {
  runTaskWithState,
  checkCancelled,
  updatePipelineState,
} from "./pipeline-executor";
import { startPhaseDeadline, enforcePhaseDeadline } from "./pipeline-route-helpers";
import {
  runStorylineGeneration,
  runEdgeComputation,
  runGuideMatching,
  runHaengteukGuideLinking,
  runHyperedgeComputation,
  runNarrativeArcExtraction,
  runAiDiagnosis,
  runCourseRecommendation,
  runGapTracking,
  runBypassAnalysis,
  runActivitySummary,
  runAiStrategy,
  runInterviewGeneration,
  runRoadmapGeneration,
  runTierPlanRefinement,
} from "./pipeline-task-runners";
import { logActionError } from "@/lib/logging/actionLogger";
import { logActionWarn } from "@/lib/utils/serverActionLogger";

// ============================================
// 선행 태스크 실패 시 자동 스킵 가드
// ============================================

/**
 * 선행 태스크가 실패했으면 해당 태스크를 failed로 마킹하고 true를 반환.
 * 호출부에서 true이면 태스크 실행을 건너뛴다.
 */
function skipIfSynthPrereqFailed(
  ctx: PipelineContext,
  taskKey: SynthesisPipelineTaskKey,
): boolean {
  if (ctx.tasks[taskKey] === "completed") return true;

  const prereqs = SYNTHESIS_TASK_PREREQUISITES[taskKey];
  if (!prereqs) return false;

  const failed = prereqs.filter((p) => ctx.tasks[p] === "failed");
  if (failed.length === 0) return false;

  ctx.tasks[taskKey] = "failed";
  ctx.errors[taskKey] = `선행 태스크 실패로 건너뜀: ${failed.join(", ")}`;
  return true;
}

// ============================================
// 헬퍼: Executive Summary 자동 생성 (best-effort)
// ============================================

async function generateAndCacheExecutiveSummary(ctx: PipelineContext): Promise<void> {
  const { studentId, tenantId } = ctx;

  // 1. ctx.results에서 캐시된 분석 결과 추출
  const diagResult = getTaskResult(ctx.results, "ai_diagnosis");
  const stratResult = getTaskResult(ctx.results, "ai_strategy");

  const timeSeriesAnalysis = diagResult?._timeSeriesAnalysis;
  const universityMatch = stratResult?._universityMatch;

  // 2. 현재 학년도 역량 점수 조회 (ctx.supabase 직접 사용)
  const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");
  const { COMPETENCY_ITEMS } = await import("@/lib/domains/student-record/constants");
  const { competencyGradeToScore } = await import("./synthesis/helpers");

  const currentSchoolYear = calculateSchoolYear();
  const { data: scoreRows } = await ctx.supabase
    .from("student_record_competency_scores")
    .select("competency_item, grade_value")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", currentSchoolYear)
    .in("source", ["ai", "ai_projected"]);

  const competencySnapshots = ((scoreRows ?? []) as Array<{ competency_item: string; grade_value: string }>)
    .map((row) => {
      const itemDef = COMPETENCY_ITEMS.find((i) => i.code === row.competency_item);
      return {
        competencyId: row.competency_item,
        competencyName: itemDef?.label ?? row.competency_item,
        score: competencyGradeToScore(row.grade_value),
      };
    });

  // 역량 스냅샷이 없으면 생성 의미 없음
  if (competencySnapshots.length === 0) return;

  // 3. Executive Summary 생성
  const { generateExecutiveSummary } = await import("@/lib/domains/record-analysis/eval/executive-summary");
  const summary = generateExecutiveSummary({
    studentId,
    competencySnapshots,
    ...(timeSeriesAnalysis ? { timeSeriesAnalysis } : {}),
    ...(universityMatch ? { universityMatch } : {}),
  });

  // 4. ctx.results에 저장
  setTaskResult(ctx.results, "_executiveSummary", summary);

  // 5. 4축 합격 진단 프로필 산출 (best-effort)
  try {
    const { buildFourAxisDiagnosis } = await import("@/lib/domains/admission/prediction/profile-diagnosis");
    const { computeAggregateFlowCompletion } = await import("@/lib/domains/student-record/evaluation-criteria/flow-completion");
    const { calculateCourseAdequacy } = await import("@/lib/domains/student-record/course-adequacy");

    // 5-1~5-3. 독립 쿼리 병렬 실행 (content_quality + student_internal_scores 통합)
    const [{ data: qualityRows }, { data: internalScoreRows }] = await Promise.all([
      ctx.supabase
        .from("student_record_content_quality")
        .select("record_type, record_id, specificity, coherence, depth, grammar, scientific_validity, overall_score, issues, feedback")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .in("source", ["ai", "ai_projected"]),
      ctx.supabase
        .from("student_internal_scores")
        .select("subject:subject_id(name), rank_grade")
        .eq("student_id", studentId)
        .returns<Array<{ subject: { name: string } | null; rank_grade: number | null }>>(),
    ]);

    // Flow Completion
    let flowCompletion: Awaited<ReturnType<typeof computeAggregateFlowCompletion>> | null = null;
    if (qualityRows && qualityRows.length > 0) {
      const records = qualityRows.map((q) => ({
        qualityData: {
          specificity: q.specificity as number,
          coherence: q.coherence as number,
          depth: q.depth as number,
          grammar: q.grammar as number,
          scientific_validity: (q.scientific_validity as number) ?? null,
          overall_score: q.overall_score as number,
          issues: (q.issues as string[]) ?? null,
          feedback: (q.feedback as string) ?? null,
        },
        isCareerSubject: q.record_type === "setek", // 세특만 진로교과 가능 (단순화)
      }));
      const tier = (ctx.snapshot?.target_school_tier as string) === "top" ? "top" as const : "mid" as const;
      flowCompletion = computeAggregateFlowCompletion(records, tier);
    }

    // Course Adequacy (통합 쿼리에서 subject 추출)
    const targetMajor = (ctx.snapshot?.target_major as string) ?? null;
    let courseAdequacy: import("@/lib/domains/student-record/types/service-types").CourseAdequacyResult | null = null;
    if (targetMajor && internalScoreRows) {
      const takenSubjects = [...new Set(
        internalScoreRows.map((s) => s.subject?.name).filter((n): n is string => !!n),
      )];
      courseAdequacy = calculateCourseAdequacy(targetMajor, takenSubjects, null);
    }

    // 학종 입결 참조 (통합 쿼리에서 rank_grade 추출)
    const gradeRows = (internalScoreRows ?? []).filter((r) => r.rank_grade != null);
    const studentGrade = gradeRows.length > 0
      ? gradeRows.reduce((sum, r) => sum + r.rank_grade!, 0) / gradeRows.length
      : null;

    // 5-4. 4축 조합
    if (universityMatch && flowCompletion) {
      const fourAxisInput = {
        universityMatch,
        courseAdequacy,
        flowCompletion,
        studentGrade: studentGrade ? Math.round(studentGrade * 10) / 10 : null,
        targetMajor,
      };
      const diagnosis = buildFourAxisDiagnosis(fourAxisInput);
      setTaskResult(ctx.results, "_fourAxisDiagnosis", diagnosis);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionWarn("buildFourAxisDiagnosis", `4축 산출 실패 — ${msg}`);
  }
}


// ============================================
// 헬퍼: DB에서 영속화된 edges 로드
// ============================================

async function loadComputedEdges(
  ctx: PipelineContext,
): Promise<PersistedEdge[] | CrossRefEdge[]> {
  const { findEdges } = await import("@/lib/domains/student-record/repository/edge-repository");
  // L3-C: analysis(S2 기준) + synthesis_inferred(S3 이후 추론) 합집합.
  // projected(설계 모드 가안)는 진단 프롬프트에서 별도 섹션으로 처리하므로 여기선 제외.
  // Phase 4(S3) 호출 시엔 synthesis_inferred가 아직 없어 analysis만 반환, Phase 5(S5) 호출 시엔 합집합.
  return findEdges(ctx.studentId, ctx.tenantId, ["analysis", "synthesis_inferred"]);
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
    .returns<import("@/lib/domains/student-record/course-plan/types").CoursePlanWithSubject[]>();

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
  if (await checkCancelled(ctx)) return;

  // 통합 입력 빌더: 학년별 분석/설계 데이터를 1회 조합하여 ctx에 저장
  if (!ctx.unifiedInput) {
    try {
      const { buildUnifiedGradeInput } = await import("./pipeline-unified-input");
      ctx.unifiedInput = await buildUnifiedGradeInput({
        studentId: ctx.studentId,
        tenantId: ctx.tenantId,
        studentGrade: (ctx.snapshot?.grade as number | undefined) ?? 1,
        supabase: ctx.supabase,
      });
    } catch {
      // unifiedInput 빌드 실패 시 기존 플로우로 폴백 (치명적이지 않음)
    }
  }

  await runTaskWithState(ctx, "storyline_generation", () =>
    runStorylineGeneration(ctx),
  );

  // Blueprint Phase는 별도 blueprint 파이프라인으로 이전됨 (2026-04-16 D).
  // runFullOrchestration이 synthesis 이전에 blueprint 파이프라인을 선행 실행.
}

// ============================================
// Synthesis Phase 2: 연결 그래프 + 가이드 매칭
// ============================================

// 트랙 D (2026-04-14): Phase 2 재구성.
//   기존: edge + hyperedge(best-effort) + narrative(best-effort, LLM × N) + guide_matching + haengteuk_link(best-effort)
//         → 단일 HTTP 300s 벽 초과 (김세린 사례 elapsed 301s).
//   신규: narrative_arc_extraction을 별도 청크 sub-route(`phase-2/narrative-chunk`)로 분리 +
//         hyperedge/haengteuk_linking을 정식 task_key로 승격(runTaskWithState 래핑).
//   주의: narrative 청크는 클라이언트가 phase-2 main 호출 전에 hasMore=false까지 선행 루프.
//         서버는 narrative 완료를 강제하지 않고, guide_matching 내부에서 DB 상태로 부드럽게 소비.
export async function executeSynthesisPhase2(
  ctx: PipelineContext,
): Promise<void> {
  // Phase 2 누적 예산 가드 — task 사이에 enforcePhaseDeadline 호출.
  // 잔여 예산 < 30s 이면 다음 task 진입 보류 → 다음 polling cycle 에서 재개.
  // (edge ~30s + hyperedge ~60s + guide_matching LLM ~120s + haengteuk ~30s = 최악 240s,
  //  rate-limit 재시도 더해지면 300s 초과 가능 → stuck 방지.)
  const deadline = startPhaseDeadline("synthesis.phase-2");

  if (await checkCancelled(ctx)) return;

  if (!skipIfSynthPrereqFailed(ctx, "edge_computation")) {
    if (!enforcePhaseDeadline(deadline, "edge_computation", ctx.pipelineId)) return;
    await runTaskWithState(ctx, "edge_computation", () =>
      runEdgeComputation(ctx),
    );
  }

  // Layer 2 Hypergraph — edge_computation 선행 필수 (엣지 DB에서 읽음). task_key 승격.
  if (await checkCancelled(ctx)) return;
  if (
    ctx.tasks.edge_computation === "completed" &&
    !skipIfSynthPrereqFailed(ctx, "hyperedge_computation")
  ) {
    if (!enforcePhaseDeadline(deadline, "hyperedge_computation", ctx.pipelineId)) return;
    await runTaskWithState(ctx, "hyperedge_computation", () =>
      runHyperedgeComputation(ctx),
    );
  }

  if (await checkCancelled(ctx)) return;

  // guide_matching은 선행 없음 — 항상 실행
  if (!enforcePhaseDeadline(deadline, "guide_matching", ctx.pipelineId)) return;
  await runTaskWithState(ctx, "guide_matching", () =>
    runGuideMatching(ctx),
  );

  // 행특 ↔ 탐구 가이드 링크 — guide_matching 선행. task_key 승격.
  // M1-c W6 (2026-04-28): chunked sub-route (executeSynthesisPhase2HaengteukChunk) 가 선행
  // 처리한 경우 skip. 클라이언트가 phase-2 main 호출 전에 haengteuk-chunk 를 hasMore=false 까지 loop.
  if (await checkCancelled(ctx)) return;
  if (
    ctx.tasks.guide_matching === "completed" &&
    ctx.tasks.haengteuk_linking !== "completed" &&
    !skipIfSynthPrereqFailed(ctx, "haengteuk_linking")
  ) {
    if (!enforcePhaseDeadline(deadline, "haengteuk_linking", ctx.pipelineId)) return;
    await runTaskWithState(ctx, "haengteuk_linking", () =>
      runHaengteukGuideLinking(ctx),
    );
  }
}

// ============================================
// Synthesis Phase 2 — Narrative Chunk (트랙 D, 2026-04-14)
// ============================================

/**
 * narrative_arc_extraction 청크 실행 진입점.
 * grade P1~P3 자기치유 청크 패턴과 동일 — DB 캐시가 진실 소스, offset 불필요.
 * 성공하면 마지막 청크(!hasMore)에서 task_key completed로 박제.
 */
export interface PhaseChunkResult {
  completed: boolean;
  hasMore: boolean;
  chunkProcessed: number;
  totalUncached: number;
}

export async function executeSynthesisPhase2NarrativeChunk(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) {
    return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  if (ctx.tasks["narrative_arc_extraction"] === "completed") {
    return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  const startMs = Date.now();

  // 첫 청크이면 running 마킹
  if (ctx.tasks["narrative_arc_extraction"] !== "running") {
    ctx.tasks["narrative_arc_extraction"] = "running";
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );
  }

  try {
    const output = await runNarrativeArcExtraction(ctx, chunkSize);
    const { hasMore, totalUncached, chunkProcessed, preview, result } = output;

    ctx.previews["narrative_arc_extraction"] = preview;
    if (!hasMore) {
      ctx.tasks["narrative_arc_extraction"] = "completed";
      setTaskResult(ctx.results, "narrative_arc_extraction", {
        ...result,
        elapsedMs: Date.now() - startMs,
      });
    }

    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );

    return {
      completed: !hasMore,
      hasMore,
      chunkProcessed,
      totalUncached,
    };
  } catch (err) {
    ctx.tasks["narrative_arc_extraction"] = "failed";
    const msg = err instanceof Error ? err.message : String(err);
    ctx.errors["narrative_arc_extraction"] = msg;
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );
    return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }
}

// ============================================
// M1-c W6 (2026-04-28): Synthesis Phase 2 — Haengteuk Linking Chunk
//
// haengteuk_linking 학년별 LLM 호출. 3년 cascade 시 3회 직렬 → 150-180s 도달 위험.
// narrative_arc chunked sub-route 패턴 mimic — 학년 단위 chunk + 별도 HTTP request.
// ============================================

export async function executeSynthesisPhase2HaengteukChunk(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<PhaseChunkResult> {
  if (await checkCancelled(ctx)) {
    return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  if (ctx.tasks["haengteuk_linking"] === "completed") {
    return { completed: true, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }

  const startMs = Date.now();

  if (ctx.tasks["haengteuk_linking"] !== "running") {
    ctx.tasks["haengteuk_linking"] = "running";
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );
  }

  try {
    const { runHaengteukGuideLinkingChunk } = await import("./synthesis");
    const output = await runHaengteukGuideLinkingChunk(ctx, chunkSize);
    const { hasMore, totalUncached, chunkProcessed, preview } = output;

    if (preview) ctx.previews["haengteuk_linking"] = preview;
    if (!hasMore) {
      ctx.tasks["haengteuk_linking"] = "completed";
      setTaskResult(ctx.results, "haengteuk_linking", {
        elapsedMs: Date.now() - startMs,
      });
    }

    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );

    return { completed: !hasMore, hasMore, chunkProcessed, totalUncached };
  } catch (err) {
    ctx.tasks["haengteuk_linking"] = "failed";
    const msg = err instanceof Error ? err.message : String(err);
    ctx.errors["haengteuk_linking"] = msg;
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );
    return { completed: false, hasMore: false, chunkProcessed: 0, totalUncached: 0 };
  }
}

// ============================================
// Synthesis Phase 3: 진단 + 수강 추천
// ============================================

export async function executeSynthesisPhase3(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  const diagSkipped = skipIfSynthPrereqFailed(ctx, "ai_diagnosis");

  if (!ctx.neisGrades?.length) {
    // NEIS 학년 없음: course_recommendation 선행 → coursePlanData 재조회 → diagnosis
    await runTaskWithState(ctx, "course_recommendation", () =>
      runCourseRecommendation(ctx),
    );
    // refreshCoursePlanData throw 시 후속 ai_diagnosis 미실행 → pending 잔존 → phase 4~7 영구 차단.
    // 재조회 실패해도 진단은 ctx.coursePlanData 직전값으로 진행해야 한다.
    try {
      await refreshCoursePlanData(ctx);
    } catch (err) {
      logActionWarn(
        "executeSynthesisPhase3",
        `refreshCoursePlanData 실패 (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!diagSkipped) {
      const edges: PersistedEdge[] | CrossRefEdge[] = [];
      await runTaskWithState(ctx, "ai_diagnosis", () =>
        runAiDiagnosis(ctx, edges, null),
      );
    }
  } else {
    // NEIS 학년 있음: diagnosis + course_recommendation 병렬
    const edges = diagSkipped ? [] : await loadComputedEdges(ctx);
    const tasks: Promise<unknown>[] = [];
    if (!diagSkipped) {
      tasks.push(runTaskWithState(ctx, "ai_diagnosis", () =>
        runAiDiagnosis(ctx, edges, null),
      ));
    }
    tasks.push(runTaskWithState(ctx, "course_recommendation", () =>
      runCourseRecommendation(ctx),
    ));
    await Promise.allSettled(tasks);
    try {
      await refreshCoursePlanData(ctx);
    } catch (err) {
      logActionWarn(
        "executeSynthesisPhase3",
        `refreshCoursePlanData 실패 (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // S3.5: Gap Tracker (blueprint 존재 시에만 — blueprint 없으면 자동 스킵)
  if (!skipIfSynthPrereqFailed(ctx, "gap_tracking")) {
    await runTaskWithState(ctx, "gap_tracking", () =>
      runGapTracking(ctx),
    );
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
// Synthesis Phase 5 — Activity Summary Chunk (Map-Reduce per grade)
//
// activity_summary 태스크를 학년 단위로 1회씩 처리.
// 단일 3년 LLM 호출(~240s) 대신 학년별 ~60s 호출 3회로 분산 → 240s wall 안전 회피.
// narrative-chunk / haengteuk-chunk 패턴 그대로 mimic.
// 클라이언트가 phase-5 main 호출 전 hasMore=false 까지 반복 호출.
// ============================================

export interface ActivitySummaryChunkResult {
  completed: boolean;
  hasMore: boolean;
  processedGrade?: number;
  totalGrades: number;
  completedGrades: number[];
}

export async function executeSynthesisPhase5ActivitySummaryChunk(
  ctx: PipelineContext,
  grade?: number,
): Promise<ActivitySummaryChunkResult> {
  if (await checkCancelled(ctx)) {
    return { completed: false, hasMore: false, totalGrades: 0, completedGrades: [] };
  }

  // 이미 완료됐으면 즉시 반환
  if (ctx.tasks["activity_summary"] === "completed") {
    return { completed: true, hasMore: false, totalGrades: 3, completedGrades: [1, 2, 3] };
  }

  // 대상 학년 목록: neisGrades + consultingGrades 합집합, 없으면 [1,2,3] fallback
  const allGrades = [...new Set([
    ...(ctx.neisGrades ?? []),
    ...(ctx.consultingGrades ?? []),
  ])].sort((a, b) => a - b);
  const targetGrades = allGrades.length > 0 ? allGrades : [1, 2, 3];

  // 이미 처리된 학년: ctx.results._activitySummaryChunkGrades 에 영속
  const completedGrades: number[] = Array.isArray(
    (ctx.results as Record<string, unknown>)["_activitySummaryChunkGrades"],
  )
    ? ((ctx.results as Record<string, unknown>)["_activitySummaryChunkGrades"] as number[])
    : [];

  const remaining = targetGrades.filter((g) => !completedGrades.includes(g));

  // 모든 학년 완료 (또는 대상 없음)
  if (remaining.length === 0) {
    ctx.tasks["activity_summary"] = "completed";
    ctx.previews["activity_summary"] = `활동 요약서 학년별 완료 (${completedGrades.join(", ")}학년)`;
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );
    return {
      completed: true,
      hasMore: false,
      totalGrades: targetGrades.length,
      completedGrades,
    };
  }

  // 첫 청크이면 running 마킹
  if (ctx.tasks["activity_summary"] !== "running") {
    ctx.tasks["activity_summary"] = "running";
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );
  }

  // 처리할 학년: grade 파라미터 지정 시 사용, 없으면 첫 번째 미처리 학년
  const gradeToProcess = grade !== undefined && remaining.includes(grade)
    ? grade
    : remaining[0];

  try {
    const edges = await loadComputedEdges(ctx);
    const { runActivitySummaryForGrade } = await import("./synthesis");
    const outcome = await runActivitySummaryForGrade(ctx, gradeToProcess, edges);

    const updatedCompleted = [...completedGrades, gradeToProcess];
    (ctx.results as Record<string, unknown>)["_activitySummaryChunkGrades"] = updatedCompleted;

    const skipMsg = outcome.skipped ? ` (데이터 없음 — 스킵: ${outcome.reason ?? ""})` : "";
    ctx.previews["activity_summary"] = `활동 요약서 ${gradeToProcess}학년 처리 완료${skipMsg} (${updatedCompleted.length}/${targetGrades.length})`;

    const nextRemaining = targetGrades.filter((g) => !updatedCompleted.includes(g));
    const hasMore = nextRemaining.length > 0;

    if (!hasMore) {
      ctx.tasks["activity_summary"] = "completed";
      ctx.previews["activity_summary"] = `활동 요약서 학년별 완료 (${updatedCompleted.join(", ")}학년)`;
    }

    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );

    return {
      completed: !hasMore,
      hasMore,
      processedGrade: gradeToProcess,
      totalGrades: targetGrades.length,
      completedGrades: updatedCompleted,
    };
  } catch (err) {
    logActionError(
      { domain: "record-analysis", action: "pipeline.synthesis.phase-5.activity-summary-chunk" },
      err,
      { pipelineId: ctx.pipelineId, grade: gradeToProcess },
    );
    ctx.tasks["activity_summary"] = "failed";
    const msg = err instanceof Error ? err.message : String(err);
    ctx.errors["activity_summary"] = msg;
    await updatePipelineState(
      ctx.supabase as SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results ?? {},
      ctx.errors ?? {},
    );
    return {
      completed: false,
      hasMore: false,
      processedGrade: gradeToProcess,
      totalGrades: targetGrades.length,
      completedGrades,
    };
  }
}

// ============================================
// Synthesis Phase 5: 활동 요약 + 보완 전략
// ============================================

export async function executeSynthesisPhase5(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  const summarySkipped = skipIfSynthPrereqFailed(ctx, "activity_summary");
  const strategySkipped = skipIfSynthPrereqFailed(ctx, "ai_strategy");

  if (summarySkipped && strategySkipped) return;

  const edges = summarySkipped ? [] : await loadComputedEdges(ctx);
  const tasks: Promise<unknown>[] = [];
  // activity_summary: chunked sub-route 가 이미 completed 처리한 경우 skip.
  // 아닌 경우(chunked 미호출 폴백): inline 단일 호출 안전망.
  if (!summarySkipped) {
    tasks.push(runTaskWithState(ctx, "activity_summary", () =>
      runActivitySummary(ctx, edges),
    ));
  }
  if (!strategySkipped) {
    tasks.push(runTaskWithState(ctx, "ai_strategy", () => runAiStrategy(ctx)));
  }
  await Promise.allSettled(tasks);
}

// ============================================
// Synthesis Phase 6: 면접 + 로드맵
// (Phase 4b Sprint 3, 2026-04-19): 최종 상태 판정은 Phase 7 로 이관.
// Phase 7 의 tier_plan_refinement 결과까지 반영해야 완전한 파이프라인 종료가 되기 때문.
// ============================================

export async function executeSynthesisPhase6(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  const interviewSkipped = skipIfSynthPrereqFailed(ctx, "interview_generation");
  const roadmapSkipped = skipIfSynthPrereqFailed(ctx, "roadmap_generation");

  if (!interviewSkipped || !roadmapSkipped) {
    const tasks: Promise<unknown>[] = [];
    if (!interviewSkipped) {
      tasks.push(runTaskWithState(ctx, "interview_generation", () =>
        runInterviewGeneration(ctx),
      ));
    }
    if (!roadmapSkipped) {
      tasks.push(runTaskWithState(ctx, "roadmap_generation", () =>
        runRoadmapGeneration(ctx),
      ));
    }
    await Promise.allSettled(tasks);
  }

  // Phase 6 단독 종료 — 최종 상태 판정은 Phase 7 가 담당한다.
  await updatePipelineState(
    ctx.supabase as SupabaseAdminClient,
    ctx.pipelineId,
    "running",
    ctx.tasks,
    ctx.previews,
    ctx.results ?? {},
    ctx.errors ?? {},
  );
}

// ============================================
// Synthesis Phase 7: tier_plan_refinement → 최종 상태
// (Phase 4b Sprint 3, 2026-04-19)
//
// Synthesis 산출물을 근거로 활성 main_exploration.tier_plan 을 재평가.
// 수렴(jaccard ≥ 0.8) 시 no-op, 미수렴 시 origin=auto_bootstrap_v2 로 신규 row INSERT.
// 재부트스트랩 트리거는 Phase 4a staleness 배너가 사용자 클릭으로 주도 (서버-서버 체이닝 금지).
// ============================================

export async function executeSynthesisPhase7(
  ctx: PipelineContext,
): Promise<void> {
  if (await checkCancelled(ctx)) return;

  const refinementSkipped = skipIfSynthPrereqFailed(ctx, "tier_plan_refinement");
  if (!refinementSkipped) {
    await runTaskWithState(ctx, "tier_plan_refinement", () =>
      runTierPlanRefinement(ctx),
    );
  }

  // Synthesis pipeline 최종 상태 판정 (S1-S7 전체 기준)
  const allCompleted = SYNTHESIS_PIPELINE_TASK_KEYS.every(
    (k) => ctx.tasks[k] === "completed",
  );

  // Executive Summary 자동 생성 (best-effort — 실패해도 파이프라인 완료 상태에 영향 없음)
  if (allCompleted) {
    try {
      await generateAndCacheExecutiveSummary(ctx);
    } catch {
      // 실패 무시 — 파이프라인 완료 상태 유지
    }
  }

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
