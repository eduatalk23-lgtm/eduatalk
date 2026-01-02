/**
 * Timer Core Service
 *
 * 일반 플랜(timer.ts)과 Ad-hoc 플랜(adHocTimer.ts)에서 공통으로 사용하는
 * 타이머 관련 핵심 로직을 제공합니다.
 *
 * TODAY-004: 코드 중복 제거를 위한 공통 모듈
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterActivelyRunningSessions } from "@/lib/utils/timerUtils";
import { TIMER_ERRORS } from "../errors";

/**
 * 충돌 검사 결과
 */
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: "plan" | "ad_hoc";
  error?: string;
}

/**
 * 활성 세션 정보
 */
export interface ActiveSessionInfo {
  id: string;
  plan_id: string | null;
  paused_at: string | null;
  resumed_at?: string | null;
}

/**
 * 다른 타이머가 실행 중인지 확인
 *
 * 일반 플랜과 Ad-hoc 플랜 모두에서 사용 가능합니다.
 *
 * @param studentId 학생 ID
 * @param options.excludePlanId 제외할 플랜 ID (해당 플랜 시작 시 자기 자신 제외)
 * @param options.excludeAdHocPlanId 제외할 Ad-hoc 플랜 ID
 * @returns 충돌 여부 및 충돌 타입
 */
export async function checkForConflictingTimers(
  studentId: string,
  options?: {
    excludePlanId?: string;
    excludeAdHocPlanId?: string;
  }
): Promise<ConflictCheckResult> {
  const supabase = await createSupabaseServerClient();
  const { excludePlanId, excludeAdHocPlanId } = options ?? {};

  // 1. 활성 세션 확인 (student_study_sessions)
  let sessionQuery = supabase
    .from("student_study_sessions")
    .select("plan_id, paused_at, resumed_at")
    .eq("student_id", studentId)
    .is("ended_at", null)
    .not("plan_id", "is", null); // plan_id가 null인 고아 세션 제외

  if (excludePlanId) {
    sessionQuery = sessionQuery.neq("plan_id", excludePlanId);
  }

  const { data: activeSessions, error: sessionError } = await sessionQuery;

  if (sessionError) {
    return {
      hasConflict: false, // 에러 시에는 충돌 없는 것으로 처리 (이후 로직에서 다른 에러 발생)
    };
  }

  // 일시정지되지 않은 실제 활성 세션만 필터링
  const trulyActiveSessions = filterActivelyRunningSessions(activeSessions);

  if (trulyActiveSessions.length > 0) {
    return {
      hasConflict: true,
      conflictType: "plan",
      error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
    };
  }

  // 2. 활성 ad_hoc_plans 확인
  let adHocQuery = supabase
    .from("ad_hoc_plans")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "in_progress");

  if (excludeAdHocPlanId) {
    adHocQuery = adHocQuery.neq("id", excludeAdHocPlanId);
  }

  const { data: activeAdHocPlans, error: adHocError } = await adHocQuery;

  if (adHocError) {
    return {
      hasConflict: false,
    };
  }

  if (activeAdHocPlans && activeAdHocPlans.length > 0) {
    return {
      hasConflict: true,
      conflictType: "ad_hoc",
      error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
    };
  }

  return { hasConflict: false };
}

/**
 * 누적 학습 시간 계산 (일시정지 시간 제외)
 *
 * @param startedAt 시작 시간 (ISO timestamp)
 * @param pausedDurationSeconds 총 일시정지 시간 (초)
 * @param currentPausedAt 현재 일시정지 시작 시간 (일시정지 중인 경우)
 * @returns 순수 학습 시간 (초)
 */
export function calculateAccumulatedSeconds(
  startedAt: string,
  pausedDurationSeconds: number = 0,
  currentPausedAt?: string | null
): number {
  const startTime = new Date(startedAt).getTime();
  const now = Date.now();
  const totalElapsedSeconds = Math.floor((now - startTime) / 1000);

  // 현재 일시정지 중인 경우, 현재 일시정지 시간도 포함
  let currentPauseSeconds = 0;
  if (currentPausedAt) {
    const pausedAt = new Date(currentPausedAt).getTime();
    currentPauseSeconds = Math.floor((now - pausedAt) / 1000);
  }

  return Math.max(0, totalElapsedSeconds - pausedDurationSeconds - currentPauseSeconds);
}

/**
 * 학생 인증 확인 결과
 */
export interface AuthCheckResult {
  isAuthenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * 학생 인증 및 역할 확인을 위한 유틸리티 타입
 * 실제 인증은 각 액션에서 getCurrentUser()를 직접 호출합니다.
 */
export function createAuthError(): { success: false; error: string } {
  return { success: false, error: TIMER_ERRORS.AUTH_REQUIRED };
}
