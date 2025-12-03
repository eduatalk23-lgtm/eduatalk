import { NextRequest, NextResponse } from "next/server";
import { getSubjectGroupsForFilter } from "@/lib/data/contentMasters";
import { getSubjectGroupsWithSubjects } from "@/lib/data/subjects";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const curriculumRevisionId = searchParams.get("curriculum_revision_id") || undefined;
    const includeSubjects = searchParams.get("include_subjects") === "true";

    if (includeSubjects) {
      // 교과와 과목을 함께 조회 (병렬 처리)
      const groupsWithSubjects = await getSubjectGroupsWithSubjects(curriculumRevisionId);
      return NextResponse.json({
        success: true,
        data: groupsWithSubjects,
      });
    }

    // 교과만 조회
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

