"use server";

// ============================================
// 학년별 파이프라인 오케스트레이터
// pipeline.ts에서 분리된 Grade-Aware Pipeline 함수 모음
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
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
} from "../pipeline-types";
import {
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
  GRADE_TASK_DEPENDENTS,
} from "../pipeline-types";
import { resolveRecordData, deriveGradeCategories } from "../pipeline-data-resolver";
import * as competencyRepo from "../competency-repository";

const LOG_CTX = { domain: "student-record", action: "pipeline-orchestrator" };

// ============================================
// Rate Limit 검사 (pipeline-orchestrator 내부용 인라인 복사)
// 순환 참조 방지를 위해 pipeline.ts에서 import하지 않고 직접 포함
// ============================================

async function checkPipelineRateLimit(
  studentId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string | null> {
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
// 타입 정의
// ============================================

export interface GradeAwarePipelineStartResult {
  /** 학년 → pipelineId 매핑 */
  gradePipelines: Array<{ grade: number; pipelineId: string; status: string }>;
  /** 클라이언트가 즉시 실행해야 할 첫 번째 grade 파이프라인 ID */
  firstPipelineId: string | null;
}

export interface GradeAwarePipelineStatus {
  gradePipelines: Record<
    number,
    {
      pipelineId: string;
      grade: number;
      status: string;
      mode: "analysis" | "design";
      tasks: Record<string, string>;
      previews: Record<string, string>;
      elapsed: Record<string, number>;
      errors: Record<string, string>;
    }
  >;
  synthesisPipeline: {
    pipelineId: string;
    status: string;
    tasks: Record<string, string>;
    previews: Record<string, string>;
    elapsed: Record<string, number>;
    errors: Record<string, string>;
  } | null;
  /** 파이프라인 실행 전에도 NEIS 유무 기반으로 예상 mode를 표시 (1~3학년) */
  expectedModes: Record<number, "analysis" | "design">;
}

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

// ============================================
// 7-4. fetchGradeAwarePipelineStatus
// ============================================

/**
 * 해당 학생의 최근 grade + synthesis 파이프라인 상태를 모두 조회.
 */
export async function fetchGradeAwarePipelineStatus(
  studentId: string,
): Promise<ActionResponse<GradeAwarePipelineStatus>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, pipeline_type, grade, mode, tasks, task_previews, task_results, error_details")
      .eq("student_id", studentId)
      .in("pipeline_type", ["grade", "synthesis"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const gradePipelines: GradeAwarePipelineStatus["gradePipelines"] = {};
    let synthesisPipeline: GradeAwarePipelineStatus["synthesisPipeline"] = null;

    for (const row of rows ?? []) {
      const tasks = (row.tasks ?? {}) as Record<string, string>;
      const previews = (row.task_previews ?? {}) as Record<string, string>;
      const results = (row.task_results ?? {}) as Record<string, Record<string, unknown>>;
      const errors = (row.error_details ?? {}) as Record<string, string>;

      // 태스크별 소요시간 추출
      const elapsed: Record<string, number> = {};
      for (const [k, v] of Object.entries(results)) {
        if (v && typeof v === "object" && "elapsedMs" in v && typeof v.elapsedMs === "number") {
          elapsed[k] = v.elapsedMs;
        }
      }

      if (row.pipeline_type === "grade" && row.grade != null) {
        const gradeNum = row.grade as number;
        // 학년당 가장 최근 파이프라인만 유지 (order by created_at desc 이미 적용)
        if (!(gradeNum in gradePipelines)) {
          // 하위 호환: 기존 7-task 파이프라인에 신규 키 보정
          // 이미 completed인 파이프라인은 신규 태스크도 completed로 간주 (P7/P8은 해당 시점에 없었으므로)
          const isCompleted = row.status === "completed";
          for (const key of GRADE_PIPELINE_TASK_KEYS) {
            if (!(key in tasks)) {
              tasks[key] = isCompleted ? "completed" : "pending";
            }
          }
          gradePipelines[gradeNum] = {
            pipelineId: row.id as string,
            grade: gradeNum,
            status: row.status as string,
            mode: (row.mode === "design" ? "design" : "analysis") as "analysis" | "design",
            tasks,
            previews,
            elapsed,
            errors,
          };
        }
      } else if (row.pipeline_type === "synthesis" && !synthesisPipeline) {
        synthesisPipeline = {
          pipelineId: row.id as string,
          status: row.status as string,
          tasks,
          previews,
          elapsed,
          errors,
        };
      }
    }

    // 파이프라인 실행 전에도 학년별 예상 mode 산출 (NEIS 유무 기반)
    const expectedModes: Record<number, "analysis" | "design"> = {};
    const { data: student } = await supabase
      .from("students")
      .select("grade, tenant_id")
      .eq("id", studentId)
      .single();

    if (student) {
      const tenantId = student.tenant_id as string;
      const [sRes, cRes, hRes, cpRes] = await Promise.all([
        supabase.from("student_record_seteks")
          .select("grade, imported_content")
          .eq("student_id", studentId).eq("tenant_id", tenantId).is("deleted_at", null),
        supabase.from("student_record_changche")
          .select("grade, imported_content")
          .eq("student_id", studentId).eq("tenant_id", tenantId),
        supabase.from("student_record_haengteuk")
          .select("grade, imported_content")
          .eq("student_id", studentId).eq("tenant_id", tenantId),
        supabase.from("student_course_plans")
          .select("grade")
          .eq("student_id", studentId).in("plan_status", ["confirmed", "recommended"]),
      ]);

      const resolvedRecords = resolveRecordData(
        (sRes.data ?? []) as CachedSetek[],
        (cRes.data ?? []) as CachedChangche[],
        (hRes.data ?? []) as CachedHaengteuk[],
      );
      const { neisGrades } = deriveGradeCategories(resolvedRecords);
      const coursePlanGrades = [...new Set(
        ((cpRes.data ?? []) as { grade: number }[]).map((r) => r.grade).filter((g) => g >= 1 && g <= 3),
      )];

      // 레코드 또는 수강계획이 있는 모든 학년에 대해 mode 계산
      const allGrades = [...new Set([
        ...Object.keys(resolvedRecords).map(Number),
        ...coursePlanGrades,
      ])].filter((g) => g >= 1 && g <= 3);

      for (const grade of allGrades) {
        expectedModes[grade] = neisGrades.includes(grade) ? "analysis" : "design";
      }
    }

    return createSuccessResponse({ gradePipelines, synthesisPipeline, expectedModes });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchGradeAwarePipelineStatus" }, error, { studentId });
    return createErrorResponse("학년별 파이프라인 상태 조회 실패");
  }
}

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
            )]
          : []),
      ]);
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
