"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TimeEvent = {
  type: "start" | "pause" | "resume" | "complete";
  timestamp: string;
  durationSeconds?: number | null;
};

/**
 * 플랜 그룹의 시간 이벤트 조회 (세션 데이터로 계산)
 */
export async function getTimeEventsByPlanNumber(
  planNumber: number | null,
  planDate: string
): Promise<{ success: boolean; events?: TimeEvent[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    // 1. 해당 plan_number와 plan_date를 가진 플랜들 조회
    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select("id, actual_start_time, actual_end_time")
      .eq("plan_number", planNumber)
      .eq("plan_date", planDate)
      .eq("student_id", user.userId);

    if (plansError) {
      console.error("[sessionTimeActions] 플랜 조회 실패:", plansError);
      return { success: false, error: plansError.message };
    }

    if (!plans || plans.length === 0) {
      return { success: true, events: [] };
    }

    const planIds = plans.map((p) => p.id);

    // 2. 해당 플랜들의 세션 조회 (한 번에 모든 플랜 ID 조회)
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("student_study_sessions")
      .select("id, plan_id, started_at, ended_at, paused_at, resumed_at, paused_duration_seconds")
      .eq("student_id", user.userId)
      .in("plan_id", planIds)
      .order("started_at", { ascending: false });

    if (sessionsError) {
      console.error("[sessionTimeActions] 세션 조회 실패:", sessionsError);
      // 세션 조회 실패해도 플랜 데이터로 시간 정보는 표시 가능
    }

    const relevantSessions = (sessionsData || []).filter(
      (session): session is typeof session & { plan_id: string } =>
        session.plan_id !== null && planIds.includes(session.plan_id)
    );

    // 3. 시간 이벤트 계산
    const events: TimeEvent[] = [];

    // 시작 시간: 플랜의 actual_start_time
    const startTime = plans
      .map((p) => p.actual_start_time)
      .filter((t): t is string => t !== null)
      .sort()[0]; // 가장 빠른 시작 시간

    if (startTime) {
      events.push({
        type: "start",
        timestamp: startTime,
        durationSeconds: 0,
      });
    }

    // 일시정지/재개 이벤트: 세션의 paused_at, resumed_at
    const pauseResumeEvents: Array<{ type: "pause" | "resume"; timestamp: string }> = [];

    relevantSessions.forEach((session) => {
      if (session.paused_at) {
        pauseResumeEvents.push({
          type: "pause",
          timestamp: session.paused_at,
        });
      }
      if (session.resumed_at) {
        pauseResumeEvents.push({
          type: "resume",
          timestamp: session.resumed_at,
        });
      }
    });

    // 시간순으로 정렬
    pauseResumeEvents.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 일시정지/재개 이벤트 추가 (duration 계산은 복잡하므로 null로 설정)
    pauseResumeEvents.forEach((event) => {
      events.push({
        type: event.type,
        timestamp: event.timestamp,
        durationSeconds: null,
      });
    });

    // 완료 시간: 플랜의 actual_end_time
    const endTime = plans
      .map((p) => p.actual_end_time)
      .filter((t): t is string => t !== null)
      .sort()
      .reverse()[0]; // 가장 늦은 종료 시간

    if (endTime) {
      // 완료 시점의 순수 학습 시간 계산
      const plan = plans.find((p) => p.actual_end_time === endTime);
      let finalDuration: number | null = null;

      if (plan?.actual_start_time) {
        const start = new Date(plan.actual_start_time).getTime();
        const end = new Date(endTime).getTime();
        const totalSeconds = Math.floor((end - start) / 1000);

        // 세션의 일시정지 시간 합산
        const session = relevantSessions.find((s) => s.plan_id === plan.id);
        const pausedSeconds = session?.paused_duration_seconds || 0;
        finalDuration = Math.max(0, totalSeconds - pausedSeconds);
      }

      events.push({
        type: "complete",
        timestamp: endTime,
        durationSeconds: finalDuration,
      });
    }

    // 시간순으로 정렬
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return { success: true, events };
  } catch (error) {
    console.error("[sessionTimeActions] 시간 이벤트 조회 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "시간 이벤트 조회에 실패했습니다.",
    };
  }
}

