import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeGuideImprovement } from "@/lib/domains/guide/llm/actions/improveGuide";

export const maxDuration = 300;

const LOG_CTX = { domain: "guide", action: "improveGuideRoute" };

const limiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
  prefix: "rl:guide-llm",
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, limiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    await requireAdminOrConsultant();

    const { newGuideId, sourceGuideId, userId } = (await request.json()) as {
      newGuideId: string;
      sourceGuideId: string;
      userId: string;
    };

    if (!newGuideId || !sourceGuideId) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 },
      );
    }

    try {
      await executeGuideImprovement(newGuideId, sourceGuideId, userId);
      return NextResponse.json({ completed: true });
    } catch (execError) {
      const msg = execError instanceof Error ? execError.message : "";
      const admin = createSupabaseAdminClient();
      await admin
        .from("exploration_guides")
        .update({ status: "ai_failed", ai_model_version: msg.slice(0, 500) })
        .eq("id", newGuideId);
      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
    }
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "AI 개선 요청에 실패했습니다." },
      { status: 500 },
    );
  }
}
