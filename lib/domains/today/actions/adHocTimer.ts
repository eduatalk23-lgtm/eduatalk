"use server";

/**
 * Ad-hoc Plan Timer Actions
 *
 * ad_hoc_plans 테이블의 타이머 기능을 위한 서버 액션입니다.
 * student_study_sessions 없이 ad_hoc_plans 테이블의 필드를 직접 업데이트합니다.
 * - started_at: 시작 시각
 * - completed_at: 완료 시각
 * - actual_minutes: 실제 소요 시간 (분)
 * - status: 상태 ('pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled')
 */

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logActionError } from "@/lib/logging/actionLogger";
import { TIMER_ERRORS } from "../errors";
import type {
  StartPlanResult,
  PausePlanResult,
  ResumePlanResult,
  CompletePlanResult,
} from "../types";

/**
 * Ad-hoc 플랜 타이머 시작
 *
 * @param adHocPlanId - ad_hoc_plans 테이블의 ID
 * @returns StartPlanResult
 */
export async function startAdHocPlan(
  adHocPlanId: string
): Promise<StartPlanResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: TIMER_ERRORS.AUTH_REQUIRED };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 1. Ad-hoc 플랜 조회
    const { data: adHocPlan, error: planError } = await supabase
      .from("ad_hoc_plans")
      .select("id, started_at, completed_at, status")
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planError) {
      logActionError({ domain: "today", action: "startAdHocPlan.fetch" }, planError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_QUERY_ERROR };
    }

    if (!adHocPlan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    // 2. 이미 완료된 플랜인지 확인
    if (adHocPlan.status === "completed" || adHocPlan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    // 3. 이미 시작된 플랜인지 확인 (재시작 방지)
    if (adHocPlan.status === "in_progress" && adHocPlan.started_at) {
      return {
        success: false,
        error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_SAME_PLAN,
      };
    }

    // 4. 다른 활성 세션 확인 (student_plan 기반)
    const { data: activeSessions } = await supabase
      .from("student_study_sessions")
      .select("plan_id, paused_at")
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .not("plan_id", "is", null);

    // 일시정지되지 않은 실제 활성 세션만 필터링
    const trulyActiveSessions = activeSessions?.filter(
      (s) => !s.paused_at
    ) ?? [];

    if (trulyActiveSessions.length > 0) {
      return {
        success: false,
        error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
      };
    }

    // 5. 다른 활성 ad_hoc_plan 확인
    const { data: activeAdHocPlans } = await supabase
      .from("ad_hoc_plans")
      .select("id")
      .eq("student_id", user.userId)
      .eq("status", "in_progress")
      .neq("id", adHocPlanId);

    if (activeAdHocPlans && activeAdHocPlans.length > 0) {
      return {
        success: false,
        error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
      };
    }

    // 6. 플랜 시작: started_at 및 status 업데이트
    const startTime = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("ad_hoc_plans")
      .update({
        started_at: startTime,
        status: "in_progress",
      })
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId);

    if (updateError) {
      logActionError({ domain: "today", action: "startAdHocPlan.update" }, updateError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_UPDATE_FAILED };
    }

    revalidatePath("/today");
    revalidatePath("/plan/calendar");

    return {
      success: true,
      serverNow: Date.now(),
      status: "RUNNING",
      startedAt: startTime,
      accumulatedSeconds: 0,
    };
  } catch (error) {
    logActionError({ domain: "today", action: "startAdHocPlan" }, error, { adHocPlanId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 시작에 실패했습니다.",
    };
  }
}

/**
 * Ad-hoc 플랜 타이머 완료
 *
 * @param adHocPlanId - ad_hoc_plans 테이블의 ID
 * @param actualMinutes - 실제 소요 시간 (분), 없으면 started_at부터 계산
 * @returns CompletePlanResult
 */
