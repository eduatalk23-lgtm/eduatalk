// ============================================
// 파이프라인 공유 헬퍼 (Phase 분할 실행 지원)
// Phase별 route(phase-1, phase-2, phase-3...)에서 공통으로 사용하는 유틸 모음
// ============================================

import type {
  PipelineContext,
  PipelineTaskKey,
  GradePipelineTaskKey,
  PipelineTaskStatus,
  PipelineTaskResults,
  TaskRunnerOutput,
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
} from "./pipeline-types";
import { resolveRecordData, resolveRecordDataForGrade, deriveGradeCategories } from "./pipeline-data-resolver";
import { PIPELINE_TASK_KEYS, GRADE_PIPELINE_TASK_KEYS, SYNTHESIS_PIPELINE_TASK_KEYS, PAST_ANALYTICS_TASK_KEYS, BLUEPRINT_TASK_KEYS, PIPELINE_TASK_TIMEOUTS, GRADE_PIPELINE_TASK_TIMEOUTS, GRADE_PHASE_TASKS, SYNTHESIS_PHASE_TASKS } from "./pipeline-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import {
  logActionDebug,
  logActionError,
  logActionWarn,
} from "@/lib/logging/actionLogger";
import type { CoursePlanTabData } from "@/lib/domains/student-record/course-plan/types";
import type { CoursePlanWithSubject } from "@/lib/domains/student-record/course-plan/types";

const LOG_CTX = { domain: "record-analysis", action: "pipeline-executor" };

// ============================================
// withTaskTimeout
// ============================================

/** Promise에 타임아웃을 적용. 초과 시 reject. */
export function withTaskTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  taskKey: PipelineTaskKey,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Task "${taskKey}" timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ============================================
// updatePipelineState
// ============================================

export async function updatePipelineState(
  supabase: SupabaseAdminClient,
  pipelineId: string,
  status: string,
  tasks: Record<string, PipelineTaskStatus>,
  previews: Record<string, string>,
  results: PipelineTaskResults,
  errors: Record<string, string>,
  isFinal = false,
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    tasks,
    task_previews: previews,
    task_results: Object.keys(results).length > 0 ? results : null,
    error_details: Object.keys(errors).length > 0 ? errors : null,
  };
  if (isFinal) {
    update.completed_at = new Date().toISOString();
  }

  // CAS 가드: "running"으로 덮어쓰는 경우, 이미 cancelled인 파이프라인은 건드리지 않는다.
  // stopFullRun → cancelPipeline 이후에도 서버 runTaskWithState가 마저 돌면서
  // status를 running으로 되돌려 취소가 무효화되는 race를 방지.
  let query = supabase
    .from("student_record_analysis_pipelines")
    .update(update)
    .eq("id", pipelineId);
  if (status === "running") {
    query = query.neq("status", "cancelled");
  }
  const { error: stateErr } = await query;
  if (stateErr) {
    logActionError({ domain: "record-analysis", action: "pipeline-executor" }, stateErr, { pipelineId, status });
    throw new Error(`파이프라인 상태 저장 실패 (${status}): ${stateErr.message}`);
  }
}

// ============================================
// computePipelineFinalStatus
// ============================================

/**
 * 현재 태스크 상태 맵으로부터 파이프라인 레벨 최종 상태를 계산.
 *
 * - pending/running이 하나라도 있으면 "running" (아직 진행 중)
 * - 모든 required 태스크가 completed면 "completed"
 * - 모든 required가 terminal(completed/failed)이지만 일부라도 failed면 "failed"
 *
 * required 태스크 집합:
 * - grade + analysis mode: GRADE_PIPELINE_TASK_KEYS − {draft_generation, draft_analysis, cross_subject_theme_extraction}
 * - grade + design mode:   GRADE_PIPELINE_TASK_KEYS − {cross_subject_theme_extraction}
 * - synthesis:             SYNTHESIS_PIPELINE_TASK_KEYS (전체 10개)
 *
 * `cross_subject_theme_extraction`은 optional enhancement (Phase 6/8 finalize 로직이
 * 이미 동일하게 취급). 이 태스크가 홀로 pending으로 남아도 파이프라인은 종결 가능해야 함.
 *
 * 기존에는 각 phase 파일(Phase 6 analysis, Phase 8 design, Phase S6)에만 finalize 로직이
 * 있어 경로가 누락되면 파이프라인이 running에 잠기는 버그가 있었다. 이 헬퍼를
 * runTaskWithState와 오케스트레이터 resume 분기에서 공통으로 사용하여 단일 진실 소스로 통합.
 */
