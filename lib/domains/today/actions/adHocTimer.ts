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
import { checkForConflictingTimers } from "../services/timerCore";
import {
  validateAdHocTimerAction,
  type AdHocPlanStatus,
} from "@/lib/utils/timerUtils";
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

    // 2. 상태 머신 검증: START 액션이 허용되는지 확인
    // 추가 안전 체크: completed_at이 있으면 완료된 것으로 처리
    if (adHocPlan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    const validationError = validateAdHocTimerAction(
      adHocPlan.status as AdHocPlanStatus,
      "START"
    );
    if (validationError) {
      return { success: false, error: validationError };
    }

    // 3. 다른 플랜 또는 Ad-hoc 플랜이 활성화되어 있는지 확인
    // TODAY-004: 공통 모듈 사용으로 코드 중복 제거
    const conflictCheck = await checkForConflictingTimers(user.userId, {
      excludeAdHocPlanId: adHocPlanId,
    });

    if (conflictCheck.hasConflict) {
      return {
        success: false,
        error: conflictCheck.error || TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
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
      .select("id, started_at, completed_at, status, paused_at, paused_duration_seconds")
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planError) {
      logActionError({ domain: "today", action: "completeAdHocPlan.fetch" }, planError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_QUERY_ERROR };
    }

    if (!adHocPlan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    // 2. 상태 머신 검증: COMPLETE 액션이 허용되는지 확인
    // 추가 안전 체크: completed_at이 있으면 이미 완료된 것으로 처리
    if (adHocPlan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    const validationError = validateAdHocTimerAction(
      adHocPlan.status as AdHocPlanStatus,
      "COMPLETE"
    );
    if (validationError) {
      return { success: false, error: validationError };
    }

    // 3. 실제 소요 시간 계산 (일시정지 시간 제외)
    const completedAt = new Date().toISOString();
    let calculatedMinutes = actualMinutes;
    let pausedDurationSeconds = adHocPlan.paused_duration_seconds ?? 0;

    // 일시정지 상태에서 완료하는 경우, 현재 일시정지 시간도 누적
    if (adHocPlan.paused_at) {
      const pausedAt = new Date(adHocPlan.paused_at).getTime();
      const now = Date.now();
      pausedDurationSeconds += Math.round((now - pausedAt) / 1000);
    }

    if (!calculatedMinutes && adHocPlan.started_at) {
      const startTime = new Date(adHocPlan.started_at).getTime();
      const endTime = new Date(completedAt).getTime();
      const totalSeconds = Math.round((endTime - startTime) / 1000);
      const activeSeconds = totalSeconds - pausedDurationSeconds;
      calculatedMinutes = Math.round(activeSeconds / 60);
    }

    // 4. 플랜 완료 업데이트
    const { error: updateError } = await supabase
      .from("ad_hoc_plans")
      .update({
        completed_at: completedAt,
        status: "completed",
        actual_minutes: calculatedMinutes ?? null,
        paused_at: null,
        paused_duration_seconds: pausedDurationSeconds,
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
  status?: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
  startedAt?: string | null;
  pausedAt?: string | null;
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
      .select("id, started_at, completed_at, status, actual_minutes, paused_at, paused_duration_seconds")
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
    let timerStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" = "IDLE";
    if (adHocPlan.status === "completed" || adHocPlan.completed_at) {
      timerStatus = "COMPLETED";
    } else if (adHocPlan.status === "paused" && adHocPlan.paused_at) {
      timerStatus = "PAUSED";
    } else if (adHocPlan.status === "in_progress" && adHocPlan.started_at) {
      timerStatus = "RUNNING";
    }

    // 누적 시간 계산 (일시정지 시간 제외)
    let accumulatedSeconds = 0;
    if (adHocPlan.actual_minutes) {
      accumulatedSeconds = adHocPlan.actual_minutes * 60;
    } else if (adHocPlan.started_at && !adHocPlan.completed_at) {
      const startTime = new Date(adHocPlan.started_at).getTime();
      const pausedDurationSeconds = adHocPlan.paused_duration_seconds ?? 0;

      if (adHocPlan.paused_at) {
        // 일시정지 상태: 일시정지 시점까지의 시간
        const pausedAt = new Date(adHocPlan.paused_at).getTime();
        const totalElapsed = Math.round((pausedAt - startTime) / 1000);
        accumulatedSeconds = totalElapsed - pausedDurationSeconds;
      } else {
        // 진행 중: 현재까지 경과 시간
        const totalElapsed = Math.round((Date.now() - startTime) / 1000);
        accumulatedSeconds = totalElapsed - pausedDurationSeconds;
      }
    }

    return {
      success: true,
      status: timerStatus,
      startedAt: adHocPlan.started_at,
      pausedAt: adHocPlan.paused_at,
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
        paused_at: null,
        paused_duration_seconds: 0,
        pause_count: 0,
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

/**
 * Ad-hoc 플랜 타이머 일시정지
 *
 * @param adHocPlanId - ad_hoc_plans 테이블의 ID
 * @returns PausePlanResult
 */
export async function pauseAdHocPlan(
  adHocPlanId: string
): Promise<PausePlanResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: TIMER_ERRORS.AUTH_REQUIRED };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 1. Ad-hoc 플랜 조회
    const { data: adHocPlan, error: planError } = await supabase
      .from("ad_hoc_plans")
      .select("id, started_at, completed_at, status, paused_at, paused_duration_seconds, pause_count")
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planError) {
      logActionError({ domain: "today", action: "pauseAdHocPlan.fetch" }, planError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_QUERY_ERROR };
    }

    if (!adHocPlan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    // 2. 상태 머신 검증: PAUSE 액션이 허용되는지 확인
    // 추가 안전 체크: completed_at이 있으면 완료된 것으로 처리
    if (adHocPlan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    const validationError = validateAdHocTimerAction(
      adHocPlan.status as AdHocPlanStatus,
      "PAUSE"
    );
    if (validationError) {
      return { success: false, error: validationError };
    }

    // 3. 일시정지 처리
    const pausedAt = new Date().toISOString();
    const newPauseCount = (adHocPlan.pause_count ?? 0) + 1;

    const { error: updateError } = await supabase
      .from("ad_hoc_plans")
      .update({
        paused_at: pausedAt,
        status: "paused",
        pause_count: newPauseCount,
      })
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId);

    if (updateError) {
      logActionError({ domain: "today", action: "pauseAdHocPlan.update" }, updateError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_UPDATE_FAILED };
    }

    // 누적 시간 계산 (시작부터 현재까지, 기존 일시정지 시간 제외)
    const startTime = new Date(adHocPlan.started_at).getTime();
    const now = Date.now();
    const totalElapsedSeconds = Math.round((now - startTime) / 1000);
    const accumulatedSeconds = totalElapsedSeconds - (adHocPlan.paused_duration_seconds ?? 0);

    revalidatePath("/today");
    revalidatePath("/plan/calendar");

    return {
      success: true,
      serverNow: Date.now(),
      status: "PAUSED",
      accumulatedSeconds,
      pausedAt,
    };
  } catch (error) {
    logActionError({ domain: "today", action: "pauseAdHocPlan" }, error, { adHocPlanId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "일시정지에 실패했습니다.",
    };
  }
}

/**
 * Ad-hoc 플랜 타이머 재시작
 *
 * @param adHocPlanId - ad_hoc_plans 테이블의 ID
 * @returns ResumePlanResult
 */
export async function resumeAdHocPlan(
  adHocPlanId: string
): Promise<ResumePlanResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: TIMER_ERRORS.AUTH_REQUIRED };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 1. Ad-hoc 플랜 조회
    const { data: adHocPlan, error: planError } = await supabase
      .from("ad_hoc_plans")
      .select("id, started_at, completed_at, status, paused_at, paused_duration_seconds")
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planError) {
      logActionError({ domain: "today", action: "resumeAdHocPlan.fetch" }, planError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_QUERY_ERROR };
    }

    if (!adHocPlan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    // 2. 상태 머신 검증: RESUME 액션이 허용되는지 확인
    // 추가 안전 체크: completed_at이 있으면 완료된 것으로 처리
    if (adHocPlan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    const validationError = validateAdHocTimerAction(
      adHocPlan.status as AdHocPlanStatus,
      "RESUME"
    );
    if (validationError) {
      return { success: false, error: validationError };
    }

    // 3. 다른 활성 세션 확인 (student_plan 기반)
    const { data: activeSessions } = await supabase
      .from("student_study_sessions")
      .select("plan_id, paused_at")
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .not("plan_id", "is", null);

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

    // 6. 일시정지 시간 누적 및 재시작 처리
    const now = Date.now();
    const pausedAt = new Date(adHocPlan.paused_at).getTime();
    const pauseDuration = Math.round((now - pausedAt) / 1000);
    const newPausedDurationSeconds = (adHocPlan.paused_duration_seconds ?? 0) + pauseDuration;

    const { error: updateError } = await supabase
      .from("ad_hoc_plans")
      .update({
        paused_at: null,
        status: "in_progress",
        paused_duration_seconds: newPausedDurationSeconds,
      })
      .eq("id", adHocPlanId)
      .eq("student_id", user.userId);

    if (updateError) {
      logActionError({ domain: "today", action: "resumeAdHocPlan.update" }, updateError, { adHocPlanId });
      return { success: false, error: TIMER_ERRORS.PLAN_UPDATE_FAILED };
    }

    // 누적 시간 계산 (시작부터 현재까지, 전체 일시정지 시간 제외)
    const startTime = new Date(adHocPlan.started_at!).getTime();
    const totalElapsedSeconds = Math.round((now - startTime) / 1000);
    const accumulatedSeconds = totalElapsedSeconds - newPausedDurationSeconds;

    revalidatePath("/today");
    revalidatePath("/plan/calendar");

    return {
      success: true,
      serverNow: Date.now(),
      status: "RUNNING",
      accumulatedSeconds,
      startedAt: adHocPlan.started_at,
    };
  } catch (error) {
    logActionError({ domain: "today", action: "resumeAdHocPlan" }, error, { adHocPlanId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "재시작에 실패했습니다.",
    };
  }
}
