"use server";

// ============================================
// 7-8. runFullOrchestration (2026-04-16 D, 4축×3층 통합)
//
// L0 (Main Exploration) 전제 → L2 (Analysis, k≥1) → A층 (Past Analytics, k≥1)
// → B층 (Blueprint, k<3) → L3 (Design, k<3) → C층 (Synthesis, 항상)
//
// 각 단계는 파이프라인 INSERT만 수행(상태="running"/"pending"). Phase 실행은 클라이언트
// 주도 HTTP route (`/api/admin/pipeline/{type}/[phase]`)에서 수행.
//
// 학생 유형별 매트릭스 (k = NEIS 학년 수):
//   k=0 (1학년 prospective): Blueprint → L3(1,2,3) → Synthesis
//   k=1 (2학년):              L2(1) → A층 → Blueprint → L3(2,3) → Synthesis
//   k=2 (3학년):              L2(1,2) → A층 → Blueprint → L3(3) → Synthesis
//   k=3 (졸업):                L2(1,2,3) → A층 → Synthesis (Blueprint 스킵)
//
// NOTE: Synthesis INSERT는 이 오케스트레이터에서 수행하지 않는다.
//   runSynthesisPipeline이 "모든 grade 파이프라인 completed" 선행 조건을 체크하므로
//   이 오케스트레이터 호출 시점(INSERT 직후)엔 실패. 클라이언트가 Grade/Past/Blueprint
//   phase 실행을 완료한 뒤 별도로 runSynthesisPipeline을 호출해야 한다.
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import {
  resolveRecordData,
  deriveGradeCategories,
} from "@/lib/domains/record-analysis/pipeline";
import type {
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
} from "@/lib/domains/record-analysis/pipeline";
import {
  runGradeAwarePipeline,
  runPastAnalyticsPipeline,
  runBlueprintPipeline,
} from "./pipeline-orchestrator-init";
import {
  ensureBootstrap,
  BootstrapError,
} from "@/lib/domains/record-analysis/pipeline/bootstrap";

const LOG_CTX = { domain: "student-record", action: "pipeline-orchestrator-full" };

export interface FullOrchestrationResult {
  /** 생성된 각 파이프라인 ID (있는 것만 포함). synthesis는 클라이언트가 별도 생성. */
  pipelineIds: {
    gradeNeis?: string[];
    pastAnalytics?: string;
    blueprint?: string;
    gradeProspective?: string[];
  };
  /** 실행 경로 스냅샷 */
  route: {
    neisGrades: number[];
    consultingGrades: number[];
    skipped: Array<"past_analytics" | "blueprint">;
  };
}

/**
 * 전체 파이프라인 오케스트레이션.
 *
 * 동작:
 * 1. L0 전제 검증 — 활성 메인 탐구 존재 확인
 * 2. 학년 카테고리 결정 (neisGrades / consultingGrades)
 * 3. NEIS 학년 있으면 → runGradeAwarePipeline(analysis 대상) → runPastAnalyticsPipeline
 * 4. 설계 학년 있으면 → runBlueprintPipeline → runGradeAwarePipeline(design 대상)
 * 5. 항상 → runSynthesisPipeline
 *
 * 각 step은 파이프라인 행 INSERT만. 실제 Phase 실행은 클라이언트가 HTTP route로 주도.
 */
export async function runFullOrchestration(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<FullOrchestrationResult>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // ── 1. Phase 0 Auto-Bootstrap: 선결 조건 자동 보강 ────
    // target_major 검증 + main_exploration/course_plan 누락 자동 생성.
    // 실패 시 파이프라인 진입 차단 (BootstrapError → createErrorResponse).
    try {
      const bootstrap = await ensureBootstrap(studentId, tenantId);
      logActionDebug(LOG_CTX, "bootstrap 완료", { studentId, ...bootstrap });
    } catch (err) {
      if (err instanceof BootstrapError) {
        logActionError(LOG_CTX, err, { studentId, step: `bootstrap:${err.step}` });
        return createErrorResponse(`자동 셋업 실패(${err.step}): ${err.message}`);
      }
      throw err;
    }

    // ── 2. 학년 카테고리 결정 ──────────────────────────
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
    const { neisGrades, consultingGrades } = deriveGradeCategories(resolvedRecords);

    const pipelineIds: FullOrchestrationResult["pipelineIds"] = {};
    const skipped: Array<"past_analytics" | "blueprint"> = [];

    // ── 3. NEIS 경로: Grade(analysis) + Past Analytics ─────
    //   insertAsPending: 전체 오케스트레이션은 sequential이므로 INSERT는 전부 큐잉만 하고
    //   실제 실행(→ running 마킹)은 클라이언트 runFullSequence의 각 phase HTTP 호출이 주도한다.
    //   INSERT 즉시 running 마킹하면 INSERT~실행 사이 대기시간(5~10분)에 zombie cleanup이 오인 cancel.
    if (neisGrades.length > 0) {
      const gradeRes = await runGradeAwarePipeline(studentId, tenantId, {
        grades: neisGrades,
        insertAsPending: true,
      });
      if (!gradeRes.success) return createErrorResponse(gradeRes.error);
      pipelineIds.gradeNeis = gradeRes.data.gradePipelines.map((p) => p.pipelineId);

      const pastRes = await runPastAnalyticsPipeline(studentId, tenantId);
      if (!pastRes.success) return createErrorResponse(pastRes.error);
      pipelineIds.pastAnalytics = pastRes.data.pipelineId;
    } else {
      skipped.push("past_analytics");
    }

    // ── 4. Prospective 경로: Blueprint + Grade(design) ───
    if (consultingGrades.length > 0) {
      const bpRes = await runBlueprintPipeline(studentId, tenantId);
      if (!bpRes.success) return createErrorResponse(bpRes.error);
      pipelineIds.blueprint = bpRes.data.pipelineId;

      const gradeRes = await runGradeAwarePipeline(studentId, tenantId, {
        grades: consultingGrades,
        insertAsPending: true,
      });
      if (!gradeRes.success) return createErrorResponse(gradeRes.error);
      pipelineIds.gradeProspective = gradeRes.data.gradePipelines.map((p) => p.pipelineId);
    } else {
      skipped.push("blueprint");
    }

    // ── 5. C층: Synthesis는 여기서 INSERT하지 않음. ─────
    //    Grade/Past/Blueprint phase 실행이 끝난 뒤 클라이언트가 runSynthesisPipeline 호출.

    logActionDebug(LOG_CTX, "Full orchestration 완료", {
      studentId,
      neisGradeCount: neisGrades.length,
      consultingGradeCount: consultingGrades.length,
      skipped,
    });

    return createSuccessResponse({
      pipelineIds,
      route: {
        neisGrades,
        consultingGrades,
        skipped,
      },
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runFullOrchestration" }, error, { studentId });
    return createErrorResponse("전체 파이프라인 오케스트레이션 실패");
  }
}
