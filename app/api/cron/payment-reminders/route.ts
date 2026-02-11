import { NextResponse } from "next/server";
import { processPaymentReminders } from "@/lib/domains/payment/services/reminderService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPaymentReminders();

    console.log("[payment-reminders] 결과:", JSON.stringify(result));

    return NextResponse.json({
      message: "Payment reminders processed",
      date: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[payment-reminders] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
