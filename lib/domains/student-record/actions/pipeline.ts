"use server";

// ============================================
// AI 초기 분석 파이프라인 — 상태 조회/속도 제한 등 공용 헬퍼
//
// 실제 실행 엔진은 record-analysis/pipeline 으로 이동됨:
//   - record-analysis/pipeline/pipeline-grade-phases.ts
//   - record-analysis/pipeline/pipeline-synthesis-phases.ts
//
// [Grade Pipeline — 학년별, 9태스크×8Phase]
//   Phase 1: competency_setek
//   Phase 2: competency_changche
//   Phase 3: competency_haengteuk (+ 집계)
//   Phase 4: setek_guide + slot_generation (병렬)
//   Phase 5: changche_guide
//   Phase 6: haengteuk_guide
//   Phase 7: draft_generation (설계 모드 전용)
//   Phase 8: draft_analysis   (설계 모드 전용)
//
// [Synthesis Pipeline — 종합, 10태스크×6Phase]
//   Phase 1: storyline_generation
//   Phase 2: edge_computation + guide_matching (병렬)
//   Phase 3: ai_diagnosis + course_recommendation (병렬)
//   Phase 4: bypass_analysis
//   Phase 5: activity_summary + ai_strategy (병렬)
//   Phase 6: interview_generation + roadmap_generation (병렬)
//
// Legacy Pipeline은 제거됨 (/api/admin/pipeline/run 은 410 Gone).
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type {
  PipelineStatus,
  PipelineTaskKey,
  PipelineTaskStatus,
  PipelineTaskResults,
} from "@/lib/domains/record-analysis/pipeline";
import { PIPELINE_TASK_KEYS, computeCascadeResetKeys } from "@/lib/domains/record-analysis/pipeline";
import * as competencyRepo from "../repository/competency-repository";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

// ============================================
// 파이프라인 상태 조회
// ============================================

/** 학생의 최신 파이프라인 상태 조회 */
export async function fetchPipelineStatus(
  studentId: string,
): Promise<ActionResponse<PipelineStatus | null>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("student_record_analysis_pipelines")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return createSuccessResponse(null);

    // 하위 호환: 이전 5-task 파이프라인에서 새 키가 누락된 경우 "pending" 기본값
    const rawTasks = (data.tasks ?? {}) as Record<string, PipelineTaskStatus>;
    const tasks = {} as Record<PipelineTaskKey, PipelineTaskStatus>;
    for (const key of PIPELINE_TASK_KEYS) {
      tasks[key] = rawTasks[key] ?? "pending";
    }

    return createSuccessResponse<PipelineStatus>({
      id: data.id,
      studentId: data.student_id,
      status: data.status,
      mode: (data.mode as "analysis" | "prospective" | null) ?? null,
      tasks,
      taskPreviews: (data.task_previews ?? {}) as Record<string, string>,
      taskResults: (data.task_results ?? {}) as PipelineTaskResults,
      errorDetails: data.error_details as Record<string, string> | null,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
      contentHash: data.content_hash ?? null,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPipelineStatus" }, error, { studentId });
    return createErrorResponse("파이프라인 상태 조회 실패");
  }
}

// ============================================
// 속도 제한 (학생당 1 running + 5/hour)
// ============================================

