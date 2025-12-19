/**
 * 알림 조회 API
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAllNotifications } from "@/lib/services/inAppNotificationService";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifications = await getAllNotifications(user.userId);

    return NextResponse.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("[api/notifications] 알림 조회 실패:", error);
    return NextResponse.json(
      { error: "알림 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

