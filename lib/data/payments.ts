import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PaymentRecordWithEnrollment,
  PaymentStatus,
  PaymentMethod,
  CreatePaymentInput,
} from "@/lib/domains/payment/types";

export async function getPaymentsByStudent(
  studentId: string
): Promise<PaymentRecordWithEnrollment[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("payment_records")
    .select("*, enrollments(program_id, programs(name, code))")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[data/payments] getPaymentsByStudent error:", error);
    return [];
  }

  return (data ?? []).map((row) => mapPaymentRow(row));
}

export async function getPaymentsByEnrollment(
  enrollmentId: string
): Promise<PaymentRecordWithEnrollment[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("payment_records")
    .select("*, enrollments(program_id, programs(name, code))")
    .eq("enrollment_id", enrollmentId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("[data/payments] getPaymentsByEnrollment error:", error);
    return [];
  }

  return (data ?? []).map((row) => mapPaymentRow(row));
}

export async function createPaymentRecord(
  data: CreatePaymentInput & { tenant_id: string; created_by?: string }
): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();

  const { data: result, error } = await supabase
    .from("payment_records")
    .insert({
      tenant_id: data.tenant_id,
      enrollment_id: data.enrollment_id,
      student_id: data.student_id,
      amount: data.amount,
      due_date: data.due_date ?? null,
      billing_period: data.billing_period ?? null,
      memo: data.memo ?? null,
      created_by: data.created_by ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[data/payments] createPaymentRecord error:", error);
    return null;
  }

  return result;
}

export async function confirmPayment(
  paymentId: string,
  paidAmount: number,
  paymentMethod: PaymentMethod,
  paidDate: string,
  memo?: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data: record, error: fetchError } = await supabase
    .from("payment_records")
    .select("amount")
    .eq("id", paymentId)
    .single();

  if (fetchError || !record) {
    console.error("[data/payments] confirmPayment fetch error:", fetchError);
    return false;
  }

  const status: PaymentStatus =
    paidAmount >= record.amount ? "paid" : "partial";

  const updateData: Record<string, unknown> = {
    paid_amount: paidAmount,
    payment_method: paymentMethod,
    paid_date: paidDate,
    status,
  };
  if (memo !== undefined) {
    updateData.memo = memo;
  }

  const { error } = await supabase
    .from("payment_records")
    .update(updateData)
    .eq("id", paymentId);

  if (error) {
    console.error("[data/payments] confirmPayment error:", error);
    return false;
  }

  return true;
}

/** payment_records 행을 PaymentRecordWithEnrollment로 매핑하는 유틸 */
function mapPaymentRow(row: Record<string, unknown>): PaymentRecordWithEnrollment {
  const enrollment = row.enrollments as {
    program_id: string;
    programs: { name: string; code: string } | null;
  } | null;
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    enrollment_id: row.enrollment_id as string,
    student_id: row.student_id as string,
    amount: row.amount as number,
    paid_amount: row.paid_amount as number,
    status: row.status as PaymentStatus,
    payment_method: row.payment_method as PaymentMethod | null,
    due_date: row.due_date as string | null,
    paid_date: row.paid_date as string | null,
    billing_period: row.billing_period as string | null,
    memo: row.memo as string | null,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    toss_order_id: (row.toss_order_id as string) ?? null,
    toss_payment_key: (row.toss_payment_key as string) ?? null,
    toss_method: (row.toss_method as string) ?? null,
    toss_receipt_url: (row.toss_receipt_url as string) ?? null,
    toss_approved_at: (row.toss_approved_at as string) ?? null,
    cash_receipt_url: (row.cash_receipt_url as string) ?? null,
    cash_receipt_key: (row.cash_receipt_key as string) ?? null,
    cash_receipt_type: (row.cash_receipt_type as "소득공제" | "지출증빙") ?? null,
    payment_order_id: (row.payment_order_id as string) ?? null,
    program_name: enrollment?.programs?.name ?? "",
    program_code: enrollment?.programs?.code ?? "",
  };
}

export async function deletePaymentRecord(
  paymentId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("payment_records")
    .delete()
    .eq("id", paymentId);

  if (error) {
    console.error("[data/payments] deletePaymentRecord error:", error);
    return false;
  }

  return true;
}
