/**
 * 채팅 고아 첨부파일 정리 Cron Job
 *
 * 매일 새벽 3시(KST)에 실행.
 * message_id가 NULL이고 24시간 이상 경과한 첨부파일을
 * Storage + DB에서 일괄 삭제합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { cleanupOrphanedAttachments } from "@/lib/domains/chat/cleanup";

export const runtime = "nodejs";

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedApiKey = process.env.CRON_SECRET;

  if (!expectedApiKey) {
    console.error("[cleanup-chat-attachments] CRON_SECRET이 설정되지 않았습니다.");
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
    const result = await cleanupOrphanedAttachments();

    console.log("[cleanup-chat-attachments] Result:", {
      orphanedDeleted: result.orphanedDeleted,
      expiredDeleted: result.expiredDeleted,
      storageDeletedCount: result.storageDeletedCount,
      errors: result.errors,
    });

    return NextResponse.json({
      success: result.success,
      orphanedDeleted: result.orphanedDeleted,
      expiredDeleted: result.expiredDeleted,
      storageDeletedCount: result.storageDeletedCount,
      ...(result.errors.length > 0 ? { errors: result.errors } : {}),
    });
  } catch (error) {
    console.error("[cleanup-chat-attachments] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
