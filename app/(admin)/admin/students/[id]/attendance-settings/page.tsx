
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { StudentAttendanceSettingsForm } from "./_components/StudentAttendanceSettingsForm";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function StudentAttendanceSettingsPage({
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
    redirect("/admin/students");
  }
  
  // 학생 정보 조회
  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("id", id)
    .eq("tenant_id", tenantContext.tenantId)
    .single();
  
  if (!student) {
    redirect("/admin/students");
  }
  
  // 학생 알림 설정 조회
  const { data: settings } = await supabase
    .from("student_notification_preferences")
    .select("attendance_check_in_enabled, attendance_check_out_enabled, attendance_absent_enabled, attendance_late_enabled")
    .eq("student_id", id)
    .single();
  
  return (
    <PageContainer widthType="FORM">
      <div className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title={`${student.name} 출석 알림 설정`}
          description="학생별 출석 SMS 알림을 개별적으로 설정할 수 있습니다."
        />
        
        <StudentAttendanceSettingsForm
          studentId={id}
          initialSettings={settings || undefined}
        />
      </div>
    </PageContainer>
  );
}

