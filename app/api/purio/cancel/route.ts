/**
 * 뿌리오 SMS 예약 취소 API Route
 * POST /api/purio/cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin as requireAdminAuth } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { cancelScheduledMessage } from "@/lib/services/smsService";
import { logError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      return NextResponse.json(
        { success: false, error: "기관 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { messageKey } = body;

    if (!messageKey) {
      return NextResponse.json(
        { success: false, error: "메시지 키가 필요합니다." },
        { status: 400 }
      );
    }

    const result = await cancelScheduledMessage(messageKey, tenantContext.tenantId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "예약 취소에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logError(error, {
      context: "[SMS Cancel API]",
      operation: "예약 취소",
    });

    return NextResponse.json(
      {
        success: false,
        error: (error as { message?: string })?.message || "예약 취소 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