export function computePipelineFinalStatus(
  pipelineType: "grade" | "synthesis" | "past_analytics" | "blueprint" | undefined,
  gradeMode: "analysis" | "design" | undefined,
  tasks: Record<string, PipelineTaskStatus>,
): "running" | "completed" | "failed" {
  if (pipelineType == null) return "running";

  let requiredKeys: readonly string[];
  if (pipelineType === "synthesis") {
    requiredKeys = SYNTHESIS_PIPELINE_TASK_KEYS;
  } else if (pipelineType === "past_analytics") {
    requiredKeys = PAST_ANALYTICS_TASK_KEYS;
  } else if (pipelineType === "blueprint") {
    requiredKeys = BLUEPRINT_TASK_KEYS;
  } else if (gradeMode === "design") {
    requiredKeys = GRADE_PIPELINE_TASK_KEYS.filter(
      (k) => k !== "cross_subject_theme_extraction",
    );
  } else {
    requiredKeys = GRADE_PIPELINE_TASK_KEYS.filter(
      (k) =>
        k !== "draft_generation" &&
        k !== "draft_analysis" &&
        k !== "cross_subject_theme_extraction",
    );
  }

  const states = requiredKeys.map((k) => tasks[k] ?? "pending");
  const anyActive = states.some((s) => s === "pending" || s === "running");
  if (anyActive) return "running";

  const allCompleted = states.every((s) => s === "completed");
  return allCompleted ? "completed" : "failed";
}

// ============================================
// checkCancelled
// ============================================

export async function checkCancelled(ctx: PipelineContext): Promise<boolean> {
  const { data } = await ctx.supabase
    .from("student_record_analysis_pipelines")
    .select("status")
    .eq("id", ctx.pipelineId)
    .single();
  if (data?.status === "cancelled") {
    logActionDebug(LOG_CTX, `Pipeline ${ctx.pipelineId} cancelled`);
    return true;
  }
  return false;
}

// ============================================
// runTaskWithState
// ============================================

