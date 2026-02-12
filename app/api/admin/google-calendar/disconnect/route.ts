/**
 * Google Calendar 연결 해제
 * POST /api/admin/google-calendar/disconnect
 *
 * 토큰 삭제 + Google 토큰 폐기
 */

import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import {
  getTokenByAdminUser,
  deleteToken,
} from "@/lib/domains/googleCalendar";
import { createOAuth2Client } from "@/lib/domains/googleCalendar/oauth";

export async function POST() {
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

    // 기존 토큰 조회
    const token = await getTokenByAdminUser(adminClient, userId);

    if (token) {
      // Google 토큰 폐기 (실패해도 로컬 삭제 진행)
      try {
        const oauth2Client = createOAuth2Client();
        await oauth2Client.revokeToken(token.access_token);
      } catch {
        // 폐기 실패 무시 (만료된 토큰 등)
      }

      // DB에서 삭제
      await deleteToken(adminClient, userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/admin/google-calendar/disconnect] 오류:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
