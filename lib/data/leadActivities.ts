import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  LeadActivity,
  LeadActivityFilter,
  CrmPaginatedResult,
} from "@/lib/domains/crm/types";

export async function getLeadActivitiesList(
  filter: LeadActivityFilter
): Promise<CrmPaginatedResult<LeadActivity>> {
  const supabase = await createSupabaseServerClient();

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("lead_activities")
    .select("*", { count: "exact" })
    .eq("lead_id", filter.leadId)
    .eq("tenant_id", filter.tenantId)
    .order("activity_date", { ascending: false })
    .range(from, to);

  if (filter.activityType) {
    query = query.eq("activity_type", filter.activityType);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[data/leadActivities] getLeadActivitiesList error:", error);
    return { items: [], totalCount: 0, hasMore: false };
  }

  const totalCount = count ?? 0;
  return {
    items: data ?? [],
    totalCount,
    hasMore: from + pageSize < totalCount,
  };
}
