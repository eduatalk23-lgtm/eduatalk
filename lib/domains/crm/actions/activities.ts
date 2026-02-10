"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { scoreLeadActivity } from "./scoring";
import type {
  CrmActionResult,
  LeadActivity,
  ActivityType,
  CrmPaginatedResult,
} from "../types";

const CRM_PATH = "/admin/crm";

export async function addLeadActivity(input: {
  leadId: string;
  activityType: ActivityType;
  title?: string;
  description?: string;
  activityDate?: string;
  metadata?: Record<string, unknown>;
}): Promise<CrmActionResult<{ activityId: string }>> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 리드 테넌트 격리 확인
    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("tenant_id")
      .eq("id", input.leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { data, error } = await supabase
      .from("lead_activities")
      .insert({
        tenant_id: tenantId,
        lead_id: input.leadId,
        activity_type: input.activityType,
        title: input.title ?? null,
        description: input.description ?? null,
        performed_by: userId,
        activity_date: input.activityDate ?? new Date().toISOString(),
        metadata: input.metadata ?? null,
      })
      .select("id")
      .single();

    if (error) {
      logActionError(
        { domain: "crm", action: "addLeadActivity", tenantId, userId },
        error,
        { leadId: input.leadId }
      );
      return { success: false, error: error.message };
    }

    // 참여도 스코어 자동 갱신 (비동기, 실패해도 활동 기록은 성공)
    scoreLeadActivity(input.leadId, input.activityType).catch(() => {});

    revalidatePath(CRM_PATH);
    return { success: true, data: { activityId: data.id } };
  } catch (error) {
    logActionError({ domain: "crm", action: "addLeadActivity" }, error, {
      leadId: input.leadId,
    });
    return { success: false, error: "활동 기록에 실패했습니다." };
  }
}

export async function getLeadActivities(
  leadId: string,
  options?: { page?: number; pageSize?: number }
): Promise<CrmActionResult<CrmPaginatedResult<LeadActivity>>> {
  try {
    const { role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("lead_activities")
      .select("*", { count: "exact" })
      .eq("lead_id", leadId)
      .order("activity_date", { ascending: false })
      .range(from, to);

    if (role !== "superadmin") {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error, count } = await query;

    if (error) {
      logActionError(
        { domain: "crm", action: "getLeadActivities", tenantId },
        error,
        { leadId }
      );
      return { success: false, error: error.message };
    }

    const totalCount = count ?? 0;
    return {
      success: true,
      data: {
        items: data ?? [],
        totalCount,
        hasMore: from + pageSize < totalCount,
      },
    };
  } catch (error) {
    logActionError({ domain: "crm", action: "getLeadActivities" }, error, {
      leadId,
    });
    return { success: false, error: "활동 목록 조회에 실패했습니다." };
  }
}

export async function deleteLeadActivity(
  activityId: string
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: activity, error: fetchError } = await supabase
      .from("lead_activities")
      .select("tenant_id")
      .eq("id", activityId)
      .maybeSingle();

    if (fetchError || !activity) {
      return { success: false, error: "활동 기록을 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && activity.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await supabase
      .from("lead_activities")
      .delete()
      .eq("id", activityId);

    if (error) {
      logActionError(
        { domain: "crm", action: "deleteLeadActivity", tenantId, userId },
        error,
        { activityId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "deleteLeadActivity" }, error, {
      activityId,
    });
    return { success: false, error: "활동 삭제에 실패했습니다." };
  }
}
