/**
 * 캠프 초대 만료 처리 Cron Job
 * 
 * 이 API는 외부 Cron 서비스(예: Vercel Cron)에서 주기적으로 호출됩니다.
 * 매일 오전 9시에 실행하는 것을 권장합니다.
 * 
 * 보안: Authorization 헤더에 API 키를 포함하여 호출해야 합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  processExpiredInvitations,
  sendExpiryReminderNotifications,
} from "@/lib/services/campInvitationExpiryService";

export const runtime = "nodejs";

/**
 * API 키 검증
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedApiKey = process.env.CRON_SECRET;

  if (!expectedApiKey) {
    console.warn(
      "[process-camp-expiry] CRON_SECRET이 설정되지 않았습니다."
    );
    return false;
  }

  return apiKey === expectedApiKey;
}

/**
 * GET /api/cron/process-camp-expiry
 * 
 * 캠프 초대 만료 처리 및 만료 예정 알림 발송
 */
export async function GET(request: NextRequest) {
  try {
    // API 키 검증
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 만료 예정 알림 발송 (1일 전)
    const reminderResult = await sendExpiryReminderNotifications();
    if (!reminderResult.success) {
      console.error(
        "[process-camp-expiry] 만료 예정 알림 발송 실패:",
        reminderResult.error
      );
    }

    // 만료된 초대 처리
    const expiryResult = await processExpiredInvitations();
    if (!expiryResult.success) {
      console.error(
        "[process-camp-expiry] 만료 처리 실패:",
        expiryResult.error
      );
      return NextResponse.json(
        {
          success: false,
          error: expiryResult.error,
          reminderCount: reminderResult.count,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expiredCount: expiryResult.count,
      reminderCount: reminderResult.count,
      message: `${expiryResult.count}개의 초대를 만료 처리하고, ${reminderResult.count}개의 만료 예정 알림을 발송했습니다.`,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[process-camp-expiry] 예외 발생:", errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

