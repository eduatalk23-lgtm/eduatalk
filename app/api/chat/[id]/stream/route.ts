/**
 * Phase D-5 — Resumable streaming GET endpoint.
 *
 * AI SDK v6 `DefaultChatTransport.reconnectToStream` 의 기본 URL 규약:
 *   `${api}/${chatId}/stream`   → `/api/chat/<conversationId>/stream`
 *
 * 동작:
 *  1. 인증 확인 (비로그인 → 401)
 *  2. ai_conversations owner 검증 — RLS 로 owner 외에는 행을 못 본다.
 *     행이 없거나 오너가 다르면 **204 No Content** 로 조용히 종료.
 *  3. stream-store 에서 활성 스트림이 있으면 SSE ReadableStream 반환,
 *     없거나 이미 done 이면 204.
 *
 * 204 응답은 AI SDK 쪽에서 `null` 로 해석되어 조용히 무시된다
 * (신규 페이지 진입 시마다 자동 호출되는 경로라서 로그 오염 방지).
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { replayStream } from "@/lib/domains/ai-chat/stream-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Owner 검증 — RLS 로 owner 외에는 행이 안 보인다. 행이 없으면 활성 스트림 없음으로 취급.
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      return new Response(null, { status: 204 });
    }
  } catch {
    return new Response(null, { status: 204 });
  }

  let stream: ReadableStream<string> | null;
  try {
    stream = await replayStream(id);
  } catch (err) {
    console.warn(
      "[ai-chat] replayStream 실패:",
      err instanceof Error ? err.message : err,
    );
    return new Response(null, { status: 204 });
  }

  if (!stream) {
    return new Response(null, { status: 204 });
  }

  // Response 는 바이트 스트림이 필요하다. SSE 문자열을 UTF-8 로 인코딩.
  const encoded = stream.pipeThrough(new TextEncoderStream());

  return new Response(encoded, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
