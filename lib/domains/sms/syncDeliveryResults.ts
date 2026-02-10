"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import {
  fetchDeliveryResults,
  confirmDeliveryResults,
  mapPpurioResultToStatus,
} from "@/lib/services/smsService";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";

export interface SyncResult {
  success: boolean;
  synced: number;
  delivered: number;
  failed: number;
  error?: string;
}

/**
 * 뿌리오 발송 결과를 DB에 동기화
 * - fetchDeliveryResults()로 결과 조회
 * - message_key 또는 ref_key로 sms_logs 매칭
 * - status, delivered_at, ppurio_result_code 업데이트
 * - confirmDeliveryResults()로 수신 확인
 */
export async function syncDeliveryResults(): Promise<SyncResult> {
  try {
    await requireAdmin();

    const reports = await fetchDeliveryResults();

    if (reports.length === 0) {
      return { success: true, synced: 0, delivered: 0, failed: 0 };
    }

    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      return {
        success: false,
        synced: 0,
        delivered: 0,
        failed: 0,
        error: "시스템 오류: DB 클라이언트를 초기화할 수 없습니다.",
      };
    }

    let synced = 0;
    let delivered = 0;
    let failed = 0;

    for (const report of reports) {
      const status = mapPpurioResultToStatus(report.result);
      const deliveredAt =
        status === "delivered"
          ? report.unixtime
            ? new Date(parseInt(report.unixtime, 10) * 1000).toISOString()
            : new Date().toISOString()
          : null;

      // message_key (msgid)로 매칭 시도
      let matched = false;

      if (report.msgid) {
        const { data, error } = await adminClient
          .from("sms_logs")
          .update({
            status,
            delivered_at: deliveredAt,
            ppurio_result_code: report.result,
          })
          .eq("message_key", report.msgid)
          .select("id")
          .maybeSingle();

        if (!error && data) {
          matched = true;
        }
      }

      // message_key로 못 찾으면 ref_key (cmsgid)로 매칭
      if (!matched && report.cmsgid) {
        const { data, error } = await adminClient
          .from("sms_logs")
          .update({
            status,
            delivered_at: deliveredAt,
            ppurio_result_code: report.result,
          })
          .eq("ref_key", report.cmsgid)
          .select("id")
          .maybeSingle();

        if (!error && data) {
          matched = true;
        }
      }

      if (matched) {
        synced++;
        if (status === "delivered") delivered++;
        else failed++;
      }
    }

    // 결과 수신 확인 (동일 결과 재반환 방지)
    await confirmDeliveryResults();

    logActionDebug(
      { domain: "sms", action: "syncDeliveryResults" },
      "동기화 완료",
      { total: reports.length, synced, delivered, failed }
    );

    return { success: true, synced, delivered, failed };
  } catch (error) {
    logActionError(
      { domain: "sms", action: "syncDeliveryResults" },
      error,
      {}
    );

    return {
      success: false,
      synced: 0,
      delivered: 0,
      failed: 0,
      error:
        error instanceof Error
          ? error.message
          : "발송 결과 동기화에 실패했습니다.",
    };
  }
}
