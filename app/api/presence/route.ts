import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Presence beacon endpoint.
 *
 * iOS PWA에서 백그라운드 전환 시 navigator.sendBeacon()으로 호출됩니다.
 * JS 실행이 중단되기 전에 "idle" 상태를 확실히 DB에 기록하기 위함입니다.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const status = url.searchParams.get("status");

  if (!userId || !status || !["idle", "offline"].includes(status)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  }

  await supabase.from("user_presence").upsert({
    user_id: userId,
    status,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

// sendBeacon은 POST만 지원하지만, GET도 허용 (디버깅용)
export async function GET(request: NextRequest) {
  return POST(request);
}
