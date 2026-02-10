import { redirect, notFound } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { getSalesLeadById } from "@/lib/data/salesLeads";
import { getProgramsByTenant } from "@/lib/data/programs";
import { getLeadActivities } from "@/lib/domains/crm/actions/activities";
import { getLeadTasks } from "@/lib/domains/crm/actions/tasks";
import { getLeadScoreLogs } from "@/lib/domains/crm/actions/scoring";
import { getSchoolByUnifiedId } from "@/lib/domains/school/service";
import { LeadDetailHeader } from "../../_components/LeadDetailHeader";
import { LeadDetailTabs } from "../../_components/LeadDetailTabs";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
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

  const { leadId } = await params;

  const supabase = await createSupabaseServerClient();

  // 병렬 fetch
  const [lead, programs, adminUsersResult, activitiesResult, tasksResult, scoreLogsResult] =
    await Promise.all([
      getSalesLeadById(leadId, tenantId),
      getProgramsByTenant(tenantId),
      supabase
        .from("admin_users")
        .select("id, name")
        .eq("tenant_id", tenantId),
      getLeadActivities(leadId),
      getLeadTasks({ tenantId, leadId }),
      getLeadScoreLogs(leadId),
    ]);

  if (!lead) {
    notFound();
  }

  // 학교 코드("SCHOOL_xxx")를 학교명으로 변환
  let resolvedSchoolName: string | null = null;
  if (lead.student_school_name?.startsWith("SCHOOL_")) {
    const school = await getSchoolByUnifiedId(lead.student_school_name);
    if (school) {
      resolvedSchoolName = school.name;
    }
  }

  const adminUsers = adminUsersResult.data ?? [];
  const activities = activitiesResult.success && activitiesResult.data
    ? activitiesResult.data
    : { items: [], totalCount: 0, hasMore: false };
  const tasks = tasksResult.success && tasksResult.data
    ? tasksResult.data
    : { items: [], totalCount: 0, hasMore: false };
  const scoreLogs = scoreLogsResult.success && scoreLogsResult.data
    ? scoreLogsResult.data
    : { items: [], totalCount: 0, hasMore: false };

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="리드 상세"
          backHref="/admin/crm/leads"
          backLabel="리드 목록"
        />

        <LeadDetailHeader lead={lead} adminUsers={adminUsers} />

        <LeadDetailTabs
          lead={lead}
          activities={activities}
          tasks={tasks}
          scoreLogs={scoreLogs}
          programs={programs}
          adminUsers={adminUsers}
          resolvedSchoolName={resolvedSchoolName}
        />
      </div>
    </div>
  );
}
