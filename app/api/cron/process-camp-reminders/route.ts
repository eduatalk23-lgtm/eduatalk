/**
 * 캠프 초대 리마인더 발송 Cron Job
 * 
 * 이 API는 외부 Cron 서비스(예: Vercel Cron)에서 주기적으로 호출됩니다.
 * 매일 오전 10시에 실행하는 것을 권장합니다.
 * 
 * 보안: Authorization 헤더에 API 키를 포함하여 호출해야 합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { processReminders } from "@/lib/services/campReminderService";

export const runtime = "nodejs";

/**
 * API 키 검증
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedApiKey = process.env.CRON_SECRET;

  if (!expectedApiKey) {
    console.warn(
      "[process-camp-reminders] CRON_SECRET이 설정되지 않았습니다."
    );
    return false;
  }

  return apiKey === expectedApiKey;
}

/**
 * GET /api/cron/process-camp-reminders
 * 
 * 캠프 초대 리마인더 발송
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

    // 리마인더 발송
    const result = await processReminders();
    if (!result.success) {
      console.error(
        "[process-camp-reminders] 리마인더 발송 실패:",
        result.error
      );
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count}개의 리마인더를 발송했습니다.`,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[process-camp-reminders] 예외 발생:", errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

