/**
 * Phase T-3: handoff initialize API
 *
 * split 모드 (SplitChatPanel) 가 클라이언트에서 호출.
 * 서버는 T-4 규약(화이트리스트·권한·테넌트 검증) + 선공 메시지 생성·저장을 수행.
 *
 * T-1 전환 모드 (page.tsx) 와 동일 로직(initializeHandoff) 을 공유.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { initializeHandoff } from "@/lib/domains/ai-chat/handoff/initialize";
import { getHandoffSource } from "@/lib/domains/ai-chat/handoff/sources";

export const runtime = "nodejs";

type RequestBody = {
  conversationId: string;
  from: string;
  studentId?: string;
  grade?: number;
  semester?: number;
  subject?: string;
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "unauthenticated" },
      { status: 401 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid-json" },
      { status: 400 },
    );
  }

  if (!body.conversationId || !body.from) {
    return NextResponse.json(
      { ok: false, reason: "missing-params" },
      { status: 400 },
    );
  }

  const result = await initializeHandoff({
    conversationId: body.conversationId,
    user,
    input: {
      from: body.from,
      studentId: body.studentId,
      grade: body.grade,
      semester: body.semester,
      subject: body.subject,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 200 },
    );
  }

  // isExisting 시에는 initialize 가 source key 만 반환. label 복원.
  const source = getHandoffSource(result.bannerOrigin.source);
  const bannerLabel = source?.label ?? result.bannerOrigin.label;

  return NextResponse.json({
    ok: true,
    isExisting: result.isExisting,
    bannerOrigin: {
      source: result.bannerOrigin.source,
      label: bannerLabel,
      originPath: result.bannerOrigin.originPath,
    },
    suggestionChips: result.suggestionChips,
    resolvedStudentId: result.resolvedStudentId,
  });
}
