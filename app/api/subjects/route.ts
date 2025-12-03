import { NextRequest, NextResponse } from "next/server";
import { getSubjectsForFilter } from "@/lib/data/contentMasters";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subjectGroupId = searchParams.get("subject_group_id") || undefined;

    if (!subjectGroupId) {
      return NextResponse.json(
        {
          success: false,
          error: "subject_group_id가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const subjects = await getSubjectsForFilter(subjectGroupId);

    return NextResponse.json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    console.error("[api/subjects] 조회 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "과목 목록 조회에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

