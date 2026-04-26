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
  PAST_ANALYTICS_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
  BOOTSTRAP_TASK_KEYS,
  computePipelineFinalStatus,
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
    const { userId, role } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 속도 제한 검사 (role 전달 — admin/superadmin 면제, consultant 15/hour)
    const rateLimitError = await checkPipelineRateLimit(studentId, supabase, role);
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

    // past_analytics / blueprint 완료 여부 소프트 검증 (soft warning — hard 차단은 하지 않음).
    // 두 파이프라인은 선택적(NEIS 학년·설계 학년 유무에 따라 생성 안 될 수 있음)이므로,
    // 존재하는 경우에 한해 완료 여부를 확인하고 미완료면 에러 반환.
    const { data: auxPipelines } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, pipeline_type")
      .eq("student_id", studentId)
      .in("pipeline_type", ["past_analytics", "blueprint"])
      .order("created_at", { ascending: false });

    const seenTypes = new Set<string>();
    const latestAux = (auxPipelines ?? []).filter((p) => {
      const type = p.pipeline_type as string;
      if (seenTypes.has(type)) return false;
      seenTypes.add(type);
      return true;
    });
    const incompleteAux = latestAux.filter((p) => p.status !== "completed");
    if (incompleteAux.length > 0) {
      const labels = incompleteAux.map((p) =>
        p.pipeline_type === "past_analytics" ? "기간별 분석(Past Analytics)" : "청사진(Blueprint)",
      );
      return createErrorResponse(
        `${labels.join(", ")} 파이프라인이 완료되지 않았습니다. 전체 시퀀스를 순서대로 실행해주세요.`,
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

    // 최신 synthesis 파이프라인 조회 (상태 무관).
    // 정책: completed는 신규 INSERT로 덮어쓰기, running/pending/cancelled는 전부 resume 대상.
    // "pending/running이 있으면 새로 못 만든다"는 과보호는 제거.
    const { data: latestSynth } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, tasks")
      .eq("student_id", studentId)
      .eq("pipeline_type", "synthesis")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingResumable =
      latestSynth?.status === "running" ||
      latestSynth?.status === "pending" ||
      latestSynth?.status === "cancelled"
        ? latestSynth
        : null;

    if (existingResumable) {
      const resumedTasks = {
        ...(existingResumable.tasks as Record<string, string>),
      };
      for (const k of Object.keys(resumedTasks)) {
        if (resumedTasks[k] === "running") resumedTasks[k] = "pending";
      }

      // Early-finalize 가드: 모든 required 태스크가 이미 종결되어 있으면
      // "running"으로 승격하지 않고 즉시 completed/failed로 마감한다.
      // (캐시로만 끝날 이어서 실행이 DB를 running에 잠그는 버그 차단)
      const resumedStatus = computePipelineFinalStatus(
        "synthesis",
        undefined,
        resumedTasks as Record<string, import("@/lib/domains/record-analysis/pipeline").PipelineTaskStatus>,
      );
      const isTerminal =
        resumedStatus === "completed" || resumedStatus === "failed";
      const effectiveStatus = isTerminal ? resumedStatus : "running";

      const { error: updateError } = await supabase
        .from("student_record_analysis_pipelines")
        .update({
          status: effectiveStatus,
          tasks: resumedTasks,
          completed_at: isTerminal ? new Date().toISOString() : null,
          error_details: null,
          // 실제로 실행될 때만 started_at 리셋
          ...(!isTerminal
            ? { started_at: new Date().toISOString() }
            : {}),
          input_snapshot: { ...(student ?? {}), gradePipelineIds },
        })
        .eq("id", existingResumable.id);

      if (updateError) {
        throw updateError;
      }
      return createSuccessResponse({ pipelineId: existingResumable.id as string });
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
  options?: { grades?: number[]; insertAsPending?: boolean },
): Promise<ActionResponse<GradeAwarePipelineStartResult>> {
  try {
    const { userId, role } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 속도 제한 검사 (전체 파이프라인 기준, role 전달)
    const rateLimitError = await checkPipelineRateLimit(studentId, supabase, role);
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

    // Phase 3 Auto-Bootstrap (2026-04-19): options.grades 명시 시 호출자 의도 존중.
    //   상위 오케스트레이터(`pipeline-orchestrator-full.ts`)가 student.grade 전파로 확장한
    //   [학생 현재 학년..3] 리스트를 전달해도, 예전 로직은 `allGradesWithData` 로 재필터링하여
    //   레코드·수강계획 없는 미래 학년이 드롭 → 설계 파이프라인 공백이 됐다.
    //   options.grades 지정 경로는 범위(1~3) 검증만 수행하고 그대로 통과시킨다.
    const targetGrades =
      options?.grades && options.grades.length > 0
        ? [...new Set(options.grades)]
            .filter((g) => g >= 1 && g <= 3)
            .sort((a, b) => a - b)
        : allGradesWithData;

    if (targetGrades.length === 0) {
      return createErrorResponse("파이프라인을 실행할 학년 데이터가 없습니다");
    }

    // grade 파이프라인 행 일괄 생성.
    //   기본: 첫 번째만 running, 나머지 pending (직접 호출 경로 — 클라이언트가 즉시 실행).
    //   insertAsPending=true: 전부 pending, started_at=null (오케스트레이터 큐잉 경로 —
    //     past/blueprint 실행 뒤에야 design grade가 시작되므로 INSERT 직후 running 마킹 시
    //     5분 zombie cleanup에 오인 cancel 된다. 세션 04-16 I UI 순서 버그의 근본 원인).
    const created: Array<{ grade: number; pipelineId: string; status: string; mode: "analysis" | "design" }> = [];
    const queueOnly = options?.insertAsPending === true;

    for (let i = 0; i < targetGrades.length; i++) {
      const grade = targetGrades[i];
      const isFirst = i === 0;
      const status = queueOnly ? "pending" : isFirst ? "running" : "pending";
      const startedAtValue =
        queueOnly || !isFirst ? null : new Date().toISOString();

      const initTasks: Record<string, string> = {};
      for (const key of GRADE_PIPELINE_TASK_KEYS) {
        initTasks[key] = "pending";
      }

      // NEIS 데이터가 있는 학년 = analysis, 없는 학년 = design
      const gradeMode = neisGrades.includes(grade) ? "analysis" : "design";

      // 가장 최근 grade 파이프라인 조회
      // 정책:
      // - completed        → 그대로 재사용 (초기화 금지)
      // - running/pending/cancelled → 전부 resume 대상으로 통일
      //   ("pending/running이 있으면 에러"는 UX를 막는 과보호였음.
      //    DB unique 제약 + runTaskWithState의 completed 가드로 중복 보호는 충분.)
      // - 그 외 (행 없음) → 신규 INSERT
      const { data: latestPipeline } = await supabase
        .from("student_record_analysis_pipelines")
        .select("id, status, tasks")
        .eq("student_id", studentId)
        .eq("pipeline_type", "grade")
        .eq("grade", grade)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 완료된 파이프라인 재사용: 새 행 INSERT 금지 (전체 실행 시 "초기화" 방지)
      // 완료 Phase는 클라이언트 runFullSequence에서 자동 스킵됨.
      if (latestPipeline?.status === "completed") {
        created.push({
          grade,
          pipelineId: latestPipeline.id as string,
          status: "completed",
          mode: gradeMode,
        });
        continue;
      }

      // running/pending/cancelled 전부 resume 경로로 통일.
      // - running: 이전 세션이 중단됐거나 좀비. 클라이언트가 이어서 실행 가능.
      // - pending: isFirst가 아닌 학년이 이전에 만들어졌으나 미시작.
      // - cancelled: 사용자가 명시적으로 중단한 것.
      const existingResumable =
        latestPipeline?.status === "running" ||
        latestPipeline?.status === "pending" ||
        latestPipeline?.status === "cancelled"
          ? latestPipeline
          : null;

      if (existingResumable) {
        const resumedTasks = {
          ...(existingResumable.tasks as Record<string, string>),
        };
        for (const k of Object.keys(resumedTasks)) {
          if (resumedTasks[k] === "running") resumedTasks[k] = "pending";
        }

        // Early-finalize 가드: 모든 required 태스크가 이미 종결되어 있으면
        // "running"/"pending"으로 승격하지 않고 즉시 completed/failed로 마감한다.
        // (캐시로만 끝날 이어서 실행이 DB를 running에 잠그는 버그 차단)
        const resumedStatus = computePipelineFinalStatus(
          "grade",
          gradeMode,
          resumedTasks as Record<string, import("@/lib/domains/record-analysis/pipeline").PipelineTaskStatus>,
        );
        const isTerminal =
          resumedStatus === "completed" || resumedStatus === "failed";
        const effectiveStatus = isTerminal ? resumedStatus : status;

        const { error: updateError } = await supabase
          .from("student_record_analysis_pipelines")
          .update({
            status: effectiveStatus,
            tasks: resumedTasks,
            completed_at: isTerminal ? new Date().toISOString() : null,
            error_details: null,
            // started_at 정책:
            //   terminal(early-finalize)   → 기존 타임라인 유지 (건드리지 않음)
            //   queueOnly(오케스트레이터)  → null 리셋 (첫 phase 실행 시 runTaskWithState가 찍음)
            //   직접 호출 + isFirst        → now() (즉시 실행됨)
            //   직접 호출 + non-first      → 건드리지 않음
            ...(isTerminal
              ? {}
              : queueOnly
                ? { started_at: null }
                : isFirst
                  ? { started_at: new Date().toISOString() }
                  : {}),
          })
          .eq("id", existingResumable.id);

        if (updateError) {
          throw updateError;
        }
        created.push({
          grade,
          pipelineId: existingResumable.id as string,
          status: effectiveStatus,
          mode: gradeMode,
        });
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
          started_at: startedAtValue,
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
// 7-6. runPastAnalyticsPipeline (4축×3층 A층, 2026-04-16 D)
// ============================================

/**
 * Past Analytics 파이프라인 행 생성.
 * NEIS 학년(k≥1)이 존재할 때만 실행. 3 Phase: Storyline → Diagnosis → Strategy.
 * 실제 phase 실행은 API route(`/api/admin/pipeline/past-analytics/[phase]`)에서 수행.
 */
export async function runPastAnalyticsPipeline(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<{ pipelineId: string; neisGrades: number[] }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // NEIS 데이터 존재 학년 감지
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
    const resolvedRecords = resolveRecordData(
      (sRes.data ?? []) as CachedSetek[],
      (cRes.data ?? []) as CachedChangche[],
      (hRes.data ?? []) as CachedHaengteuk[],
    );
    const { neisGrades } = deriveGradeCategories(resolvedRecords);
    if (neisGrades.length === 0) {
      return createErrorResponse("NEIS 학년 데이터가 없어 Past Analytics를 실행할 수 없습니다");
    }

    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    const initTasks: Record<string, string> = {};
    for (const key of PAST_ANALYTICS_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    // status="pending" + started_at=null: 오케스트레이터가 여러 파이프라인을 한 번에 INSERT하는
    // 큐잉 경로에서 INSERT 즉시 "running" 마킹하면 analysis grade 실행 중(5~10분) zombie cleanup에
    // 오인 cancel 된다. 첫 phase 실행 시점에 runTaskWithState가 status를 running으로 승격한다.
    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "pending",
        pipeline_type: "past_analytics",
        grade: null,
        tasks: initTasks,
        input_snapshot: { ...(student ?? {}), neisGrades },
        started_at: null,
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      if (insertError?.code === "23505") {
        return createErrorResponse("이미 실행 중인 Past Analytics 파이프라인이 있습니다.");
      }
      throw insertError ?? new Error("past_analytics 파이프라인 생성 실패");
    }

    return createSuccessResponse({ pipelineId: pipeline.id, neisGrades });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runPastAnalyticsPipeline" }, error, { studentId });
    return createErrorResponse("Past Analytics 파이프라인 시작 실패");
  }
}

// ============================================
// 7-8. runBootstrapPipeline (Phase 0 자동 셋업, 2026-04-18)
// ============================================

/**
 * Bootstrap 파이프라인 행 생성 (pipelineType="bootstrap").
 * target_major 진입 시 선결 조건 자동 보강: BT0/BT1/BT2 (3 태스크).
 * 실제 phase 실행은 API route(`/api/admin/pipeline/bootstrap/phase-1`)에서 수행.
 *
 * 동시성 보호: idx_unique_running_bootstrap_pipeline 위반(23505) 시 "이미 실행 중" 에러.
 */
export async function runBootstrapPipeline(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<{ pipelineId: string }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    const initTasks: Record<string, string> = {};
    for (const key of BOOTSTRAP_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    // status="pending" + started_at=null: 오케스트레이터 큐잉 경로 —
    // runTaskWithState가 첫 phase 실행 시 status를 running으로 승격한다.
    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "pending",
        pipeline_type: "bootstrap",
        grade: null,
        tasks: initTasks,
        input_snapshot: student ?? {},
        started_at: null,
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      if (insertError?.code === "23505") {
        return createErrorResponse("이미 실행 중인 Bootstrap 파이프라인이 있습니다.");
      }
      throw insertError ?? new Error("bootstrap 파이프라인 생성 실패");
    }

    return createSuccessResponse({ pipelineId: pipeline.id });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runBootstrapPipeline" }, error, { studentId });
    return createErrorResponse("Bootstrap 파이프라인 시작 실패");
  }
}

// ============================================
// 7-7. runBlueprintPipeline (4축×3층 B층, 2026-04-16 D)
// ============================================

/**
 * Blueprint 파이프라인 행 생성.
 * 설계 대상 학년(consultingGrades, k<3)이 존재할 때만 실행. 단일 Phase: blueprint_generation.
 */
export async function runBlueprintPipeline(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<{ pipelineId: string; consultingGrades: number[] }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 설계 대상 학년 = 레코드 없는 학년 + 수강계획만 있는 학년
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
    const resolvedRecords = resolveRecordData(
      (sRes.data ?? []) as CachedSetek[],
      (cRes.data ?? []) as CachedChangche[],
      (hRes.data ?? []) as CachedHaengteuk[],
    );
    const { consultingGrades } = deriveGradeCategories(resolvedRecords);
    if (consultingGrades.length === 0) {
      return createErrorResponse(
        "설계 대상 학년이 없어 Blueprint 파이프라인을 실행할 수 없습니다 (k=3, 졸업 학생)",
      );
    }

    // L0 전제 체크는 Phase 실행 시점(phase-b1-blueprint.ts)에만 수행.
    // INSERT 시점에 체크하면 Bootstrap(BT1 main_exploration_seed)이 아직 실행 전이라
    // 활성 메인 탐구가 없어서 풀런이 차단됨 — Auto-Bootstrap 철학과 모순.
    // Phase 실행 시점에는 이미 graceful degrade(task="completed" + "활성 메인 탐구 없음" preview)로 처리됨.

    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    const initTasks: Record<string, string> = {};
    for (const key of BLUEPRINT_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    // status="pending" + started_at=null: past_analytics와 동일. 오케스트레이터 큐잉 경로 —
    // grade(analysis)+past_analytics 완료 뒤에야 B1이 실행되므로 INSERT 즉시 running 마킹 시
    // zombie cleanup으로 오인 cancel 된다.
    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "pending",
        pipeline_type: "blueprint",
        grade: null,
        tasks: initTasks,
        input_snapshot: { ...(student ?? {}), consultingGrades },
        started_at: null,
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      if (insertError?.code === "23505") {
        return createErrorResponse("이미 실행 중인 Blueprint 파이프라인이 있습니다.");
      }
      throw insertError ?? new Error("blueprint 파이프라인 생성 실패");
    }

    return createSuccessResponse({ pipelineId: pipeline.id, consultingGrades });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runBlueprintPipeline" }, error, { studentId });
    return createErrorResponse("Blueprint 파이프라인 시작 실패");
  }
}
