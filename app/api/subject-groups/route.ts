import { NextRequest, NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const curriculumRevisionId = searchParams.get("curriculum_revision_id") || undefined;
    const includeSubjects = searchParams.get("include_subjects") === "true";

    const supabase = createSupabasePublicClient();

    // 교과 그룹 조회
    let groupsQuery = supabase
      .from("subject_groups")
      .select("*")
      .order("name", { ascending: true });

    if (curriculumRevisionId) {
      groupsQuery = groupsQuery.eq("curriculum_revision_id", curriculumRevisionId);
    }

    const { data: groups, error: groupsError } = await groupsQuery;

    if (groupsError) {
      throw new Error(`교과 그룹 조회 실패: ${groupsError.message}`);
    }

    if (!includeSubjects) {
      // 교과만 조회
      return NextResponse.json({
        success: true,
        data: groups || [],
      });
    }

    // 교과와 과목을 함께 조회
    const groupsWithSubjects = await Promise.all(
      (groups || []).map(async (group) => {
        const { data: subjects, error: subjectsError } = await supabase
          .from("subjects")
          .select("*")
          .eq("subject_group_id", group.id)
          .order("name", { ascending: true });

        if (subjectsError) {
          console.error(`[api/subject-groups] 과목 조회 실패 (교과 ID: ${group.id}):`, subjectsError);
          return { ...group, subjects: [] };
        }

        return { ...group, subjects: subjects || [] };
      })
    );

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

