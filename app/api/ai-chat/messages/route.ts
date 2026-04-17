/**
 * Phase T-3: 특정 대화의 메시지 조회 API
 *
 * SplitChatPanel 이 클라이언트에서 선공 메시지 + 이전 대화 내역을 로드할 때 사용.
 * /ai-chat 페이지는 서버 컴포넌트에서 loadConversationMessages 직접 호출하므로
 * 이 API 는 split 모드 전용.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { loadConversationMessages } from "@/lib/domains/ai-chat/persistence";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { messages: [], reason: "unauthenticated" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { messages: [], reason: "missing-id" },
      { status: 400 },
    );
  }

  // RLS 로 owner 만 읽을 수 있음. 실패 시 빈 배열 반환.
  const messages = await loadConversationMessages(id);
  return NextResponse.json({ messages });
}
