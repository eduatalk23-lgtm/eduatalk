/**
 * 예약 메시지 발송 Cron Job
 *
 * pg_cron이 매분 호출 (pending 메시지가 있을 때만).
 * scheduled_at이 도래한 예약 메시지를 chat_messages로 발송합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { processScheduledMessages } from "@/lib/domains/chat/scheduled/processScheduledMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedApiKey = process.env.CRON_SECRET;

  if (!expectedApiKey) {
    console.error("[send-scheduled-messages] CRON_SECRET이 설정되지 않았습니다.");
    return false;
  }

  if (!apiKey) return false;

  try {
    const bufA = Buffer.from(apiKey);
    const bufB = Buffer.from(expectedApiKey);
    if (bufA.length !== bufB.length) {
      const randomBuf = randomBytes(bufA.length);
      timingSafeEqual(bufA, randomBuf);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    const result = await processScheduledMessages();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      ...result,
      durationMs,
    });
  } catch (error) {
    console.error("[send-scheduled-messages] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
