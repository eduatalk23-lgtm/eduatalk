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

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
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
import {
  runStorylineGeneration,
  runEdgeComputation,
  runGuideMatching,
  runHaengteukGuideLinking,
  runAiDiagnosis,
  runCourseRecommendation,
  runBypassAnalysis,
  runActivitySummary,
  runAiStrategy,
  runInterviewGeneration,
  runRoadmapGeneration,
} from "./pipeline-task-runners";

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
    .eq("source", "ai");

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
        .eq("source", "ai"),
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
    let courseAdequacy: import("@/lib/domains/student-record/course-adequacy").CourseAdequacyResult | null = null;
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
      const diagnosis = buildFourAxisDiagnosis({
        universityMatch,
        courseAdequacy,
        flowCompletion,
        studentGrade: studentGrade ? Math.round(studentGrade * 10) / 10 : null,
      });
      setTaskResult(ctx.results, "_fourAxisDiagnosis", diagnosis);
    }
  } catch {
    // 4축 산출 실패 무시
  }
}

// ============================================
// 헬퍼: DB에서 영속화된 edges 로드
// ============================================

async function loadComputedEdges(
  ctx: PipelineContext,
): Promise<PersistedEdge[] | CrossRefEdge[]> {
  const { findEdges } = await import("@/lib/domains/student-record/repository/edge-repository");
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

  if (!skipIfSynthPrereqFailed(ctx, "edge_computation")) {
    await runTaskWithState(ctx, "edge_computation", () =>
      runEdgeComputation(ctx),
    );
  }

  if (await checkCancelled(ctx)) return;

  // guide_matching은 선행 없음 — 항상 실행
  await runTaskWithState(ctx, "guide_matching", () =>
    runGuideMatching(ctx),
  );

  // Phase 2 Wave 4.2 (Decision #3 / D5):
  // guide_matching 직후 행특 ↔ 탐구 가이드 링크 생성. best-effort, 실패해도 전체 phase 실패 안 시킴.
  if (await checkCancelled(ctx)) return;
  if (ctx.tasks.guide_matching === "completed") {
    try {
      const result = await runHaengteukGuideLinking(ctx);
      const preview = typeof result === "string" ? result : result.preview;
      logActionDebug(
        { domain: "record-analysis", action: "haengteuk_linking" },
        `행특 링크 생성: ${preview}`,
      );
    } catch (err) {
      logActionError(
        { domain: "record-analysis", action: "haengteuk_linking" },
        err instanceof Error ? err : new Error(String(err)),
        { studentId: ctx.studentId },
      );
    }
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
    await refreshCoursePlanData(ctx);
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

  const summarySkipped = skipIfSynthPrereqFailed(ctx, "activity_summary");
  const strategySkipped = skipIfSynthPrereqFailed(ctx, "ai_strategy");

  if (summarySkipped && strategySkipped) return;

  const edges = summarySkipped ? [] : await loadComputedEdges(ctx);
  const tasks: Promise<unknown>[] = [];
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
// Synthesis Phase 6: 면접 + 로드맵 → 최종 상태
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

  // Synthesis pipeline 최종 상태 판정
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
