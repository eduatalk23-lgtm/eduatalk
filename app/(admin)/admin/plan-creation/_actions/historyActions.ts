"use server";

/**
 * 플랜 생성 이력 Server Actions
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type {
  PlanCreationHistory,
  HistoryListItem,
  CreateHistoryInput,
  UpdateHistoryInput,
  HistoryListFilter,
  HistoryStats,
  HistoryStatus,
  HistoryResultItem,
} from "../_types/historyTypes";
import type { CreationMethod } from "../_types";
import type { TemplateSettings } from "../_types/templateTypes";

// DB 행을 도메인 타입으로 변환
function mapRowToHistory(row: Record<string, unknown>): PlanCreationHistory {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    creationMethod: row.creation_method as CreationMethod,
    templateId: row.template_id as string | null,
    settingsSnapshot: row.settings_snapshot as TemplateSettings,
    targetStudentIds: row.target_student_ids as string[],
    totalCount: row.total_count as number,
    successCount: row.success_count as number,
    failedCount: row.failed_count as number,
    skippedCount: row.skipped_count as number,
    results: row.results as HistoryResultItem[],
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    status: row.status as HistoryStatus,
    createdBy: row.created_by as string | null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapRowToListItem(row: Record<string, unknown>): HistoryListItem {
  return {
    id: row.id as string,
    creationMethod: row.creation_method as CreationMethod,
    totalCount: row.total_count as number,
    successCount: row.success_count as number,
    failedCount: row.failed_count as number,
    skippedCount: row.skipped_count as number,
    status: row.status as HistoryStatus,
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    createdBy: row.created_by as string | null,
  };
}

/**
 * 이력 목록 조회
 */
export async function getHistoryList(
  filter?: HistoryListFilter
): Promise<{ data: HistoryListItem[] | null; total: number; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user?.tenantId) {
      return { data: null, total: 0, error: "테넌트 정보를 찾을 수 없습니다" };
    }

    let query = supabase
      .from("plan_creation_history")
      .select(
        "id, creation_method, total_count, success_count, failed_count, skipped_count, status, started_at, completed_at, created_by",
        { count: "exact" }
      )
      .eq("tenant_id", user.tenantId)
      .order("created_at", { ascending: false });

    if (filter?.creationMethod) {
      query = query.eq("creation_method", filter.creationMethod);
    }

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    if (filter?.startDate) {
      query = query.gte("started_at", filter.startDate.toISOString());
    }

    if (filter?.endDate) {
      query = query.lte("started_at", filter.endDate.toISOString());
    }

    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    if (filter?.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit ?? 10) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("이력 목록 조회 오류:", error);
      return { data: null, total: 0, error: error.message };
    }

    return {
      data: (data ?? []).map(mapRowToListItem),
      total: count ?? 0,
      error: null,
    };
  } catch (err) {
    console.error("이력 목록 조회 예외:", err);
    return { data: null, total: 0, error: "이력 목록을 불러오는데 실패했습니다" };
  }
}

/**
 * 이력 상세 조회
 */
export async function getHistory(
  id: string
): Promise<{ data: PlanCreationHistory | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("plan_creation_history")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("이력 조회 오류:", error);
      return { data: null, error: error.message };
    }

    return {
      data: mapRowToHistory(data),
      error: null,
    };
  } catch (err) {
    console.error("이력 조회 예외:", err);
    return { data: null, error: "이력을 불러오는데 실패했습니다" };
  }
}

/**
 * 이력 생성 (처리 시작 시)
 */
export async function createHistory(
  input: CreateHistoryInput
): Promise<{ data: PlanCreationHistory | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user) {
      return { data: null, error: "로그인이 필요합니다" };
    }

    if (!user.tenantId) {
      return { data: null, error: "테넌트 정보를 찾을 수 없습니다" };
    }

    const { data, error } = await supabase
      .from("plan_creation_history")
      .insert({
        tenant_id: user.tenantId,
        creation_method: input.creationMethod,
        template_id: input.templateId ?? null,
        settings_snapshot: input.settingsSnapshot,
        target_student_ids: input.targetStudentIds,
        total_count: input.targetStudentIds.length,
        status: "processing",
        created_by: user.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("이력 생성 오류:", error);
      return { data: null, error: error.message };
    }

    return {
      data: mapRowToHistory(data),
      error: null,
    };
  } catch (err) {
    console.error("이력 생성 예외:", err);
    return { data: null, error: "이력 생성에 실패했습니다" };
  }
}

/**
 * 이력 업데이트 (처리 완료/실패 시)
 */
export async function updateHistory(
  input: UpdateHistoryInput
): Promise<{ data: PlanCreationHistory | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();

    const updateData: Record<string, unknown> = {};

    if (input.status) {
      updateData.status = input.status;
    }

    if (input.completedAt) {
      updateData.completed_at = input.completedAt.toISOString();
    }

    if (input.results) {
      updateData.results = input.results;
      updateData.success_count = input.results.filter((r) => r.status === "success").length;
      updateData.failed_count = input.results.filter((r) => r.status === "error").length;
      updateData.skipped_count = input.results.filter((r) => r.status === "skipped").length;
    }

    const { data, error } = await supabase
      .from("plan_creation_history")
      .update(updateData)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      console.error("이력 업데이트 오류:", error);
      return { data: null, error: error.message };
    }

    return {
      data: mapRowToHistory(data),
      error: null,
    };
  } catch (err) {
    console.error("이력 업데이트 예외:", err);
    return { data: null, error: "이력 업데이트에 실패했습니다" };
  }
}

/**
 * 이력 통계 조회
 */
export async function getHistoryStats(): Promise<{ data: HistoryStats | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getCurrentUser();

    if (!user?.tenantId) {
      return { data: null, error: "테넌트 정보를 찾을 수 없습니다" };
    }

    // 전체 통계
    const { data: allHistory, error: historyError } = await supabase
      .from("plan_creation_history")
      .select("creation_method, total_count, success_count, status")
      .eq("tenant_id", user.tenantId)
      .eq("status", "completed");

    if (historyError) {
      console.error("이력 통계 조회 오류:", historyError);
      return { data: null, error: historyError.message };
    }

    // 최근 실행 목록
    const { data: recentData } = await supabase
      .from("plan_creation_history")
      .select(
        "id, creation_method, total_count, success_count, failed_count, skipped_count, status, started_at, completed_at, created_by"
      )
      .eq("tenant_id", user.tenantId)
      .order("created_at", { ascending: false })
      .limit(5);

    const totalExecutions = allHistory?.length ?? 0;
    const totalStudentsProcessed = allHistory?.reduce((sum, h) => sum + (h.total_count ?? 0), 0) ?? 0;
    const totalSuccess = allHistory?.reduce((sum, h) => sum + (h.success_count ?? 0), 0) ?? 0;

    const methodBreakdown: Record<CreationMethod, number> = {
      ai: 0,
      planGroup: 0,
      quickPlan: 0,
      contentAdd: 0,
    };

    allHistory?.forEach((h) => {
      const method = h.creation_method as CreationMethod;
      if (method in methodBreakdown) {
        methodBreakdown[method]++;
      }
    });

    return {
      data: {
        totalExecutions,
        totalStudentsProcessed,
        successRate: totalStudentsProcessed > 0 ? (totalSuccess / totalStudentsProcessed) * 100 : 0,
        methodBreakdown,
        recentExecutions: (recentData ?? []).map(mapRowToListItem),
      },
      error: null,
    };
  } catch (err) {
    console.error("이력 통계 조회 예외:", err);
    return { data: null, error: "이력 통계를 불러오는데 실패했습니다" };
  }
}
