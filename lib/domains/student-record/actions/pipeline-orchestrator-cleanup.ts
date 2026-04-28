"use server";

// ============================================
// 파이프라인 자가 치유 (self-healing) — cleanup 전용
//
// 폴링 핫패스에서 분리. 매 폴링마다 실행되던 두 개 작업을
// 명시적 트리거 시점(파이프라인 시작·패널 마운트)에만 호출하도록 격리한다.
//
// 1) analysis 모드 stuck 파이프라인 복구
//    예전 버그로 Phase 6 이 "completed" 마킹을 누락해 모든 task 가 completed
//    인데도 status="running" 으로 고착된 row 가 남는다. 최신 코드에서는 발생
//    하지 않지만 기존 누적 stuck 데이터 복구용.
//
// 2) 좀비 파이프라인 자동 cancel
//    `updated_at` (heartbeat) 기준 5분 이상 정지한 running row 를 cancelled
//    로 마킹. heartbeat 는 runTaskWithState 가 task 진행 중에 갱신하므로
//    임계 5분이면 정상 실행 중인 long-running synthesis 도 안전.
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import { GRADE_PIPELINE_TASK_KEYS } from "@/lib/domains/record-analysis/pipeline";

const LOG_CTX = { domain: "student-record", action: "pipeline-orchestrator-cleanup" };

/**
 * 학생별 stuck/좀비 파이프라인 정리.
 * 명시적 트리거 시점에만 호출 — 폴링 호출 경로에서는 절대 호출하지 말 것.
 *
 * 호출 시점:
 *  - 파이프라인 패널 마운트 (페이지 진입)
 *  - run* 트리거 직전 (run* 액션 내부에서 한 번 더)
 */
export async function cleanupStalePipelinesForStudent(
  studentId: string,
): Promise<ActionResponse<{ healedStuck: number; cancelledZombies: number }>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 1) analysis stuck 복구 — analysis 필수 task 가 모두 completed 인데 status=running 인 row
    let healedStuck = 0;
    {
      const { data: stuckGrade } = await supabase
        .from("student_record_analysis_pipelines")
        .select("id, tasks, mode")
        .eq("student_id", studentId)
        .eq("pipeline_type", "grade")
        .eq("status", "running");

      const ANALYSIS_REQUIRED = GRADE_PIPELINE_TASK_KEYS.filter(
        (k) => k !== "draft_generation" && k !== "draft_analysis",
      );

      for (const row of stuckGrade ?? []) {
        if (row.mode !== "analysis") continue;
        const t = (row.tasks ?? {}) as Record<string, string>;
        const allDone = ANALYSIS_REQUIRED.every((k) => t[k] === "completed");
        if (allDone) {
          await supabase
            .from("student_record_analysis_pipelines")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", row.id as string);
          healedStuck += 1;
        }
      }
    }

    // 2) 좀비 cancel — updated_at 5분 임계
    const zombieThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: cancelled } = await supabase
      .from("student_record_analysis_pipelines")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("student_id", studentId)
      .eq("status", "running")
      .lt("updated_at", zombieThreshold)
      .select("id");

    return createSuccessResponse({
      healedStuck,
      cancelledZombies: cancelled?.length ?? 0,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "cleanupStalePipelinesForStudent" }, error, { studentId });
    return createErrorResponse("파이프라인 정리 실패");
  }
}
