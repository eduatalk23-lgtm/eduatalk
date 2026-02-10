import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  SalesLeadFilter,
  SalesLeadWithRelations,
  CrmPaginatedResult,
  PipelineStats,
  PipelineStatus,
  SalesLead,
} from "@/lib/domains/crm/types";

const LEAD_SELECT_WITH_RELATIONS = `
  *,
  assigned_admin:admin_users!sales_leads_assigned_to_fkey(id, name),
  program:programs!sales_leads_program_id_fkey(id, code, name),
  student:students!sales_leads_student_id_fkey(id, name)
`;

export async function getSalesLeads(
  filter: SalesLeadFilter
): Promise<CrmPaginatedResult<SalesLeadWithRelations>> {
  const supabase = await createSupabaseServerClient();

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sales_leads")
    .select(LEAD_SELECT_WITH_RELATIONS, { count: "exact" })
    .eq("tenant_id", filter.tenantId)
    .order("inquiry_date", { ascending: false })
    .range(from, to);

  if (filter.pipelineStatus) {
    query = query.eq("pipeline_status", filter.pipelineStatus);
  }

  if (filter.leadSource) {
    query = query.eq("lead_source", filter.leadSource);
  }

  if (filter.assignedTo) {
    query = query.eq("assigned_to", filter.assignedTo);
  }

  if (filter.programId) {
    query = query.eq("program_id", filter.programId);
  }

  if (filter.qualityLevel) {
    query = query.eq("quality_level", filter.qualityLevel);
  }

  if (filter.isSpam !== undefined) {
    query = query.eq("is_spam", filter.isSpam);
  }

  if (filter.dateFrom) {
    query = query.gte("inquiry_date", filter.dateFrom);
  }

  if (filter.dateTo) {
    query = query.lte("inquiry_date", filter.dateTo);
  }

  if (filter.search) {
    const searchTerm = `%${filter.search}%`;
    query = query.or(
      `contact_name.ilike.${searchTerm},student_name.ilike.${searchTerm},contact_phone.ilike.${searchTerm}`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[data/salesLeads] getSalesLeads error:", error);
    return { items: [], totalCount: 0, hasMore: false };
  }

  const totalCount = count ?? 0;
  return {
    items: (data ?? []) as SalesLeadWithRelations[],
    totalCount,
    hasMore: from + pageSize < totalCount,
  };
}

export async function getSalesLeadById(
  leadId: string,
  tenantId: string
): Promise<SalesLeadWithRelations | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("sales_leads")
    .select(LEAD_SELECT_WITH_RELATIONS)
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[data/salesLeads] getSalesLeadById error:", error);
    return null;
  }

  return data as SalesLeadWithRelations | null;
}

export async function getLeadCountsByStatus(
  tenantId: string
): Promise<PipelineStats[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("sales_leads")
    .select("pipeline_status")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[data/salesLeads] getLeadCountsByStatus error:", error);
    return [];
  }

  const counts = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const status = row.pipeline_status;
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([status, count]) => ({
    status: status as PipelineStatus,
    count,
  }));
}

export async function findLeadByPhone(
  phone: string,
  tenantId: string
): Promise<SalesLead | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("sales_leads")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("contact_phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[data/salesLeads] findLeadByPhone error:", error);
    return null;
  }

  return data;
}
