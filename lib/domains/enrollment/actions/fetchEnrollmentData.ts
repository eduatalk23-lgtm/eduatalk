"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getEnrollmentsByStudent } from "@/lib/data/enrollments";
import { getProgramsByTenant } from "@/lib/data/programs";
import { getPaymentsByStudent } from "@/lib/data/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudentParents } from "@/lib/domains/student/actions/parentLinks";
import type { EnrollmentWithProgram } from "../types";
import type { PaymentRecordWithEnrollment } from "@/lib/domains/payment/types";
import type { Program } from "@/lib/domains/crm/types";

type ConsultantOption = { id: string; name: string; role: string };

type FetchEnrollmentDataResult = {
  enrollments: EnrollmentWithProgram[];
  programs: Program[];
  payments: PaymentRecordWithEnrollment[];
  consultants: ConsultantOption[];
  parentPhone?: string;
};

async function getConsultantsByTenant(
  tenantId: string
): Promise<ConsultantOption[]> {
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

export async function fetchEnrollmentData(
  studentId: string
): Promise<FetchEnrollmentDataResult> {
  const { tenantId } = await requireAdminOrConsultant({
    requireTenant: true,
  });

  const [enrollments, programs, payments, consultants, parentsResult] =
    await Promise.all([
      getEnrollmentsByStudent(studentId),
      getProgramsByTenant(tenantId!),
      getPaymentsByStudent(studentId),
      getConsultantsByTenant(tenantId!),
      getStudentParents(studentId),
    ]);

  const parentPhone = parentsResult.data?.[0]?.parentPhone ?? undefined;

  return { enrollments, programs, payments, consultants, parentPhone };
}
