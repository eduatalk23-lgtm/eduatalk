"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TimerLogEventType = "start" | "pause" | "resume" | "complete";

export type TimerLog = {
  id: string;
  plan_id: string;
  event_type: TimerLogEventType;
  timestamp: string;
  duration_seconds: number | null;
  note: string | null;
  created_at: string;
};

/**
 * 타이머 이벤트 로그 기록
 */
export async function recordTimerLog(
  planId: string,
  eventType: TimerLogEventType,
  durationSeconds?: number | null
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    const { error } = await supabase.from("plan_timer_logs").insert({
      plan_id: planId,
      student_id: user.userId,
      tenant_id: tenantContext?.tenantId || null,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      duration_seconds: durationSeconds ?? null,
    });

    if (error) {
      console.error("[timerLogActions] 로그 기록 실패:", error);
      // 로그 기록 실패는 메인 기능에 영향 주지 않음
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[timerLogActions] 로그 기록 중 예외:", error);
    // 로그 기록 실패는 메인 기능에 영향 주지 않음
    return { success: false, error: error instanceof Error ? error.message : "로그 기록에 실패했습니다." };
  }
}

/**
 * 플랜의 타이머 로그 조회
 */
export async function getTimerLogs(
  planId: string
): Promise<{ success: boolean; logs?: TimerLog[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("plan_timer_logs")
      .select("id, plan_id, event_type, timestamp, duration_seconds, note, created_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .order("timestamp", { ascending: false })
      .limit(20); // 최근 20개만 조회

    if (error) {
      console.error("[timerLogActions] 로그 조회 실패:", error);
      return { success: false, error: error.message };
    }

    return { success: true, logs: (data as TimerLog[]) || [] };
  } catch (error) {
    console.error("[timerLogActions] 로그 조회 중 예외:", error);
    return { success: false, error: error instanceof Error ? error.message : "로그 조회에 실패했습니다." };
  }
}

/**
 * 플랜 그룹의 모든 플랜에 대한 타이머 로그 조회
 */
export async function getTimerLogsByPlanNumber(
  planNumber: number | null,
  planDate: string
): Promise<{ success: boolean; logs?: TimerLog[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 먼저 해당 plan_number와 plan_date를 가진 플랜들을 조회
    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select("id")
      .eq("plan_number", planNumber)
      .eq("plan_date", planDate)
      .eq("student_id", user.userId);

    if (plansError) {
      console.error("[timerLogActions] 플랜 조회 실패:", plansError);
      return { success: false, error: plansError.message };
    }

    if (!plans || plans.length === 0) {
      return { success: true, logs: [] };
    }

    const planIds = plans.map((p) => p.id);

    // 해당 플랜들의 로그 조회
    const { data, error } = await supabase
      .from("plan_timer_logs")
      .select("id, plan_id, event_type, timestamp, duration_seconds, note, created_at")
      .in("plan_id", planIds)
      .eq("student_id", user.userId)
      .order("timestamp", { ascending: false })
      .limit(30); // 최근 30개만 조회

    if (error) {
      console.error("[timerLogActions] 로그 조회 실패:", error);
      return { success: false, error: error.message };
    }

    return { success: true, logs: (data as TimerLog[]) || [] };
  } catch (error) {
    console.error("[timerLogActions] 로그 조회 중 예외:", error);
    return { success: false, error: error instanceof Error ? error.message : "로그 조회에 실패했습니다." };
  }
}

