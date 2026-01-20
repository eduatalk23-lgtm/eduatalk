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
import {
  getNextPlanSuggestion,
  getDailyProgress,
} from "../services/nextPlanService";

// ============================================
// Phase 3.1: 통합 Ad-hoc 플랜 지원
// ============================================

/**
 * Ad-hoc 플랜 소스 테이블
 */
type AdHocPlanSource = "student_plan" | "ad_hoc_plans";

/**
 * Ad-hoc 플랜 조회 결과
 */
type AdHocPlanLookupResult = {
  found: boolean;
  source?: AdHocPlanSource;
  plan?: {
    id: string;
    started_at: string | null;
    completed_at: string | null;
    status: string | null;
    paused_at?: string | null;
    paused_duration_seconds?: number | null;
    pause_count?: number | null;
    content_type?: string | null;
    content_title?: string | null;
  };
};

/**
 * Ad-hoc 플랜 소스 테이블 찾기
 *
 * student_plan (is_adhoc=true)을 먼저 확인하고, 없으면 ad_hoc_plans에서 찾음
 */
async function findAdHocPlan(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planId: string,
  studentId: string
): Promise<AdHocPlanLookupResult> {
  // 1. student_plan에서 먼저 찾기 (새 데이터)
  const { data: studentPlan, error: spError } = await supabase
    .from("student_plan")
    .select("id, started_at, completed_at, status, paused_at, paused_duration_seconds, pause_count, content_type, content_title")
    .eq("id", planId)
    .eq("student_id", studentId)
    .eq("is_adhoc", true)
    .maybeSingle();

  if (!spError && studentPlan) {
    return {
      found: true,
      source: "student_plan",
      plan: studentPlan,
    };
  }

  // 2. ad_hoc_plans에서 찾기 (레거시 데이터)
  const { data: adHocPlan, error: ahError } = await supabase
    .from("ad_hoc_plans")
    .select("id, started_at, completed_at, status, paused_at, paused_duration_seconds, pause_count, content_type, title")
    .eq("id", planId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!ahError && adHocPlan) {
    return {
      found: true,
      source: "ad_hoc_plans",
      plan: {
        ...adHocPlan,
        content_title: adHocPlan.title, // ad_hoc_plans는 title 필드 사용
      },
    };
  }

  return { found: false };
}

/**
 * Ad-hoc 플랜 업데이트
 *
 * 소스 테이블에 따라 적절한 테이블 업데이트
 */