export async function runTaskWithState(
  ctx: PipelineContext,
  key: PipelineTaskKey | GradePipelineTaskKey,
  runner: () => Promise<TaskRunnerOutput>,
): Promise<void> {
  if (ctx.tasks[key] === "completed") {
    logActionDebug(LOG_CTX, `Task ${key} already completed — skipping`);
    return;
  }

  // 모든 task 실행 전 cancelled 가드 — Phase 4~8 전체 자동 보호
  if (await checkCancelled(ctx)) {
    logActionDebug(LOG_CTX, `Task ${key} skipped — pipeline cancelled`);
    return;
  }

  ctx.tasks[key] = "running";
  await updatePipelineState(
    ctx.supabase as SupabaseAdminClient,
    ctx.pipelineId,
    "running",
    ctx.tasks,
    ctx.previews,
    ctx.results,
    ctx.errors,
  );

  const startMs = Date.now();

  try {
    // grade pipeline 전용 타임아웃 우선, 없으면 legacy 타임아웃
    const timeoutMs =
      (GRADE_PIPELINE_TASK_TIMEOUTS as Record<string, number>)[key] ??
      PIPELINE_TASK_TIMEOUTS[key as PipelineTaskKey];
    const output = await withTaskTimeout(runner(), timeoutMs, key as PipelineTaskKey);
    const elapsedMs = Date.now() - startMs;
    ctx.tasks[key] = "completed";
    if (typeof output === "string") {
      ctx.previews[key] = output;
    } else {
      ctx.previews[key] = output.preview;
      ctx.results[key] = output.result;
    }
    // 소요시간 저장
    ctx.results[key] = {
      ...(typeof ctx.results[key] === "object" && ctx.results[key] != null ? ctx.results[key] as Record<string, unknown> : {}),
      elapsedMs,
    };
    logActionDebug(LOG_CTX, `Task ${key} completed in ${(elapsedMs / 1000).toFixed(1)}s: ${ctx.previews[key]}`);
  } catch (err) {
    const elapsedMs = Date.now() - startMs;
    ctx.tasks[key] = "failed";
    const msg = err instanceof Error ? err.message : String(err);
    ctx.errors[key] = msg;
    ctx.results[key] = {
      ...(typeof ctx.results[key] === "object" && ctx.results[key] != null ? ctx.results[key] as Record<string, unknown> : {}),
      elapsedMs,
    };
    logActionError(
      { ...LOG_CTX, action: `pipeline.${key}` },
      err,
      { pipelineId: ctx.pipelineId, elapsedMs },
    );
  }

  // 파이프라인 레벨 상태 자동 계산: 모든 required 태스크가 종결되면 completed/failed로 전이.
  // 기존에는 여기서 항상 "running"만 썼기 때문에 마지막 phase endpoint가 호출되어야만
  // finalize가 가능했고, 경로가 한 번이라도 누락되면 파이프라인이 영원히 running에 잠겼다.
  const finalStatus = computePipelineFinalStatus(
    ctx.pipelineType,
    ctx.gradeMode,
    ctx.tasks,
  );
  const isFinal = finalStatus === "completed" || finalStatus === "failed";

  await updatePipelineState(
    ctx.supabase as SupabaseAdminClient,
    ctx.pipelineId,
    finalStatus,
    ctx.tasks,
    ctx.previews,
    ctx.results,
    ctx.errors,
    isFinal,
  );

  // E2: 파이프라인 완료 시 경고 스냅샷 저장 (best-effort, 실패해도 파이프라인 영향 없음)
  if (isFinal && finalStatus === "completed") {
    await import("@/lib/domains/student-record/actions/warning-history")
      .then(({ saveWarningSnapshot }) =>
        saveWarningSnapshot(
          ctx.pipelineId,
          ctx.studentId,
          ctx.tenantId,
          ctx.studentGrade,
          ctx.pipelineType,
          ctx.targetGrade ?? null,
        ),
      )
      .catch(() => {});
  }
}

// ============================================
// Phase 판별 (클라이언트 주도 순차 실행용)
// ============================================

/** 현재 태스크 상태에서 다음 실행할 Phase 번호 반환. 모두 완료면 0. */
export function getNextPhase(tasks: Record<string, string>): number {
  // Phase 1: competency_analysis
  if (tasks.competency_analysis !== "completed") return 1;
  // Phase 2: storyline_generation
  if (tasks.storyline_generation !== "completed") return 2;
  // Phase 3: edge_computation, guide_matching
  if (tasks.edge_computation !== "completed" || tasks.guide_matching !== "completed") return 3;
  // Phase 4: ai_diagnosis, course_recommendation, slot_generation
  if (tasks.ai_diagnosis !== "completed" || tasks.course_recommendation !== "completed" || tasks.slot_generation !== "completed") return 4;
  // Phase 5: bypass_analysis, setek_guide
  if (tasks.bypass_analysis !== "completed" || tasks.setek_guide !== "completed") return 5;
  // Phase 6: changche_guide, haengteuk_guide
  if (tasks.changche_guide !== "completed" || tasks.haengteuk_guide !== "completed") return 6;
  // Phase 7: activity_summary, ai_strategy
  if (tasks.activity_summary !== "completed" || tasks.ai_strategy !== "completed") return 7;
  // Phase 8: interview_generation, roadmap_generation
  if (tasks.interview_generation !== "completed" || tasks.roadmap_generation !== "completed") return 8;
  return 0; // 전부 완료
}

