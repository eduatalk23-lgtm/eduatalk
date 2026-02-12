/**
 * 동기화 대상 캘린더 변경
 * PUT /api/admin/google-calendar/calendar
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { updateCalendarId } from "@/lib/domains/googleCalendar";

export async function PUT(request: NextRequest) {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !isAdminRole(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { calendarId } = body as { calendarId?: string };

    if (!calendarId || typeof calendarId !== "string") {
      return NextResponse.json({ error: "calendarId is required" }, { status: 400 });
    }

    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const result = await updateCalendarId(adminClient, userId, calendarId);

    if (!result.success) {
      return NextResponse.json({ error: "캘린더 변경에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/admin/google-calendar/calendar] 오류:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
