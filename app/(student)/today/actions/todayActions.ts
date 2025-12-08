"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanById, updatePlan } from "@/lib/data/studentPlans";
import { startStudySession, endStudySession } from "@/app/(student)/actions/studySessionActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateString } from "@/lib/date/calendarUtils";

type PlanRecordPayload = {
  startPageOrTime: number;
  endPageOrTime: number;
  memo?: string | null;
};

/**
 * 플랜 시작 (타이머 시작)
 */
export async function startPlan(
  planId: string,
  timestamp?: string // 클라이언트에서 생성한 타임스탬프
): Promise<{ 
  success: boolean; 
  sessionId?: string; 
  error?: string;
  serverNow?: number;
  status?: "RUNNING";
  startedAt?: string;
  accumulatedSeconds?: number;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    // 다른 플랜이 활성화되어 있는지 확인 (현재 플랜 제외, 일시정지된 세션 제외)
    // 일시정지된 세션은 paused_at이 있고 resumed_at이 없는 상태
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("plan_id, paused_at, resumed_at")
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .neq("plan_id", planId);

    if (sessionError) {
      console.error("[todayActions] 활성 세션 조회 오류:", sessionError);
      return { success: false, error: "활성 세션 조회 중 오류가 발생했습니다." };
    }

    // 일시정지되지 않은 실제 활성 세션만 필터링
    const trulyActiveSessions = activeSessions?.filter(
      (session) => !session.paused_at || session.resumed_at
    ) || [];

    // 다른 플랜이 활성화되어 있으면 에러 반환
    if (trulyActiveSessions.length > 0) {
      return { 
        success: false, 
        error: "다른 플랜의 타이머가 실행 중입니다. 먼저 해당 플랜의 타이머를 중지해주세요." 
      };
    }

    // 학습 세션 시작 (내부에서 플랜 조회 및 검증 수행)
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

    // 필요한 경로만 재검증 (성능 최적화)
    revalidatePath("/today");
    revalidatePath("/camp/today");
    return { 
      success: true, 
      sessionId: result.sessionId,
      serverNow,
      status: "RUNNING" as const,
      accumulatedSeconds: 0,
      startedAt: sessionStartedAt,
    };
  } catch (error) {
    console.error("[todayActions] 플랜 시작 실패", error);
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
): Promise<{ 
  success: boolean; 
  error?: string;
  serverNow?: number;
  status?: "COMPLETED";
  accumulatedSeconds?: number;
  startedAt?: string | null;
}> {
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

    // 콘텐츠 총량 조회
    let totalAmount: number | null = null;
    if (plan.content_type === "book") {
      const { data } = await supabase
        .from("books")
        .select("total_pages")
        .eq("id", plan.content_id)
        .maybeSingle();
      totalAmount = data?.total_pages ?? null;
    } else if (plan.content_type === "lecture") {
      const { data } = await supabase
        .from("lectures")
        .select("duration")
        .eq("id", plan.content_id)
        .maybeSingle();
      totalAmount = data?.duration ?? null;
    } else if (plan.content_type === "custom") {
      const { data } = await supabase
        .from("student_custom_contents")
        .select("total_page_or_time")
        .eq("id", plan.content_id)
        .maybeSingle();
      totalAmount = data?.total_page_or_time ?? null;
    }

    if (totalAmount === null || totalAmount <= 0) {
      return { success: false, error: "콘텐츠 총량을 확인할 수 없습니다." };
    }

    // 진행률 계산
    const completedAmount = payload.endPageOrTime - payload.startPageOrTime;
    const progress = Math.min(
      Math.round((completedAmount / totalAmount) * 100),
      100
    );

    // 같은 plan_number를 가진 모든 플랜의 진행률 업데이트
    for (const samePlan of samePlanNumberPlans) {
      await updatePlan(samePlan.id, user.userId, {
        completed_amount: completedAmount,
        progress: progress,
      });
    }

    // student의 tenant_id 조회 (tenant_id가 없어도 진행 가능하도록)
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", user.userId)
      .maybeSingle();

    const tenantId = student?.tenant_id || tenantContext?.tenantId || null;

    // 같은 plan_number를 가진 모든 플랜의 student_content_progress에 기록
    for (const samePlan of samePlanNumberPlans) {
      const { data: existingPlanProgress } = await supabase
        .from("student_content_progress")
        .select("id")
        .eq("student_id", user.userId)
        .eq("plan_id", samePlan.id)
        .maybeSingle();

      const progressPayload = {
        student_id: user.userId,
        tenant_id: tenantId,
        plan_id: samePlan.id,
        content_type: plan.content_type,
        content_id: plan.content_id,
        progress: progress,
        start_page_or_time: payload.startPageOrTime,
        end_page_or_time: payload.endPageOrTime,
        completed_amount: completedAmount,
        last_updated: new Date().toISOString(),
      };

      if (existingPlanProgress) {
        await supabase
          .from("student_content_progress")
          .update(progressPayload)
          .eq("id", existingPlanProgress.id);
      } else {
        await supabase.from("student_content_progress").insert(progressPayload);
      }
    }

    // content_type + content_id로도 진행률 업데이트 (전체 진행률)
    const { data: existingContentProgress } = await supabase
      .from("student_content_progress")
      .select("id,completed_amount")
      .eq("student_id", user.userId)
      .eq("content_type", plan.content_type)
      .eq("content_id", plan.content_id)
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
        content_id: plan.content_id,
        completed_amount: completedAmount,
        progress: progress,
        last_updated: new Date().toISOString(),
      });
    }

    // 플랜의 actual_end_time 및 시간 정보 업데이트
    const now = new Date();
    const actualEndTime = plan.actual_end_time || now.toISOString();

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
    const sessionPausedDuration = activeSession?.paused_duration_seconds || 0;
    const planPausedDuration = planData?.paused_duration_seconds || 0;
    
    // 현재 일시정지 중인 경우 일시정지 시간 추가 계산
    let currentPauseDuration = sessionPausedDuration;
    if (activeSession?.paused_at && !activeSession.resumed_at) {
      const pausedAt = new Date(activeSession.paused_at);
      const now = new Date();
      const currentPauseSeconds = Math.floor((now.getTime() - pausedAt.getTime()) / 1000);
      currentPauseDuration += currentPauseSeconds;
    }
    
    const totalPausedDuration = currentPauseDuration + planPausedDuration;
    const pauseCount = planData?.pause_count || 0;

    // 활성 세션 종료 (모든 활성 세션 종료)
    if (activeSessions && activeSessions.length > 0) {
      for (const session of activeSessions) {
        await endStudySession(session.id);
      }
    }

    // 같은 plan_number를 가진 모든 플랜의 시간 정보 업데이트
    for (const samePlan of samePlanNumberPlans) {
      // 각 플랜의 actual_start_time 조회
      const { data: samePlanData } = await supabase
        .from("student_plan")
        .select("actual_start_time, paused_duration_seconds, pause_count")
        .eq("id", samePlan.id)
        .eq("student_id", user.userId)
        .maybeSingle();

      let samePlanTotalDurationSeconds: number | null = null;
      if (samePlanData?.actual_start_time) {
        const startTime = new Date(samePlanData.actual_start_time);
        const endTime = new Date(actualEndTime);
        samePlanTotalDurationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      }

      const samePlanPausedDuration = samePlanData?.paused_duration_seconds || 0;
      const samePlanPauseCount = samePlanData?.pause_count || 0;

      // 각 플랜의 활성 세션 조회 및 종료
      const { data: samePlanActiveSessions } = await supabase
        .from("student_study_sessions")
        .select("id, paused_duration_seconds, paused_at, resumed_at")
        .eq("plan_id", samePlan.id)
        .eq("student_id", user.userId)
        .is("ended_at", null);

      let samePlanCurrentPauseDuration = 0;
      if (samePlanActiveSessions && samePlanActiveSessions.length > 0) {
        const samePlanActiveSession = samePlanActiveSessions[0];
        samePlanCurrentPauseDuration = samePlanActiveSession.paused_duration_seconds || 0;
        
        if (samePlanActiveSession.paused_at && !samePlanActiveSession.resumed_at) {
          const pausedAt = new Date(samePlanActiveSession.paused_at);
          const now = new Date();
          const currentPauseSeconds = Math.floor((now.getTime() - pausedAt.getTime()) / 1000);
          samePlanCurrentPauseDuration += currentPauseSeconds;
        }

        // 활성 세션 종료
        for (const session of samePlanActiveSessions) {
          await endStudySession(session.id);
        }
      }

      const samePlanTotalPausedDuration = samePlanCurrentPauseDuration + samePlanPausedDuration;

      // 플랜 시간 정보 업데이트
      await supabase
        .from("student_plan")
        .update({
          actual_end_time: actualEndTime,
          total_duration_seconds: samePlanTotalDurationSeconds,
          paused_duration_seconds: samePlanTotalPausedDuration,
          pause_count: samePlanPauseCount,
        })
        .eq("id", samePlan.id)
        .eq("student_id", user.userId);
    }

    // 완료 시점의 순수 학습 시간 계산 (일시정지 시간 제외)
    const finalDuration = totalDurationSeconds ? Math.max(0, totalDurationSeconds - totalPausedDuration) : 0;

    // 서버 현재 시간 반환
    const serverNow = Date.now();

    // 필요한 경로만 재검증 (성능 최적화)
    // 완료 시에는 대시보드도 업데이트 필요
    revalidatePath("/today");
    revalidatePath("/camp/today");
    revalidatePath("/dashboard");
    return { 
      success: true,
      serverNow,
      status: "COMPLETED" as const,
      accumulatedSeconds: finalDuration,
      startedAt: null,
    };
  } catch (error) {
    console.error("[todayActions] 플랜 완료 실패", error);
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
): Promise<{ success: boolean; error?: string }> {
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

    revalidatePath("/today");
    revalidatePath("/camp/today");
    return { success: true };
  } catch (error) {
    console.error("[todayActions] 플랜 미루기 실패", error);
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
    revalidatePath("/today");
    revalidatePath("/camp/today");
    revalidatePath("/dashboard");
    return result;
  } catch (error) {
    console.error("[todayActions] 타이머 종료 실패", error);
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
): Promise<{ 
  success: boolean; 
  error?: string;
  serverNow?: number;
  status?: "PAUSED";
  accumulatedSeconds?: number;
  startedAt?: never; // PAUSED 상태에는 startedAt이 없음
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 활성 세션 조회 (최신 세션만 조회하여 최적화)
    const { data: activeSession, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("id, started_at, paused_at, resumed_at, paused_duration_seconds")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(); // 최신 세션만 조회

    if (!activeSession) {
      return { success: false, error: "활성 세션을 찾을 수 없습니다. 플랜을 먼저 시작해주세요." };
    }

    // 이미 일시정지된 상태인지 확인
    if (activeSession.paused_at && !activeSession.resumed_at) {
      return { success: false, error: "이미 일시정지된 상태입니다." };
    }

    // 세션 일시정지
    // 클라이언트에서 전달한 타임스탬프 사용, 없으면 서버에서 생성 (하위 호환성)
    const pauseTimestamp = timestamp || new Date().toISOString();
    
    // 재개 후 다시 일시정지하는 경우를 위해 resumed_at을 null로 리셋
    // 이전 일시정지 시간이 있다면 paused_duration_seconds에 이미 누적되어 있음
    const { error: pauseError } = await supabase
      .from("student_study_sessions")
      .update({
        paused_at: pauseTimestamp,
        resumed_at: null, // 재개 후 다시 일시정지할 때 리셋
      })
      .eq("id", activeSession.id)
      .eq("student_id", user.userId);

    if (pauseError) {
      console.error("[todayActions] 세션 일시정지 오류:", pauseError);
      return { success: false, error: "세션 일시정지에 실패했습니다." };
    }

    // 플랜의 pause_count 증가 (RPC 함수로 한 번의 쿼리로 최적화)
    const { data: newPauseCount, error: rpcError } = await supabase.rpc(
      "increment_pause_count",
      {
        p_plan_id: planId,
        p_student_id: user.userId,
      }
    );

    if (rpcError) {
      console.error("[todayActions] pause_count 증가 오류:", rpcError);
      // 일시정지는 성공했으므로 경고만 로그하고 계속 진행
    }

    // 서버 현재 시간 반환
    const serverNow = Date.now();

    // 플랜의 현재 누적 시간 계산 (세션 정보 사용)
    let accumulatedSeconds = 0;
    if (activeSession?.started_at) {
      const sessionStartMs = new Date(activeSession.started_at).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - sessionStartMs) / 1000);
      const sessionPausedDuration = activeSession.paused_duration_seconds || 0;
      
      // 플랜의 paused_duration_seconds도 고려
      const { data: planData } = await supabase
        .from("student_plan")
        .select("paused_duration_seconds")
        .eq("id", planId)
        .eq("student_id", user.userId)
        .maybeSingle();
      
      const planPausedDuration = planData?.paused_duration_seconds || 0;
      accumulatedSeconds = Math.max(0, elapsed - sessionPausedDuration - planPausedDuration);
    }

    // 필요한 경로만 재검증 (성능 최적화)
    revalidatePath("/today");
    revalidatePath("/camp/today");
    return { 
      success: true,
      serverNow,
      status: "PAUSED" as const,
      accumulatedSeconds,
    };
  } catch (error) {
    console.error("[todayActions] 플랜 일시정지 실패", error);
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
): Promise<{ 
  success: boolean; 
  error?: string;
  serverNow?: number;
  status?: "RUNNING";
  startedAt?: string | null;
  accumulatedSeconds?: number;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 활성 세션 조회 (최신 세션만 조회하여 최적화)
    const { data: activeSession, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("id, started_at, paused_at, paused_duration_seconds, resumed_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(); // 최신 세션만 조회

    if (!activeSession) {
      return { success: false, error: "활성 세션을 찾을 수 없습니다." };
    }

    // 일시정지 상태인지 확인
    if (!activeSession.paused_at || activeSession.resumed_at) {
      return { success: false, error: "일시정지된 상태가 아닙니다." };
    }

    const pausedAt = new Date(activeSession.paused_at);
    // 클라이언트에서 전달한 타임스탬프 사용, 없으면 서버에서 생성 (하위 호환성)
    const resumedAt = timestamp ? new Date(timestamp) : new Date();
    const pauseDuration = Math.floor((resumedAt.getTime() - pausedAt.getTime()) / 1000);
    const totalPausedDuration = (activeSession.paused_duration_seconds || 0) + pauseDuration;

    // 세션 재개
    await supabase
      .from("student_study_sessions")
      .update({
        resumed_at: resumedAt.toISOString(),
        paused_duration_seconds: totalPausedDuration,
      })
      .eq("id", activeSession.id);

    // 플랜의 paused_duration_seconds 업데이트 및 현재 누적 시간 계산을 위한 조회
    const { data: planData } = await supabase
      .from("student_plan")
      .select("actual_start_time, paused_duration_seconds")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    // 플랜의 paused_duration_seconds 업데이트
    const planPausedDuration = planData?.paused_duration_seconds || 0;
    await supabase
      .from("student_plan")
      .update({
        paused_duration_seconds: planPausedDuration + pauseDuration,
      })
      .eq("id", planId)
      .eq("student_id", user.userId);

    // 서버 현재 시간 반환
    const serverNow = Date.now();

    let accumulatedSeconds = 0;
    let startedAt: string | null = null;
    if (planData?.actual_start_time && activeSession?.started_at) {
      const sessionStartMs = new Date(activeSession.started_at).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - sessionStartMs) / 1000);
      const sessionPausedDuration = activeSession.paused_duration_seconds || 0;
      const planPausedDuration = planData.paused_duration_seconds || 0;
      accumulatedSeconds = Math.max(0, elapsed - sessionPausedDuration - planPausedDuration);
      startedAt = activeSession.started_at;
    }

    // 필요한 경로만 재검증 (성능 최적화)
    revalidatePath("/today");
    revalidatePath("/camp/today");
    return { 
      success: true,
      serverNow,
      status: "RUNNING" as const,
      accumulatedSeconds,
      startedAt: startedAt ?? null,
    };
  } catch (error) {
    console.error("[todayActions] 플랜 재개 실패", error);
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
): Promise<{
  success: boolean;
  error?: string;
  plan?: {
    id: string;
    content_type: string;
    content_id: string;
    chapter: string | null;
    planned_start_page_or_time: number | null;
    planned_end_page_or_time: number | null;
    actual_start_time: string | null;
    actual_end_time: string | null;
    total_duration_seconds: number | null;
    paused_duration_seconds: number | null;
    is_reschedulable: boolean;
    plan_date: string;
  };
  hasActiveSession: boolean;
  isAlreadyCompleted: boolean;
}> {
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
      console.error("[todayActions] 세션 조회 오류:", sessionError);
      return { success: false, error: `세션 조회 중 오류가 발생했습니다: ${sessionError.message}`, hasActiveSession: false, isAlreadyCompleted: false };
    }

    const hasActiveSession = activeSessions && activeSessions.length > 0;

    // 활성 세션이 있으면 종료
    if (hasActiveSession && activeSessions) {
      let newlyAccumulatedPausedSeconds = 0;

      for (const session of activeSessions) {
        let pausedSeconds = session.paused_duration_seconds || 0;

        // 현재 일시정지 중이었다면 추가 계산
        if (session.paused_at && !session.resumed_at) {
          const pausedAt = new Date(session.paused_at);
          const currentPause = Math.floor((now.getTime() - pausedAt.getTime()) / 1000);
          pausedSeconds += currentPause;
        }

        newlyAccumulatedPausedSeconds += pausedSeconds;
        await endStudySession(session.id);
      }

      // 플랜의 paused_duration_seconds 업데이트
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
        revalidatePath("/today");
        revalidatePath("/camp/today");
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
    revalidatePath("/today");
    revalidatePath("/camp/today");
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
    console.error("[todayActions] 플랜 완료 준비 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 완료 준비에 실패했습니다.",
      hasActiveSession: false,
      isAlreadyCompleted: false,
    };
  }
}

