/**
 * 스케줄러 설정 데이터 조회 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TenantSchedulerSettings,
  PartialSchedulerSettings,
  SchedulerSettings,
} from "@/lib/types/schedulerSettings";
import {
  mergeSchedulerSettings,
  dbToPartialSettings,
  planGroupOptionsToPartialSettings,
} from "@/lib/utils/schedulerSettingsMerge";

/**
 * 기관별 전역 스케줄러 설정 조회
 */
export async function getTenantSchedulerSettings(
  tenantId: string
): Promise<TenantSchedulerSettings | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenant_scheduler_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching tenant scheduler settings:", error);
    return null;
  }

  return data;
}

/**
 * 템플릿 스케줄러 설정 조회
 * camp_templates.template_data.scheduler_settings에서 추출
 */
export async function getTemplateSchedulerSettings(
  templateId: string
): Promise<PartialSchedulerSettings | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("camp_templates")
    .select("template_data")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching template scheduler settings:", error);
    return null;
  }

  if (!data?.template_data) {
    return null;
  }

  const templateData = data.template_data as {
    scheduler_settings?: PartialSchedulerSettings;
  };

  return templateData.scheduler_settings || null;
}

/**
 * 병합된 스케줄러 설정 조회
 * 전역 → 템플릿 → 플랜그룹 순으로 병합
 */
export async function getMergedSchedulerSettings(
  tenantId: string,
  templateId?: string | null,
  groupSettings?: Record<string, unknown> | null
): Promise<SchedulerSettings> {
  // 1. 전역 설정 조회
  const tenantSettings = await getTenantSchedulerSettings(tenantId);
  const globalPartial = dbToPartialSettings(tenantSettings);

  // 2. 템플릿 설정 조회
  let templatePartial: PartialSchedulerSettings | null = null;
  if (templateId) {
    templatePartial = await getTemplateSchedulerSettings(templateId);
  }

  // 3. 플랜그룹 설정 변환
  const groupPartial = planGroupOptionsToPartialSettings(
    groupSettings as {
      study_days?: number;
      review_days?: number;
      weak_subject_focus?: string | boolean;
      review_scope?: string;
      lunch_time?: { start: string; end: string };
      camp_study_hours?: { start: string; end: string };
      self_study_hours?: { start: string; end: string };
    } | null
  );

  // 4. 병합
  return mergeSchedulerSettings(globalPartial, templatePartial, groupPartial);
}

/**
 * 플랜 그룹 ID로 병합된 스케줄러 설정 조회
 */
export async function getMergedSchedulerSettingsByGroupId(
  groupId: string
): Promise<SchedulerSettings | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("plan_groups")
    .select("tenant_id, camp_template_id, scheduler_options")
    .eq("id", groupId)
    .single();

  if (error) {
    console.error("Error fetching plan group for scheduler settings:", error);
    return null;
  }

  return getMergedSchedulerSettings(
    data.tenant_id,
    data.camp_template_id,
    data.scheduler_options as Record<string, unknown>
  );
}

/**
 * 전역 스케줄러 설정 생성 또는 업데이트
 */
export async function upsertTenantSchedulerSettings(
  tenantId: string,
  settings: Partial<Omit<TenantSchedulerSettings, "id" | "tenant_id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("tenant_scheduler_settings")
    .upsert(
      {
        tenant_id: tenantId,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "tenant_id",
      }
    );

  if (error) {
    console.error("Error upserting tenant scheduler settings:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 템플릿 스케줄러 설정 업데이트
 */
export async function updateTemplateSchedulerSettings(
  templateId: string,
  schedulerSettings: PartialSchedulerSettings
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 기존 template_data 가져오기
  const { data: existingData, error: fetchError } = await supabase
    .from("camp_templates")
    .select("template_data")
    .eq("id", templateId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const templateData = (existingData.template_data || {}) as Record<
    string,
    unknown
  >;

  // scheduler_settings 업데이트
  templateData.scheduler_settings = schedulerSettings;

  const { error: updateError } = await supabase
    .from("camp_templates")
    .update({ template_data: templateData })
    .eq("id", templateId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

