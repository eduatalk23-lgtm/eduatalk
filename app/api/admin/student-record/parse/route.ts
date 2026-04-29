import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";
import { parseRecordContent } from "@/lib/domains/student-record/import/parser";
import type { ExtractedContent } from "@/lib/domains/student-record/import/types";

export const maxDuration = 300; // PDF/이미지 → Gemini 파싱은 1~3분 소요

const limiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
  prefix: "rl:record-parse",
});

/**
 * 생기부 PDF/이미지를 Gemini로 파싱하는 서버 라우트.
 *
 * 클라이언트가 NEXT_PUBLIC_GOOGLE_API_KEY로 직접 Gemini를 호출하던 흐름을
 * 서버 라우트로 이동(키 노출 차단). 클라이언트는 ExtractedContent까지만
 * 추출(pdfjs는 브라우저 전용)하여 전송한다.
 */
export async function POST(request: NextRequest) {
  const rateLimitResp = await applyRateLimit(request, limiter);
  if (rateLimitResp) return rateLimitResp;

  try {
    await requireAdminOrConsultant();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY가 서버에 설정되어 있지 않습니다." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { content?: ExtractedContent };
    const content = body?.content;
    if (!content || typeof content !== "object" || !("format" in content)) {
      return NextResponse.json(
        { error: "content(ExtractedContent)가 필요합니다." },
        { status: 400 },
      );
    }

    const parsed = await parseRecordContent(content, apiKey);
    return NextResponse.json({ data: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "파싱 실패";
    const status =
      err instanceof Error && err.message.includes("로그인이")
        ? 401
        : err instanceof Error && err.message.includes("권한")
          ? 403
          : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
