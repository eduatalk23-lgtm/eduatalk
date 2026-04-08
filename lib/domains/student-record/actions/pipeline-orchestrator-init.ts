"use server";

// ============================================
// 파이프라인 초기화 함수 (7-1 ~ 7-3)
//   runGradePipeline       — 특정 학년 grade 파이프라인 생성
//   runSynthesisPipeline   — synthesis 파이프라인 생성
//   runGradeAwarePipeline  — 학년별 파이프라인 전체 흐름 초기화
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type {
  GradePipelineTaskKey,
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
} from "@/lib/domains/record-analysis/pipeline";
import {
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
} from "@/lib/domains/record-analysis/pipeline";
import { resolveRecordData, deriveGradeCategories } from "@/lib/domains/record-analysis/pipeline";
import { checkPipelineRateLimit } from "./pipeline";
import type { GradeAwarePipelineStartResult } from "./pipeline-orchestrator-types";

const LOG_CTX = { domain: "student-record", action: "pipeline-orchestrator" };

// ============================================
// 7-1. runGradePipeline
// ============================================

/**
 * 특정 학년에 대한 grade 파이프라인 행 생성.
 * 실제 phase 실행은 API route에서 클라이언트 주도로 수행.
 */
export async function runGradePipeline(
  studentId: string,
  tenantId: string,
  grade: number,
): Promise<ActionResponse<{ pipelineId: string; grade: number }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 속도 제한 검사
    const rateLimitError = await checkPipelineRateLimit(studentId, supabase);
    if (rateLimitError) {
      return createErrorResponse(rateLimitError);
    }

    // 학생 스냅샷
    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    // grade 태스크만 초기화
    const initTasks: Record<string, string> = {};
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "running",
        pipeline_type: "grade",
        grade,
        tasks: initTasks,
        input_snapshot: student ?? {},
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      throw insertError ?? new Error("grade 파이프라인 생성 실패");
    }

    return createSuccessResponse({ pipelineId: pipeline.id, grade });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runGradePipeline" }, error, { studentId, grade });
    return createErrorResponse("grade 파이프라인 시작 실패");
  }
}

// ============================================
// 7-2. runSynthesisPipeline
// ============================================

/**
 * synthesis 파이프라인 행 생성.
 * 사전 조건: 해당 학생의 grade 파이프라인이 모두 completed이어야 함.
 */
