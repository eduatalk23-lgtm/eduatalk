/**
 * 연결된 Google 계정의 캘린더 목록 조회
 * GET /api/admin/google-calendar/calendars
 */

import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import {
  getTokenByAdminUser,
  refreshTokenIfNeeded,
  listCalendars,
} from "@/lib/domains/googleCalendar";

export async function GET() {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !isAdminRole(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const token = await getTokenByAdminUser(adminClient, userId);
    if (!token) {
      return NextResponse.json(
        { error: "Google Calendar이 연결되지 않았습니다." },
        { status: 404 }
      );
    }

    const refreshed = await refreshTokenIfNeeded(adminClient, token);
    const calendars = await listCalendars(refreshed);

    return NextResponse.json({ calendars });
  } catch (error) {
    console.error("[api/admin/google-calendar/calendars] 오류:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
