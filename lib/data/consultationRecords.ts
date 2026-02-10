import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ConsultationRecord,
  ConsultationRecordFilter,
  CrmPaginatedResult,
} from "@/lib/domains/crm/types";

export async function getConsultationRecords(
  filter: ConsultationRecordFilter
): Promise<CrmPaginatedResult<ConsultationRecord>> {
  const supabase = await createSupabaseServerClient();

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 검색이 있으면 먼저 lead_id 목록을 가져온다
  let matchingLeadIds: string[] | null = null;

  if (filter.search) {
    const searchTerm = `%${filter.search}%`;
    const { data: matchedLeads } = await supabase
      .from("sales_leads")
      .select("id")
      .eq("tenant_id", filter.tenantId)
      .or(
        `contact_name.ilike.${searchTerm},student_name.ilike.${searchTerm},contact_phone.ilike.${searchTerm}`
      );

    matchingLeadIds = (matchedLeads ?? []).map((l) => l.id);

    if (matchingLeadIds.length === 0) {
      return { items: [], totalCount: 0, hasMore: false };
    }
  }

  let query = supabase
    .from("lead_activities")
    .select(
      `
      id,
      activity_date,
      activity_type,
      title,
      description,
      metadata,
      performed_by,
      lead_id,
      lead:sales_leads!lead_activities_lead_id_fkey(
        lead_source,
        contact_name,
        contact_phone,
        student_name,
        student_grade,
        student_school_name,
        region,
        pipeline_status,
        registration_checklist,
        program:programs!sales_leads_program_id_fkey(name)
      ),
      performer:admin_users!lead_activities_performed_by_fkey(name)
    `,
      { count: "exact" }
    )
    .eq("tenant_id", filter.tenantId)
    .in("activity_type", ["consultation", "phone_call", "sms"])
    .order("activity_date", { ascending: false })
    .range(from, to);

  if (matchingLeadIds) {
    query = query.in("lead_id", matchingLeadIds);
  }

  if (filter.leadSource) {
    // lead_source 필터는 lead의 속성이므로 서브쿼리 불가
    // 먼저 해당 소스의 lead_id를 구한 후 필터
    const { data: sourceLeads } = await supabase
      .from("sales_leads")
      .select("id")
      .eq("tenant_id", filter.tenantId)
      .eq("lead_source", filter.leadSource);

    const sourceLeadIds = (sourceLeads ?? []).map((l) => l.id);
    if (sourceLeadIds.length === 0) {
      return { items: [], totalCount: 0, hasMore: false };
    }

    // matchingLeadIds와 교차
    if (matchingLeadIds) {
      const intersected = sourceLeadIds.filter((id) =>
        matchingLeadIds!.includes(id)
      );
      if (intersected.length === 0) {
        return { items: [], totalCount: 0, hasMore: false };
      }
      query = query.in("lead_id", intersected);
    } else {
      query = query.in("lead_id", sourceLeadIds);
    }
  }

  if (filter.consultationResult) {
    // metadata.consultation_result 필터
    query = query.contains("metadata", {
      consultation_result: filter.consultationResult,
    });
  }

  if (filter.performedBy) {
    query = query.eq("performed_by", filter.performedBy);
  }

  if (filter.dateFrom) {
    query = query.gte("activity_date", filter.dateFrom);
  }

  if (filter.dateTo) {
    query = query.lte("activity_date", `${filter.dateTo}T23:59:59`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error(
      "[data/consultationRecords] getConsultationRecords error:",
      error
    );
    return { items: [], totalCount: 0, hasMore: false };
  }

  const totalCount = count ?? 0;
  const items: ConsultationRecord[] = (data ?? []).map((row) => {
    const lead = row.lead as unknown as Record<string, unknown> | null;
    const performer = row.performer as unknown as { name: string } | null;
    const program = lead?.program as unknown as { name: string } | null;

    return {
      id: row.id,
      activity_date: row.activity_date,
      activity_type: row.activity_type,
      title: row.title,
      description: row.description,
      metadata: row.metadata as Record<string, unknown> | null,
      performed_by: row.performed_by,
      lead_id: row.lead_id,
      lead_source: (lead?.lead_source as string) ?? null,
      contact_name: (lead?.contact_name as string) ?? null,
      contact_phone: (lead?.contact_phone as string) ?? null,
      student_name: (lead?.student_name as string) ?? null,
      student_grade: (lead?.student_grade as number) ?? null,
      student_school_name: (lead?.student_school_name as string) ?? null,
      region: (lead?.region as string) ?? null,
      program_name: program?.name ?? null,
      pipeline_status: (lead?.pipeline_status as string) ?? null,
      registration_checklist: lead?.registration_checklist as ConsultationRecord["registration_checklist"],
      performer_name: performer?.name ?? null,
    };
  });

  return {
    items,
    totalCount,
    hasMore: from + pageSize < totalCount,
  };
}
