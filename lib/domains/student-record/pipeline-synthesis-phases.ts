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
import { SYNTHESIS_PIPELINE_TASK_KEYS, getTaskResult, setTaskResult } from "./pipeline-types";
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
  const { COMPETENCY_ITEMS } = await import("./constants");
  const { competencyGradeToScore } = await import("./pipeline/synthesis/helpers");

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
  const { generateExecutiveSummary } = await import("./eval/executive-summary");
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
    const { computeAggregateFlowCompletion } = await import("./evaluation-criteria/flow-completion");
    const { calculateCourseAdequacy } = await import("./course-adequacy");

    // 5-1. Flow Completion: content_quality DB 조회
    const { data: qualityRows } = await ctx.supabase
      .from("student_record_content_quality")
      .select("record_type, record_id, specificity, coherence, depth, grammar, scientific_validity, overall_score, issues, feedback")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("source", "ai");

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

    // 5-2. Course Adequacy
    const targetMajor = (ctx.snapshot?.target_major as string) ?? null;
    let courseAdequacy: import("./course-adequacy").CourseAdequacyResult | null = null;
    if (targetMajor) {
      const { data: scoreRowsForCa } = await ctx.supabase
        .from("student_internal_scores")
        .select("subject:subject_id(name)")
        .eq("student_id", studentId)
        .returns<Array<{ subject: { name: string } | null }>>();
      const takenSubjects = [...new Set(
        (scoreRowsForCa ?? []).map((s) => s.subject?.name).filter((n): n is string => !!n),
      )];
      courseAdequacy = calculateCourseAdequacy(targetMajor, takenSubjects, null);
    }

    // 5-3. 학종 입결 참조 (학생 평균 내신)
    const { data: gradeRows } = await ctx.supabase
      .from("student_internal_scores")
      .select("rank_grade")
      .eq("student_id", studentId)
      .not("rank_grade", "is", null);
    const studentGrade = gradeRows && gradeRows.length > 0
      ? gradeRows.reduce((sum, r) => sum + (r.rank_grade as number), 0) / gradeRows.length
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