// ============================================
// loadPipelineContext
// ============================================

/**
 * DB에서 파이프라인 행을 조회하여 PipelineContext를 복원한다.
 * Phase별 route 진입 시 이전 Phase 상태를 재구성하는 데 사용.
 */
export async function loadPipelineContext(
  pipelineId: string,
): Promise<PipelineContext> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Admin client unavailable — SUPABASE_SERVICE_ROLE_KEY missing");
  }

  // 파이프라인 행 조회 (pipeline_type, grade 포함)
  const { data: row, error } = await admin
    .from("student_record_analysis_pipelines")
    .select("*")
    .eq("id", pipelineId)
    .single();

  if (error || !row) {
    throw new Error(`Pipeline not found: ${pipelineId}`);
  }

  const studentId: string = row.student_id;
  const tenantId: string = row.tenant_id;

  // pipeline_type 복원
  const rawPipelineType: string = row.pipeline_type ?? "legacy";
  if (rawPipelineType === "legacy") {
    throw new Error("레거시 파이프라인은 지원 중단되었습니다. Grade/Synthesis 파이프라인을 사용하세요.");
  }
  const pipelineType: "grade" | "synthesis" | "past_analytics" | "blueprint" =
    rawPipelineType === "grade" ? "grade"
    : rawPipelineType === "past_analytics" ? "past_analytics"
    : rawPipelineType === "blueprint" ? "blueprint"
    : "synthesis";
  const targetGrade: number | undefined =
    pipelineType === "grade" && row.grade != null ? (row.grade as number) : undefined;

  // 태스크 상태 복원 (pipeline_type에 따라 사용할 키 셋 결정)
  const rawTasks = (row.tasks ?? {}) as Record<string, PipelineTaskStatus>;
  const tasks: Record<string, PipelineTaskStatus> = {};

  if (pipelineType === "grade") {
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      tasks[key] = rawTasks[key] ?? "pending";
    }
  } else if (pipelineType === "past_analytics") {
    for (const key of PAST_ANALYTICS_TASK_KEYS) {
      tasks[key] = rawTasks[key] ?? "pending";
    }
  } else if (pipelineType === "blueprint") {
    for (const key of BLUEPRINT_TASK_KEYS) {
      tasks[key] = rawTasks[key] ?? "pending";
    }
  } else {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      tasks[key] = rawTasks[key] ?? "pending";
    }
  }

  const previews: Record<string, string> =
    (row.task_previews ?? {}) as Record<string, string>;
  const results: PipelineTaskResults =
    (row.task_results ?? {}) as PipelineTaskResults;
  const errors: Record<string, string> =
    (row.error_details ?? {}) as Record<string, string>;

  // snapshot 복원
  const snapshot = (row.input_snapshot ?? null) as Record<string, unknown> | null;

  // studentGrade: snapshot에서 추출, 없으면 DB 재조회
  let studentGrade = (snapshot?.grade as number) ?? 0;
  if (!studentGrade) {
    const { data: fresh } = await admin
      .from("students")
      .select("grade")
      .eq("id", studentId)
      .single();
    studentGrade = (fresh?.grade as number) ?? 3;
  }

  // 레코드 조회 — NEIS 기반 해소를 위해 항상 실행
  const [sRes, cRes, hRes] = await Promise.all([
    admin
      .from("student_record_seteks")
      .select("id, content, imported_content, ai_draft_content, grade, subject:subject_id(name)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .returns<CachedSetek[]>(),
    admin
      .from("student_record_changche")
      .select("id, content, imported_content, ai_draft_content, grade, activity_type")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
    admin
      .from("student_record_haengteuk")
      .select("id, content, imported_content, ai_draft_content, grade")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
  ]);

  const allCachedSeteks = sRes.data ?? [];
  const allCachedChangche = (cRes.data ?? []) as CachedChangche[];
  const allCachedHaengteuk = (hRes.data ?? []) as CachedHaengteuk[];

  // grade 파이프라인: targetGrade에 해당하는 레코드만 필터링
  const cachedSeteks = pipelineType === "grade" && targetGrade != null
    ? allCachedSeteks.filter((s) => s.grade === targetGrade)
    : allCachedSeteks;
  const cachedChangche = pipelineType === "grade" && targetGrade != null
    ? allCachedChangche.filter((c) => c.grade === targetGrade)
    : allCachedChangche;
  const cachedHaengteuk = pipelineType === "grade" && targetGrade != null
    ? allCachedHaengteuk.filter((h) => h.grade === targetGrade)
    : allCachedHaengteuk;

  // grade 파이프라인: targetGrade만 해소 / 그 외: 전체 학년 해소
  const resolvedRecords = pipelineType === "grade" && targetGrade != null
    ? resolveRecordDataForGrade(allCachedSeteks, allCachedChangche, allCachedHaengteuk, targetGrade)
    : resolveRecordData(allCachedSeteks, allCachedChangche, allCachedHaengteuk);

  // grade 파이프라인: targetGrade 엔트리 보장 (레코드 0건이어도 컨설팅 모드로 동작)
  if (pipelineType === "grade" && targetGrade != null && !resolvedRecords[targetGrade]) {
    resolvedRecords[targetGrade] = {
      seteks: [],
      changche: [],
      haengteuk: null,
      hasAnyNeis: false,
    };
  }

  // neisGrades/consultingGrades: grade 파이프라인이면 targetGrade 기준으로만 판별
  let neisGrades: number[];
  let consultingGrades: number[];
  if (pipelineType === "grade" && targetGrade != null) {
    const gradeData = resolvedRecords[targetGrade];
    neisGrades = gradeData?.hasAnyNeis ? [targetGrade] : [];
    consultingGrades = gradeData?.hasAnyNeis ? [] : [targetGrade];
  } else {
    ({ neisGrades, consultingGrades } = deriveGradeCategories(resolvedRecords));

    // blueprint/past_analytics 파이프라인: input_snapshot에 저장된 학년 힌트 복원.
    // K=0 prospective(레코드 0건)는 resolvedRecords가 비어있어 consultingGrades가 []가 됨.
    // runBlueprintPipeline/runPastAnalyticsPipeline이 INSERT 시 snapshot에 저장한 배열을 복원.
    if (pipelineType === "blueprint") {
      const snapConsulting = (snapshot?.consultingGrades as number[] | undefined) ?? undefined;
      if (Array.isArray(snapConsulting) && snapConsulting.length > 0) {
        consultingGrades = [...new Set([...consultingGrades, ...snapConsulting])].sort((a, b) => a - b);
      }
    } else if (pipelineType === "past_analytics") {
      const snapNeis = (snapshot?.neisGrades as number[] | undefined) ?? undefined;
      if (Array.isArray(snapNeis) && snapNeis.length > 0) {
        neisGrades = [...new Set([...neisGrades, ...snapNeis])].sort((a, b) => a - b);
      }
    }
  }

  // Grade Pipeline 모드 (analysis/design)
  const gradeMode: "analysis" | "design" | undefined =
    pipelineType === "grade"
      ? (row.mode === "design" ? "design" : "analysis")
      : undefined;

  // pipelineMode 복원
  // DB에 저장된 mode가 있으면 그대로 사용,
  // null이면 NEIS 기반으로 판단 (신규 파이프라인 또는 구버전 호환)
  let pipelineMode: "analysis" | "prospective";

  if (row.mode === "analysis" || row.mode === "prospective") {
    pipelineMode = row.mode;
  } else if (row.mode === "design") {
    // design 모드 grade pipeline → 전체 파이프라인 모드는 NEIS 유무로 판단
    pipelineMode = neisGrades.length > 0 ? "analysis" : "prospective";
  } else {
    // mode 컬럼이 null — NEIS 유무로 판단 (하위 호환)
    pipelineMode = neisGrades.length > 0 ? "analysis" : "prospective";

    // 판단 결과를 DB에 저장 (이후 Phase에서 재판단 방지)
    const { error: modeErr } = await admin
      .from("student_record_analysis_pipelines")
      .update({ mode: pipelineMode })
      .eq("id", pipelineId);
    if (modeErr) logActionWarn(LOG_CTX, `pipeline mode 저장 실패: ${modeErr.message}`, { pipelineId, pipelineMode });

    logActionWarn(
      LOG_CTX,
      `Pipeline ${pipelineId}: mode was null — determined as "${pipelineMode}" from NEIS presence`,
      { studentId, neisGrades, consultingGrades },
    );
  }

  // 수강계획 복원
  let coursePlanData: CoursePlanTabData | null = null;
  {
    const { data: planRows } = await admin
      .from("student_course_plans")
      .select(`
        *,
        subject:subject_id (
          id, name,
          subject_type:subject_type_id ( name ),
          subject_group:subject_group_id ( name )
        )
      `)
      .eq("student_id", studentId)
      .order("grade")
      .order("semester")
      .order("priority", { ascending: false })
      .returns<CoursePlanWithSubject[]>();
    if (planRows) {
      coursePlanData = {
        plans: planRows,
      };
    }
  }

  // S6: qualityPatterns를 task_results.ai_diagnosis에서 복원 (Phase 재시작 시 S5에서 사용)
  const diagResult = results.ai_diagnosis as Record<string, unknown> | undefined;
  const qualityPatterns = Array.isArray(diagResult?.qualityPatterns)
    ? (diagResult.qualityPatterns as Array<{ pattern: string; count: number; subjects: string[] }>)
    : undefined;

  // P2: analysisContext를 task_results._analysisContext에서 복원 (Phase 4-6 재시작 시 사용)
  const persistedAnalysisContext = results._analysisContext as
    import("./pipeline-types").AnalysisContextByGrade | undefined;

  // Synthesis 파이프라인: unifiedInput을 loadPipelineContext에서 빌드
  // (각 Phase route가 별도 HTTP 요청이라 Phase 2+ 에서 ctx.unifiedInput이 undefined였던 버그 수정)
  // assertSynthesisCtx가 unifiedInput을 요구하므로 반드시 여기서 채워야 함
  let unifiedInput: import("./pipeline-unified-input").UnifiedGradeInput | undefined;
  if (pipelineType === "synthesis") {
    try {
      const { buildUnifiedGradeInput } = await import("./pipeline-unified-input");
      unifiedInput = await buildUnifiedGradeInput({
        studentId,
        tenantId,
        studentGrade: (snapshot?.grade as number) ?? studentGrade,
        supabase: admin,
      });
    } catch (err) {
      logActionWarn(
        LOG_CTX,
        `loadPipelineContext: buildUnifiedGradeInput 실패 — Phase 실행 시 assertSynthesisCtx 에서 throw 될 것`,
        { pipelineId, error: err instanceof Error ? err.message : String(err) },
      );
    }
  }

  return {
    pipelineId,
    studentId,
    tenantId,
    supabase: admin,
    studentGrade,
    snapshot,
    tasks,
    previews,
    results,
    errors,
    cachedSeteks,
    cachedChangche,
    cachedHaengteuk,
    coursePlanData,
    resolvedRecords,
    neisGrades,
    consultingGrades,
    pipelineType,
    targetGrade,
    gradeMode,
    qualityPatterns,
    analysisContext: persistedAnalysisContext,
    unifiedInput,
  };
}

