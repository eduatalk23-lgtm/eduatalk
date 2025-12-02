"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import {
  getTenantSchedulerSettings,
  upsertTenantSchedulerSettings,
} from "@/lib/data/schedulerSettings";
import type { TenantSchedulerSettings } from "@/lib/types/schedulerSettings";

/**
 * 기관 전역 스케줄러 설정 조회
 */
export async function getTenantSchedulerSettingsAction(): Promise<TenantSchedulerSettings | null> {
  const { tenantId } = await requireAdminAuth();
  return getTenantSchedulerSettings(tenantId);
}

/**
 * 기관 전역 스케줄러 설정 저장
 */
export async function saveTenantSchedulerSettingsAction(
  settings: Partial<
    Omit<TenantSchedulerSettings, "id" | "tenant_id" | "created_at" | "updated_at">
  >
): Promise<{ success: boolean; error?: string }> {
  const { tenantId } = await requireAdminAuth();
  return upsertTenantSchedulerSettings(tenantId, settings);
}

