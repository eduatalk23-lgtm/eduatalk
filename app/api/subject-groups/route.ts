import { NextRequest, NextResponse } from "next/server";
import { getSubjectGroupsForFilter } from "@/lib/data/contentMasters";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const curriculumRevisionId = searchParams.get("curriculum_revision_id") || undefined;

    const groups = await getSubjectGroupsForFilter(curriculumRevisionId);

    return NextResponse.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    console.error("[api/subject-groups] 조회 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "교과 목록 조회에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

