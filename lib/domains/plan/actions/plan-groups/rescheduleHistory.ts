/**
 * 재조정 히스토리 조회 Server Actions
 * 
 * 재조정 이력을 조회하고 분석합니다.
 */

"use server";

import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 로그 항목
 */
export interface RescheduleLogItem {
  id: string;
  plan_group_id: string;
  student_id: string;
  tenant_id: string | null;
  status: "pending" | "completed" | "failed" | "rolled_back";
  adjusted_contents: string[] | null; // JSONB
  plans_before_count: number;
  plans_after_count: number;
  affected_dates: string[] | null; // JSONB
  date_range: {
    from: string;
    to: string;
  } | null; // JSONB
  created_at: string;
  completed_at: string | null;
  rolled_back_at: string | null;
  error_message: string | null;
}

/**
 * 재조정 히스토리 조회 결과
 */
export interface RescheduleHistoryResult {
  logs: RescheduleLogItem[];
  totalCount: number;
  statistics: {
    totalReschedules: number;
    successfulReschedules: number;
    failedReschedules: number;
    rolledBackReschedules: number;
    averagePlansChanged: number;
  };
}

// ============================================
// 재조정 히스토리 조회
// ============================================

/**
 * 플랜 그룹의 재조정 히스토리 조회
 * 
 * @param groupId 플랜 그룹 ID
 * @param limit 조회 개수 제한 (기본값: 50)
 * @param offset 오프셋 (기본값: 0)
 * @returns 재조정 히스토리 결과
 */
export const getRescheduleHistory = withErrorHandling(
  async (
    groupId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<RescheduleHistoryResult> => {
    const user = await requireStudentAuth();
    const tenantContext = await getTenantContext();

    const supabase = await createSupabaseServerClient();

    // 재조정 로그 조회
    const { data: logs, error: logsError } = await supabase
      .from("reschedule_log")
      .select("*")
      .eq("plan_group_id", groupId)
      .eq("student_id", user.userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (logsError) {
      throw new AppError(
        logsError.message || "재조정 히스토리 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { supabaseError: logsError }
      );
    }

    // 전체 개수 조회
    const { count, error: countError } = await supabase
      .from("reschedule_log")
      .select("*", { count: "exact", head: true })
      .eq("plan_group_id", groupId)
      .eq("student_id", user.userId);

    if (countError) {
      throw new AppError(
        countError.message || "재조정 히스토리 개수 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { supabaseError: countError }
      );
    }

    // 통계 계산
    const totalReschedules = count || 0;
    const successfulReschedules = logs?.filter(
      (log) => log.status === "completed"
    ).length || 0;
    const failedReschedules = logs?.filter(
      (log) => log.status === "failed"
    ).length || 0;
    const rolledBackReschedules = logs?.filter(
      (log) => log.status === "rolled_back"
    ).length || 0;

    const plansChangedSum = logs?.reduce(
      (sum, log) =>
        sum + Math.abs(log.plans_after_count - log.plans_before_count),
      0
    ) || 0;
    const averagePlansChanged =
      logs && logs.length > 0
        ? Math.round((plansChangedSum / logs.length) * 10) / 10
        : 0;

    // 타입 변환
    const typedLogs: RescheduleLogItem[] = (logs || []).map((log) => ({
      id: log.id,
      plan_group_id: log.plan_group_id,
      student_id: log.student_id,
      tenant_id: log.tenant_id,
      status: log.status as "pending" | "completed" | "failed" | "rolled_back",
      adjusted_contents: log.adjusted_contents as string[] | null,
      plans_before_count: log.plans_before_count,
      plans_after_count: log.plans_after_count,
      affected_dates: log.affected_dates as string[] | null,
      date_range: log.date_range as { from: string; to: string } | null,
      created_at: log.created_at,
      completed_at: log.completed_at,
      rolled_back_at: log.rolled_back_at,
      error_message: log.error_message,
    }));

    return {
      logs: typedLogs,
      totalCount: totalReschedules,
      statistics: {
        totalReschedules,
        successfulReschedules,
        failedReschedules,
        rolledBackReschedules,
        averagePlansChanged,
      },
    };
  }
);

/**
 * 특정 재조정 로그의 상세 정보 조회
 * 
 * @param logId 재조정 로그 ID
 * @returns 재조정 로그 상세 정보
 */
export const getRescheduleLogDetail = withErrorHandling(
  async (logId: string): Promise<RescheduleLogItem | null> => {
    const user = await requireStudentAuth();
    const tenantContext = await getTenantContext();

    const supabase = await createSupabaseServerClient();

    const { data: log, error } = await supabase
      .from("reschedule_log")
      .select("*")
      .eq("id", logId)
      .eq("student_id", user.userId)
      .maybeSingle();

    if (error) {
      throw new AppError(
        error.message || "재조정 로그 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { supabaseError: error }
      );
    }

    if (!log) {
      return null;
    }

    return {
      id: log.id,
      plan_group_id: log.plan_group_id,
      student_id: log.student_id,
      tenant_id: log.tenant_id,
      status: log.status as "pending" | "completed" | "failed" | "rolled_back",
      adjusted_contents: log.adjusted_contents as string[] | null,
      plans_before_count: log.plans_before_count,
      plans_after_count: log.plans_after_count,
      affected_dates: log.affected_dates as string[] | null,
      date_range: log.date_range as { from: string; to: string } | null,
      created_at: log.created_at,
      completed_at: log.completed_at,
      rolled_back_at: log.rolled_back_at,
      error_message: log.error_message,
    };
  }
);

