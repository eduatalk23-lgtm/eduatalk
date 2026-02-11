import { getEnrollmentsByStudent } from "@/lib/data/enrollments";
import { getProgramsByTenant } from "@/lib/data/programs";
import { getPaymentsByStudent } from "@/lib/data/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { EnrollmentSectionClient } from "./EnrollmentSectionClient";

type EnrollmentSectionProps = {
  studentId: string;
  tenantId: string;
};

async function getConsultantsByTenant(
  tenantId: string
): Promise<{ id: string; name: string; role: string }[]> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return [];

  const { data } = await adminClient
    .from("admin_users")
    .select("id, name, role")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "consultant"])
    .order("name");

  return data ?? [];
}

export async function EnrollmentSection({
  studentId,
  tenantId,
}: EnrollmentSectionProps) {
  const [enrollments, programs, payments, consultants] = await Promise.all([
    getEnrollmentsByStudent(studentId),
    getProgramsByTenant(tenantId),
    getPaymentsByStudent(studentId),
    getConsultantsByTenant(tenantId),
  ]);

  return (
    <EnrollmentSectionClient
      studentId={studentId}
      enrollments={enrollments}
      programs={programs}
      payments={payments}
      consultants={consultants}
    />
  );
}