export async function runSynthesisPipeline(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<{ pipelineId: string }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // grade 파이프라인이 모두 completed인지 확인 (개별 태스크 레벨까지 검증)
    const { data: gradePipelines, error: fetchErr } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, grade, tasks")
      .eq("student_id", studentId)
      .eq("pipeline_type", "grade")
      .order("created_at", { ascending: false });

    if (fetchErr) throw fetchErr;

    const grades = gradePipelines ?? [];
    const allCompleted = grades.length > 0 && grades.every((p) => p.status === "completed");
    if (!allCompleted) {
      return createErrorResponse(
        "모든 학년 파이프라인이 완료된 후 종합 파이프라인을 실행할 수 있습니다",
      );
    }

    // 핵심 태스크(P1~P3 역량분석)가 실제 completed인지 검증
    const CORE_TASKS: GradePipelineTaskKey[] = ["competency_setek", "competency_changche", "competency_haengteuk"];
    const failedGrades: number[] = [];
    for (const p of grades) {
      const tasks = (p.tasks ?? {}) as Record<string, string>;
      const hasFailedCore = CORE_TASKS.some((k) => tasks[k] === "failed");
      if (hasFailedCore) failedGrades.push(p.grade as number);
    }
    if (failedGrades.length > 0) {
      return createErrorResponse(
        `${failedGrades.join(", ")}학년의 역량 분석 태스크가 실패했습니다. 해당 학년을 재실행한 후 시도해주세요.`,
      );
    }

    // grade 파이프라인 ID 목록 (synthesis context용)
    const gradePipelineIds = grades.map((p) => p.id as string);

    // 학생 스냅샷
    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    // synthesis 태스크만 초기화
    const initTasks: Record<string, string> = {};
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    // 이전에 cancelled된 synthesis 파이프라인이 있으면 재사용 (resume)
    const { data: existingCancelled } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, tasks")
      .eq("student_id", studentId)
      .eq("pipeline_type", "synthesis")
      .eq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCancelled) {
      const resumedTasks = {
        ...(existingCancelled.tasks as Record<string, string>),
      };
      for (const k of Object.keys(resumedTasks)) {
        if (resumedTasks[k] === "running") resumedTasks[k] = "pending";
      }
      const { error: updateError } = await supabase
        .from("student_record_analysis_pipelines")
        .update({
          status: "running",
          tasks: resumedTasks,
          completed_at: null,
          error_details: null,
          started_at: new Date().toISOString(),
          input_snapshot: { ...(student ?? {}), gradePipelineIds },
        })
        .eq("id", existingCancelled.id);

      if (updateError) {
        throw updateError;
      }
      return createSuccessResponse({ pipelineId: existingCancelled.id });
    }

    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "running",
        pipeline_type: "synthesis",
        grade: null,
        tasks: initTasks,
        input_snapshot: {
          ...(student ?? {}),
          gradePipelineIds,
        },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      if (insertError?.code === "23505") {
        return createErrorResponse("이미 실행 중인 종합 파이프라인이 있습니다. 완료 후 다시 시도해주세요.");
      }
      throw insertError ?? new Error("synthesis 파이프라인 생성 실패");
    }

    return createSuccessResponse({ pipelineId: pipeline.id });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runSynthesisPipeline" }, error, { studentId });
    return createErrorResponse("synthesis 파이프라인 시작 실패");
  }
}

// ============================================
// 7-3. runGradeAwarePipeline
// ============================================

/**
 * 학년별 파이프라인 전체 흐름 초기화 오케스트레이터.
 * - 데이터가 있는 학년들을 탐지하여 grade 파이프라인 행들을 일괄 생성.
 * - 첫 번째 학년만 status: 'running', 나머지는 status: 'pending'.
 * - options.grades로 특정 학년만 한정 가능.
 */
