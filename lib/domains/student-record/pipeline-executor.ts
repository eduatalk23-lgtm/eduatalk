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
import { PIPELINE_TASK_KEYS, GRADE_PIPELINE_TASK_KEYS, SYNTHESIS_PIPELINE_TASK_KEYS, PIPELINE_TASK_TIMEOUTS, GRADE_PIPELINE_TASK_TIMEOUTS } from "./pipeline-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import {
  logActionDebug,
  logActionError,
  logActionWarn,
} from "@/lib/logging/actionLogger";
import type { CoursePlanTabData } from "./course-plan/types";
import type { CoursePlanWithSubject } from "./course-plan/types";

const LOG_CTX = { domain: "student-record", action: "pipeline-executor" };

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

  await supabase
    .from("student_record_analysis_pipelines")
    .update(update)
    .eq("id", pipelineId);
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
  const pipelineType: "legacy" | "grade" | "synthesis" =
    row.pipeline_type === "grade" || row.pipeline_type === "synthesis"
      ? row.pipeline_type
      : "legacy";
  const targetGrade: number | undefined =
    pipelineType === "grade" && row.grade != null ? (row.grade as number) : undefined;

  // 태스크 상태 복원 (pipeline_type에 따라 사용할 키 셋 결정)
  const rawTasks = (row.tasks ?? {}) as Record<string, PipelineTaskStatus>;
  const tasks: Record<string, PipelineTaskStatus> = {};

  if (pipelineType === "grade") {
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      tasks[key] = rawTasks[key] ?? "pending";
    }
  } else if (pipelineType === "synthesis") {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      tasks[key] = rawTasks[key] ?? "pending";
    }
  } else {
    // legacy: 기존 전체 키 사용
    for (const key of PIPELINE_TASK_KEYS) {
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
    await admin
      .from("student_record_analysis_pipelines")
      .update({ mode: pipelineMode })
      .eq("id", pipelineId);

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
