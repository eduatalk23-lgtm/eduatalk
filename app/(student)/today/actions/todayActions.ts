"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanById, updatePlan } from "@/lib/data/studentPlans";
import { startStudySession, endStudySession } from "@/app/(student)/actions/studySessionActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    // 다른 플랜이 활성화되어 있는지 확인 (현재 플랜 제외)
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("plan_id")
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .neq("plan_id", planId);

    if (sessionError) {
      console.error("[todayActions] 활성 세션 조회 오류:", sessionError);
      return { success: false, error: "활성 세션 조회 중 오류가 발생했습니다." };
    }

    // 다른 플랜이 활성화되어 있으면 에러 반환
    if (activeSessions && activeSessions.length > 0) {
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
    // startStudySession 내부에서 이미 플랜을 조회하므로 여기서는 직접 업데이트만 수행
    const startTime = timestamp || new Date().toISOString();
    const { data: planData } = await supabase
      .from("student_plan")
      .select("actual_start_time")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (planData && !planData.actual_start_time) {
      await supabase
        .from("student_plan")
        .update({
          actual_start_time: startTime,
        })
        .eq("id", planId)
        .eq("student_id", user.userId);
    }

    // 필요한 경로만 재검증 (성능 최적화)
    revalidatePath("/today");
    return { success: true, sessionId: result.sessionId };
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
): Promise<{ success: boolean; error?: string }> {
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

    // 플랜 진행률 업데이트
    await updatePlan(planId, user.userId, {
      completed_amount: completedAmount,
      progress: progress,
    });

    // student의 tenant_id 조회 (tenant_id가 없어도 진행 가능하도록)
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", user.userId)
      .maybeSingle();

    const tenantId = student?.tenant_id || tenantContext?.tenantId || null;

    // student_content_progress에 기록
    // plan_id로 기존 진행률 확인
    const { data: existingPlanProgress } = await supabase
      .from("student_content_progress")
      .select("id")
      .eq("student_id", user.userId)
      .eq("plan_id", planId)
      .maybeSingle();

    const progressPayload = {
      student_id: user.userId,
      tenant_id: tenantId,
      plan_id: planId,
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

    // 플랜 시간 정보 업데이트
    await supabase
      .from("student_plan")
      .update({
        actual_end_time: actualEndTime,
        total_duration_seconds: totalDurationSeconds,
        paused_duration_seconds: totalPausedDuration,
        pause_count: pauseCount,
      })
      .eq("id", planId)
      .eq("student_id", user.userId);

    // 완료 시점의 순수 학습 시간 계산 (일시정지 시간 제외)
    const finalDuration = totalDurationSeconds ? Math.max(0, totalDurationSeconds - totalPausedDuration) : 0;

    // 필요한 경로만 재검증 (성능 최적화)
    // 완료 시에는 대시보드도 업데이트 필요
    revalidatePath("/today");
    revalidatePath("/dashboard");
    return { success: true };
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
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);

    await updatePlan(planId, user.userId, {
      plan_date: tomorrowDate,
    });

    revalidatePath("/today");
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
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 활성 세션 조회 (여러 개일 수 있으므로 배열로 조회)
    // 일시정지된 세션도 포함하여 조회 (이미 일시정지된 경우를 확인하기 위해)
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("id, paused_at, resumed_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false }); // 최신 세션 우선

    if (sessionError) {
      console.error("[todayActions] 세션 조회 오류:", sessionError);
      return { success: false, error: `세션 조회 중 오류가 발생했습니다: ${sessionError.message}` };
    }

    // 여러 세션이 있는 경우 가장 최근 세션 사용
    const activeSession = activeSessions && activeSessions.length > 0 ? activeSessions[0] : null;

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
    const { error: pauseError } = await supabase
      .from("student_study_sessions")
      .update({
        paused_at: pauseTimestamp,
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

    // duration 계산은 클라이언트에서 타임스탬프 기반으로 수행하므로 서버에서 불필요

    // 필요한 경로만 재검증 (성능 최적화)
    revalidatePath("/today");
    return { success: true };
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
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 활성 세션 조회 (여러 개일 수 있으므로 배열로 조회)
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("id, paused_at, paused_duration_seconds, resumed_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false }); // 최신 세션 우선

    if (sessionError) {
      console.error("[todayActions] 세션 조회 오류:", sessionError);
      return { success: false, error: `세션 조회 중 오류가 발생했습니다: ${sessionError.message}` };
    }

    // 여러 세션이 있는 경우 가장 최근 세션 사용
    const activeSession = activeSessions && activeSessions.length > 0 ? activeSessions[0] : null;

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

    // 플랜의 paused_duration_seconds 업데이트 (한 번의 쿼리로 조회 및 업데이트)
    const { data: planData } = await supabase
      .from("student_plan")
      .select("paused_duration_seconds")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    const planPausedDuration = planData?.paused_duration_seconds || 0;
    await supabase
      .from("student_plan")
      .update({
        paused_duration_seconds: planPausedDuration + pauseDuration,
      })
      .eq("id", planId)
      .eq("student_id", user.userId);

    // duration 계산은 클라이언트에서 타임스탬프 기반으로 수행하므로 서버에서 불필요

    // 필요한 경로만 재검증 (성능 최적화)
    revalidatePath("/today");
    return { success: true };
  } catch (error) {
    console.error("[todayActions] 플랜 재개 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 재개에 실패했습니다.",
    };
  }
}

/**
 * 플랜의 모든 활성 세션 종료 (완료 버튼 클릭 시 타이머 중지용)
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

    // 해당 플랜의 모든 활성 세션 조회
    const { data: activeSessions, error: sessionError } = await supabase
      .from("student_study_sessions")
      .select("id")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null);

    if (sessionError) {
      console.error("[todayActions] 세션 조회 오류:", sessionError);
      return { success: false, error: `세션 조회 중 오류가 발생했습니다: ${sessionError.message}` };
    }

    // 모든 활성 세션 종료
    if (activeSessions && activeSessions.length > 0) {
      for (const session of activeSessions) {
        await endStudySession(session.id);
      }
    }

    revalidatePath("/today");
    return { success: true };
  } catch (error) {
    console.error("[todayActions] 세션 종료 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 종료에 실패했습니다.",
    };
  }
}