// ============================================
// Grade Pipeline Phase 판별
// ============================================

/**
 * Grade 파이프라인의 현재 태스크 상태에서 다음 실행할 Phase 번호를 반환한다.
 * 모두 완료면 0.
 *
 * GradePhase 1: competency_setek
 * GradePhase 2: competency_changche
 * GradePhase 3: competency_haengteuk
 * GradePhase 4: setek_guide + slot_generation (병렬)
 * GradePhase 5: changche_guide
 * GradePhase 6: haengteuk_guide
 * GradePhase 7: draft_generation (설계 모드 전용)
 * GradePhase 8: draft_analysis (설계 모드 전용)
 */
export function getNextGradePhase(tasks: Record<string, string>): number {
  if (tasks.competency_setek !== "completed") return 1;
  if (tasks.competency_changche !== "completed") return 2;
  if (tasks.competency_haengteuk !== "completed") return 3;
  if (tasks.setek_guide !== "completed" || tasks.slot_generation !== "completed") return 4;
  if (tasks.changche_guide !== "completed") return 5;
  if (tasks.haengteuk_guide !== "completed") return 6;
  if (tasks.draft_generation !== "completed") return 7;
  if (tasks.draft_analysis !== "completed") return 8;
  return 0; // 모두 완료
}

// ============================================
// Synthesis Pipeline Phase 판별
// ============================================

