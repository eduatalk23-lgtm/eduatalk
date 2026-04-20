/**
 * Phase C-2: /api/ai-chat/artifacts
 *
 * GET  ?conversationId=<uuid>                     — 해당 대화의 artifact 목록 + 최신 버전 props
 * GET  ?conversationId=<uuid>&artifactId=<uuid>   — 특정 artifact 의 전체 버전 히스토리
 *
 * RLS 가 tenant/auth 를 강제하므로 추가 가드 불필요. 미로그인/권한 미달은 빈 배열.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listArtifactVersions,
  listConversationArtifacts,
} from "@/lib/domains/ai-chat/artifact-repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const artifactId = searchParams.get("artifactId");

  if (!conversationId && !artifactId) {
    return NextResponse.json(
      { ok: false, reason: "conversationId 또는 artifactId 필수" },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  if (artifactId) {
    const versions = await listArtifactVersions(artifactId, supabase);
    return NextResponse.json({ ok: true, versions });
  }

  const artifacts = await listConversationArtifacts(conversationId!, supabase);
  return NextResponse.json({ ok: true, artifacts });
}
