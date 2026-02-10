import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { getSalesLeads } from "@/lib/data/salesLeads";
import { getLeadCountsByStatus } from "@/lib/data/salesLeads";
import { getOverdueTaskCount, getMyPendingTasks } from "@/lib/data/leadTasks";
import { markOverdueTasks } from "@/lib/domains/crm/actions/tasks";
import { PipelineStatsBar } from "./_components/PipelineStatsBar";
import { PipelineBoard } from "./_components/PipelineBoard";
import type { PipelineStatus, SalesLeadWithRelations } from "@/lib/domains/crm/types";

export default async function CrmPipelinePage() {
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

  // 기한 초과 태스크 감지 (비동기)
  markOverdueTasks().catch(() => {});

  const [statsResult, leadsResult, overdueCount, myPendingTasks] =
    await Promise.all([
      getLeadCountsByStatus(tenantId),
      getSalesLeads({ tenantId, isSpam: false, pageSize: 200 }),
      getOverdueTaskCount(tenantId),
      getMyPendingTasks(tenantId, userId),
    ]);

  // 상태별 리드 그룹핑
  const leadsByStatus: Record<string, SalesLeadWithRelations[]> = {};
  for (const lead of leadsResult.items) {
    const status = lead.pipeline_status as PipelineStatus;
    if (!leadsByStatus[status]) leadsByStatus[status] = [];
    leadsByStatus[status].push(lead);
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="세일즈 파이프라인"
          description="리드 현황을 한눈에 파악하고 관리합니다"
        />

        <PipelineStatsBar
          stats={statsResult}
          overdueCount={overdueCount}
          myPendingCount={myPendingTasks.length}
        />

        <PipelineBoard leadsByStatus={leadsByStatus} />
      </div>
    </div>
  );
}
