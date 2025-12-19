/**
 * 모든 알림 읽음 처리 API
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { markAllNotificationsAsRead } from "@/lib/services/inAppNotificationService";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await markAllNotificationsAsRead(user.userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "전체 알림 읽음 처리에 실패했습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[api/notifications/read-all] 전체 알림 읽음 처리 실패:",
      error
    );
    return NextResponse.json(
      { error: "전체 알림 읽음 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}