export async function runGradeAwarePipeline(
  studentId: string,
  tenantId: string,
  options?: { grades?: number[] },
): Promise<ActionResponse<GradeAwarePipelineStartResult>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 속도 제한 검사 (전체 파이프라인 기준)
    const rateLimitError = await checkPipelineRateLimit(studentId, supabase);
    if (rateLimitError) {
      return createErrorResponse(rateLimitError);
    }

    // 학생 스냅샷
    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    // 레코드 데이터 조회 → 어떤 학년에 데이터가 있는지 파악
    const [sRes, cRes, hRes] = await Promise.all([
      supabase
        .from("student_record_seteks")
        .select("id, content, imported_content, grade, subject:subject_id(name)")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      supabase
        .from("student_record_changche")
        .select("id, content, imported_content, grade, activity_type")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
      supabase
        .from("student_record_haengteuk")
        .select("id, content, imported_content, grade")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
    ]);

    const allSeteks = (sRes.data ?? []) as CachedSetek[];
    const allChangche = (cRes.data ?? []) as CachedChangche[];
    const allHaengteuk = (hRes.data ?? []) as CachedHaengteuk[];

    const resolvedRecords = resolveRecordData(allSeteks, allChangche, allHaengteuk);
    const { neisGrades, consultingGrades } = deriveGradeCategories(resolvedRecords);

    // 수강계획이 있는 학년도 컨설팅 대상에 포함 (레코드 없어도 슬롯/방향 생성 필요)
    const { data: coursePlanGradeRows } = await supabase
      .from("student_course_plans")
      .select("grade")
      .eq("student_id", studentId)
      .in("plan_status", ["confirmed", "recommended"]);
    const coursePlanGrades = [...new Set(
      (coursePlanGradeRows ?? []).map((r) => r.grade as number).filter((g) => g >= 1 && g <= 3),
    )];

    // 데이터가 있는 학년 = neisGrades + consultingGrades + 수강계획 학년, 오름차순 정렬
    const allGradesWithData = [...new Set([...neisGrades, ...consultingGrades, ...coursePlanGrades])].sort(
      (a, b) => a - b,
    );

    // options.grades로 필터링 (지정된 경우)
    const targetGrades =
      options?.grades && options.grades.length > 0
        ? allGradesWithData.filter((g) => options.grades!.includes(g))
        : allGradesWithData;

    if (targetGrades.length === 0) {
      return createErrorResponse("파이프라인을 실행할 학년 데이터가 없습니다");
    }

    // grade 파이프라인 행 일괄 생성 (첫 번째만 running, 나머지 pending)
    const created: Array<{ grade: number; pipelineId: string; status: string; mode: "analysis" | "design" }> = [];

    for (let i = 0; i < targetGrades.length; i++) {
      const grade = targetGrades[i];
      const isFirst = i === 0;
      const status = isFirst ? "running" : "pending";

      const initTasks: Record<string, string> = {};
      for (const key of GRADE_PIPELINE_TASK_KEYS) {
        initTasks[key] = "pending";
      }

      // NEIS 데이터가 있는 학년 = analysis, 없는 학년 = design
      const gradeMode = neisGrades.includes(grade) ? "analysis" : "design";

      // 이전에 cancelled된 파이프라인이 있으면 재사용 (resume)
      // running 상태였던 태스크만 pending으로 되돌리고, completed는 그대로 유지
      const { data: existingCancelled } = await supabase
        .from("student_record_analysis_pipelines")
        .select("id, tasks")
        .eq("student_id", studentId)
        .eq("pipeline_type", "grade")
        .eq("grade", grade)
        .eq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCancelled) {
        const resumedTasks = {
          ...(existingCancelled.tasks as Record<string, string>),
        };
        for (const k of Object.keys(resumedTasks)) {
          if (resumedTasks[k] === "running") resumedTasks[k] = "pending";
        }
        const { error: updateError } = await supabase
          .from("student_record_analysis_pipelines")
          .update({
            status,
            tasks: resumedTasks,
            completed_at: null,
            error_details: null,
            started_at: isFirst ? new Date().toISOString() : null,
          })
          .eq("id", existingCancelled.id);

        if (updateError) {
          throw updateError;
        }
        created.push({ grade, pipelineId: existingCancelled.id, status, mode: gradeMode });
        continue;
      }

      const { data: pipeline, error: insertError } = await supabase
        .from("student_record_analysis_pipelines")
        .insert({
          student_id: studentId,
          tenant_id: tenantId,
          created_by: userId,
          status,
          pipeline_type: "grade",
          grade,
          mode: gradeMode,
          tasks: initTasks,
          input_snapshot: student ?? {},
          started_at: isFirst ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (insertError || !pipeline) {
        // unique partial index 위반 = 동일 학생+학년에 이미 running/pending 파이프라인 존재
        if (insertError?.code === "23505") {
          return createErrorResponse("이미 실행 중인 파이프라인이 있습니다. 완료 후 다시 시도해주세요.");
        }
        throw insertError ?? new Error(`학년 ${grade} 파이프라인 생성 실패`);
      }

      created.push({ grade, pipelineId: pipeline.id, status, mode: gradeMode });
    }

    const firstPipelineId = created[0]?.pipelineId ?? null;

    return createSuccessResponse({
      gradePipelines: created,
      firstPipelineId,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runGradeAwarePipeline" }, error, { studentId });
    return createErrorResponse("학년별 파이프라인 시작 실패");
  }
}
