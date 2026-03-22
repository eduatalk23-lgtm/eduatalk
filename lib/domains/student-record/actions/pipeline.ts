"use server";

// ============================================
// AI 초기 분석 파이프라인
// Phase B: 5개 AI 태스크 순차 실행 + DB 상태 추적
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type {
  PipelineStatus,
  PipelineTaskKey,
  PipelineTaskStatus,
} from "../pipeline-types";
import { PIPELINE_TASK_KEYS } from "../pipeline-types";

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

    return createSuccessResponse<PipelineStatus>({
      id: data.id,
      studentId: data.student_id,
      status: data.status,
      tasks: (data.tasks ?? {}) as Record<PipelineTaskKey, PipelineTaskStatus>,
      taskPreviews: (data.task_previews ?? {}) as Record<string, string>,
      errorDetails: data.error_details as Record<string, string> | null,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPipelineStatus" }, error, { studentId });
    return createErrorResponse("파이프라인 상태 조회 실패");
  }
}

// ============================================
// 파이프라인 실행
// ============================================

/** AI 초기 분석 파이프라인 실행 (fire-and-forget safe) */
export async function runInitialAnalysisPipeline(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<{ pipelineId: string }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 이미 running인 파이프라인이 있는지 체크 (중복 방지)
    const { data: existing } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id")
      .eq("student_id", studentId)
      .in("status", ["pending", "running"])
      .limit(1)
      .maybeSingle();

    if (existing) {
      return createSuccessResponse({ pipelineId: existing.id });
    }

    // 학생 정보 스냅샷
    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    // 파이프라인 행 생성
    const initTasks: Record<string, string> = {};
    for (const key of PIPELINE_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "running",
        tasks: initTasks,
        input_snapshot: student ?? {},
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      throw insertError ?? new Error("파이프라인 생성 실패");
    }

    const pipelineId = pipeline.id;

    // 비동기로 태스크 실행 (서버에서 계속 실행됨)
    executePipelineTasks(pipelineId, studentId, tenantId, student).catch((err) => {
      logActionError({ ...LOG_CTX, action: "executePipelineTasks" }, err, { pipelineId });
    });

    return createSuccessResponse({ pipelineId });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runInitialAnalysisPipeline" }, error, { studentId });
    return createErrorResponse("파이프라인 시작 실패");
  }
}

// ============================================
// 태스크 실행 (내부)
// ============================================

async function executePipelineTasks(
  pipelineId: string,
  studentId: string,
  tenantId: string,
  studentSnapshot: Record<string, unknown> | null,
) {
  const supabase = await createSupabaseServerClient();
  const tasks: Record<string, PipelineTaskStatus> = {};
  const previews: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const key of PIPELINE_TASK_KEYS) {
    tasks[key] = "pending";
  }

  const taskRunners: Array<{ key: PipelineTaskKey; run: () => Promise<string> }> = [
    {
      key: "course_recommendation",
      run: async () => {
        const { generateRecommendationsAction } = await import("./coursePlan");
        const result = await generateRecommendationsAction(studentId, tenantId);
        if (!result.success) throw new Error(result.error);
        return `${(result.data as { count?: number })?.count ?? 0}개 과목 추천됨`;
      },
    },
    {
      key: "guide_matching",
      run: async () => {
        const { autoRecommendGuidesAction } = await import("@/lib/domains/guide/actions/auto-recommend");
        const classificationId = studentSnapshot?.target_sub_classification_id as number | null;
        const result = await autoRecommendGuidesAction({
          studentId,
          classificationId,
        });
        if (!result.success) throw new Error(result.error);
        const count = (result.data as { assigned?: number })?.assigned ?? 0;
        return `${count}건 가이드 배정`;
      },
    },
    {
      key: "setek_guide",
      run: async () => {
        const { generateSetekGuide } = await import("../llm/actions/generateSetekGuide");
        const result = await generateSetekGuide(studentId);
        if (!result.success) throw new Error(result.error);
        const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
        return guides ? `${guides.length}과목 방향 생성` : "세특 방향 생성 완료";
      },
    },
    {
      key: "activity_summary",
      run: async () => {
        const { generateActivitySummary } = await import("../llm/actions/generateActivitySummary");
        const grade = (studentSnapshot?.grade as number) ?? 1;
        const grades = Array.from({ length: grade }, (_, i) => i + 1);
        const result = await generateActivitySummary(studentId, grades);
        if (!result.success) throw new Error(result.error);
        return "활동 요약서 생성 완료";
      },
    },
    {
      key: "competency_analysis",
      run: async () => {
        const { analyzeSetekWithHighlight } = await import("../llm/actions/analyzeWithHighlight");
        // 세특 레코드 조회 → 개별 분석
        const { data: seteks } = await supabase
          .from("student_record_seteks")
          .select("id, content, grade, subject:subject_id(name)")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);
        let analyzed = 0;
        for (const s of (seteks ?? [])) {
          const content = s.content as string;
          if (!content || content.trim().length < 20) continue;
          const subj = s.subject as unknown as { name: string } | null;
          try {
            await analyzeSetekWithHighlight({
              recordType: "setek",
              content,
              subjectName: subj?.name,
              grade: s.grade,
            });
            analyzed++;
          } catch {
            // 개별 실패는 무시, 계속 진행
          }
        }
        return `${analyzed}건 역량 분석 완료`;
      },
    },
  ];

  // 순차 실행 (rate limiter가 자동 큐잉)
  for (const { key, run } of taskRunners) {
    tasks[key] = "running";
    await updatePipelineState(supabase, pipelineId, "running", tasks, previews, errors);

    try {
      const preview = await run();
      tasks[key] = "completed";
      previews[key] = preview;
      logActionDebug(LOG_CTX, `Task ${key} completed: ${preview}`);
    } catch (err) {
      tasks[key] = "failed";
      const msg = err instanceof Error ? err.message : String(err);
      errors[key] = msg;
      logActionError({ ...LOG_CTX, action: `pipeline.${key}` }, err, { pipelineId });
    }

    await updatePipelineState(supabase, pipelineId, "running", tasks, previews, errors);
  }

  // 최종 상태 결정
  const allCompleted = PIPELINE_TASK_KEYS.every((k) => tasks[k] === "completed");
  const anyFailed = PIPELINE_TASK_KEYS.some((k) => tasks[k] === "failed");
  const finalStatus = allCompleted ? "completed" : anyFailed ? "failed" : "completed";

  await updatePipelineState(supabase, pipelineId, finalStatus, tasks, previews, errors, true);
}

async function updatePipelineState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pipelineId: string,
  status: string,
  tasks: Record<string, PipelineTaskStatus>,
  previews: Record<string, string>,
  errors: Record<string, string>,
  isFinal = false,
) {
  const update: Record<string, unknown> = {
    status,
    tasks,
    task_previews: previews,
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
// 파이프라인 취소
// ============================================

export async function cancelPipeline(
  pipelineId: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    await supabase
      .from("student_record_analysis_pipelines")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", pipelineId)
      .eq("status", "running");

    return createSuccessResponse(undefined);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "cancelPipeline" }, error, { pipelineId });
    return createErrorResponse("파이프라인 취소 실패");
  }
}