async function updateAdHocPlan(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  source: AdHocPlanSource,
  planId: string,
  studentId: string,
  updates: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(source)
    .update(updates)
    .eq("id", planId)
    .eq("student_id", studentId);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Ad-hoc 플랜 타이머 시작
 *
 * Phase 3.1: student_plan (is_adhoc=true)와 ad_hoc_plans 모두 지원
 *
 * @param adHocPlanId - 플랜 ID (student_plan 또는 ad_hoc_plans)
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

    // 1. Ad-hoc 플랜 조회 (student_plan 또는 ad_hoc_plans)
    const lookup = await findAdHocPlan(supabase, adHocPlanId, user.userId);

    if (!lookup.found || !lookup.plan || !lookup.source) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    const { plan, source } = lookup;

    // 2. 상태 머신 검증: START 액션이 허용되는지 확인
    // 추가 안전 체크: completed_at이 있으면 완료된 것으로 처리
    if (plan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    const validationError = validateAdHocTimerAction(
      (plan.status ?? "pending") as AdHocPlanStatus,
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

    // 4. 플랜 시작: started_at 및 status 업데이트 (통합 헬퍼 사용)
    const startTime = new Date().toISOString();
    const { error: updateError } = await updateAdHocPlan(
      supabase,
      source,
      adHocPlanId,
      user.userId,
      {
        started_at: startTime,
        status: "in_progress",
      }
    );

    if (updateError) {
      logActionError({ domain: "today", action: "startAdHocPlan.update" }, updateError, { adHocPlanId, source });
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

    // 1. Ad-hoc 플랜 조회 (student_plan 또는 ad_hoc_plans)
    const lookup = await findAdHocPlan(supabase, adHocPlanId, user.userId);

    if (!lookup.found || !lookup.plan || !lookup.source) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    const { plan, source } = lookup;

    // 2. 상태 머신 검증: COMPLETE 액션이 허용되는지 확인
    // 추가 안전 체크: completed_at이 있으면 이미 완료된 것으로 처리
    if (plan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    const validationError = validateAdHocTimerAction(
      (plan.status ?? "pending") as AdHocPlanStatus,
      "COMPLETE"
    );
    if (validationError) {
      return { success: false, error: validationError };
    }

    // 3. 실제 소요 시간 계산 (일시정지 시간 제외)
    const completedAt = new Date().toISOString();
    let calculatedMinutes = actualMinutes;
    let pausedDurationSeconds = plan.paused_duration_seconds ?? 0;

    // 일시정지 상태에서 완료하는 경우, 현재 일시정지 시간도 누적
    if (plan.paused_at) {
      const pausedAt = new Date(plan.paused_at).getTime();
      const now = Date.now();
      pausedDurationSeconds += Math.round((now - pausedAt) / 1000);
    }

    if (!calculatedMinutes && plan.started_at) {
      const startTime = new Date(plan.started_at).getTime();
      const endTime = new Date(completedAt).getTime();
      const totalSeconds = Math.round((endTime - startTime) / 1000);
      const activeSeconds = totalSeconds - pausedDurationSeconds;
      calculatedMinutes = Math.round(activeSeconds / 60);
    }

    // 4. 플랜 완료 업데이트 (통합 헬퍼 사용)
    const { error: updateError } = await updateAdHocPlan(
      supabase,
      source,
      adHocPlanId,
      user.userId,
      {
        completed_at: completedAt,
        status: "completed",
        actual_minutes: calculatedMinutes ?? null,
        paused_at: null,
        paused_duration_seconds: pausedDurationSeconds,
      }
    );

    if (updateError) {
      logActionError({ domain: "today", action: "completeAdHocPlan.update" }, updateError, { adHocPlanId, source });
      return { success: false, error: TIMER_ERRORS.PLAN_UPDATE_FAILED };
    }

    revalidatePath("/today");
    revalidatePath("/plan/calendar");

    // 누적 시간 계산 (초 단위)
    const accumulatedSeconds = (calculatedMinutes ?? 0) * 60;

    // 다음 플랜 추천 및 일일 진행률 계산 (비동기 처리, 실패해도 완료에 영향 없음)
    let nextPlanSuggestion;
    let dailyProgress;
    try {
      const studyDurationMinutes = calculatedMinutes ?? 0;

      // 다음 플랜 추천 계산
      nextPlanSuggestion = await getNextPlanSuggestion({
        studentId: user.userId,
        completedPlanId: adHocPlanId,
        studyDurationMinutes,
        // Ad-hoc 플랜의 과목/콘텐츠 타입 정보 제공
        completedPlanSubject: undefined,
        completedPlanContentType: plan.content_type ?? undefined,
      });

      // 일일 진행률 조회
      dailyProgress = await getDailyProgress(user.userId);
    } catch (suggestionError) {
      // 추천 계산 오류는 플랜 완료에 영향을 주지 않음
      console.warn("[completeAdHocPlan] 다음 플랜 추천 계산 실패:", suggestionError);
    }

    return {
      success: true,
      serverNow: Date.now(),
      status: "COMPLETED",
      accumulatedSeconds,
      startedAt: plan.started_at,
      nextPlanSuggestion,
      dailyProgress,
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

    // 통합 조회 (student_plan + ad_hoc_plans)
    const lookupResult = await findAdHocPlan(supabase, adHocPlanId, user.userId);

    if (!lookupResult.found || !lookupResult.plan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    const adHocPlan = lookupResult.plan;

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
    // actual_minutes 필드가 있는지 확인 (타입 안전)
    const actualMinutes = "actual_minutes" in adHocPlan ? (adHocPlan as { actual_minutes?: number | null }).actual_minutes : null;
    
    if (actualMinutes) {
      accumulatedSeconds = actualMinutes * 60;
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

    // 1. Ad-hoc 플랜 조회 (student_plan + ad_hoc_plans 통합)
    const lookupResult = await findAdHocPlan(supabase, adHocPlanId, user.userId);

    if (!lookupResult.found || !lookupResult.source || !lookupResult.plan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    const { source, plan } = lookupResult;

    // 이미 완료된 플랜은 취소 불가
    if (plan.status === "completed" || plan.completed_at) {
      return {
        success: false,
        error: "이미 완료된 플랜은 취소할 수 없습니다.",
      };
    }

    // 2. 플랜 상태 초기화
    const { error: updateError } = await updateAdHocPlan(
      supabase,
      source,
      adHocPlanId,
      user.userId,
      {
        started_at: null,
        status: "pending",
        actual_minutes: null,
        paused_at: null,
        paused_duration_seconds: 0,
        pause_count: 0,
      }
    );

    if (updateError) {
      logActionError({ domain: "today", action: "cancelAdHocPlan.update" }, updateError, { adHocPlanId, source });
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

    // 1. Ad-hoc 플랜 조회 (student_plan 또는 ad_hoc_plans)
    const lookup = await findAdHocPlan(supabase, adHocPlanId, user.userId);

    if (!lookup.found || !lookup.plan || !lookup.source) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    const { plan, source } = lookup;

    // 2. 상태 머신 검증: PAUSE 액션이 허용되는지 확인
    // 추가 안전 체크: completed_at이 있으면 완료된 것으로 처리
    if (plan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    const validationError = validateAdHocTimerAction(
      (plan.status ?? "pending") as AdHocPlanStatus,
      "PAUSE"
    );
    if (validationError) {
      return { success: false, error: validationError };
    }

    // 3. 일시정지 처리 (통합 헬퍼 사용)
    const pausedAt = new Date().toISOString();
    const newPauseCount = (plan.pause_count ?? 0) + 1;

    const { error: updateError } = await updateAdHocPlan(
      supabase,
      source,
      adHocPlanId,
      user.userId,
      {
        paused_at: pausedAt,
        status: "paused",
        pause_count: newPauseCount,
      }
    );

    if (updateError) {
      logActionError({ domain: "today", action: "pauseAdHocPlan.update" }, updateError, { adHocPlanId, source });
      return { success: false, error: TIMER_ERRORS.PLAN_UPDATE_FAILED };
    }

    // 누적 시간 계산 (시작부터 현재까지, 기존 일시정지 시간 제외)
    const startTime = plan.started_at ? new Date(plan.started_at).getTime() : Date.now();
    const now = Date.now();
    const totalElapsedSeconds = Math.round((now - startTime) / 1000);
    const accumulatedSeconds = totalElapsedSeconds - (plan.paused_duration_seconds ?? 0);

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

    // 1. Ad-hoc 플랜 조회 (student_plan 또는 ad_hoc_plans)
    const lookup = await findAdHocPlan(supabase, adHocPlanId, user.userId);

    if (!lookup.found || !lookup.plan || !lookup.source) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    const { plan, source } = lookup;

    // 2. 상태 머신 검증: RESUME 액션이 허용되는지 확인
    // 추가 안전 체크: completed_at이 있으면 완료된 것으로 처리
    if (plan.completed_at) {
      return { success: false, error: TIMER_ERRORS.PLAN_ALREADY_COMPLETED };
    }

    const validationError = validateAdHocTimerAction(
      (plan.status ?? "pending") as AdHocPlanStatus,
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

    // 4. 다른 활성 ad_hoc_plan 확인 (레거시)
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

    // 5. 다른 활성 student_plan (is_adhoc=true) 확인
    const { data: activeStudentAdHocPlans } = await supabase
      .from("student_plan")
      .select("id")
      .eq("student_id", user.userId)
      .eq("is_adhoc", true)
      .eq("status", "in_progress")
      .neq("id", adHocPlanId);

    if (activeStudentAdHocPlans && activeStudentAdHocPlans.length > 0) {
      return {
        success: false,
        error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
      };
    }

    // 6. 일시정지 시간 누적 및 재시작 처리 (통합 헬퍼 사용)
    const now = Date.now();
    const pausedAt = plan.paused_at ? new Date(plan.paused_at).getTime() : now;
    const pauseDuration = Math.round((now - pausedAt) / 1000);
    const newPausedDurationSeconds = (plan.paused_duration_seconds ?? 0) + pauseDuration;

    const { error: updateError } = await updateAdHocPlan(
      supabase,
      source,
      adHocPlanId,
      user.userId,
      {
        paused_at: null,
        status: "in_progress",
        paused_duration_seconds: newPausedDurationSeconds,
      }
    );

    if (updateError) {
      logActionError({ domain: "today", action: "resumeAdHocPlan.update" }, updateError, { adHocPlanId, source });
      return { success: false, error: TIMER_ERRORS.PLAN_UPDATE_FAILED };
    }

    // 누적 시간 계산 (시작부터 현재까지, 전체 일시정지 시간 제외)
    const startTime = plan.started_at ? new Date(plan.started_at).getTime() : now;
    const totalElapsedSeconds = Math.round((now - startTime) / 1000);
    const accumulatedSeconds = totalElapsedSeconds - newPausedDurationSeconds;

    revalidatePath("/today");
    revalidatePath("/plan/calendar");

    return {
      success: true,
      serverNow: Date.now(),
      status: "RUNNING",
      accumulatedSeconds,
      startedAt: plan.started_at,
    };
  } catch (error) {
    logActionError({ domain: "today", action: "resumeAdHocPlan" }, error, { adHocPlanId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "재시작에 실패했습니다.",
    };
  }
}
