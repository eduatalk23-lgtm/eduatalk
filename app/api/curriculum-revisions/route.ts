import { NextResponse } from "next/server";
import { getCurriculumRevisions } from "@/lib/data/contentMasters";

export async function GET() {
  try {
    const revisions = await getCurriculumRevisions();

    return NextResponse.json({
      success: true,
      data: revisions,
    });
  } catch (error) {
    console.error("[api/curriculum-revisions] 조회 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "개정교육과정 목록 조회에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

