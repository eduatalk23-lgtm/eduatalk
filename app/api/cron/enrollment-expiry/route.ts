import { NextResponse } from "next/server";
import { processEnrollmentExpiry } from "@/lib/domains/enrollment/services/expiryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processEnrollmentExpiry();

    console.log("[enrollment-expiry] 결과:", JSON.stringify(result));

    return NextResponse.json({
      message: "Enrollment expiry processed",
      date: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[enrollment-expiry] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
