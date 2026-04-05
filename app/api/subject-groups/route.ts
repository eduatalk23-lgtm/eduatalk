import { NextRequest, NextResponse } from "next/server";
import { getSubjectGroups, getSubjectGroupsWithSubjects } from "@/lib/data/subjects";
import { CACHE_STATIC } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const curriculumRevisionId = searchParams.get("curriculum_revision_id") || undefined;
    const includeSubjects = searchParams.get("include_subjects") === "true";

    if (!includeSubjects) {
      // 교과만 조회
      const groups = await getSubjectGroups(curriculumRevisionId);
      
      return NextResponse.json({
        success: true,
        data: groups || [],
      }, { headers: CACHE_STATIC });
    }

    // 교과와 과목을 함께 조회
    const groupsWithSubjects = await getSubjectGroupsWithSubjects(curriculumRevisionId);

    return NextResponse.json({
      success: true,
      data: groupsWithSubjects,
    }, { headers: CACHE_STATIC });
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

