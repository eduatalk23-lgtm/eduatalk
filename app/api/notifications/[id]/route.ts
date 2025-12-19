/**
 * 알림 삭제 API
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { deleteNotification } from "@/lib/services/inAppNotificationService";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await deleteNotification(user.userId, id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "알림 삭제에 실패했습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/notifications/[id]] 알림 삭제 실패:", error);
    return NextResponse.json(
      { error: "알림 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}

