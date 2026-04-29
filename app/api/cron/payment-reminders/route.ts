import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/auth/cronAuth";
import { processPaymentReminders } from "@/lib/domains/payment/services/reminderService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResp = verifyCronAuth(request);
  if (authResp) return authResp;

  try {
    const result = await processPaymentReminders();

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
