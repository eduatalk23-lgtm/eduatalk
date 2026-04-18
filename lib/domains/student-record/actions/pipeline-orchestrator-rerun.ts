"use server";

// ============================================
// 파이프라인 태스크 재실행 (7-5)
//   rerunGradePipelineTasks — grade 태스크 재실행 + cascade reset
//   rerunSynthesisPipelineTasks — synthesis 태스크 재실행 + cascade reset + 파생 DB 클린업 (트랙 D, 2026-04-14)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type {
  PipelineTaskStatus,
  PipelineTaskResults,
  GradePipelineTaskKey,
  SynthesisPipelineTaskKey,
  BootstrapTaskKey,
} from "@/lib/domains/record-analysis/pipeline";
import {
  SYNTHESIS_PIPELINE_TASK_KEYS,
  SYNTHESIS_TASK_DEPENDENTS,
  GRADE_TASK_DEPENDENTS,
  PAST_ANALYTICS_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
  BOOTSTRAP_TASK_KEYS,
  PIPELINE_RERUN_CASCADE,
  derivePipelineCascadeKey,
  type PipelineCascadeKey,
} from "@/lib/domains/record-analysis/pipeline";
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
        // LLM 캐시 삭제 → 해당 학년만 강제 재호출 (다른 학년 캐시 보존)
        ...(pipelineGrade != null
          ? [competencyRepo.deleteAnalysisCacheByGrade(
              pipeline.student_id as string,
              pipeline.tenant_id as string,
              pipelineGrade,
            )]
          : [competencyRepo.deleteAnalysisCacheByStudentId(
              pipeline.student_id as string,
              pipeline.tenant_id as string,
            )]),
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

    // 4축×3층 (2026-04-16 D 결정 7): Pipeline-level cascade.
    // grade_analysis 재실행 → past_analytics + blueprint + grade_design + synthesis 리셋
    // grade_design 재실행  → synthesis 리셋
    const pipelineMode = (pipeline.mode as "analysis" | "design" | null) ?? null;
    const sourceKey = derivePipelineCascadeKey("grade", pipelineMode);
    if (sourceKey) {
      await cascadeDownstreamPipelines({
        supabase,
        studentId: pipeline.student_id as string,
        sourceKey,
      });
    }

    return createSuccessResponse({ pipelineId });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "rerunGradePipelineTasks" }, error, { pipelineId });
    return createErrorResponse("grade 태스크 재실행 실패");
  }
}

// ============================================
// Pipeline-level cascade helper (2026-04-16 D)
// ============================================

/**
 * PIPELINE_RERUN_CASCADE에 따라 하류 파이프라인을 전체 pending으로 리셋.
 * 각 하류 파이프라인 유형별 TASK_KEYS로 tasks 재초기화.
 *
 * 주의: grade_design은 pipeline_type='grade' + mode='design'이므로 별도 처리.
 */
