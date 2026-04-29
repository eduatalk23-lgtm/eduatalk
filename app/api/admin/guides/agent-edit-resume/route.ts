import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { verifyGuideTenantAccess } from "@/lib/auth/verifyTenantAccess";
import { logActionError } from "@/lib/logging/actionLogger";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyAgentEditResult } from "@/lib/domains/guide/llm/actions/agentEditGuide";

export const maxDuration = 300;

const LOG_CTX = { domain: "guide", action: "agentEditResume" };

const limiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
  prefix: "rl:guide-llm",
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, limiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const caller = await requireAdminOrConsultant();

    const { guideId, approved } = (await request.json()) as {
      guideId: string;
      approved: boolean;
    };

    if (!guideId) {
      return NextResponse.json(
        { error: "guideId가 필요합니다." },
        { status: 400 },
      );
    }

    await verifyGuideTenantAccess(guideId, caller);

    if (!approved) {
      // 거절: ai_failed로 전환
      const admin = createSupabaseAdminClient();
      await admin
        .from("exploration_guides")
        .update({
          status: "ai_failed",
          agent_question: null,
          version_message: "AI 편집 사용자 거절",
        })
        .eq("id", guideId);
      return NextResponse.json({ cancelled: true });
    }

    try {
      await applyAgentEditResult(guideId);
      return NextResponse.json({ completed: true });
    } catch (execError) {
      const msg = execError instanceof Error ? execError.message : "";
      const admin = createSupabaseAdminClient();
      await admin
        .from("exploration_guides")
        .update({
          status: "ai_failed",
          agent_question: null,
        })
        .eq("id", guideId);
      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
    }
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "편집 적용에 실패했습니다." },
      { status: 500 },
    );
  }
}
