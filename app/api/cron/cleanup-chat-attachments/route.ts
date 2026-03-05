/**
 * 파일 정리 Cron Job
 *
 * 매일 새벽 3시(KST)에 실행.
 * 1. 채팅: message_id가 NULL이고 24시간 이상 경과한 첨부파일 삭제
 * 2. 드라이브: expires_at 경과한 파일 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { cleanupOrphanedAttachments } from "@/lib/domains/chat/cleanup";
import { cleanupDriveFiles } from "@/lib/domains/drive/cleanup";

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
    // 1. 채팅 첨부파일 정리
    const chatResult = await cleanupOrphanedAttachments();

    console.log("[cleanup] Chat attachments:", {
      orphanedDeleted: chatResult.orphanedDeleted,
      expiredDeleted: chatResult.expiredDeleted,
      storageDeletedCount: chatResult.storageDeletedCount,
      errors: chatResult.errors,
    });

    // 2. 드라이브 파일 정리
    const driveResult = await cleanupDriveFiles();

    console.log("[cleanup] Drive files:", {
      expiredDeleted: driveResult.expiredDeleted,
      storageDeletedCount: driveResult.storageDeletedCount,
      errors: driveResult.errors,
    });

    return NextResponse.json({
      success: chatResult.success && driveResult.success,
      chat: {
        orphanedDeleted: chatResult.orphanedDeleted,
        expiredDeleted: chatResult.expiredDeleted,
        storageDeletedCount: chatResult.storageDeletedCount,
      },
      drive: {
        expiredDeleted: driveResult.expiredDeleted,
        storageDeletedCount: driveResult.storageDeletedCount,
      },
      ...((chatResult.errors.length > 0 || driveResult.errors.length > 0)
        ? { errors: [...chatResult.errors, ...driveResult.errors] }
        : {}),
    });
  } catch (error) {
    console.error("[cleanup] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
