// ============================================
// 파이프라인 공유 헬퍼 (Phase 분할 실행 지원)
// Phase별 route(phase-1, phase-2, phase-3...)에서 공통으로 사용하는 유틸 모음
// ============================================

import type {
  PipelineContext,
  PipelineTaskKey,
  PipelineTaskStatus,
  PipelineTaskResults,
  TaskRunnerOutput,
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
} from "./pipeline-types";
import { PIPELINE_TASK_KEYS, PIPELINE_TASK_TIMEOUTS } from "./pipeline-types";
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
  key: PipelineTaskKey,
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

  try {
    const timeoutMs = PIPELINE_TASK_TIMEOUTS[key];
    const output = await withTaskTimeout(runner(), timeoutMs, key);
    ctx.tasks[key] = "completed";
    if (typeof output === "string") {
      ctx.previews[key] = output;
    } else {
      ctx.previews[key] = output.preview;
      ctx.results[key] = output.result;
    }
    logActionDebug(LOG_CTX, `Task ${key} completed: ${ctx.previews[key]}`);
  } catch (err) {
    ctx.tasks[key] = "failed";
    const msg = err instanceof Error ? err.message : String(err);
    ctx.errors[key] = msg;
    logActionError(
      { ...LOG_CTX, action: `pipeline.${key}` },
      err,
      { pipelineId: ctx.pipelineId },
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
// chainToNextPhase
// ============================================

/**
 * 다음 Phase API route를 fire-and-forget으로 호출한다.
 * 체이닝 실패 시 에러를 무시 — 사용자가 resume으로 이어서 실행 가능.
 */
export async function chainToNextPhase(
  nextPhase: number,
  pipelineId: string,
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const url = `${baseUrl}/api/admin/pipeline/phase-${nextPhase}`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pipelineId }),
  }).catch((err) => {
    logActionWarn(
      LOG_CTX,
      `Phase ${nextPhase} chain call failed — user can resume manually`,
      { pipelineId, error: String(err) },
    );
  });
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

  // 파이프라인 행 조회
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

  // 태스크 상태 복원 (하위 호환: 누락된 키는 pending 기본값)
  const rawTasks = (row.tasks ?? {}) as Record<string, PipelineTaskStatus>;
  const tasks: Record<string, PipelineTaskStatus> = {};
  for (const key of PIPELINE_TASK_KEYS) {
    tasks[key] = rawTasks[key] ?? "pending";
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

  // pipelineMode 복원
  // DB에 저장된 mode가 있으면 그대로 사용,
  // null이면 레코드 유무로 analysis/prospective 판단
  let pipelineMode: "analysis" | "prospective";

  if (row.mode === "analysis" || row.mode === "prospective") {
    pipelineMode = row.mode;
  } else {
    // mode 컬럼이 null — 레코드 유무로 판단 (신규 파이프라인 또는 구버전 호환)
    const [sRes, cRes, hRes] = await Promise.all([
      admin
        .from("student_record_seteks")
        .select("id, content, grade, subject:subject_id(name)")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      admin
        .from("student_record_changche")
        .select("id, content, grade, activity_type")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
      admin
        .from("student_record_haengteuk")
        .select("id, content, grade")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
    ]);

    const cachedSeteks = (sRes.data ?? []) as unknown as CachedSetek[];
    const cachedChangche = (cRes.data ?? []) as CachedChangche[];
    const cachedHaengteuk = (hRes.data ?? []) as CachedHaengteuk[];

    const hasRecords =
      cachedSeteks.some((s) => s.content?.trim()) ||
      cachedChangche.some((c) => c.content?.trim()) ||
      cachedHaengteuk.some((h) => h.content?.trim());

    pipelineMode = hasRecords ? "analysis" : "prospective";

    // 판단 결과를 DB에 저장 (이후 Phase에서 재판단 방지)
    await admin
      .from("student_record_analysis_pipelines")
      .update({ mode: pipelineMode })
      .eq("id", pipelineId);

    logActionWarn(
      LOG_CTX,
      `Pipeline ${pipelineId}: mode was null — determined as "${pipelineMode}" from record presence`,
      { studentId },
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
      .order("priority", { ascending: false });
    if (planRows) {
      coursePlanData = {
        plans: planRows as unknown as CoursePlanWithSubject[],
      };
    }
  }

  return {
    pipelineId,
    studentId,
    tenantId,
    supabase: admin,
    pipelineMode,
    studentGrade,
    snapshot,
    tasks,
    previews,
    results,
    errors,
    coursePlanData,
  };
}