async function cascadeDownstreamPipelines(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  studentId: string;
  sourceKey: PipelineCascadeKey;
}): Promise<void> {
  const { supabase, studentId, sourceKey } = params;
  const downstream = PIPELINE_RERUN_CASCADE[sourceKey];
  if (!downstream || downstream.length === 0) return;

  for (const target of downstream) {
    if (target === "synthesis") {
      const { data: synth } = await supabase
        .from("student_record_analysis_pipelines")
        .select("id")
        .eq("student_id", studentId)
        .eq("pipeline_type", "synthesis")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (synth) {
        const tasks: Record<string, PipelineTaskStatus> = {};
        for (const k of SYNTHESIS_PIPELINE_TASK_KEYS) tasks[k] = "pending";
        await supabase
          .from("student_record_analysis_pipelines")
          .update({ status: "pending", tasks, completed_at: null })
          .eq("id", synth.id as string);
      }
      continue;
    }

    if (target === "past_analytics") {
      const { data: past } = await supabase
        .from("student_record_analysis_pipelines")
        .select("id")
        .eq("student_id", studentId)
        .eq("pipeline_type", "past_analytics")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (past) {
        const tasks: Record<string, PipelineTaskStatus> = {};
        for (const k of PAST_ANALYTICS_TASK_KEYS) tasks[k] = "pending";
        await supabase
          .from("student_record_analysis_pipelines")
          .update({ status: "pending", tasks, completed_at: null })
          .eq("id", past.id as string);
      }
      continue;
    }

    if (target === "blueprint") {
      const { data: bp } = await supabase
        .from("student_record_analysis_pipelines")
        .select("id")
        .eq("student_id", studentId)
        .eq("pipeline_type", "blueprint")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (bp) {
        const tasks: Record<string, PipelineTaskStatus> = {};
        for (const k of BLUEPRINT_TASK_KEYS) tasks[k] = "pending";
        await supabase
          .from("student_record_analysis_pipelines")
          .update({ status: "pending", tasks, completed_at: null })
          .eq("id", bp.id as string);
      }
      continue;
    }

    if (target === "grade_design") {
      // grade 파이프라인 중 mode='design' 전부 pending 리셋
      const { data: designGrades } = await supabase
        .from("student_record_analysis_pipelines")
        .select("id, tasks")
        .eq("student_id", studentId)
        .eq("pipeline_type", "grade")
        .eq("mode", "design");
      for (const row of designGrades ?? []) {
        const currentTasks = (row.tasks ?? {}) as Record<string, PipelineTaskStatus>;
        for (const k of Object.keys(currentTasks)) currentTasks[k] = "pending";
        await supabase
          .from("student_record_analysis_pipelines")
          .update({ status: "pending", tasks: currentTasks, completed_at: null })
          .eq("id", row.id as string);
      }
      continue;
    }
  }
}

// ============================================
// 7-6. rerunSynthesisPipelineTasks (트랙 D, 2026-04-14)
// ============================================

/**
 * synthesis 파이프라인 전용 태스크 재실행.
 * - 지정 태스크 + SYNTHESIS_TASK_DEPENDENTS cascade reset.
 * - 각 태스크의 파생 DB 산출물도 함께 클린업하여 실제로 재실행되도록 보장.
 *   (캐시 성격이 아닌 idempotent upsert 대상 테이블들.)
 *
 * 사용처:
 * - 트랙 D 검증: Phase 2 narrative_arc 청크 분할이 실제 300s 내 들어오는지 측정
 * - 파이프라인 구조 변경 후 재검증
 * - 데이터 품질 이슈로 특정 태스크만 강제 재생성
 */
