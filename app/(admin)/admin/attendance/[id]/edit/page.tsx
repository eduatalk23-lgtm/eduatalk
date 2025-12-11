export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { EditAttendanceRecordForm } from "./_components/EditAttendanceRecordForm";

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
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">출석 기록 수정</h1>
      </div>
      
      <EditAttendanceRecordForm recordId={id} initialData={record} />
    </div>
  );
}

