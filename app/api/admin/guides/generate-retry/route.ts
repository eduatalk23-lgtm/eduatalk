import { NextRequest, NextResponse } from "next/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeGuideGeneration } from "@/lib/domains/guide/llm/actions/executeGuideGeneration";
import type { GuideGenerationInput } from "@/lib/domains/guide/llm/types";

export const maxDuration = 300; // 5분 — Vercel Hobby 최대

const LOG_CTX = { domain: "guide", action: "generateGuide.retry" };

const limiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
  prefix: "rl:guide-llm",
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, limiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // retry route는 generate route에서 서버→서버 호출이므로 auth 체크 생략
    const { guideId, input, modelStartIndex } = (await request.json()) as {
      guideId: string;
      input: GuideGenerationInput;
      modelStartIndex: number;
    };

    if (!guideId || !input || modelStartIndex == null) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    try {
      await executeGuideGeneration(guideId, input, { modelStartIndex });
      return NextResponse.json({ completed: true });
    } catch (retryError) {
      // 이 모델도 타임아웃 → ai_failed (더 이상 재시도 안 함)
      const msg = retryError instanceof Error ? retryError.message : String(retryError);
      const admin = createSupabaseAdminClient();
      await admin
        .from("exploration_guides")
        .update({
          status: "ai_failed",
          ai_model_version: `모든 모델 타임아웃: ${msg.slice(0, 400)}`,
        })
        .eq("id", guideId);
      return NextResponse.json({ error: "모든 모델 타임아웃" }, { status: 500 });
    }
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "가이드 재시도에 실패했습니다." },
      { status: 500 },
    );
  }
}