/**
 * Synthesis 파이프라인의 현재 태스크 상태에서 다음 실행할 Phase 번호를 반환한다.
 * 모두 완료면 0.
 *
 * SynthPhase 1: storyline_generation
 * SynthPhase 2: edge_computation + guide_matching (순차)
 * SynthPhase 3: ai_diagnosis + course_recommendation (병렬)
 * SynthPhase 4: bypass_analysis
 * SynthPhase 5: activity_summary + ai_strategy (병렬)
 * SynthPhase 6: interview_generation + roadmap_generation (병렬)
 */
export function getNextSynthesisPhase(tasks: Record<string, string>): number {
  if (tasks.storyline_generation !== "completed") return 1;
  // guide_matching은 Phase 2(executeSynthesisPhase2)에서 edge_computation과 함께 실행
  // 둘 중 하나라도 미완료면 Phase 2 재실행
  if (tasks.edge_computation !== "completed" || tasks.guide_matching !== "completed") return 2;
  if (
    tasks.ai_diagnosis !== "completed" ||
    tasks.course_recommendation !== "completed"
  ) return 3;
  if (tasks.bypass_analysis !== "completed") return 4;
  if (tasks.activity_summary !== "completed" || tasks.ai_strategy !== "completed") return 5;
  if (tasks.interview_generation !== "completed" || tasks.roadmap_generation !== "completed") return 6;
  return 0;
}

