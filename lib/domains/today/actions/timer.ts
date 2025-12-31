"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanById, updatePlan } from "@/lib/data/studentPlans";
import { startStudySession, endStudySession } from "@/lib/domains/student";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateString } from "@/lib/date/calendarUtils";
import { revalidateTimerPaths } from "@/lib/utils/revalidatePathOptimized";
import {
  isSessionPaused,
  filterActivelyRunningSessions,
  validateTimerAction,
  determineTimerStatus,
  type TimerAction,
} from "@/lib/utils/timerUtils";
import { fetchContentTotal, type ContentType } from "@/lib/data/contentTotal";
import type {
  PlanRecordPayload,
  StartPlanResult,
  CompletePlanResult,
  PausePlanResult,
  ResumePlanResult,
  PreparePlanCompletionResult,
  ActionResult,
} from "../types";
import { TIMER_ERRORS } from "../errors";
import { timerLogger } from "../logger";
import { updateGamificationOnPlanComplete } from "@/lib/domains/gamification";
import {
  startAdHocPlan,
  completeAdHocPlan,
  cancelAdHocPlan,
} from "./adHocTimer";

/**
 * 서버 현재 시간 조회
 *
 * 탭이 다시 활성화될 때 정확한 서버 시간 동기화를 위해 사용합니다.
 */
export async function getServerTime(): Promise<{ serverNow: number }> {
  return { serverNow: Date.now() };
}

/**
 * 플랜 시작 (타이머 시작)
 *
 * 경합 방지 규칙:
 * 1. 동시 실행 금지: 한 학생이 동시에 여러 플랜을 RUNNING 상태로 둘 수 없음
 * 2. 완료된 플랜 재시작 금지: actual_end_time이 설정된 플랜은 다시 시작할 수 없음
 *
 * @see docs/refactoring/timer_state_machine.md
 */
export async function startPlan(
  planId: string,
  timestamp?: string // 클라이언트에서 생성한 타임스탬프
): Promise<StartPlanResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: TIMER_ERRORS.AUTH_REQUIRED };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    // [경합 방지 규칙 2] 완료된 플랜 재시작 방지
    const { data: plan, error: planError } = await supabase
      .from("student_plan")
      .select("id, actual_start_time, actual_end_time, is_virtual")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planError) {
      timerLogger.error("플랜 조회 오류", {
        action: "startPlan",
        id: planId,
        error: planError instanceof Error ? planError : new Error(String(planError)),
      });
      return { success: false, error: TIMER_ERRORS.PLAN_QUERY_ERROR };
    }

    if (!plan) {
      return { success: false, error: TIMER_ERRORS.PLAN_NOT_FOUND };
    }

    // 가상 플랜은 학습 시작 불가
    if (plan.is_virtual === true) {
      return {
        success: false,
        error: "콘텐츠가 연결되지 않은 플랜입니다. 먼저 콘텐츠를 연결해주세요.",
      };
    }

    // 현재 활성 세션 조회 (상태 판별용)
    const { data: currentSession } = await supabase
      .from("student_study_sessions")
      .select("paused_at, resumed_at, ended_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 상태 머신 검증: START 또는 RESUME 액션이 허용되는지 확인
    const action: TimerAction = currentSession && isSessionPaused(currentSession) ? "RESUME" : "START";
    const validationError = validateTimerAction(plan, currentSession, action);
    if (validationError) {
      timerLogger.warn("상태 전환 검증 실패", {
        action: "startPlan",
        id: planId,
        data: { timerAction: action, error: validationError },
      });
      return {
        success: false,
        error: action === "START" ? TIMER_ERRORS.PLAN_ALREADY_COMPLETED : validationError,
      };
    }

    // [경합 방지 규칙 1] 동시 실행 금지
    // 다른 플랜이 활성화되어 있는지 확인 (현재 플랜 제외, 일시정지된 세션 제외)
    // 일시정지된 세션은 paused_at이 있고 resumed_at이 없는 상태
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("plan_id, paused_at, resumed_at")
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .not("plan_id", "is", null) // plan_id가 null인 고아 세션 제외
      .neq("plan_id", planId);

    if (sessionError) {
      timerLogger.error("활성 세션 조회 오류", {
        action: "startPlan",
        id: planId,
        error: sessionError instanceof Error ? sessionError : new Error(String(sessionError)),
      });
      return { success: false, error: TIMER_ERRORS.SESSION_QUERY_ERROR };
    }

    // 일시정지되지 않은 실제 활성 세션만 필터링
    const trulyActiveSessions = filterActivelyRunningSessions(activeSessions);

    // 다른 플랜이 활성화되어 있으면 에러 반환
    if (trulyActiveSessions.length > 0) {
      return {
        success: false,
        error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
      };
    }

    // [경합 방지 규칙 1-b] Ad-hoc 플랜 동시 실행 금지
    // Ad-hoc 플랜이 진행 중인지 확인
    const { data: activeAdHocPlans, error: adHocError } = await supabase
      .from("ad_hoc_plans")
      .select("id")
      .eq("student_id", user.userId)
      .eq("status", "in_progress");

    if (adHocError) {
      timerLogger.error("Ad-hoc 플랜 조회 오류", {
        action: "startPlan",
        id: planId,
        error: adHocError instanceof Error ? adHocError : new Error(String(adHocError)),
      });
      return { success: false, error: TIMER_ERRORS.SESSION_QUERY_ERROR };
    }

    if (activeAdHocPlans && activeAdHocPlans.length > 0) {
      return {
        success: false,
        error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
      };
    }

    // 학습 세션 시작 (내부에서 플랜 조회 및 검증 수행)
    // Race Condition은 DB 레벨 유니크 제약(idx_unique_active_session_per_student)으로 방지
    const result = await startStudySession(planId);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 플랜의 actual_start_time 업데이트 (처음 시작하는 경우만)
    // 조회 없이 UPDATE ... WHERE actual_start_time IS NULL로 최적화
    const startTime = timestamp || new Date().toISOString();
    await supabase
      .from("student_plan")
      .update({
        actual_start_time: startTime,
      })
      .eq("id", planId)
      .eq("student_id", user.userId)
      .is("actual_start_time", null); // 처음 시작하는 경우만 업데이트

    // 세션의 started_at 조회 (정확한 시작 시각 사용)
    let sessionStartedAt = startTime;
    if (result.sessionId) {
      const { data: session } = await supabase
        .from("student_study_sessions")
        .select("started_at")
        .eq("id", result.sessionId)
        .maybeSingle();

      if (session?.started_at) {
        sessionStartedAt = session.started_at;
      }
    }

    // 서버 현재 시간 반환
    const serverNow = Date.now();

    // 클라이언트에서 React Query invalidateQueries로 처리 (Optimistic Update)
    return {
      success: true,
      sessionId: result.sessionId,
      serverNow,
      status: "RUNNING" as const,
      accumulatedSeconds: 0,
      startedAt: sessionStartedAt,
    };
  } catch (error) {
    timerLogger.error("플랜 시작 실패", {
      action: "startPlan",
      id: planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 시작에 실패했습니다.",
    };
  }
}

