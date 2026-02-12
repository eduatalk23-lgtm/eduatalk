import { NextResponse } from "next/server";
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
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processConsultationReminders();

    console.log("[consultation-reminders] 결과:", JSON.stringify(result));

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