export async function checkPipelineRateLimit(
  studentId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string | null> {
  // 좀비 파이프라인 자동 정리:
  // Vercel serverless maxDuration=300초이므로 5분 이상 running은 서버 함수가 이미 죽은 상태.
  // HMR/배포/타임아웃 등으로 DB에 running으로 남은 좀비를 cancelled로 마킹.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { error: zombieErr } = await supabase
    .from("student_record_analysis_pipelines")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("status", "running")
    .lt("started_at", fiveMinutesAgo);
  if (zombieErr) {
    logActionError(
      { ...LOG_CTX, action: "checkPipelineRateLimit.zombieCleanup" },
      zombieErr,
      { studentId },
    );
    // 계속 진행 (fail-open)
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentPipelines, error } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, status")
    .eq("student_id", studentId)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false });

  if (error) {
    logActionError({ ...LOG_CTX, action: "checkPipelineRateLimit" }, error, { studentId });
    return null; // fail-open
  }

  const rows = recentPipelines ?? [];
  if (rows.some((r) => r.status === "pending" || r.status === "running")) {
    return "이미 실행 중인 파이프라인이 있습니다. 완료 후 다시 시도해주세요.";
  }
  if (rows.length >= 5) {
    return "1시간 내 최대 5회까지 파이프라인을 실행할 수 있습니다. 잠시 후 다시 시도해주세요.";
  }
  return null;
}

// ============================================
// P2-3: 특정 태스크만 재실행
// ============================================

/** 이어서 실행 시 복원할 기존 파이프라인 상태 */
interface ExistingPipelineState {
  tasks: Record<string, PipelineTaskStatus>;
  previews: Record<string, string>;
  results: Record<string, unknown>;
  errors: Record<string, string>;
}

/** 완료된 파이프라인에서 특정 태스크들만 "pending"으로 리셋 후 재실행 */
export async function rerunPipelineTasks(
  pipelineId: string,
  taskKeys: PipelineTaskKey[],
): Promise<ActionResponse<{ pipelineId: string }>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: pipeline, error: fetchErr } = await supabase
      .from("student_record_analysis_pipelines")
      .select("*")
      .eq("id", pipelineId)
      .single();

    if (fetchErr || !pipeline) {
      return createErrorResponse("파이프라인을 찾을 수 없습니다");
    }
    if (pipeline.status === "running") {
      return createErrorResponse("실행 중인 파이프라인은 재실행할 수 없습니다");
    }

    // 지정된 태스크 + 의존 태스크를 pending으로 리셋
    const tasks = (pipeline.tasks ?? {}) as Record<string, PipelineTaskStatus>;
    const toReset = computeCascadeResetKeys(taskKeys);

    for (const key of toReset) {
      tasks[key] = "pending";
    }

    // P2-3: 재실행 전 기존 task_results 스냅샷 보존
    const prevResults = pipeline.task_results as PipelineTaskResults | null;
    if (prevResults && Object.keys(prevResults).length > 0) {
      const { error: snapErr } = await supabase
        .from("student_record_analysis_pipeline_snapshots")
        .insert({
          pipeline_id: pipelineId,
          tenant_id: pipeline.tenant_id as string,
          student_id: pipeline.student_id as string,
          snapshot: prevResults,
        });
      if (snapErr) logActionWarn(LOG_CTX, `파이프라인 스냅샷 저장 실패: ${snapErr.message}`, { pipelineId });
    }

    await supabase
      .from("student_record_analysis_pipelines")
      .update({ status: "running", tasks, completed_at: null })
      .eq("id", pipelineId);

    // competency_analysis 재실행 시 analysis_cache 무효화 → LLM 강제 재호출
    if (toReset.has("competency_analysis")) {
      await competencyRepo.deleteAnalysisCacheByStudentId(
        pipeline.student_id as string,
        pipeline.tenant_id as string,
      );
    }

    const existingState: ExistingPipelineState = {
      tasks,
      previews: (pipeline.task_previews ?? {}) as Record<string, string>,
      results: (pipeline.task_results ?? {}) as Record<string, unknown>,
      errors: (pipeline.error_details ?? {}) as Record<string, string>,
    };

    return createSuccessResponse({
      pipelineId,
      studentId: pipeline.student_id,
      tenantId: pipeline.tenant_id,
      studentSnapshot: pipeline.input_snapshot as Record<string, unknown> | null,
      existingState,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "rerunPipelineTasks" }, error, { pipelineId });
    return createErrorResponse("태스크 재실행 실패");
  }
}

// ============================================
// 파이프라인 취소
// ============================================