export async function completeAdHocPlan(
  adHocPlanId: string,
  actualMinutes?: number
): Promise<CompletePlanResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: TIMER_ERRORS.AUTH_REQUIRED };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 1. Ad-hoc 플랜 조회
    const { data: adHocPlan, error: planError } = await supabase
      .from("ad_hoc_plans")
      .select("id, started_at, completed_at, status")
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planError) {
      logActionError({ domain: "today", action: "startAdHocPlan.fetch" }, planError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_QUERY_ERROR };
    }

    if (!adHocPlan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    // 2. 이미 완료된 플랜인지 확인
    if (adHocPlan.status === "completed" || adHocPlan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    // 3. 실제 소요 시간 계산
    const completedAt = new Date().toISOString();
    let calculatedMinutes = actualMinutes;

    if (!calculatedMinutes && adHocPlan.started_at) {
      const startTime = new Date(adHocPlan.started_at).getTime();
      const endTime = new Date(completedAt).getTime();
      calculatedMinutes = Math.round((endTime - startTime) / 1000 / 60);
    }

    // 4. 플랜 완료 업데이트
    const { error: updateError } = await supabase
      .from("ad_hoc_plans")
      .update({
        completed_at: completedAt,
        status: "completed",
        actual_minutes: calculatedMinutes ?? null,
      })
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId);

    if (updateError) {
      logActionError({ domain: "today", action: "completeAdHocPlan.update" }, updateError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_UPDATE_FAILED };
    }

    revalidatePath("/today");
    revalidatePath("/plan/calendar");

    // 누적 시간 계산 (초 단위)
    const accumulatedSeconds = (calculatedMinutes ?? 0) * 60;

    return {
      success: true,
      serverNow: Date.now(),
      status: "COMPLETED",
      accumulatedSeconds,
      startedAt: adHocPlan.started_at,
    };
  } catch (error) {
    logActionError({ domain: "today", action: "completeAdHocPlan" }, error, { adHocPlanId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 완료에 실패했습니다.",
    };
  }
}

/**
 * Ad-hoc 플랜 상태 조회
 *
 * @param adHocPlanId - ad_hoc_plans 테이블의 ID
 * @returns 플랜 상태 정보
 */
export async function getAdHocPlanStatus(adHocPlanId: string): Promise<{
  success: boolean;
  error?: string;
  status?: "IDLE" | "RUNNING" | "COMPLETED";
  startedAt?: string | null;
  accumulatedSeconds?: number;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: TIMER_ERRORS.AUTH_REQUIRED };
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: adHocPlan, error } = await supabase
      .from("ad_hoc_plans")
      .select("id, started_at, completed_at, status, actual_minutes")
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (error) {
      return { success: false, error: TIMER_ERRORS.PLAN_QUERY_ERROR };
    }

    if (!adHocPlan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    // 상태 매핑
    let timerStatus: "IDLE" | "RUNNING" | "COMPLETED" = "IDLE";
    if (adHocPlan.status === "completed" || adHocPlan.completed_at) {
      timerStatus = "COMPLETED";
    } else if (adHocPlan.status === "in_progress" && adHocPlan.started_at) {
      timerStatus = "RUNNING";
    }

    // 누적 시간 계산
    let accumulatedSeconds = 0;
    if (adHocPlan.actual_minutes) {
      accumulatedSeconds = adHocPlan.actual_minutes * 60;
    } else if (adHocPlan.started_at && !adHocPlan.completed_at) {
      // 진행 중인 경우 현재까지 경과 시간
      const startTime = new Date(adHocPlan.started_at).getTime();
      accumulatedSeconds = Math.round((Date.now() - startTime) / 1000);
    }

    return {
      success: true,
      status: timerStatus,
      startedAt: adHocPlan.started_at,
      accumulatedSeconds,
    };
  } catch (error) {
    logActionError({ domain: "today", action: "getAdHocPlanStatus" }, error, { adHocPlanId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "상태 조회에 실패했습니다.",
    };
  }
}

/**
 * Ad-hoc 플랜 타이머 취소 (시작 전 상태로 되돌림)
 *
 * @param adHocPlanId - ad_hoc_plans 테이블의 ID
 * @returns ActionResult
 */
export async function cancelAdHocPlan(adHocPlanId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: TIMER_ERRORS.AUTH_REQUIRED };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 1. Ad-hoc 플랜 조회
    const { data: adHocPlan, error: planError } = await supabase
      .from("ad_hoc_plans")
      .select("id, status, completed_at")
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planError || !adHocPlan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    // 이미 완료된 플랜은 취소 불가
    if (adHocPlan.status === "completed" || adHocPlan.completed_at) {
      return {
        success: false,
        error: "이미 완료된 플랜은 취소할 수 없습니다.",
      };
    }

    // 2. 플랜 상태 초기화
    const { error: updateError } = await supabase
      .from("ad_hoc_plans")
      .update({
        started_at: null,
        status: "pending",
        actual_minutes: null,
      })
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId);

    if (updateError) {
      logActionError({ domain: "today", action: "cancelAdHocPlan.update" }, updateError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_UPDATE_FAILED };
    }

    revalidatePath("/today");
    revalidatePath("/plan/calendar");

    return { success: true };
  } catch (error) {
    logActionError({ domain: "today", action: "cancelAdHocPlan" }, error, { adHocPlanId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 취소에 실패했습니다.",
    };
  }
}
