import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/auth/cronAuth";
import { processEnrollmentExpiry } from "@/lib/domains/enrollment/services/expiryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResp = verifyCronAuth(request);
  if (authResp) return authResp;

  try {
    const result = await processEnrollmentExpiry();

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