export async function cancelPipeline(
  pipelineId: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // running + pending 모두 cancelled로 전환
    // pending이 남아있으면 재실행 시 checkPipelineRateLimit에 걸려 에러 발생
    await supabase
      .from("student_record_analysis_pipelines")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", pipelineId)
      .in("status", ["running", "pending"]);

    return createSuccessResponse(undefined);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "cancelPipeline" }, error, { pipelineId });
    return createErrorResponse("파이프라인 취소 실패");
  }
}

// ============================================
// 개별 액션 성공 시 파이프라인 상태 동기화
// ============================================

/**
 * 개별 AI 액션이 파이프라인 외부에서 성공했을 때,
 * 해당 태스크의 파이프라인 상태를 "completed"로 갱신한다.
 * Fire-and-forget: 파이프라인이 없거나 갱신 실패해도 에러를 던지지 않는다.
 */
export async function syncPipelineTaskStatus(
  studentId: string,
  taskKey: PipelineTaskKey,
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    // 최신 파이프라인 조회
    const { data } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, tasks")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;

    const tasks = (data.tasks ?? {}) as Record<string, PipelineTaskStatus>;

    // 이미 completed이거나, 실패하지 않았으면 갱신 불필요
    if (tasks[taskKey] !== "failed") return;

    // 태스크 상태 갱신
    tasks[taskKey] = "completed";

    // 전체 상태 재계산
    const allCompleted = PIPELINE_TASK_KEYS.every((k) => tasks[k] === "completed");
    const overallStatus = allCompleted ? "completed" : data.status;

    await supabase
      .from("student_record_analysis_pipelines")
      .update({
        tasks,
        status: overallStatus,
        ...(allCompleted && !data.status?.includes("completed")
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", data.id);

    logActionDebug(
      { ...LOG_CTX, action: "syncPipelineTask" },
      `Task ${taskKey} synced to completed (pipeline: ${data.id})`,
    );
  } catch (err) {
    // fire-and-forget: 동기화 실패는 무시
    logActionWarn({ ...LOG_CTX, action: "syncPipelineTaskStatus" }, "syncPipelineTaskStatus failed (fire-and-forget)", { error: err instanceof Error ? err.message : String(err) });
  }
}

// ============================================
// 태스크 결과 저장 (수동 UI에서 AI 분석 결과 영속화)
// ============================================

/**
 * 수동 경로에서 AI 분석 결과를 파이프라인 task_results에 저장.
 * 파이프라인이 없으면 새로 생성한다.
 */
export async function saveTaskResult(
  studentId: string,
  tenantId: string,
  taskKey: PipelineTaskKey,
  result: unknown,
): Promise<void> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 최신 파이프라인 조회
    const { data: existing } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, task_results")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // 기존 파이프라인에 결과 머지
      const currentResults = (existing.task_results ?? {}) as PipelineTaskResults;
      currentResults[taskKey] = result;

      await supabase
        .from("student_record_analysis_pipelines")
        .update({ task_results: currentResults })
        .eq("id", existing.id);
    } else {
      // 파이프라인 없으면 새로 생성 (수동 분석만 실행한 경우)
      await supabase.from("student_record_analysis_pipelines").insert({
        student_id: studentId,
        tenant_id: tenantId,
        status: "completed",
        tasks: { [taskKey]: "completed" },
        task_results: { [taskKey]: result },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    // fire-and-forget
    logActionWarn({ ...LOG_CTX, action: "saveTaskResult" }, "saveTaskResult failed (fire-and-forget)", { error: err instanceof Error ? err.message : String(err) });
  }
}

// ============================================
// P2-3: 파이프라인 스냅샷 조회
// ============================================

export async function findPipelineSnapshots(studentId: string, limit = 10) {
  await requireAdminOrConsultant();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("student_record_analysis_pipeline_snapshots")
    .select("id, pipeline_id, snapshot, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

