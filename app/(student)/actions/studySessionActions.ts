"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getActiveSession,
  createSession,
  endSession,
  deleteSession,
  getSessionById,
} from "@/lib/data/studentSessions";
import { getPlanById } from "@/lib/data/studentPlans";
import { recordHistory } from "@/lib/history/record";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 학습 세션 시작
export async function startStudySession(
  planId?: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요." };
  }

  try {
    // 기존 활성 세션 확인 (planId가 있는 경우 해당 플랜의 세션만 확인)
    if (planId) {
      // 특정 플랜의 활성 세션이 있는지 확인
      const supabase = await createSupabaseServerClient();
      const { data: existingSession } = await supabase
        .from("student_study_sessions")
        .select("id")
        .eq("plan_id", planId)
        .eq("student_id", user.userId)
        .is("ended_at", null)
        .maybeSingle();

      if (existingSession) {
        // 이미 해당 플랜의 세션이 활성화되어 있으면 에러 반환
        return { success: false, error: "이미 해당 플랜의 타이머가 실행 중입니다." };
      }
    } else {
      // planId가 없는 경우 전체 활성 세션 확인
      const activeSession = await getActiveSession(
        user.userId,
        tenantContext.tenantId
      );
      if (activeSession) {
        // 기존 세션 강제 종료 후 새 세션 시작 (planId가 없는 경우만)
        await endStudySession(activeSession.id);
      }
    }

    // 플랜 정보 조회 (planId가 있는 경우)
    let contentType: string | null = null;
    let contentId: string | null = null;

    if (planId) {
      const plan = await getPlanById(
        planId,
        user.userId,
        tenantContext.tenantId
      );
      if (plan) {
        contentType = plan.content_type;
        contentId = plan.content_id;
      }
    }

    // 새 세션 생성
    const result = await createSession({
      tenant_id: tenantContext.tenantId,
      student_id: user.userId,
      plan_id: planId || null,
      content_type: contentType,
      content_id: contentId,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/today");
    return { success: true, sessionId: result.sessionId };
  } catch (error) {
    console.error("[studySessions] 세션 시작 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 시작에 실패했습니다.",
    };
  }
}

// 학습 세션 종료
export async function endStudySession(
  sessionId: string
): Promise<{ success: boolean; durationSeconds?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const tenantContext = await getTenantContext();

    // 세션 조회 및 검증
    const session = await getSessionById(
      sessionId,
      user.userId,
      tenantContext?.tenantId || null
    );

    if (!session) {
      return { success: false, error: "세션을 찾을 수 없습니다." };
    }

    if (session.ended_at) {
      return { success: false, error: "이미 종료된 세션입니다." };
    }

    // 일시정지된 시간 계산 (세션 종료 시)
    let totalPausedDuration = session.paused_duration_seconds || 0;
    if (session.paused_at && !session.resumed_at) {
      // 현재 일시정지 중인 경우, 일시정지 시간 추가 계산
      const pausedAt = new Date(session.paused_at);
      const now = new Date();
      const currentPauseDuration = Math.floor((now.getTime() - pausedAt.getTime()) / 1000);
      totalPausedDuration += currentPauseDuration;
    }

    // 세션 종료
    const result = await endSession(sessionId, user.userId, undefined, totalPausedDuration);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 히스토리 기록
    if (session.content_type && session.content_id) {
      const sessionDate = new Date(session.started_at).toISOString().slice(0, 10);
      const supabase = await createSupabaseServerClient();
      await recordHistory(
        supabase,
        user.userId,
        "study_session",
        {
          session_id: sessionId,
          duration: result.durationSeconds || 0,
          content_type: session.content_type,
          content_id: session.content_id,
          date: sessionDate,
        },
        tenantContext?.tenantId || null
      );
    }

    revalidatePath("/today");
    return { success: true, durationSeconds: result.durationSeconds };
  } catch (error) {
    console.error("[studySessions] 세션 종료 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 종료에 실패했습니다.",
    };
  }
}

// 학습 세션 취소 (삭제)
export async function cancelStudySession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const tenantContext = await getTenantContext();

    // 세션 조회 및 검증
    const session = await getSessionById(
      sessionId,
      user.userId,
      tenantContext?.tenantId || null
    );

    if (!session) {
      return { success: false, error: "세션을 찾을 수 없습니다." };
    }

    // 종료되지 않은 세션만 취소 가능
    if (session.ended_at) {
      return { success: false, error: "이미 종료된 세션은 취소할 수 없습니다." };
    }

    // 세션 삭제
    const result = await deleteSession(sessionId, user.userId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/today");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[studySessions] 세션 취소 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 취소에 실패했습니다.",
    };
  }
}

// 학습 세션 일시정지
export async function pauseStudySession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const tenantContext = await getTenantContext();
    const supabase = await createSupabaseServerClient();

    // 세션 조회 및 검증
    const session = await getSessionById(
      sessionId,
      user.userId,
      tenantContext?.tenantId || null
    );

    if (!session) {
      return { success: false, error: "세션을 찾을 수 없습니다." };
    }

    if (session.ended_at) {
      return { success: false, error: "이미 종료된 세션입니다." };
    }

    // 이미 일시정지된 상태인지 확인
    if (session.paused_at && !session.resumed_at) {
      return { success: false, error: "이미 일시정지된 상태입니다." };
    }

    // 세션 일시정지
    await supabase
      .from("student_study_sessions")
      .update({
        paused_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("student_id", user.userId);

    revalidatePath("/today");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[studySessions] 세션 일시정지 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 일시정지에 실패했습니다.",
    };
  }
}

// 학습 세션 재개
export async function resumeStudySession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const tenantContext = await getTenantContext();
    const supabase = await createSupabaseServerClient();

    // 세션 조회 및 검증
    const session = await getSessionById(
      sessionId,
      user.userId,
      tenantContext?.tenantId || null
    );

    if (!session) {
      return { success: false, error: "세션을 찾을 수 없습니다." };
    }

    if (session.ended_at) {
      return { success: false, error: "이미 종료된 세션입니다." };
    }

    // 일시정지 상태인지 확인
    if (!session.paused_at || session.resumed_at) {
      return { success: false, error: "일시정지된 상태가 아닙니다." };
    }

    // 일시정지 시간 계산
    const pausedAt = new Date(session.paused_at);
    const resumedAt = new Date();
    const pauseDuration = Math.floor((resumedAt.getTime() - pausedAt.getTime()) / 1000);
    const totalPausedDuration = (session.paused_duration_seconds || 0) + pauseDuration;

    // 세션 재개
    await supabase
      .from("student_study_sessions")
      .update({
        resumed_at: resumedAt.toISOString(),
        paused_duration_seconds: totalPausedDuration,
      })
      .eq("id", sessionId)
      .eq("student_id", user.userId);

    revalidatePath("/today");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[studySessions] 세션 재개 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 재개에 실패했습니다.",
    };
  }
}