// ============================================
// Phase 순서 검증
// ============================================

/**
 * Phase 실행 전 선행 Phase 완료 여부 검증.
 *
 * 이전 Phase의 모든 태스크가 completed 또는 failed여야 통과.
 * - completed: 정상 완료
 * - failed: skipIfPrereqFailed에 의해 처리됨 (허용)
 * - pending/running: 이전 Phase 미완료 → 거부
 *
 * @returns null이면 통과, 문자열이면 에러 메시지 (409 응답용)
 */
export function validatePhasePrerequisites(
  ctx: PipelineContext,
  phaseNumber: number,
  pipelineType: "grade" | "synthesis",
): string | null {
  const phaseTasks = pipelineType === "grade"
    ? GRADE_PHASE_TASKS
    : SYNTHESIS_PHASE_TASKS;

  for (let p = 1; p < phaseNumber; p++) {
    const tasks = phaseTasks[p];
    if (!tasks) continue;

    const incomplete = tasks.filter((taskKey) => {
      const status = ctx.tasks[taskKey];
      return status !== "completed" && status !== "failed";
    });

    if (incomplete.length > 0) {
      const details = incomplete
        .map((k) => `${k}=${ctx.tasks[k] || "pending"}`)
        .join(", ");
      return `Phase ${phaseNumber} 실행 불가: Phase ${p} 미완료 (${details})`;
    }
  }

  return null;
}
