/**
 * 관리자용 재조정 로그 조회 페이지
 * 
 * 재조정 이력을 조회하고 관리할 수 있는 페이지입니다.
 */


import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RescheduleLogsList } from "./_components/RescheduleLogsList";

export default async function RescheduleLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  const supabase = await createSupabaseServerClient();

  const params = await searchParams;
  const planGroupId = params.groupId;
  const studentId = params.studentId;
  const startDate = params.startDate;
  const endDate = params.endDate;

  // 재조정 로그 조회
  let query = supabase
    .from("reschedule_log")
    .select(
      `
      *,
      plan_groups!inner(id, name, student_id),
      students!inner(id, name)
    `
    )
    .eq("tenant_id", tenantContext?.tenantId || "")
    .order("created_at", { ascending: false })
    .limit(100);

  if (planGroupId) {
    query = query.eq("plan_group_id", planGroupId);
  }

  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  if (startDate) {
    query = query.gte("created_at", startDate);
  }

  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  const { data: logs, error } = await query;

  if (error) {
    console.error("[reschedule-logs] 조회 실패:", error);
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 p-6 md:p-8 lg:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          재조정 로그
        </h1>
        <p className="text-sm text-gray-600">
          플랜 그룹 재조정 이력을 조회하고 관리할 수 있습니다.
        </p>
      </div>

      <RescheduleLogsList
        logs={logs || []}
        initialFilters={{
          planGroupId: planGroupId || "",
          studentId: studentId || "",
          startDate: startDate || "",
          endDate: endDate || "",
        }}
      />
    </div>
  );
}

