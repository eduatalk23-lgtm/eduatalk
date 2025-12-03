import { NextRequest, NextResponse } from "next/server";
import { getSubjectGroups, getSubjectGroupsWithSubjects } from "@/lib/data/subjects";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const curriculumRevisionId = searchParams.get("curriculum_revision_id") || undefined;
    const includeSubjects = searchParams.get("include_subjects") === "true";

    if (!includeSubjects) {
      // 교과만 조회
      const groups = await getSubjectGroups(curriculumRevisionId);
      
      console.log("[api/subject-groups] 교과 조회 결과:", {
        curriculumRevisionId,
        count: groups.length,
        groups: groups.map((g) => ({ id: g.id, name: g.name })),
      });

      return NextResponse.json({
        success: true,
        data: groups || [],
      });
    }

    // 교과와 과목을 함께 조회
    const groupsWithSubjects = await getSubjectGroupsWithSubjects(curriculumRevisionId);

    console.log("[api/subject-groups] 교과 및 과목 조회 결과:", {
      curriculumRevisionId,
      count: groupsWithSubjects.length,
      groupsWithSubjects: groupsWithSubjects.map((g) => ({
        id: g.id,
        name: g.name,
        subjectCount: g.subjects?.length || 0,
      })),
    });

    return NextResponse.json({
      success: true,
      data: groupsWithSubjects,
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

