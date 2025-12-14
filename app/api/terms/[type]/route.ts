import { NextResponse } from "next/server";
import { getActiveTermsContent } from "@/lib/data/termsContents";
import type { TermsContentType } from "@/lib/types/terms";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;

    // 약관 유형 검증
    if (!["terms", "privacy", "marketing"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid terms type" },
        { status: 400 }
      );
    }

    const contentType = type as TermsContentType;
    const content = await getActiveTermsContent(contentType);

    if (!content) {
      return NextResponse.json(
        { error: "Terms content not found" },
        { status: 404 }
      );
    }

    // 캐싱 헤더 설정 (5분)
    return NextResponse.json(
      {
        id: content.id,
        content_type: content.content_type,
        version: content.version,
        title: content.title,
        content: content.content,
        updated_at: content.updated_at,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[api/terms] 약관 조회 실패:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

