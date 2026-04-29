import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeGuideReview } from "@/lib/domains/guide/llm/actions/reviewGuide";

export const maxDuration = 300;

const LOG_CTX = { domain: "guide", action: "reviewGuideRoute" };

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

    const { guideId } = (await request.json()) as { guideId: string };

    if (!guideId) {
      return NextResponse.json(
        { error: "guideId가 필요합니다." },
        { status: 400 },
      );
    }

    try {
      await executeGuideReview(guideId);
      return NextResponse.json({ completed: true });
    } catch (execError) {
      const msg = execError instanceof Error ? execError.message : "";
      const admin = createSupabaseAdminClient();
      await admin
        .from("exploration_guides")
        .update({ status: "draft" })
        .eq("id", guideId);
      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
    }
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "AI 리뷰 요청에 실패했습니다." },
      { status: 500 },
    );
  }
}
