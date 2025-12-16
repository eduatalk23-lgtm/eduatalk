import { NextRequest, NextResponse } from "next/server";
import { getDifficultyLevels } from "@/lib/data/difficultyLevels";

/**
 * 난이도 목록 조회 API
 * GET /api/difficulty-levels?contentType=book
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contentType = searchParams.get("contentType") as
      | "book"
      | "lecture"
      | "custom"
      | "common"
      | null;

    const levels = await getDifficultyLevels(contentType || undefined);

    return NextResponse.json(levels, { status: 200 });
  } catch (error) {
    console.error("[API] 난이도 조회 실패:", error);
    return NextResponse.json(
      {
        error: "난이도 조회에 실패했습니다.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

