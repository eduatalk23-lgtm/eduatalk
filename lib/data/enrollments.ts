import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  EnrollmentWithProgram,
  EnrollmentStatus,
  CreateEnrollmentInput,
} from "@/lib/domains/enrollment/types";

export async function getEnrollmentsByStudent(
  studentId: string
): Promise<EnrollmentWithProgram[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("enrollments")
    .select("*, programs(name, code)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[data/enrollments] getEnrollmentsByStudent error:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const program = row.programs as { name: string; code: string } | null;
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      student_id: row.student_id,
      program_id: row.program_id,
      status: row.status as EnrollmentStatus,
      start_date: row.start_date,
      end_date: row.end_date,
      notes: row.notes,
      price: row.price,
      price_note: row.price_note,
      consultant_id: row.consultant_id ?? null,
      auto_end_on_expiry: row.auto_end_on_expiry ?? false,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      program_name: program?.name ?? "",
      program_code: program?.code ?? "",
    };
  });
}

export async function createEnrollment(
  data: CreateEnrollmentInput & { tenant_id: string; created_by?: string }
): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();

  const { data: result, error } = await supabase
    .from("enrollments")
    .insert({
      tenant_id: data.tenant_id,
      student_id: data.student_id,
      program_id: data.program_id,
      start_date: data.start_date,
      notes: data.notes ?? null,
      price: data.price ?? null,
      price_note: data.price_note ?? null,
      created_by: data.created_by ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[data/enrollments] createEnrollment error:", error);
    return null;
  }

  return result;
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const endDate =
    status === "completed" || status === "cancelled" || status === "suspended"
      ? new Date().toISOString().slice(0, 10)
      : null;

  const { error } = await supabase
    .from("enrollments")
    .update({ status, end_date: endDate })
    .eq("id", enrollmentId);

  if (error) {
    console.error("[data/enrollments] updateEnrollmentStatus error:", error);
    return false;
  }

  return true;
}

export async function deleteEnrollment(enrollmentId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("id", enrollmentId);

  if (error) {
    console.error("[data/enrollments] deleteEnrollment error:", error);
    return false;
  }

  return true;
}
