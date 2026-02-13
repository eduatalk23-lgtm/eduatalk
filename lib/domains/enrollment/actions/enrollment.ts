"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  EnrollmentStatus,
  EnrollmentWithProgram,
  CreateEnrollmentInput,
} from "../types";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getStudentEnrollmentsAction(
  studentId: string
): Promise<ActionResult<EnrollmentWithProgram[]>> {
  try {
    await requireAdminOrConsultant();

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data, error } = await adminClient
      .from("enrollments")
      .select("*, programs(name, code)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const enrollments: EnrollmentWithProgram[] = (data ?? []).map((row) => {
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

    return { success: true, data: enrollments };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "수강 목록 조회 중 오류가 발생했습니다.",
    };
  }
}

export async function createEnrollmentAction(
  input: CreateEnrollmentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 중복 active enrollment 체크
    const { data: existing } = await adminClient
      .from("enrollments")
      .select("id")
      .eq("student_id", input.student_id)
      .eq("program_id", input.program_id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "이미 해당 프로그램에 수강중인 등록이 있습니다.",
      };
    }

    // 프로그램 정보 조회 (end_date 계산 + 청구 방식)
    let calculatedEndDate: string | null = null;
    const { data: program } = await adminClient
      .from("programs")
      .select("duration_months, price, billing_type")
      .eq("id", input.program_id)
      .maybeSingle();

    if (program?.duration_months) {
      const start = new Date(input.start_date);
      start.setMonth(start.getMonth() + program.duration_months);
      calculatedEndDate = start.toISOString().slice(0, 10);
    }

    const { data, error } = await adminClient
      .from("enrollments")
      .insert({
        tenant_id: tenantId,
        student_id: input.student_id,
        program_id: input.program_id,
        start_date: input.start_date,
        end_date: calculatedEndDate,
        notes: input.notes ?? null,
        price: input.price ?? null,
        price_note: input.price_note ?? null,
        consultant_id: input.consultant_id ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      logActionError(
        { domain: "enrollment", action: "create", tenantId, userId },
        error,
        { studentId: input.student_id, programId: input.program_id }
      );
      return { success: false, error: "수강 등록에 실패했습니다." };
    }

    // 첫 청구서 자동 생성 (billing_type이 manual이 아닌 경우)
    const billingType = program?.billing_type ?? "recurring";
    if (billingType !== "manual") {
      const amount = input.price ?? program?.price ?? 0;
      if (amount > 0) {
        const startMonth = input.start_date.slice(0, 7); // "YYYY-MM"
        const dueDate = new Date(input.start_date);
        dueDate.setDate(dueDate.getDate() + 7);
        const dueDateStr = dueDate.toISOString().slice(0, 10);

        await adminClient.from("payment_records").insert({
          tenant_id: tenantId,
          enrollment_id: data.id,
          student_id: input.student_id,
          amount,
          paid_amount: 0,
          status: "unpaid",
          due_date: dueDateStr,
          billing_period: startMonth,
          created_by: userId,
        });
      }
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/billing");
    return { success: true, data: { id: data.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "수강 등록 중 오류가 발생했습니다.",
    };
  }
}

export async function updateEnrollmentStatusAction(
  enrollmentId: string,
  status: EnrollmentStatus
): Promise<ActionResult<{ cancelledPayments: number }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 테넌트 소유권 검증
    const { data: enrollment } = await adminClient
      .from("enrollments")
      .select("tenant_id")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (!enrollment || enrollment.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const endDate =
      status === "completed" || status === "cancelled" || status === "suspended"
        ? new Date().toISOString().slice(0, 10)
        : null;

    const { error } = await adminClient
      .from("enrollments")
      .update({ status, end_date: endDate })
      .eq("id", enrollmentId);

    if (error) {
      logActionError(
        { domain: "enrollment", action: "updateStatus", tenantId, userId },
        error,
        { enrollmentId, status }
      );
      return { success: false, error: "상태 변경에 실패했습니다." };
    }

    // 수료/취소 시 미납 수납 레코드 자동 취소
    let cancelledPayments = 0;

    if (status === "completed" || status === "cancelled") {
      const statusLabel = status === "completed" ? "수료" : "취소";
      const { data: cancelledRecords } = await adminClient
        .from("payment_records")
        .update({
          status: "cancelled",
          memo: `수강 ${statusLabel} 처리로 자동 취소됨`,
        })
        .in("status", ["unpaid", "partial"])
        .eq("enrollment_id", enrollmentId)
        .select("id");

      cancelledPayments = cancelledRecords?.length ?? 0;
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/billing");
    return { success: true, data: { cancelledPayments } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "상태 변경 중 오류가 발생했습니다.",
    };
  }
}

export async function deleteEnrollmentAction(
  enrollmentId: string
): Promise<ActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 테넌트 소유권 검증
    const { data: enrollment } = await adminClient
      .from("enrollments")
      .select("tenant_id")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (!enrollment || enrollment.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await adminClient
      .from("enrollments")
      .delete()
      .eq("id", enrollmentId);

    if (error) {
      logActionError(
        { domain: "enrollment", action: "delete", tenantId, userId },
        error,
        { enrollmentId }
      );
      return { success: false, error: "삭제에 실패했습니다." };
    }

    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "삭제 중 오류가 발생했습니다.",
    };
  }
}
