"use server";

/**
 * SMS 패널 데이터 로딩 서버 액션
 * Client Component에서 서버 전용 모듈을 직접 import하지 않도록 분리
 */

import { requireAdmin as requireAdminAuth } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentPhones } from "@/lib/utils/studentPhoneUtils";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import type { SMSPanelData, SMSCustomTemplate, SMSLogEntry } from "../types";

async function _fetchSMSPanelData(studentId: string): Promise<SMSPanelData> {
  await requireAdminAuth();
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();

  // 병렬 데이터 로딩
  const [phoneData, templatesResult, historyResult, tenantResult] = await Promise.all([
    getStudentPhones(studentId),
    supabase
      .from("sms_custom_templates")
      .select("*")
      .eq("tenant_id", tenantContext.tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("sms_logs")
      .select("id, recipient_phone, message_content, status, channel, created_at, sent_at")
      .eq("tenant_id", tenantContext.tenantId)
      .eq("recipient_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantContext.tenantId)
      .single(),
  ]);

  if (!phoneData) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  return {
    phoneData: {
      id: phoneData.id,
      name: phoneData.name,
      phone: phoneData.phone,
      mother_phone: phoneData.mother_phone,
      father_phone: phoneData.father_phone,
    },
    customTemplates: (templatesResult.data ?? []) as SMSCustomTemplate[],
    smsHistory: (historyResult.data ?? []) as SMSLogEntry[],
    academyName: tenantResult.data?.name ?? "학원",
  };
}

export const fetchSMSPanelData = withActionResponse(_fetchSMSPanelData);
