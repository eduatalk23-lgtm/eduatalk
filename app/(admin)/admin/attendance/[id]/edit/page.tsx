export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { EditAttendanceRecordForm } from "./_components/EditAttendanceRecordForm";
import { AttendanceHistoryList } from "./_components/AttendanceHistoryList";

export default async function EditAttendanceRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, role } = await getCurrentUserRole();
  
  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }
  
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
  
  if (!tenantContext?.tenantId) {
    redirect("/admin/attendance");
  }
  
  const { data: record } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId)
    .single();
  
  if (!record) {
    redirect("/admin/attendance");
  }
  
  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">출석 기록 수정</h1>
      
      <EditAttendanceRecordForm recordId={id} initialData={record} />
      
      <AttendanceHistoryList recordId={id} />
    </div>
  );
}

