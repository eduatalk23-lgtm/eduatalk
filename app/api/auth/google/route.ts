/**
 * Google OAuth 인증 시작
 * GET /api/auth/google?target=personal|shared
 *
 * Google 동의 화면으로 리다이렉트
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { generateAuthUrl } from "@/lib/domains/googleCalendar";

export async function GET(request: NextRequest) {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !isAdminRole(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return NextResponse.json({ error: "기관 정보 없음" }, { status: 400 });
    }

    const target = request.nextUrl.searchParams.get("target") ?? "personal";
    if (target !== "personal" && target !== "shared") {
      return NextResponse.json({ error: "잘못된 target" }, { status: 400 });
    }

    const authUrl = generateAuthUrl({
      adminUserId: userId,
      tenantId: tenantContext.tenantId,
      target,
      timestamp: Date.now(),
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[api/auth/google] 오류:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
