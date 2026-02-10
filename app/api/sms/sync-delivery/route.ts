import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { syncDeliveryResults } from "@/lib/domains/sms/syncDeliveryResults";

/**
 * POST /api/sms/sync-delivery
 * 뿌리오 발송 결과를 DB에 동기화 (Admin 전용)
 */
export async function POST() {
  try {
    await requireAdmin();
    const result = await syncDeliveryResults();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "동기화에 실패했습니다.";
    return NextResponse.json(
      { success: false, synced: 0, delivered: 0, failed: 0, error: message },
      { status: error instanceof Error && error.message.includes("권한") ? 403 : 500 }
    );
  }
}
