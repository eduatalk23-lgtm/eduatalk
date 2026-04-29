import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/auth/cronAuth";
import { processConsultationReminders } from "@/lib/domains/consulting/services/reminderService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/consultation-reminders
 *
 * D-1 상담 일정 리마인더 발송
 * 매일 오전 9시(KST)에 Vercel Cron으로 실행
 * 내일 예정된 상담에 대해 학부모에게 알림톡/SMS 발송
 */
export async function GET(request: Request) {
  const authResp = verifyCronAuth(request);
  if (authResp) return authResp;

  try {
    const result = await processConsultationReminders();

    return NextResponse.json({
      message: "Consultation reminders processed",
      date: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[consultation-reminders] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
