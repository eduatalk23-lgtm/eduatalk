import { NextResponse } from "next/server";

/**
 * Cron / 내부 호출 인증.
 * - CRON_SECRET 미설정 → 503 (fail-safe: 우회 차단)
 * - Authorization 헤더 불일치 → 401
 * - 통과 → null
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET not set" },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
