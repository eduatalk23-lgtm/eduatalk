"use server";

import { requireAdmin as requireAdminAuth } from "@/lib/auth/guards";
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
  if (!tenantId) {
    return null;
  }
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
  if (!tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }
  return upsertTenantSchedulerSettings(tenantId, settings);
}

