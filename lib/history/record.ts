import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type HistoryEventType =
  | "plan_completed"
  | "study_session"
  | "goal_progress"
  | "goal_created"
  | "goal_completed"
  | "score_added"
  | "score_updated"
  | "content_progress"
  | "auto_schedule_generated"
  | "risk_evaluation";

export type HistoryDetail = {
  [key: string]: any;
};

/**
 * 히스토리 기록 함수
 * 기록 실패해도 메인 기능에는 영향 주지 않도록 try/catch 처리
 */
export async function recordHistory(
  supabase: SupabaseServerClient,
  studentId: string,
  eventType: HistoryEventType,
  detail: HistoryDetail,
  tenantId?: string | null
): Promise<void> {
  try {
    // tenant_id가 제공되지 않은 경우 studentId로부터 조회
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      const { data: student } = await supabase
        .from("students")
        .select("tenant_id")
        .eq("id", studentId)
        .maybeSingle();
      
      finalTenantId = student?.tenant_id || null;
    }

    const payload = {
      student_id: studentId,
      tenant_id: finalTenantId,
      event_type: eventType,
      detail,
    };

    let { error } = await supabase.from("student_history").insert(payload);

    if (error && error.code === "42703") {
      // fallback: tenant_id 컬럼이 없는 경우
      const { tenant_id: _tenantId, ...fallbackPayload } = payload;
      void _tenantId;
      ({ error } = await supabase.from("student_history").insert(fallbackPayload));
    }

    if (error) {
      console.error(`[history] ${eventType} 기록 실패:`, error);
    }
  } catch (error) {
    // 히스토리 기록 실패는 메인 기능에 영향 주지 않음
    console.error(`[history] ${eventType} 기록 중 예외 발생:`, error);
  }
}

