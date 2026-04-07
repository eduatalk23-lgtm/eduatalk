"use server";

// ============================================
// 파이프라인 태스크 재실행 (7-5)
//   rerunGradePipelineTasks — grade 태스크 재실행 + cascade reset
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type {
  PipelineTaskStatus,
  PipelineTaskResults,
  GradePipelineTaskKey,
} from "../pipeline-types";
import {
  SYNTHESIS_PIPELINE_TASK_KEYS,
  GRADE_TASK_DEPENDENTS,
} from "../pipeline-types";
import * as competencyRepo from "../repository/competency-repository";

const LOG_CTX = { domain: "student-record", action: "pipeline-orchestrator" };

// ============================================
// 7-5. rerunGradePipelineTasks
// ============================================

/**
 * grade 파이프라인 전용 태스크 재실행.
 * - 지정 태스크 + GRADE_TASK_DEPENDENTS cascade reset.
 * - 해당 학생의 synthesis 파이프라인이 있으면 전체 pending으로 리셋.
 */
export async function rerunGradePipelineTasks(
  pipelineId: string,
  taskKeys: GradePipelineTaskKey[],
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

    // cascade reset: GRADE_TASK_DEPENDENTS 기반
    const toReset = new Set<GradePipelineTaskKey>(taskKeys);
    for (const key of taskKeys) {
      for (const dep of GRADE_TASK_DEPENDENTS[key] ?? []) {
        toReset.add(dep);
      }
    }

    const tasks = (pipeline.tasks ?? {}) as Record<string, PipelineTaskStatus>;
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

    // competency 계열 태스크 재실행 시 analysis_cache + 파생 데이터 무효화
    const GRADE_COMPETENCY_TASKS: GradePipelineTaskKey[] = [
      "competency_setek",
      "competency_changche",
      "competency_haengteuk",
    ];
    const hasCompetencyReset = GRADE_COMPETENCY_TASKS.some((k) => toReset.has(k));
    if (hasCompetencyReset) {
      const pipelineGrade = pipeline.grade as number;
      // grade → school_year 변환 — 호출부에서 계산 (S7: repository에서 students 직접 조회 제거)
      const { calculateSchoolYear, gradeToSchoolYear } = await import("@/lib/utils/schoolYear");
      const currentSchoolYear = calculateSchoolYear();
      const { data: studentRow } = await supabase
        .from("students").select("grade").eq("id", pipeline.student_id as string).single();
      const studentGrade = (studentRow?.grade as number) ?? 3;
      const targetSchoolYear = gradeToSchoolYear(pipelineGrade, studentGrade, currentSchoolYear);

      await Promise.all([
        // LLM 캐시 삭제 → 강제 재호출
        competencyRepo.deleteAnalysisCacheByStudentId(
          pipeline.student_id as string,
          pipeline.tenant_id as string,
        ),
        // 파생 데이터 삭제 → 이전 scores/tags/quality 잔류 방지
        ...(pipelineGrade != null
          ? [competencyRepo.deleteAnalysisResultsByGrade(
              pipeline.student_id as string,
              pipeline.tenant_id as string,
              pipelineGrade,
              targetSchoolYear,
            )]
          : []),
      ]);

      // P2: 영속화된 analysisContext도 클린업 (재분석 시 stale 맥락 방지)
      const taskResults = (pipeline.task_results ?? {}) as Record<string, unknown>;
      if (taskResults._analysisContext) {
        delete taskResults._analysisContext;
        await supabase
          .from("student_record_analysis_pipelines")
          .update({ task_results: taskResults })
          .eq("id", pipelineId);
      }
    }

    // 해당 학생의 synthesis 파이프라인이 있으면 전체 pending으로 리셋
    const { data: synthPipeline } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, tasks")
      .eq("student_id", pipeline.student_id as string)
      .eq("pipeline_type", "synthesis")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (synthPipeline) {
      const synthTasks: Record<string, PipelineTaskStatus> = {};
      for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
        synthTasks[key] = "pending";
      }
      await supabase
        .from("student_record_analysis_pipelines")
        .update({ status: "pending", tasks: synthTasks, completed_at: null })
        .eq("id", synthPipeline.id as string);
    }

    return createSuccessResponse({ pipelineId });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "rerunGradePipelineTasks" }, error, { pipelineId });
    return createErrorResponse("grade 태스크 재실행 실패");
  }
}