/**
 * 플랜 완료 (기록 저장)
 */
export async function completePlan(
  planId: string,
  payload: PlanRecordPayload
): Promise<CompletePlanResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const tenantContext = await getTenantContext();

  try {
    const supabase = await createSupabaseServerClient();

    // 플랜 조회
    const plan = await getPlanById(
      planId,
      user.userId,
      tenantContext?.tenantId || null
    );

    if (!plan || !plan.content_type || !plan.content_id) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    // 활성 세션 조회 (상태 판별용)
    const { data: stateCheckSession } = await supabase
      .from("student_study_sessions")
      .select("paused_at, resumed_at, ended_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 상태 머신 검증: COMPLETE 액션이 허용되는지 확인
    const validationError = validateTimerAction(plan, stateCheckSession, "COMPLETE");
    if (validationError) {
      timerLogger.warn("상태 전환 검증 실패", {
        action: "completePlan",
        id: planId,
        data: { timerAction: "COMPLETE", error: validationError },
      });
      return { success: false, error: validationError };
    }

    // 같은 plan_number를 가진 모든 플랜 조회 (같은 논리적 플랜)
    let samePlanNumberPlans: Array<{ id: string }> = [];
    if (plan.plan_number !== null && plan.plan_number !== undefined) {
      const { data: plansWithSameNumber } = await supabase
        .from("student_plan")
        .select("id")
        .eq("student_id", user.userId)
        .eq("plan_number", plan.plan_number)
        .eq("plan_date", plan.plan_date);

      samePlanNumberPlans = plansWithSameNumber || [];
    } else {
      // plan_number가 없으면 현재 플랜만 처리
      samePlanNumberPlans = [{ id: planId }];
    }

    // 콘텐츠 총량 조회 (공통 함수 사용, student_id 필터 포함)
    let totalAmount: number | null = null;
    try {
      totalAmount = await fetchContentTotal(
        supabase,
        user.userId,
        plan.content_type as ContentType,
        plan.content_id
      );
    } catch (error) {
      timerLogger.error("콘텐츠 총량 조회 중 예외 발생", {
        action: "completePlan",
        id: planId,
        userId: user.userId,
        data: {
          contentType: plan.content_type,
          contentId: plan.content_id,
        },
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return {
        success: false,
        error: `콘텐츠 정보를 조회하는 중 오류가 발생했습니다. ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      };
    }

    // 상세한 에러 메시지 제공
    if (totalAmount === null) {
      timerLogger.error("콘텐츠 총량이 null", {
        action: "completePlan",
        id: planId,
        userId: user.userId,
        data: {
          contentType: plan.content_type,
          contentId: plan.content_id,
        },
      });
      return {
        success: false,
        error: `콘텐츠를 찾을 수 없거나 총량 정보가 설정되지 않았습니다. (${plan.content_type}: ${plan.content_id})`,
      };
    }

    if (totalAmount <= 0) {
      timerLogger.error("콘텐츠 총량이 0 이하", {
        action: "completePlan",
        id: planId,
        userId: user.userId,
        data: {
          contentType: plan.content_type,
          contentId: plan.content_id,
          totalAmount,
        },
      });
      return {
        success: false,
        error: `콘텐츠 총량이 0 이하입니다. 콘텐츠 설정에서 총량을 확인해주세요. (현재 총량: ${totalAmount})`,
      };
    }

    // 진행률 계산
    const completedAmount = payload.endPageOrTime - payload.startPageOrTime;
    const progress = Math.min(
      Math.round((completedAmount / totalAmount) * 100),
      100
    );

    // 같은 plan_number를 가진 모든 플랜의 진행률 배치 업데이트 (N+1 → 1 쿼리)
    const planIds = samePlanNumberPlans.map((p) => p.id);
    const { error: batchUpdateError } = await supabase
      .from("student_plan")
      .update({
        completed_amount: completedAmount,
        progress: progress,
      })
      .in("id", planIds)
      .eq("student_id", user.userId);

    if (batchUpdateError) {
      timerLogger.error("플랜 진행률 배치 업데이트 오류", {
        action: "completePlan",
        id: planId,
        error: batchUpdateError instanceof Error ? batchUpdateError : new Error(String(batchUpdateError)),
      });
    }

    // student의 tenant_id 조회 (tenant_id가 없어도 진행 가능하도록)
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", user.userId)
      .maybeSingle();

    const tenantId = student?.tenant_id || tenantContext?.tenantId || null;

    // 같은 plan_number를 가진 모든 플랜의 student_content_progress에 기록 (N+1 → upsert 배치)
    const progressTimestamp = new Date().toISOString();
    // Calendar-First: content_id가 빈 문자열이면 null로 변환 (UUID 타입 호환성)
    const normalizedContentId = plan.content_id && plan.content_id.trim() !== "" ? plan.content_id : null;
    const progressPayloads = planIds.map((planIdForProgress) => ({
      student_id: user.userId,
      tenant_id: tenantId,
      plan_id: planIdForProgress,
      content_type: plan.content_type,
      content_id: normalizedContentId,
      progress: progress,
      start_page_or_time: payload.startPageOrTime,
      end_page_or_time: payload.endPageOrTime,
      completed_amount: completedAmount,
      last_updated: progressTimestamp,
    }));

    const { error: progressUpsertError } = await supabase
      .from("student_content_progress")
      .upsert(progressPayloads, {
        onConflict: "student_id,plan_id",
        ignoreDuplicates: false,
      });

    if (progressUpsertError) {
      timerLogger.error("플랜별 진행률 upsert 오류", {
        action: "completePlan",
        id: planId,
        error: progressUpsertError instanceof Error ? progressUpsertError : new Error(String(progressUpsertError)),
      });
    }

    // content_type + content_id로도 진행률 업데이트 (전체 진행률)
    // Calendar-First: content_id가 null이거나 빈 문자열인 경우 (자유 학습) 전체 진행률 업데이트 스킵
    if (normalizedContentId) {
      const { data: existingContentProgress } = await supabase
        .from("student_content_progress")
        .select("id,completed_amount")
        .eq("student_id", user.userId)
        .eq("content_type", plan.content_type)
        .eq("content_id", normalizedContentId)
        .is("plan_id", null)
        .maybeSingle();

      if (existingContentProgress) {
        // 기존 완료량에 추가
        const newCompletedAmount =
          (existingContentProgress.completed_amount || 0) + completedAmount;
        const newProgress = Math.min(
          Math.round((newCompletedAmount / totalAmount) * 100),
          100
        );

        await supabase
          .from("student_content_progress")
          .update({
            completed_amount: newCompletedAmount,
            progress: newProgress,
            last_updated: new Date().toISOString(),
          })
          .eq("id", existingContentProgress.id);
      } else {
        // 새로 생성
        await supabase.from("student_content_progress").insert({
          student_id: user.userId,
          tenant_id: tenantId,
          content_type: plan.content_type,
          content_id: normalizedContentId,
          completed_amount: completedAmount,
          progress: progress,
          last_updated: new Date().toISOString(),
        });
      }
    }

    // 플랜의 actual_end_time 및 시간 정보 업데이트
    // 항상 현재 시간을 사용하여 정확한 종료 시간 기록
    const now = new Date();
    const actualEndTime = now.toISOString();

    // 플랜의 actual_start_time 조회
    const { data: planData } = await supabase
      .from("student_plan")
      .select("actual_start_time, paused_duration_seconds, pause_count")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    let totalDurationSeconds: number | null = null;
    if (planData?.actual_start_time) {
      const startTime = new Date(planData.actual_start_time);
      const endTime = new Date(actualEndTime);
      totalDurationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    }

    // 활성 세션 조회하여 일시정지 정보 가져오기 및 종료 (여러 개일 수 있으므로 배열로 조회)
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("id, paused_duration_seconds, paused_at, resumed_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false }); // 최신 세션 우선

    // 여러 세션이 있는 경우 가장 최근 세션 사용
    const activeSession = activeSessions && activeSessions.length > 0 ? activeSessions[0] : null;

    // 플랜의 paused_duration_seconds만 사용 (단일 소스 원칙 - 이중 계산 방지)
    let totalPausedDuration = planData?.paused_duration_seconds || 0;

    // 현재 일시정지 중인 경우, 아직 플랜에 반영되지 않은 현재 일시정지 시간 추가
    if (activeSession && isSessionPaused(activeSession)) {
      // isSessionPaused가 true면 paused_at은 반드시 존재
      const pausedAt = new Date(activeSession.paused_at!);
      const now = new Date();
      const currentPauseSeconds = Math.max(0, Math.floor((now.getTime() - pausedAt.getTime()) / 1000));
      totalPausedDuration += currentPauseSeconds;
    }

    const pauseCount = planData?.pause_count || 0;

    // 같은 plan_number를 가진 모든 플랜의 시간 정보 업데이트 (N+1 → 배치 쿼리 최적화)
    // 1. 모든 플랜 데이터 배치 조회
    const { data: allPlanData } = await supabase
      .from("student_plan")
      .select("id, actual_start_time, paused_duration_seconds, pause_count")
      .in("id", planIds)
      .eq("student_id", user.userId);

    // 2. 모든 활성 세션 배치 조회
    const { data: allActiveSessions } = await supabase
      .from("student_study_sessions")
      .select("id, plan_id, paused_duration_seconds, paused_at, resumed_at")
      .in("plan_id", planIds)
      .eq("student_id", user.userId)
      .is("ended_at", null);

    // 3. plan_id별로 세션 그룹화
    const sessionsByPlanId = new Map<string, typeof allActiveSessions>();
    if (allActiveSessions) {
      for (const session of allActiveSessions) {
        const existing = sessionsByPlanId.get(session.plan_id) || [];
        existing.push(session);
        sessionsByPlanId.set(session.plan_id, existing);
      }
    }

    // 4. 모든 활성 세션 종료 (병렬 처리, 부분 실패 허용)
    if (allActiveSessions && allActiveSessions.length > 0) {
      const sessionEndResults = await Promise.allSettled(
        allActiveSessions.map((session) => endStudySession(session.id))
      );

      // 실패한 세션 종료 로깅
      const failedSessions = sessionEndResults
        .map((result, idx) => ({ result, sessionId: allActiveSessions[idx].id }))
        .filter((item) => item.result.status === "rejected");

      if (failedSessions.length > 0) {
        timerLogger.error("일부 세션 종료 실패", {
          action: "completePlan",
          id: planId,
          data: {
            failedCount: failedSessions.length,
            totalCount: allActiveSessions.length,
            failedSessionIds: failedSessions.map((f) => f.sessionId),
          },
        });
      }
    }

    // 5. 각 플랜의 업데이트 데이터 계산 및 배치 업데이트
    const planDataMap = new Map(
      (allPlanData || []).map((p) => [p.id, p])
    );
    const nowTime = new Date();

    const updatePromises = planIds.map((samePlanId) => {
      const samePlanData = planDataMap.get(samePlanId);

      let samePlanTotalDurationSeconds: number | null = null;
      if (samePlanData?.actual_start_time) {
        const startTime = new Date(samePlanData.actual_start_time);
        const endTime = new Date(actualEndTime);
        samePlanTotalDurationSeconds = Math.floor(
          (endTime.getTime() - startTime.getTime()) / 1000
        );
      }

      // 플랜의 paused_duration_seconds만 사용 (단일 소스 원칙 - 이중 계산 방지)
      let samePlanTotalPausedDuration = samePlanData?.paused_duration_seconds || 0;
      const samePlanPauseCount = samePlanData?.pause_count || 0;

      // 현재 일시정지 중인 경우, 아직 플랜에 반영되지 않은 현재 일시정지 시간만 추가
      const planSessions = sessionsByPlanId.get(samePlanId) || [];
      if (planSessions.length > 0) {
        const firstSession = planSessions[0];
        if (isSessionPaused(firstSession)) {
          const pausedAt = new Date(firstSession.paused_at);
          const currentPauseSeconds = Math.max(0, Math.floor(
            (nowTime.getTime() - pausedAt.getTime()) / 1000
          ));
          samePlanTotalPausedDuration += currentPauseSeconds;
        }
      }

      return {
        planId: samePlanId,
        promise: supabase
          .from("student_plan")
          .update({
            actual_end_time: actualEndTime,
            total_duration_seconds: samePlanTotalDurationSeconds,
            paused_duration_seconds: samePlanTotalPausedDuration,
            pause_count: samePlanPauseCount,
          })
          .eq("id", samePlanId)
          .eq("student_id", user.userId),
      };
    });

    // 플랜 업데이트 실행 (부분 실패 허용)
    const planUpdateResults = await Promise.allSettled(
      updatePromises.map((item) => item.promise)
    );

    // 실패한 플랜 업데이트 확인
    const failedPlanUpdates = planUpdateResults
      .map((result, idx) => ({ result, planId: updatePromises[idx].planId }))
      .filter((item) => item.result.status === "rejected");

    if (failedPlanUpdates.length > 0) {
      timerLogger.error("일부 플랜 업데이트 실패", {
        action: "completePlan",
        id: planId,
        data: {
          failedCount: failedPlanUpdates.length,
          totalCount: planIds.length,
          failedPlanIds: failedPlanUpdates.map((f) => f.planId),
        },
      });

      // 메인 플랜 업데이트 실패 시 에러 반환
      const mainPlanFailed = failedPlanUpdates.some((f) => f.planId === planId);
      if (mainPlanFailed) {
        return {
          success: false,
          error: "플랜 완료 저장에 실패했습니다. 다시 시도해주세요.",
        };
      }
    }

    // 완료 시점의 순수 학습 시간 계산 (일시정지 시간 제외)
    const finalDuration = totalDurationSeconds ? Math.max(0, totalDurationSeconds - totalPausedDuration) : 0;

    // 서버 현재 시간 반환
    const serverNow = Date.now();

    // 게이미피케이션 업데이트 (비동기로 처리, 실패해도 플랜 완료에 영향 없음)
    const studyDurationMinutes = Math.floor(finalDuration / 60);
    try {
      const gamificationResult = await updateGamificationOnPlanComplete({
        studentId: user.userId,
        tenantId: tenantId || "",
        eventType: "plan_completed",
        studyDurationMinutes,
        completedAt: new Date(),
        planId,
      });

      if (gamificationResult.success && gamificationResult.data) {
        timerLogger.info("게이미피케이션 업데이트 성공", {
          action: "completePlan",
          id: planId,
          data: gamificationResult.data,
        });
      }
    } catch (gamificationError) {
      // 게이미피케이션 오류는 플랜 완료에 영향을 주지 않음
      timerLogger.warn("게이미피케이션 업데이트 실패", {
        action: "completePlan",
        id: planId,
        error: gamificationError instanceof Error ? gamificationError : new Error(String(gamificationError)),
      });
    }

    // 현재 경로만 재검증 (성능 최적화)
    // 완료 시에는 대시보드도 업데이트 필요
    await revalidateTimerPaths(false, true);
    return {
      success: true,
      serverNow,
      status: "COMPLETED" as const,
      accumulatedSeconds: finalDuration,
      startedAt: null,
    };
  } catch (error) {
    timerLogger.error("플랜 완료 실패", {
      action: "completePlan",
      id: planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 완료에 실패했습니다.",
    };
  }
}

/**
 * 플랜 미루기 (내일로 이동)
 */
export async function postponePlan(
  planId: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const tenantContext = await getTenantContext();
    const plan = await getPlanById(
      planId,
      user.userId,
      tenantContext?.tenantId || null
    );
    if (!plan) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    if (!plan.is_reschedulable) {
      return { success: false, error: "이 플랜은 재조정할 수 없습니다." };
    }

    // 내일 날짜 계산
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowDate = formatDateString(tomorrow);

    await updatePlan(planId, user.userId, {
      plan_date: tomorrowDate,
    });

    await revalidateTimerPaths(false, false);
    return { success: true };
  } catch (error) {
    timerLogger.error("플랜 미루기 실패", {
      action: "postponePlan",
      id: planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 미루기에 실패했습니다.",
    };
  }
}

/**
 * 타이머 시작
 */
export async function startTimer(
  planId?: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const result = await startPlan(planId || "");
  if (!result.success) {
    return result;
  }

  // 세션 ID는 startStudySession에서 반환되지만 여기서는 간단히 처리
  return { success: true };
}

/**
 * 타이머 종료
 */
export async function endTimer(
  sessionId: string
): Promise<{ success: boolean; durationSeconds?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const result = await endStudySession(sessionId);
    await revalidateTimerPaths(false, true);
    return result;
  } catch (error) {
    timerLogger.error("타이머 종료 실패", {
      action: "endTimer",
      id: sessionId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "타이머 종료에 실패했습니다.",
    };
  }
}

/**
 * 플랜 일시정지
 */
export async function pausePlan(
  planId: string,
  timestamp?: string // 클라이언트에서 생성한 타임스탬프
): Promise<PausePlanResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // [병렬화 최적화] 플랜과 세션을 동시에 조회
    const [planResult, sessionResult] = await Promise.all([
      // 플랜 조회 (상태 판별용 + paused_duration_seconds 포함)
      supabase
        .from("student_plan")
        .select("actual_start_time, actual_end_time, paused_duration_seconds")
        .eq("id", planId)
        .eq("student_id", user.userId)
        .maybeSingle(),
      // 활성 세션 조회 (최신 세션만)
      supabase
        .from("student_study_sessions")
        .select("id, started_at, paused_at, resumed_at, ended_at, paused_duration_seconds")
        .eq("plan_id", planId)
        .eq("student_id", user.userId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { data: plan, error: planError } = planResult;
    const { data: activeSession, error: sessionError } = sessionResult;

    if (planError || !plan) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    if (!activeSession) {
      return { success: false, error: "활성 세션을 찾을 수 없습니다. 플랜을 먼저 시작해주세요." };
    }

    // 상태 머신 검증: PAUSE 액션이 허용되는지 확인
    const validationError = validateTimerAction(plan, activeSession, "PAUSE");
    if (validationError) {
      timerLogger.warn("상태 전환 검증 실패", {
        action: "pausePlan",
        id: planId,
        data: { timerAction: "PAUSE", error: validationError },
      });
      // 이미 일시정지 상태인 경우 사용자 친화적 메시지
      if (isSessionPaused(activeSession)) {
        return { success: false, error: "이미 일시정지된 상태입니다." };
      }
      return { success: false, error: validationError };
    }

    // 세션 일시정지
    // 클라이언트에서 전달한 타임스탬프 사용, 없으면 서버에서 생성 (하위 호환성)
    const pauseTimestamp = timestamp || new Date().toISOString();

    // [병렬화 최적화] 세션 업데이트와 pause_count 증가를 동시에 실행
    const [sessionUpdateResult, rpcResult] = await Promise.all([
      // 재개 후 다시 일시정지하는 경우를 위해 resumed_at을 null로 리셋
      supabase
        .from("student_study_sessions")
        .update({
          paused_at: pauseTimestamp,
          resumed_at: null, // 재개 후 다시 일시정지할 때 리셋
        })
        .eq("id", activeSession.id)
        .eq("student_id", user.userId),
      // 플랜의 pause_count 증가 (RPC 함수)
      supabase.rpc("increment_pause_count", {
        p_plan_id: planId,
        p_student_id: user.userId,
      }),
    ]);

    const { error: pauseError } = sessionUpdateResult;
    const { error: rpcError } = rpcResult;

    if (pauseError) {
      timerLogger.error("세션 일시정지 오류", {
        action: "pausePlan",
        id: planId,
        error: pauseError instanceof Error ? pauseError : new Error(String(pauseError)),
      });
      return { success: false, error: "세션 일시정지에 실패했습니다." };
    }

    if (rpcError) {
      timerLogger.warn("pause_count 증가 오류", {
        action: "pausePlan",
        id: planId,
        error: rpcError instanceof Error ? rpcError : new Error(String(rpcError)),
      });
      // 일시정지는 성공했으므로 경고만 로그하고 계속 진행
    }

    // 서버 현재 시간 반환
    const serverNow = Date.now();

    // 플랜의 현재 누적 시간 계산 (첫 조회에서 이미 paused_duration_seconds를 가져옴)
    let accumulatedSeconds = 0;
    if (activeSession?.started_at) {
      const sessionStartMs = new Date(activeSession.started_at).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - sessionStartMs) / 1000);

      // 플랜의 paused_duration_seconds 사용 (추가 쿼리 없이 첫 조회에서 가져온 값)
      const planPausedDuration = plan.paused_duration_seconds || 0;
      accumulatedSeconds = Math.max(0, elapsed - planPausedDuration);
    }

    // 클라이언트에서 React Query invalidateQueries로 처리 (Optimistic Update)
    return {
      success: true,
      serverNow,
      status: "PAUSED" as const,
      accumulatedSeconds,
    };
  } catch (error) {
    timerLogger.error("플랜 일시정지 실패", {
      action: "pausePlan",
      id: planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 일시정지에 실패했습니다.",
    };
  }
}

/**
 * 플랜 재개
 */
export async function resumePlan(
  planId: string,
  timestamp?: string // 클라이언트에서 생성한 타임스탬프
): Promise<ResumePlanResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // [병렬화 최적화] 플랜과 세션을 동시에 조회
    const [planResult, sessionResult] = await Promise.all([
      // 플랜 조회 (상태 판별용 + paused_duration_seconds 포함)
      supabase
        .from("student_plan")
        .select("actual_start_time, actual_end_time, paused_duration_seconds")
        .eq("id", planId)
        .eq("student_id", user.userId)
        .maybeSingle(),
      // 활성 세션 조회 (최신 세션만)
      supabase
        .from("student_study_sessions")
        .select("id, started_at, paused_at, paused_duration_seconds, resumed_at, ended_at")
        .eq("plan_id", planId)
        .eq("student_id", user.userId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { data: plan, error: planError } = planResult;
    const { data: activeSession, error: sessionError } = sessionResult;

    if (planError || !plan) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    if (!activeSession) {
      return { success: false, error: "활성 세션을 찾을 수 없습니다." };
    }

    // 상태 머신 검증: RESUME 액션이 허용되는지 확인
    const validationError = validateTimerAction(plan, activeSession, "RESUME");
    if (validationError) {
      timerLogger.warn("상태 전환 검증 실패", {
        action: "resumePlan",
        id: planId,
        data: { timerAction: "RESUME", error: validationError },
      });
      // 일시정지 상태가 아닌 경우 사용자 친화적 메시지
      if (!isSessionPaused(activeSession)) {
        return { success: false, error: "일시정지된 상태가 아닙니다." };
      }
      return { success: false, error: validationError };
    }

    // [경합 방지 규칙 1-b] Ad-hoc 플랜 동시 실행 금지
    // 재개 시에도 활성 Ad-hoc 플랜이 있으면 차단
    const { data: activeAdHocPlans, error: adHocError } = await supabase
      .from("ad_hoc_plans")
      .select("id")
      .eq("student_id", user.userId)
      .eq("status", "in_progress");

    if (adHocError) {
      timerLogger.error("Ad-hoc 플랜 조회 오류", {
        action: "resumePlan",
        id: planId,
        error: adHocError instanceof Error ? adHocError : new Error(String(adHocError)),
      });
      return { success: false, error: TIMER_ERRORS.SESSION_QUERY_ERROR };
    }

    if (activeAdHocPlans && activeAdHocPlans.length > 0) {
      return {
        success: false,
        error: TIMER_ERRORS.TIMER_ALREADY_RUNNING_OTHER_PLAN,
      };
    }

    const pausedAt = new Date(activeSession.paused_at!);
    // 클라이언트에서 전달한 타임스탬프 사용, 없으면 서버에서 생성 (하위 호환성)
    const resumedAt = timestamp ? new Date(timestamp) : new Date();
    const pauseDuration = Math.max(0, Math.floor((resumedAt.getTime() - pausedAt.getTime()) / 1000));

    // 첫 조회에서 가져온 paused_duration_seconds 사용 (추가 쿼리 제거)
    const planPausedDuration = plan.paused_duration_seconds || 0;
    const updatedPlanPausedDuration = planPausedDuration + pauseDuration;

    // [병렬화 최적화] 세션 업데이트와 플랜 업데이트를 동시에 실행
    await Promise.all([
      // 세션 재개 (resumed_at만 업데이트)
      supabase
        .from("student_study_sessions")
        .update({
          resumed_at: resumedAt.toISOString(),
        })
        .eq("id", activeSession.id),
      // 플랜의 paused_duration_seconds 업데이트
      supabase
        .from("student_plan")
        .update({
          paused_duration_seconds: updatedPlanPausedDuration,
        })
        .eq("id", planId)
        .eq("student_id", user.userId),
    ]);

    // 서버 현재 시간 반환
    const serverNow = Date.now();

    let accumulatedSeconds = 0;
    let startedAt: string | null = null;
    if (plan.actual_start_time && activeSession?.started_at) {
      const sessionStartMs = new Date(activeSession.started_at).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - sessionStartMs) / 1000);
      // 플랜의 paused_duration_seconds만 사용 (이중 계산 방지)
      accumulatedSeconds = Math.max(0, elapsed - updatedPlanPausedDuration);
      startedAt = activeSession.started_at;
    }

    // 클라이언트에서 React Query invalidateQueries로 처리 (Optimistic Update)
    return {
      success: true,
      serverNow,
      status: "RUNNING" as const,
      accumulatedSeconds,
      startedAt: startedAt ?? null,
    };
  } catch (error) {
    timerLogger.error("플랜 재개 실패", {
      action: "resumePlan",
      id: planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 재개에 실패했습니다.",
    };
  }
}

/**
 * 플랜 완료 준비 (활성 세션 정리 및 메타데이터 반환)
 *
 * Today 화면에서 "학습 완료" 버튼 클릭 시 호출됩니다.
 * 활성 세션을 종료하고 완료 입력 페이지에 필요한 정보를 반환합니다.
 */
export async function preparePlanCompletion(
  planId: string
): Promise<PreparePlanCompletionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다.", hasActiveSession: false, isAlreadyCompleted: false };
  }

  const tenantContext = await getTenantContext();

  try {
    const supabase = await createSupabaseServerClient();
    const now = new Date();

    // 플랜 정보 조회
    const plan = await getPlanById(
      planId,
      user.userId,
      tenantContext?.tenantId || null
    );

    if (!plan) {
      return { success: false, error: "플랜을 찾을 수 없습니다.", hasActiveSession: false, isAlreadyCompleted: false };
    }

    // 이미 완료된 경우
    if (plan.actual_end_time) {
      return {
        success: true,
        plan: {
          id: plan.id,
          content_type: plan.content_type || "",
          content_id: plan.content_id || "",
          chapter: plan.chapter ?? null,
          planned_start_page_or_time: plan.planned_start_page_or_time ?? null,
          planned_end_page_or_time: plan.planned_end_page_or_time ?? null,
          actual_start_time: plan.actual_start_time ?? null,
          actual_end_time: plan.actual_end_time ?? null,
          total_duration_seconds: plan.total_duration_seconds ?? null,
          paused_duration_seconds: plan.paused_duration_seconds ?? null,
          is_reschedulable: plan.is_reschedulable || false,
          plan_date: plan.plan_date,
        },
        hasActiveSession: false,
        isAlreadyCompleted: true,
      };
    }

    // 활성 세션 조회
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("id, paused_duration_seconds, paused_at, resumed_at, started_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null);

    if (sessionError) {
      timerLogger.error("세션 조회 오류", {
        action: "preparePlanCompletion",
        id: planId,
        error: sessionError instanceof Error ? sessionError : new Error(String(sessionError)),
      });
      return { success: false, error: `세션 조회 중 오류가 발생했습니다: ${sessionError.message}`, hasActiveSession: false, isAlreadyCompleted: false };
    }

    const hasActiveSession = activeSessions && activeSessions.length > 0;

    // 활성 세션이 있으면 종료
    if (hasActiveSession && activeSessions) {
      let newlyAccumulatedPausedSeconds = 0;

      // 현재 일시정지 중인 세션만 추가 계산 (단일 소스 원칙 - 세션의 paused_duration_seconds는 사용하지 않음)
      for (const session of activeSessions) {
        // 현재 일시정지 중이었다면 아직 플랜에 반영되지 않은 일시정지 시간만 추가
        if (isSessionPaused(session)) {
          const pausedAt = new Date(session.paused_at!);
          const currentPause = Math.max(0, Math.floor((now.getTime() - pausedAt.getTime()) / 1000));
          newlyAccumulatedPausedSeconds += currentPause;
        }
        await endStudySession(session.id);
      }

      // 플랜의 paused_duration_seconds 업데이트 (플랜에서만 관리)
      const planPausedDuration = plan.paused_duration_seconds || 0;
      const updatedPausedDuration = planPausedDuration + newlyAccumulatedPausedSeconds;

      await supabase
        .from("student_plan")
        .update({
          paused_duration_seconds: updatedPausedDuration,
        })
        .eq("id", planId)
        .eq("student_id", user.userId);

      // 업데이트된 플랜 정보 다시 조회
      const updatedPlan = await getPlanById(
        planId,
        user.userId,
        tenantContext?.tenantId || null
      );

      if (updatedPlan) {
        await revalidateTimerPaths(false, false);
        return {
          success: true,
          plan: {
            id: updatedPlan.id,
            content_type: updatedPlan.content_type || "",
            content_id: updatedPlan.content_id || "",
            chapter: updatedPlan.chapter ?? null,
            planned_start_page_or_time: updatedPlan.planned_start_page_or_time ?? null,
            planned_end_page_or_time: updatedPlan.planned_end_page_or_time ?? null,
            actual_start_time: updatedPlan.actual_start_time ?? null,
            actual_end_time: updatedPlan.actual_end_time ?? null,
            total_duration_seconds: updatedPlan.total_duration_seconds ?? null,
            paused_duration_seconds: updatedPlan.paused_duration_seconds ?? null,
            is_reschedulable: updatedPlan.is_reschedulable || false,
            plan_date: updatedPlan.plan_date,
          },
          hasActiveSession: false, // 종료했으므로 false
          isAlreadyCompleted: false,
        };
      }
    }

    // 활성 세션이 없는 경우
    await revalidateTimerPaths(false, false);
    return {
      success: true,
      plan: {
        id: plan.id,
        content_type: plan.content_type || "",
        content_id: plan.content_id || "",
        chapter: plan.chapter ?? null,
        planned_start_page_or_time: plan.planned_start_page_or_time ?? null,
        planned_end_page_or_time: plan.planned_end_page_or_time ?? null,
        actual_start_time: plan.actual_start_time ?? null,
        actual_end_time: plan.actual_end_time ?? null,
        total_duration_seconds: plan.total_duration_seconds ?? null,
        paused_duration_seconds: plan.paused_duration_seconds ?? null,
        is_reschedulable: plan.is_reschedulable || false,
        plan_date: plan.plan_date,
      },
      hasActiveSession: false,
      isAlreadyCompleted: false,
    };
  } catch (error) {
    timerLogger.error("플랜 완료 준비 실패", {
      action: "preparePlanCompletion",
      id: planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 완료 준비에 실패했습니다.",
      hasActiveSession: false,
      isAlreadyCompleted: false,
    };
  }
}

/**
 * 타이머 진행 상태 동기화 (주기적 저장)
 *
 * RUNNING 상태에서 주기적으로 호출되어 현재 학습 시간을 DB에 저장합니다.
 * 브라우저 종료/새로고침 시 데이터 손실을 방지합니다.
 *
 * @param planId 플랜 ID
 * @param elapsedSeconds 클라이언트에서 측정한 경과 시간 (초)
 */
export async function syncTimerProgress(
  planId: string,
  elapsedSeconds: number
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 플랜과 활성 세션 동시 조회
    const [planResult, sessionResult] = await Promise.all([
      supabase
        .from("student_plan")
        .select("actual_start_time, actual_end_time, paused_duration_seconds")
        .eq("id", planId)
        .eq("student_id", user.userId)
        .maybeSingle(),
      supabase
        .from("student_study_sessions")
        .select("id, paused_at, resumed_at, ended_at")
        .eq("plan_id", planId)
        .eq("student_id", user.userId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { data: plan, error: planError } = planResult;
    const { data: activeSession, error: sessionError } = sessionResult;

    if (planError || !plan) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    // 이미 완료된 플랜은 동기화하지 않음
    if (plan.actual_end_time) {
      return { success: false, error: "이미 완료된 플랜입니다." };
    }

    // 활성 세션이 없거나 일시정지 상태면 동기화하지 않음
    if (!activeSession) {
      return { success: false, error: "활성 세션이 없습니다." };
    }

    if (isSessionPaused(activeSession)) {
      return { success: false, error: "일시정지 상태입니다." };
    }

    // 현재 시점의 순수 학습 시간 저장 (일시정지 시간 제외)
    // 클라이언트에서 측정한 시간을 신뢰하되, 서버에서 검증 가능한 범위 내에서 저장
    const pausedDuration = plan.paused_duration_seconds || 0;
    const totalDurationSeconds = elapsedSeconds + pausedDuration;

    // student_plan의 actual_duration 필드에 저장
    // actual_duration은 분 단위로 저장 (기존 스키마 호환)
    const actualDurationMinutes = Math.floor(elapsedSeconds / 60);

    const { error: updateError } = await supabase
      .from("student_plan")
      .update({
        actual_duration: actualDurationMinutes,
        // total_duration_seconds는 완료 시에만 저장하므로 여기서는 업데이트하지 않음
      })
      .eq("id", planId)
      .eq("student_id", user.userId);

    if (updateError) {
      timerLogger.warn("타이머 진행 동기화 실패", {
        action: "syncTimerProgress",
        id: planId,
        error: updateError instanceof Error ? updateError : new Error(String(updateError)),
      });
      return { success: false, error: "동기화에 실패했습니다." };
    }

    timerLogger.debug("타이머 진행 동기화 완료", {
      action: "syncTimerProgress",
      id: planId,
      data: { elapsedSeconds, actualDurationMinutes },
    });

    return { success: true };
  } catch (error) {
    timerLogger.error("타이머 진행 동기화 예외", {
      action: "syncTimerProgress",
      id: planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "동기화 중 오류가 발생했습니다.",
    };
  }
}

// stopAllActiveSessionsForPlan was removed - use preparePlanCompletion instead

// =====================
// 통합 타이머 래퍼 함수들
// =====================

// Ad-hoc plan timer functions are imported at the top of this file

export type PlanType = "student_plan" | "ad_hoc_plan";

/**
 * 통합 플랜 시작 함수
 *
 * planType에 따라 student_plan 또는 ad_hoc_plan 타이머 로직을 실행합니다.
 */
export async function startPlanUnified(
  planId: string,
  planType: PlanType,
  timestamp?: string
): Promise<StartPlanResult> {
  if (planType === "ad_hoc_plan") {
    return startAdHocPlan(planId);
  }
  return startPlan(planId, timestamp);
}

/**
 * 통합 플랜 완료 함수
 *
 * planType에 따라 student_plan 또는 ad_hoc_plan 완료 로직을 실행합니다.
 * student_plan의 경우 PlanRecordPayload가 필요하며, ad_hoc_plan의 경우 actualMinutes만 필요합니다.
 */
export async function completePlanUnified(
  planId: string,
  planType: PlanType,
  payloadOrMinutes?: PlanRecordPayload | number
): Promise<CompletePlanResult> {
  if (planType === "ad_hoc_plan") {
    const actualMinutes = typeof payloadOrMinutes === "number" ? payloadOrMinutes : undefined;
    return completeAdHocPlan(planId, actualMinutes);
  }
  // student_plan의 경우 payload가 필요
  const payload = (typeof payloadOrMinutes === "object" ? payloadOrMinutes : {}) as PlanRecordPayload;
  return completePlan(planId, payload);
}

/**
 * 통합 플랜 취소 함수
 *
 * planType에 따라 student_plan 또는 ad_hoc_plan 취소 로직을 실행합니다.
 */
export async function cancelPlanUnified(
  planId: string,
  planType: PlanType
): Promise<ActionResult> {
  if (planType === "ad_hoc_plan") {
    return cancelAdHocPlan(planId);
  }
  // student_plan은 미완료 상태로 두거나 일시정지 처리
  return pausePlan(planId);
}
