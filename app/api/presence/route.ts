import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Presence beacon endpoint.
 *
 * iOS PWA에서 백그라운드 전환 시 navigator.sendBeacon()으로 호출됩니다.
 * JS 실행이 중단되기 전에 "idle" 상태를 확실히 DB에 기록하기 위함입니다.
 *
 * 보안: 세션 쿠키로 인증된 사용자만 자신의 상태를 변경할 수 있습니다.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  if (!status || !["idle", "offline"].includes(status)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase.from("user_presence").upsert({
    user_id: user.id,
    status,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

// sendBeacon은 POST만 지원하지만, GET도 허용 (디버깅용)
export async function GET(request: NextRequest) {
  return POST(request);
}