/**
 * 플랜의 모든 활성 세션 종료 (완료 버튼 클릭 시 타이머 중지용)
 * @deprecated Use preparePlanCompletion instead for new code
 */
export async function stopAllActiveSessionsForPlan(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const now = new Date();

    // 플랜 정보 조회 (시간 계산용)
    const { data: planData, error: planError } = await supabase
      .from("student_plan")
      .select("actual_start_time, actual_end_time, paused_duration_seconds")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planError || !planData) {
      console.error("[todayActions] 플랜 조회 실패:", planError);
      return { success: false, error: "플랜 정보를 가져오지 못했습니다." };
    }

    // 해당 플랜의 모든 활성 세션 조회 (일시정지 정보 포함)
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("id, paused_duration_seconds, paused_at, resumed_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null);

    if (sessionError) {
      console.error("[todayActions] 세션 조회 오류:", sessionError);
      return { success: false, error: `세션 조회 중 오류가 발생했습니다: ${sessionError.message}` };
    }

    let newlyAccumulatedPausedSeconds = 0;

    if (activeSessions && activeSessions.length > 0) {
      for (const session of activeSessions) {
        let pausedSeconds = session.paused_duration_seconds || 0;

        // 현재 일시정지 중이었다면 추가 계산
        if (session.paused_at && !session.resumed_at) {
          const pausedAt = new Date(session.paused_at);
          const currentPause = Math.floor((now.getTime() - pausedAt.getTime()) / 1000);
          pausedSeconds += currentPause;
        }

        newlyAccumulatedPausedSeconds += pausedSeconds;
        await endStudySession(session.id);
      }
    }

    const planPausedDuration = planData.paused_duration_seconds || 0;
    const updatedPausedDuration = planPausedDuration + newlyAccumulatedPausedSeconds;

    const actualEndTime = planData.actual_end_time || now.toISOString();
    const endDate = new Date(actualEndTime);

    let totalDurationSeconds: number | null = null;
    if (planData.actual_start_time) {
      const startTime = new Date(planData.actual_start_time);
      totalDurationSeconds = Math.floor((endDate.getTime() - startTime.getTime()) / 1000);
    }

    await supabase
      .from("student_plan")
      .update({
        actual_end_time: actualEndTime,
        total_duration_seconds: totalDurationSeconds,
        paused_duration_seconds: updatedPausedDuration,
      })
      .eq("id", planId)
      .eq("student_id", user.userId);

    revalidatePath("/today");
    revalidatePath("/camp/today");
    return { success: true };
  } catch (error) {
    console.error("[todayActions] 세션 종료 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 종료에 실패했습니다.",
    };
  }
}

