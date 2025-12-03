import { NextResponse } from "next/server";
import { getPlatformsForFilter } from "@/lib/data/contentMasters";

export async function GET() {
  try {
    const platforms = await getPlatformsForFilter();

    return NextResponse.json({
      success: true,
      data: platforms,
    });
  } catch (error) {
    console.error("[api/platforms] 조회 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "플랫폼 목록 조회에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