export async function rerunSynthesisPipelineTasks(
  pipelineId: string,
  taskKeys: SynthesisPipelineTaskKey[],
): Promise<ActionResponse<{ pipelineId: string; resetKeys: SynthesisPipelineTaskKey[] }>> {
  try {
    await requireAdminOrConsultant();
    // 트랙 D (2026-04-14): synthesis는 server-autonomous라 admin client 사용.
    //   기존 createSupabaseServerClient는 RLS로 UPDATE silent-fail 위험 + cancelled 상태
    //   리셋이 확정되지 않으면 guardCancelled가 후속 실행을 499로 차단하는 버그 발생.
    const adminClient = createSupabaseAdminClient();

    const { data: pipeline, error: fetchErr } = await adminClient
      .from("student_record_analysis_pipelines")
      .select("*")
      .eq("id", pipelineId)
      .eq("pipeline_type", "synthesis")
      .single();

    if (fetchErr || !pipeline) {
      return createErrorResponse("synthesis 파이프라인을 찾을 수 없습니다");
    }
    if (pipeline.status === "running") {
      return createErrorResponse("실행 중인 파이프라인은 재실행할 수 없습니다");
    }

    const studentId = pipeline.student_id as string;
    const tenantId = pipeline.tenant_id as string;

    // cascade reset: SYNTHESIS_TASK_DEPENDENTS 기반 (상류 reset → 하류도 reset)
    const toReset = new Set<SynthesisPipelineTaskKey>(taskKeys);
    for (const key of taskKeys) {
      for (const dep of SYNTHESIS_TASK_DEPENDENTS[key] ?? []) {
        toReset.add(dep);
      }
    }

    const tasks = (pipeline.tasks ?? {}) as Record<string, PipelineTaskStatus>;
    for (const key of toReset) {
      tasks[key] = "pending";
    }
    // 이전 실행에서 "running" 으로 stuck된 태스크도 pending 으로 일관 복구
    for (const k of Object.keys(tasks)) {
      if (tasks[k] === "running") tasks[k] = "pending";
    }

    // P2-3: 재실행 전 기존 task_results 스냅샷 보존
    const prevResults = pipeline.task_results as PipelineTaskResults | null;
    if (prevResults && Object.keys(prevResults).length > 0) {
      const { error: snapErr } = await adminClient
        .from("student_record_analysis_pipeline_snapshots")
        .insert({
          pipeline_id: pipelineId,
          tenant_id: tenantId,
          student_id: studentId,
          snapshot: prevResults,
        });
      if (snapErr) logActionWarn(LOG_CTX, `synthesis 스냅샷 저장 실패: ${snapErr.message}`, { pipelineId });
    }

    // task_results에서 reset 대상 키의 엔트리 제거 (stale 방지)
    const cleanedResults = { ...(prevResults ?? {}) } as Record<string, unknown>;
    for (const key of toReset) {
      delete cleanedResults[key];
    }

    const { error: updateErr } = await adminClient
      .from("student_record_analysis_pipelines")
      .update({
        status: "pending",
        tasks,
        task_results: cleanedResults,
        completed_at: null,
        error_details: null,
      })
      .eq("id", pipelineId);
    if (updateErr) {
      logActionError({ ...LOG_CTX, action: "rerunSynthesisPipelineTasks" }, updateErr, { pipelineId });
      return createErrorResponse(`파이프라인 상태 리셋 실패: ${updateErr.message}`);
    }

    // ─── 파생 DB 클린업 ───────────────────────────────────────────────
    // 각 태스크가 재실행되어도 의미 있는 결과가 나오도록 영속화된 산출물 삭제.
    // admin client 사용 — RLS 우회 (synthesis는 server-autonomous).

    if (toReset.has("narrative_arc_extraction")) {
      const { error } = await adminClient
        .from("student_record_narrative_arc")
        .delete()
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("source", "ai");
      if (error) logActionWarn(LOG_CTX, `narrative_arc 클린업 실패: ${error.message}`, { pipelineId });
    }

    if (toReset.has("hyperedge_computation")) {
      const { error } = await adminClient
        .from("student_record_hyperedges")
        .delete()
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("edge_context", "analysis");
      if (error) logActionWarn(LOG_CTX, `hyperedges 클린업 실패: ${error.message}`, { pipelineId });
    }

    if (toReset.has("edge_computation")) {
      const { error } = await adminClient
        .from("student_record_edges")
        .delete()
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("edge_context", "analysis");
      if (error) logActionWarn(LOG_CTX, `edges 클린업 실패: ${error.message}`, { pipelineId });
    }

    if (toReset.has("haengteuk_linking")) {
      // 현 학생의 행특 가이드 id 목록을 거쳐 해당 링크만 삭제
      const { data: hgRows } = await adminClient
        .from("student_record_haengteuk_guides")
        .select("id")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId);
      const hgIds = (hgRows ?? []).map((r) => r.id as string);
      if (hgIds.length > 0) {
        // @ts-expect-error — student_record_haengteuk_guide_links는 generated types 미반영
        const { error } = await adminClient
          .from("student_record_haengteuk_guide_links")
          .delete()
          .in("haengteuk_guide_id", hgIds)
          .eq("source", "ai");
        if (error) logActionWarn(LOG_CTX, `haengteuk_links 클린업 실패: ${error.message}`, { pipelineId });
      }
    }

    if (toReset.has("guide_matching")) {
      // AI 생성된 배정만 삭제 (수동/셸 유지는 별도 판단 필요 — 현재는 전체 삭제)
      const { error } = await adminClient
        .from("exploration_guide_assignments")
        .delete()
        .eq("student_id", studentId);
      if (error) logActionWarn(LOG_CTX, `assignments 클린업 실패: ${error.message}`, { pipelineId });
    }

    // storyline / ai_diagnosis / ai_strategy / interview / roadmap 등은 upsert 패턴이라
    // 태스크 재실행만으로 덮어쓰기 충분 → 별도 클린업 불필요.

    return createSuccessResponse({
      pipelineId,
      resetKeys: [...toReset],
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "rerunSynthesisPipelineTasks" }, error, { pipelineId });
    return createErrorResponse("synthesis 태스크 재실행 실패");
  }
}
