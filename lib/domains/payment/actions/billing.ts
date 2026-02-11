"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/logging/actionLogger";
import type { Database } from "@/lib/supabase/database.types";

type PaymentRecordInsert = Database["public"]["Tables"]["payment_records"]["Insert"];

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

type BillingSettings = {
  billing_day: number;
  auto_billing_enabled: boolean;
  due_day_offset: number;
};

const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  billing_day: 25,
  auto_billing_enabled: false,
  due_day_offset: 7,
};

function parseBillingSettings(settings: unknown): BillingSettings {
  if (!settings || typeof settings !== "object") return DEFAULT_BILLING_SETTINGS;
  const s = settings as Record<string, unknown>;
  return {
    billing_day: typeof s.billing_day === "number" ? s.billing_day : DEFAULT_BILLING_SETTINGS.billing_day,
    auto_billing_enabled: typeof s.auto_billing_enabled === "boolean" ? s.auto_billing_enabled : DEFAULT_BILLING_SETTINGS.auto_billing_enabled,
    due_day_offset: typeof s.due_day_offset === "number" ? s.due_day_offset : DEFAULT_BILLING_SETTINGS.due_day_offset,
  };
}

/** 수동 일괄 청구 생성 */
export async function bulkCreateBillingAction(
  enrollmentIds: string[],
  billingPeriod: string
): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (enrollmentIds.length === 0) {
      return { success: false, error: "청구할 수강을 선택해주세요." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 테넌트 billing 설정 조회
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    const billingSettings = parseBillingSettings(
      (tenant?.settings as Record<string, unknown>)?.billing
    );

    // active 수강 정보 조회 (가격 포함)
    const { data: enrollments } = await adminClient
      .from("enrollments")
      .select("id, student_id, program_id, price, programs(price)")
      .in("id", enrollmentIds)
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (!enrollments || enrollments.length === 0) {
      return { success: false, error: "유효한 수강 정보가 없습니다." };
    }

    // 중복 체크: 이미 같은 billing_period로 생성된 건
    const { data: existingPayments } = await adminClient
      .from("payment_records")
      .select("enrollment_id")
      .in(
        "enrollment_id",
        enrollments.map((e) => e.id)
      )
      .eq("billing_period", billingPeriod)
      .eq("tenant_id", tenantId);

    const existingSet = new Set(
      (existingPayments ?? []).map((p) => p.enrollment_id)
    );

    // 납부기한 계산
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + billingSettings.due_day_offset);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const inserts: PaymentRecordInsert[] = [];
    let skipped = 0;

    for (const enrollment of enrollments) {
      if (existingSet.has(enrollment.id)) {
        skipped++;
        continue;
      }

      const programPrice = (
        enrollment.programs as { price: number } | null
      )?.price;
      const amount = enrollment.price ?? programPrice ?? 0;

      if (amount <= 0) {
        skipped++;
        continue;
      }

      inserts.push({
        tenant_id: tenantId,
        enrollment_id: enrollment.id,
        student_id: enrollment.student_id,
        amount,
        paid_amount: 0,
        status: "unpaid",
        due_date: dueDateStr,
        billing_period: billingPeriod,
        created_by: userId,
      });
    }

    if (inserts.length === 0) {
      return {
        success: true,
        data: { created: 0, skipped },
      };
    }

    const { error } = await adminClient
      .from("payment_records")
      .insert(inserts);

    if (error) {
      logActionError(
        { domain: "payment", action: "bulkCreateBilling", tenantId, userId },
        error,
        { enrollmentCount: inserts.length, billingPeriod }
      );
      return { success: false, error: "청구 생성에 실패했습니다." };
    }

    revalidatePath("/admin/billing");
    revalidatePath("/admin/students");
    return {
      success: true,
      data: { created: inserts.length, skipped },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "청구 생성 중 오류가 발생했습니다.",
    };
  }
}

/** 테넌트 billing 설정 조회 */
export async function getBillingSettingsAction(): Promise<
  ActionResult<BillingSettings>
> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data: tenant } = await adminClient
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    const settings = parseBillingSettings(
      (tenant?.settings as Record<string, unknown>)?.billing
    );

    return { success: true, data: settings };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "설정 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 테넌트 billing 설정 업데이트 */
export async function updateBillingSettingsAction(
  billingSettings: BillingSettings
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

    // 기존 settings 조회
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    const existingSettings =
      (tenant?.settings as Record<string, unknown>) ?? {};

    const { error } = await adminClient
      .from("tenants")
      .update({
        settings: {
          ...existingSettings,
          billing: billingSettings,
        },
      })
      .eq("id", tenantId);

    if (error) {
      logActionError(
        {
          domain: "payment",
          action: "updateBillingSettings",
          tenantId,
          userId,
        },
        error
      );
      return { success: false, error: "설정 저장에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "설정 저장 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 자동 청구 생성 (Cron에서 호출)
 * 지정된 테넌트의 active enrollment에 대해 billing_period 미중복 건만 생성
 */
export async function runAutoBillingForTenant(
  tenantId: string,
  billingPeriod: string,
  dueDate: string
): Promise<{ created: number; skipped: number }> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Admin client 초기화 실패");
  }

  // active 수강 조회 (billing_type 포함)
  const { data: enrollments } = await adminClient
    .from("enrollments")
    .select("id, student_id, price, programs(price, billing_type)")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // 이미 청구된 건 확인 (해당 billing_period)
  const { data: existingPayments } = await adminClient
    .from("payment_records")
    .select("enrollment_id")
    .in(
      "enrollment_id",
      enrollments.map((e) => e.id)
    )
    .eq("billing_period", billingPeriod)
    .eq("tenant_id", tenantId);

  const existingPeriodSet = new Set(
    (existingPayments ?? []).map((p) => p.enrollment_id)
  );

  // one_time 프로그램: 어떤 period든 청구가 있으면 스킵
  const oneTimeEnrollmentIds = enrollments
    .filter((e) => {
      const bt = (e.programs as { price: number; billing_type: string } | null)
        ?.billing_type;
      return bt === "one_time";
    })
    .map((e) => e.id);

  let oneTimeExistingSet = new Set<string>();
  if (oneTimeEnrollmentIds.length > 0) {
    const { data: oneTimePayments } = await adminClient
      .from("payment_records")
      .select("enrollment_id")
      .in("enrollment_id", oneTimeEnrollmentIds)
      .eq("tenant_id", tenantId);
    oneTimeExistingSet = new Set(
      (oneTimePayments ?? []).map((p) => p.enrollment_id)
    );
  }

  const inserts: PaymentRecordInsert[] = [];
  let skipped = 0;

  for (const enrollment of enrollments) {
    const programData = enrollment.programs as {
      price: number;
      billing_type: string;
    } | null;
    const billingType = programData?.billing_type ?? "recurring";

    // manual → 자동 청구 제외
    if (billingType === "manual") {
      skipped++;
      continue;
    }

    // one_time → 기존 청구가 하나라도 있으면 스킵
    if (billingType === "one_time" && oneTimeExistingSet.has(enrollment.id)) {
      skipped++;
      continue;
    }

    // recurring → 해당 period 중복 체크
    if (billingType === "recurring" && existingPeriodSet.has(enrollment.id)) {
      skipped++;
      continue;
    }

    const amount = enrollment.price ?? programData?.price ?? 0;

    if (amount <= 0) {
      skipped++;
      continue;
    }

    inserts.push({
      tenant_id: tenantId,
      enrollment_id: enrollment.id,
      student_id: enrollment.student_id,
      amount,
      paid_amount: 0,
      status: "unpaid",
      due_date: dueDate,
      billing_period: billingPeriod,
    });
  }

  if (inserts.length > 0) {
    await adminClient.from("payment_records").insert(inserts);
  }

  return { created: inserts.length, skipped };
}
