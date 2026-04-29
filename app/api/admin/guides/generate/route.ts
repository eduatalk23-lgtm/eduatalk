import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeGuideGeneration } from "@/lib/domains/guide/llm/actions/executeGuideGeneration";
import type { GuideGenerationInput } from "@/lib/domains/guide/llm/types";

export const maxDuration = 300; // 5분 — Vercel Hobby 최대

const LOG_CTX = { domain: "guide", action: "generateGuide" };

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

    const { guideId, input } = (await request.json()) as {
      guideId: string;
      input: GuideGenerationInput;
    };

    if (!guideId || !input) {
      return NextResponse.json(
        { error: "guideId와 input이 필요합니다." },
        { status: 400 },
      );
    }

    try {
      await executeGuideGeneration(guideId, input);
      return NextResponse.json({ completed: true });
    } catch (genError) {
      // 타임아웃 → retry route로 다음 모델 시도 (독립 5분)
      const msg = genError instanceof Error ? genError.message : "";
      const modelIndexMatch = msg.match(/modelIndex=(\d+)/);
      if (modelIndexMatch) {
        const nextIndex = parseInt(modelIndexMatch[1], 10) + 1;
        const baseUrl =
          process.env.NEXT_PUBLIC_SITE_URL ??
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000");
        fetch(`${baseUrl}/api/admin/guides/generate-retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guideId, input, modelStartIndex: nextIndex }),
        }).catch(() => {});
        return NextResponse.json({ retrying: true, nextModelIndex: nextIndex });
      }
      // 타임아웃 아닌 에러 → ai_failed
      const admin = createSupabaseAdminClient();
      await admin
        .from("exploration_guides")
        .update({
          status: "ai_failed",
          ai_model_version: msg.slice(0, 500),
        })
        .eq("id", guideId);
      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
    }
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "가이드 생성 요청에 실패했습니다." },
      { status: 500 },
    );
  }
}
