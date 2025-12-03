import { NextResponse } from "next/server";
import { getPublishersForFilter } from "@/lib/data/contentMasters";

export async function GET() {
  try {
    const publishers = await getPublishersForFilter();

    return NextResponse.json({
      success: true,
      data: publishers,
    });
  } catch (error) {
    console.error("[api/publishers] 조회 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "출판사 목록 조회에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

