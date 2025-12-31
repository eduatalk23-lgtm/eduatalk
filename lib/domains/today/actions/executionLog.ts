"use server";

/**
 * Plan Execution Log Actions
 *
 * 학습 실행 이벤트를 기록하는 서버 액션
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import type {
  PlanExecutionEventType,
  CreatePlanExecutionLogInput,
  PlanExecutionMetadata,
} from "@/lib/types/plan/domain";

// ============================================
// Types
// ============================================

export type LogExecutionEventResult = {
  success: boolean;
  logId?: string;
  error?: string;
};

export type GetExecutionLogsResult = {
  success: boolean;
  logs?: Array<{
    id: string;
    event_type: PlanExecutionEventType;
    created_at: string;
    elapsed_seconds: number | null;
    progress_percent: number | null;
    status: string | null;
    metadata: PlanExecutionMetadata | null;
  }>;
  error?: string;
};

// ============================================
// Actions
// ============================================

/**
 * 플랜 실행 이벤트 로깅
 *
 * @param input - 로그 생성 입력
 * @returns 로그 생성 결과
 */
export async function logPlanExecutionEvent(
  input: CreatePlanExecutionLogInput
): Promise<LogExecutionEventResult> {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return { success: false, error: "인증되지 않은 사용자입니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 정보 조회하여 tenant_id 가져오기
    const { data: plan, error: planError } = await supabase
      .from("student_plan")
      .select("tenant_id, status, progress")
      .eq("id", input.plan_id)
      .eq("student_id", user.userId)
      .single();

    if (planError || !plan) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    // 로그 생성
    const { data: log, error: insertError } = await supabase
      .from("plan_execution_logs")
      .insert({
        plan_id: input.plan_id,
        student_id: user.userId,
        tenant_id: plan.tenant_id,
        event_type: input.event_type,
        elapsed_seconds: input.elapsed_seconds ?? null,
        progress_percent: input.progress_percent ?? null,
        status: input.status ?? plan.status ?? null,
        previous_value: input.previous_value ?? null,
        new_value: input.new_value ?? null,
        metadata: input.metadata ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      logActionError({ domain: "today", action: "logPlanExecutionEvent" }, insertError);
      return { success: false, error: "로그 저장에 실패했습니다." };
    }

    return { success: true, logId: log?.id };
  } catch (error) {
    logActionError({ domain: "today", action: "logPlanExecutionEvent" }, error);
    return { success: false, error: "예상치 못한 오류가 발생했습니다." };
  }
}

/**
 * 특정 플랜의 실행 로그 조회
 *
 * @param planId - 플랜 ID
 * @param limit - 조회할 로그 수 (기본값: 50)
 * @returns 실행 로그 목록
 */
export async function getPlanExecutionLogs(
  planId: string,
  limit: number = 50
): Promise<GetExecutionLogsResult> {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return { success: false, error: "인증되지 않은 사용자입니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: logs, error } = await supabase
      .from("plan_execution_logs")
      .select(
        "id, event_type, created_at, elapsed_seconds, progress_percent, status, metadata"
      )
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logActionError({ domain: "today", action: "getPlanExecutionLogs" }, error);
      return { success: false, error: "로그 조회에 실패했습니다." };
    }

    return {
      success: true,
      logs: logs as GetExecutionLogsResult["logs"],
    };
  } catch (error) {
    logActionError({ domain: "today", action: "getPlanExecutionLogs" }, error);
    return { success: false, error: "예상치 못한 오류가 발생했습니다." };
  }
}

/**
 * 오늘의 학습 로그 요약 조회
 *
 * @returns 오늘의 학습 통계
 */
export async function getTodayExecutionSummary(): Promise<{
  success: boolean;
  summary?: {
    totalStudySeconds: number;
    completedPlans: number;
    pauseCount: number;
    sessionCount: number;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return { success: false, error: "인증되지 않은 사용자입니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 오늘 날짜 (KST)
    const today = new Date()
      .toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\. /g, "-")
      .replace(".", "");

    const { data: logs, error } = await supabase
      .from("plan_execution_logs")
      .select("event_type, elapsed_seconds")
      .eq("student_id", user.userId)
      .eq("log_date", today);

    if (error) {
      logActionError({ domain: "today", action: "getTodayExecutionSummary" }, error);
      return { success: false, error: "통계 조회에 실패했습니다." };
    }

    // 통계 계산
    let totalStudySeconds = 0;
    let completedPlans = 0;
    let pauseCount = 0;
    let sessionCount = 0;

    for (const log of logs ?? []) {
      switch (log.event_type) {
        case "timer_complete":
          completedPlans++;
          if (log.elapsed_seconds) {
            totalStudySeconds += log.elapsed_seconds;
          }
          break;
        case "timer_pause":
          pauseCount++;
          break;
        case "timer_start":
          sessionCount++;
          break;
      }
    }

    return {
      success: true,
      summary: {
        totalStudySeconds,
        completedPlans,
        pauseCount,
        sessionCount,
      },
    };
  } catch (error) {
    logActionError({ domain: "today", action: "getTodayExecutionSummary" }, error);
    return { success: false, error: "예상치 못한 오류가 발생했습니다." };
  }
}

// ============================================
// Helper Functions (내부 사용)
// ============================================

/**
 * 타이머 이벤트 로깅 헬퍼 (timer.ts에서 사용)
 *
 * 실패해도 에러를 throw하지 않음 (비동기 로깅)
 */
export async function logTimerEvent(
  planId: string,
  eventType: Extract<
    PlanExecutionEventType,
    "timer_start" | "timer_pause" | "timer_resume" | "timer_complete" | "sync"
  >,
  elapsedSeconds?: number,
  metadata?: PlanExecutionMetadata
): Promise<void> {
  try {
    await logPlanExecutionEvent({
      plan_id: planId,
      event_type: eventType,
      elapsed_seconds: elapsedSeconds,
      metadata: {
        trigger: "timer_action",
        ...metadata,
      },
    });
  } catch (error) {
    // 로깅 실패는 무시 (주요 기능에 영향 없도록)
    logActionWarn({ domain: "today", action: "logTimerEvent" }, "Failed to log event", { error: error instanceof Error ? error.message : String(error) });
  }
}
