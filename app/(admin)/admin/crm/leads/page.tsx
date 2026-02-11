import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";

import { ErrorState } from "@/components/ui/ErrorState";
import { getSalesLeads } from "@/lib/data/salesLeads";
import { getProgramsByTenant } from "@/lib/data/programs";
import { LeadSearchFilter } from "../_components/LeadSearchFilter";
import { LeadListClient } from "../_components/LeadListClient";
import { CrmPagination } from "../_components/CrmPagination";
import type {
  PipelineStatus,
  LeadSource,
  QualityLevel,
} from "@/lib/domains/crm/types";

const PAGE_SIZE = 20;

export default async function LeadListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  if (!tenantId) {
    return (
      <div className="p-6 md:p-10">
        <ErrorState
          title="기관 정보를 찾을 수 없습니다"
          message="기관 설정을 확인해주세요."
        />
      </div>
    );
  }

  const params = await searchParams;
  const searchQuery = params.search?.trim() ?? "";
  const statusFilter = params.status?.trim() ?? "";
  const sourceFilter = params.source?.trim() ?? "";
  const qualityFilter = params.quality?.trim() ?? "";
  const assignedToFilter = params.assigned_to?.trim() ?? "";
  const dateFrom = params.date_from?.trim() ?? "";
  const dateTo = params.date_to?.trim() ?? "";
  const page = parseInt(params.page || "1", 10);

  const supabase = await createSupabaseServerClient();

  // 병렬 fetch
  const [leadsResult, programs, adminUsersResult] = await Promise.all([
    getSalesLeads({
      tenantId,
      pipelineStatus: statusFilter ? (statusFilter as PipelineStatus) : undefined,
      leadSource: sourceFilter ? (sourceFilter as LeadSource) : undefined,
      qualityLevel: qualityFilter ? (qualityFilter as QualityLevel) : undefined,
      assignedTo: assignedToFilter || undefined,
      search: searchQuery || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    getProgramsByTenant(tenantId),
    supabase
      .from("admin_users")
      .select("id, name")
      .eq("tenant_id", tenantId),
  ]);

  const adminUsers = adminUsersResult.data ?? [];
  const totalPages = Math.ceil(leadsResult.totalCount / PAGE_SIZE) || 1;

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="리드 관리"
          description={`총 ${leadsResult.totalCount}건의 리드`}
          backHref="/admin/crm"
          backLabel="파이프라인"
        />

        <LeadSearchFilter
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          sourceFilter={sourceFilter}
          qualityFilter={qualityFilter}
          assignedToFilter={assignedToFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          adminUsers={adminUsers}
        />

        <LeadListClient
          leads={leadsResult.items}
          programs={programs}
          adminUsers={adminUsers}
          currentUserId={userId}
        />

        <CrmPagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/admin/crm/leads"
          searchParams={params}
        />
      </div>
    </div>
  );
}
