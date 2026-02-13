"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { formatSMSTemplate } from "@/lib/services/smsTemplates";
import { getAlimtalkTemplate } from "@/lib/services/alimtalkTemplates";
import { sendAlimtalk } from "@/lib/services/alimtalkService";
import { sendSMS } from "@/lib/services/smsService";
import type { CrmActionResult } from "../types";

const ACTION_CTX = { domain: "crm", action: "sendMissedCallNotification" };
const CRM_PATH = "/admin/crm";

/**
 * 부재 안내 알림톡/SMS 발송
 * Activities 탭 수동 발송 및 상담 등록 시 자동 발송에서 사용
 */
export async function sendMissedCallNotification(
  leadId: string,
  options?: { skipActivityLog?: boolean }
): Promise<CrmActionResult<{ sent: boolean }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // 1. 리드 정보 조회
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase
      .from("sales_leads")
      .select("id, contact_phone, tenant_id")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { success: false, error: "리드 정보를 찾을 수 없습니다." };
    }

    if (!lead.contact_phone?.trim()) {
      return { success: false, error: "리드에 전화번호가 등록되어 있지 않습니다." };
    }

    // 2. 테넌트 정보 조회 (학원명, 대표번호)
    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      return { success: false, error: "시스템 오류: 관리자 클라이언트 초기화 실패" };
    }

    type TenantInfo = {
      name: string | null;
      representative_phone?: string | null;
    };

    const { data: tenantRaw } = await adminClient
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .maybeSingle();

    const tenant = tenantRaw as TenantInfo | null;

    const templateVariables: Record<string, string> = {
      학원명: tenant?.name ?? "",
      대표번호: tenant?.representative_phone ?? "",
    };

    // 3. 메시지 생성
    const message = formatSMSTemplate(
      "consultation_missed_call",
      templateVariables
    );

    // 4. 알림톡 발송 시도
    const alimtalkTemplate = getAlimtalkTemplate("consultation_missed_call");
    let sent = false;

    if (alimtalkTemplate) {
      const result = await sendAlimtalk({
        recipientPhone: lead.contact_phone,
        message,
        smsFallbackMessage: message,
        smsFallbackSubject: "부재 안내",
        tenantId,
        templateCode: alimtalkTemplate.templateCode,
        templateVariables,
        variableOrder: alimtalkTemplate.variableOrder,
      });
      sent = result.success;

      logActionDebug(ACTION_CTX, "알림톡 발송 결과", {
        leadId,
        sent,
        channel: result.channel,
      });
    }

    // 5. 알림톡 실패 시 SMS fallback
    if (!sent) {
      const smsResult = await sendSMS({
        recipientPhone: lead.contact_phone,
        message,
        subject: "부재 안내",
        tenantId,
      });
      sent = smsResult.success;

      logActionDebug(ACTION_CTX, "SMS fallback 결과", {
        leadId,
        sent,
      });
    }

    // 6. 활동 기록 추가 (skipActivityLog가 아닌 경우만 — 수동 발송 시)
    if (!options?.skipActivityLog) {
      await supabase.from("lead_activities").insert({
        tenant_id: tenantId,
        lead_id: leadId,
        activity_type: "sms",
        title: "부재 안내 발송",
        description: sent ? "알림톡/SMS 발송 완료" : "발송 시도 (실패)",
        performed_by: userId,
        activity_date: new Date().toISOString(),
        metadata: { missedCallSent: true, sent },
      });
    }

    revalidatePath(CRM_PATH);
    revalidatePath(`${CRM_PATH}/leads`);
    revalidatePath(`${CRM_PATH}/leads/${leadId}`);

    if (!sent) {
      return {
        success: false,
        error: "부재 안내 발송에 실패했습니다. 수동으로 발송해주세요.",
      };
    }

    return { success: true, data: { sent: true } };
  } catch (error) {
    logActionError(ACTION_CTX, error, { leadId });
    return { success: false, error: "부재 안내 발송 중 오류가 발생했습니다." };
  }
}
