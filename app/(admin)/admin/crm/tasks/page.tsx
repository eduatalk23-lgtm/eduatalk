import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { getLeadTasksList } from "@/lib/data/leadTasks";
import { getTaskStats, markOverdueTasks } from "@/lib/domains/crm/actions/tasks";
import { TaskStatsCards } from "../_components/TaskStatsCards";
import { TaskSearchFilter } from "../_components/TaskSearchFilter";
import { TaskListClient } from "../_components/TaskListClient";
import { CrmPagination } from "../_components/CrmPagination";
import type { LeadTaskStatus, LeadTaskPriority } from "@/lib/domains/crm/types";

const PAGE_SIZE = 20;

export default async function TaskCenterPage({
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
  const statusFilter = params.status?.trim() ?? "";
  const priorityFilter = params.priority?.trim() ?? "";
  const assignedToFilter = params.assigned_to?.trim() ?? "";
  const isOverdueFilter = params.is_overdue === "true";
  const page = parseInt(params.page || "1", 10);

  // 기한 초과 감지 (비동기)
  markOverdueTasks().catch(() => {});

  const supabase = await createSupabaseServerClient();

  const [statsResult, tasksResult, adminUsersResult] = await Promise.all([
    getTaskStats(),
    getLeadTasksList({
      tenantId,
      status: statusFilter ? (statusFilter as LeadTaskStatus) : undefined,
      priority: priorityFilter ? (priorityFilter as LeadTaskPriority) : undefined,
      assignedTo: assignedToFilter || undefined,
      isOverdue: isOverdueFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    supabase
      .from("admin_users")
      .select("id, name")
      .eq("tenant_id", tenantId),
  ]);

  const adminUsers = adminUsersResult.data ?? [];
  const stats = statsResult.success && statsResult.data
    ? statsResult.data
    : { pending: 0, inProgress: 0, completed: 0, overdue: 0 };
  const totalPages = Math.ceil(tasksResult.totalCount / PAGE_SIZE) || 1;

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="태스크 센터"
          description={`총 ${tasksResult.totalCount}건의 태스크`}
          backHref="/admin/crm"
          backLabel="파이프라인"
        />

        <TaskStatsCards
          pending={stats.pending}
          inProgress={stats.inProgress}
          completed={stats.completed}
          overdue={stats.overdue}
        />

        <TaskSearchFilter
          statusFilter={statusFilter}
          priorityFilter={priorityFilter}
          assignedToFilter={assignedToFilter}
          isOverdueFilter={isOverdueFilter}
          adminUsers={adminUsers}
        />

        {tasksResult.items.length === 0 ? (
          <EmptyState
            title="태스크가 없습니다"
            description="조건에 맞는 태스크가 없습니다."
          />
        ) : (
          <TaskListClient
            tasks={tasksResult.items}
            adminUsers={adminUsers}
          />
        )}

        <CrmPagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/admin/crm/tasks"
          searchParams={params}
        />
      </div>
    </div>
  );
}
