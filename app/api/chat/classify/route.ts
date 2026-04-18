/**
 * Phase F-4: Tier Routing 분류 엔드포인트.
 *
 * POST { input: string, model?: string } → TierClassification JSON.
 * proxy.ts 세션 쿠키 인증을 통과한 사용자만 호출 가능.
 * ChatShell Composer 가 submit 전에 호출해 L3 판정 시 배너 노출.
 */

import { NextResponse } from "next/server";
import { classifyTier } from "@/lib/domains/ai-chat/routing/classifier";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "body must be an object" },
      { status: 400 },
    );
  }
  const { input, model } = body as { input?: unknown; model?: unknown };
  if (typeof input !== "string" || input.trim().length === 0) {
    return NextResponse.json(
      { error: "input is required (non-empty string)" },
      { status: 400 },
    );
  }

  const result = await classifyTier(input, {
    model: typeof model === "string" && model.length > 0 ? model : undefined,
  });

  return NextResponse.json(result);
}
