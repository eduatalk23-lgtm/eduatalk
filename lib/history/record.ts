import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import type { Json } from "@/lib/supabase/database.types";

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

export type HistoryDetail = Record<string, unknown>;

/**
 * 히스토리 기록 함수
 * 기록 실패해도 메인 기능에는 영향 주지 않도록 try/catch 처리
 * RLS 정책을 우회하기 위해 Admin 클라이언트 사용
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

    // tenant_id가 null인 경우 early return (DB에서 NOT NULL)
    if (!finalTenantId) {
      console.warn(`[history] tenant_id가 없어 히스토리 기록을 건너뜁니다.`, { studentId, eventType });
      return;
    }

    const payload = {
      student_id: studentId,
      tenant_id: finalTenantId,
      event_type: eventType,
      detail: detail as Json,
    };

    // RLS 정책을 우회하기 위해 Admin 클라이언트 사용
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn(
        `[history] Admin 클라이언트를 사용할 수 없어 서버 클라이언트로 시도합니다.`
      );
      // Admin 클라이언트가 없으면 서버 클라이언트로 시도
      let { error } = await supabase.from("student_history").insert(payload);

      if (ErrorCodeCheckers.isColumnNotFound(error)) {
        // fallback: tenant_id 컬럼이 없는 경우 (이전 DB 스키마 호환)
        const { tenant_id: _tenantId, ...fallbackPayload } = payload;
        void _tenantId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ error } = await supabase
          .from("student_history")
          .insert(fallbackPayload as any));
      }

      if (error) {
        console.error(`[history] ${eventType} 기록 실패:`, {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          studentId,
          eventType,
        });
      }
      return;
    }

    // Admin 클라이언트로 INSERT 시도
    let { error } = await adminClient.from("student_history").insert(payload);

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      // fallback: tenant_id 컬럼이 없는 경우 (이전 DB 스키마 호환)
      const { tenant_id: _tenantId, ...fallbackPayload } = payload;
      void _tenantId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ error } = await adminClient
        .from("student_history")
        .insert(fallbackPayload as any));
    }

    if (error) {
      console.error(`[history] ${eventType} 기록 실패:`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        studentId,
        eventType,
      });
    }
  } catch (error) {
    // 히스토리 기록 실패는 메인 기능에 영향 주지 않음
    const errorInfo =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : { error };
    console.error(`[history] ${eventType} 기록 중 예외 발생:`, {
      ...errorInfo,
      studentId,
      eventType,
    });
  }
}
