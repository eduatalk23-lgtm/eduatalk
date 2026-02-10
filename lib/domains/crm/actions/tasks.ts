"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { AUTO_TASK_RULES } from "../constants";
import type {
  CrmActionResult,
  CrmPaginatedResult,
  LeadTaskType,
  LeadTaskPriority,
  LeadTaskFilter,
  LeadTaskWithLead,
  PipelineStatus,
} from "../types";

const CRM_PATH = "/admin/crm";

/**
 * 태스크 생성
 */
export async function createLeadTask(input: {
  leadId: string;
  taskType: LeadTaskType;
  title: string;
  description?: string;
  priority?: LeadTaskPriority;
  assignedTo?: string;
  dueDate: string;
}): Promise<CrmActionResult<{ taskId: string }>> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (!input.title.trim()) {
      return { success: false, error: "태스크 제목을 입력해주세요." };
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
      .from("lead_tasks")
      .insert({
        tenant_id: tenantId,
        lead_id: input.leadId,
        task_type: input.taskType,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "medium",
        assigned_to: input.assignedTo ?? null,
        due_date: input.dueDate,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      logActionError(
        { domain: "crm", action: "createLeadTask", tenantId, userId },
        error,
        { leadId: input.leadId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true, data: { taskId: data.id } };
  } catch (error) {
    logActionError({ domain: "crm", action: "createLeadTask" }, error, {
      leadId: input.leadId,
    });
    return { success: false, error: "태스크 생성에 실패했습니다." };
  }
}

/**
 * 태스크 상태 업데이트 (진행중, 완료, 취소)
 */
export async function updateLeadTaskStatus(
  taskId: string,
  status: "in_progress" | "completed" | "cancelled"
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: task, error: fetchError } = await supabase
      .from("lead_tasks")
      .select("tenant_id, status")
      .eq("id", taskId)
      .maybeSingle();

    if (fetchError || !task) {
      return { success: false, error: "태스크를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && task.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (task.status === "completed" || task.status === "cancelled") {
      return { success: false, error: "이미 종료된 태스크입니다." };
    }

    const updateData: Record<string, unknown> = { status };
    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
      updateData.is_overdue = false;
    }

    const { error } = await supabase
      .from("lead_tasks")
      .update(updateData)
      .eq("id", taskId);

    if (error) {
      logActionError(
        { domain: "crm", action: "updateLeadTaskStatus", tenantId, userId },
        error,
        { taskId, status }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "crm", action: "updateLeadTaskStatus" },
      error,
      { taskId, status }
    );
    return { success: false, error: "태스크 상태 변경에 실패했습니다." };
  }
}

/**
 * 태스크 수정 (제목, 설명, 우선순위, 담당자, 마감일)
 */
export async function updateLeadTask(
  taskId: string,
  input: {
    title?: string;
    description?: string;
    priority?: LeadTaskPriority;
    assignedTo?: string | null;
    dueDate?: string;
  }
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: task, error: fetchError } = await supabase
      .from("lead_tasks")
      .select("tenant_id")
      .eq("id", taskId)
      .maybeSingle();

    if (fetchError || !task) {
      return { success: false, error: "태스크를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && task.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo;
    if (input.dueDate !== undefined) updateData.due_date = input.dueDate;

    if (Object.keys(updateData).length === 0) {
      return { success: true };
    }

    const { error } = await supabase
      .from("lead_tasks")
      .update(updateData)
      .eq("id", taskId);

    if (error) {
      logActionError(
        { domain: "crm", action: "updateLeadTask", tenantId, userId },
        error,
        { taskId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "updateLeadTask" }, error, {
      taskId,
    });
    return { success: false, error: "태스크 수정에 실패했습니다." };
  }
}

/**
 * 태스크 삭제
 */
export async function deleteLeadTask(
  taskId: string
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: task, error: fetchError } = await supabase
      .from("lead_tasks")
      .select("tenant_id")
      .eq("id", taskId)
      .maybeSingle();

    if (fetchError || !task) {
      return { success: false, error: "태스크를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && task.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await supabase
      .from("lead_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      logActionError(
        { domain: "crm", action: "deleteLeadTask", tenantId, userId },
        error,
        { taskId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "deleteLeadTask" }, error, {
      taskId,
    });
    return { success: false, error: "태스크 삭제에 실패했습니다." };
  }
}

/**
 * 내 태스크 목록 조회 (필터/페이지네이션)
 */
export async function getLeadTasks(
  filter: LeadTaskFilter
): Promise<CrmActionResult<CrmPaginatedResult<LeadTaskWithLead>>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("lead_tasks")
      .select(
        "*, lead:sales_leads!lead_tasks_lead_id_fkey(id, contact_name, pipeline_status)",
        { count: "exact" }
      )
      .eq("tenant_id", filter.tenantId)
      .order("due_date", { ascending: true })
      .range(from, to);

    if (filter.leadId) {
      query = query.eq("lead_id", filter.leadId);
    }
    if (filter.assignedTo) {
      query = query.eq("assigned_to", filter.assignedTo);
    }
    if (filter.status) {
      query = query.eq("status", filter.status);
    }
    if (filter.priority) {
      query = query.eq("priority", filter.priority);
    }
    if (filter.isOverdue) {
      query = query.eq("is_overdue", true);
    }

    const { data, error, count } = await query;

    if (error) {
      logActionError(
        { domain: "crm", action: "getLeadTasks", tenantId },
        error
      );
      return { success: false, error: error.message };
    }

    const totalCount = count ?? 0;
    return {
      success: true,
      data: {
        items: (data ?? []) as LeadTaskWithLead[],
        totalCount,
        hasMore: from + pageSize < totalCount,
      },
    };
  } catch (error) {
    logActionError({ domain: "crm", action: "getLeadTasks" }, error);
    return { success: false, error: "태스크 목록 조회에 실패했습니다." };
  }
}

