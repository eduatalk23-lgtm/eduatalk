// ============================================
// 에이전트 감사 로그 조회 API
// GET /api/admin/agent-audit
// ============================================

import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { apiSuccess, apiUnauthorized, handleApiError } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 에이전트 감사 로그 조회 + 통계
 *
 * GET /api/admin/agent-audit?page=1&pageSize=20&period=7d
 * GET /api/admin/agent-audit?mode=stats&period=30d
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrConsultant();
    if (!auth) return apiUnauthorized("관리자 권한이 필요합니다.");
    if (!auth.tenantId) return apiUnauthorized("테넌트 정보가 필요합니다.");

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "list";
    const period = searchParams.get("period") ?? "7d";

    // 기간 계산
    const now = new Date();
    const periodDays = period === "1d" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 7;
    const since = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    const supabase = await createSupabaseServerClient();

    if (mode === "stats") {
      // 통계 모드
      const { data: logs, error } = await (supabase.from as Function)("agent_audit_logs")
        .select("user_id, student_id, message_count, duration_ms, error, created_at")
        .eq("tenant_id", auth.tenantId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        return apiSuccess({
          stats: null,
          message: "감사 로그 테이블이 아직 생성되지 않았습니다.",
        });
      }

      const total = (logs as Array<Record<string, unknown>>).length;
      const errorCount = (logs as Array<Record<string, unknown>>).filter(
        (l) => l.error != null,
      ).length;
      const avgDuration =
        total > 0
          ? Math.round(
              (logs as Array<Record<string, unknown>>).reduce(
                (s, l) => s + ((l.duration_ms as number) ?? 0),
                0,
              ) / total,
            )
          : 0;
      const avgMessages =
        total > 0
          ? Math.round(
              ((logs as Array<Record<string, unknown>>).reduce(
                (s, l) => s + ((l.message_count as number) ?? 0),
                0,
              ) /
                total) *
                10,
            ) / 10
          : 0;

      // 컨설턴트별 세션 수
      const consultantMap = new Map<string, number>();
      for (const l of logs as Array<Record<string, unknown>>) {
        const uid = l.user_id as string;
        consultantMap.set(uid, (consultantMap.get(uid) ?? 0) + 1);
      }
      const topConsultants = [...consultantMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([userId, count]) => ({ userId, count }));

      // 학생별 세션 수
      const studentMap = new Map<string, number>();
      for (const l of logs as Array<Record<string, unknown>>) {
        const sid = l.student_id as string;
        studentMap.set(sid, (studentMap.get(sid) ?? 0) + 1);
      }
      const topStudents = [...studentMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([studentId, count]) => ({ studentId, count }));

      return apiSuccess({
        period,
        totalSessions: total,
        errorCount,
        errorRate: total > 0 ? Math.round((errorCount / total) * 100) : 0,
        avgDurationMs: avgDuration,
        avgMessages,
        topConsultants,
        topStudents,
      });
    }

    // 목록 모드
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const offset = (page - 1) * pageSize;

    const { data: logs, error, count } = await (supabase.from as Function)("agent_audit_logs")
      .select("*", { count: "exact" })
      .eq("tenant_id", auth.tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return apiSuccess({
        logs: [],
        total: 0,
        message: "감사 로그 테이블이 아직 생성되지 않았습니다.",
      });
    }

    return apiSuccess({
      logs: logs ?? [],
      total: count ?? 0,
      page,
      pageSize,
      period,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
