import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  LeadTaskFilter,
  LeadTaskWithLead,
  CrmPaginatedResult,
} from "@/lib/domains/crm/types";

const TASK_SELECT_WITH_LEAD = `
  *,
  lead:sales_leads!lead_tasks_lead_id_fkey(id, contact_name, pipeline_status)
`;

export async function getLeadTasksList(
  filter: LeadTaskFilter
): Promise<CrmPaginatedResult<LeadTaskWithLead>> {
  const supabase = await createSupabaseServerClient();

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("lead_tasks")
    .select(TASK_SELECT_WITH_LEAD, { count: "exact" })
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
    console.error("[data/leadTasks] getLeadTasksList error:", error);
    return { items: [], totalCount: 0, hasMore: false };
  }

  const totalCount = count ?? 0;
  return {
    items: (data ?? []) as LeadTaskWithLead[],
    totalCount,
    hasMore: from + pageSize < totalCount,
  };
}

export async function getOverdueTaskCount(
  tenantId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("lead_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "in_progress"])
    .eq("is_overdue", true);

  if (error) {
    console.error("[data/leadTasks] getOverdueTaskCount error:", error);
    return 0;
  }

  return count ?? 0;
}

export async function getMyPendingTasks(
  tenantId: string,
  userId: string,
  limit = 10
): Promise<LeadTaskWithLead[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("lead_tasks")
    .select(TASK_SELECT_WITH_LEAD)
    .eq("tenant_id", tenantId)
    .eq("assigned_to", userId)
    .in("status", ["pending", "in_progress"])
    .order("is_overdue", { ascending: false })
    .order("due_date", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[data/leadTasks] getMyPendingTasks error:", error);
    return [];
  }

  return (data ?? []) as LeadTaskWithLead[];
}