/**
 * 파이프라인 상태 변경 시 자동 태스크 생성
 * (updatePipelineStatus에서 호출)
 */
export async function createAutoTask(
  leadId: string,
  newStatus: PipelineStatus,
  assignedTo: string | null
): Promise<CrmActionResult<{ taskId: string } | undefined>> {
  const rule = AUTO_TASK_RULES[newStatus];
  if (!rule) return { success: true };

  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) return { success: true };

    const supabase = await createSupabaseServerClient();

    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + rule.slaHours);

    const { data, error } = await supabase
      .from("lead_tasks")
      .insert({
        tenant_id: tenantId,
        lead_id: leadId,
        task_type: rule.taskType,
        title: rule.title,
        priority: rule.priority,
        assigned_to: assignedTo,
        due_date: dueDate.toISOString(),
        is_auto_created: true,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      logActionError(
        { domain: "crm", action: "createAutoTask", tenantId },
        error,
        { leadId, newStatus }
      );
      return { success: false, error: error.message };
    }

    return { success: true, data: { taskId: data.id } };
  } catch (error) {
    logActionError({ domain: "crm", action: "createAutoTask" }, error, {
      leadId,
      newStatus,
    });
    return { success: false, error: "자동 태스크 생성에 실패했습니다." };
  }
}

/**
 * 기한 초과 태스크 일괄 감지 및 플래그 업데이트
 * (CRON 또는 대시보드 로드 시 호출)
 */
export async function markOverdueTasks(): Promise<
  CrmActionResult<{ updatedCount: number }>
> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("lead_tasks")
      .update({ is_overdue: true })
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "in_progress"])
      .eq("is_overdue", false)
      .lt("due_date", now)
      .select("id");

    if (error) {
      logActionError(
        { domain: "crm", action: "markOverdueTasks", tenantId },
        error
      );
      return { success: false, error: error.message };
    }

    return { success: true, data: { updatedCount: data?.length ?? 0 } };
  } catch (error) {
    logActionError({ domain: "crm", action: "markOverdueTasks" }, error);
    return { success: false, error: "기한 초과 감지에 실패했습니다." };
  }
}

/**
 * 태스크 통계 (상태별 카운트 + 오버듀 수)
 */
export async function getTaskStats(): Promise<
  CrmActionResult<{
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
  }>
> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("lead_tasks")
      .select("status, is_overdue")
      .eq("tenant_id", tenantId);

    if (error) {
      logActionError(
        { domain: "crm", action: "getTaskStats", tenantId },
        error
      );
      return { success: false, error: error.message };
    }

    const rows = data ?? [];
    const stats = {
      pending: rows.filter((r) => r.status === "pending").length,
      inProgress: rows.filter((r) => r.status === "in_progress").length,
      completed: rows.filter((r) => r.status === "completed").length,
      overdue: rows.filter((r) => r.is_overdue && r.status !== "completed" && r.status !== "cancelled").length,
    };

    return { success: true, data: stats };
  } catch (error) {
    logActionError({ domain: "crm", action: "getTaskStats" }, error);
    return { success: false, error: "태스크 통계 조회에 실패했습니다." };
  }
}
