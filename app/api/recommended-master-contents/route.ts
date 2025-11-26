import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRecommendedMasterContents } from "@/lib/recommendations/masterContentRecommendation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    // 학생의 tenant_id 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", user.userId)
      .maybeSingle();

    if (studentError) {
      console.error("[api/recommended-master-contents] 학생 조회 실패", studentError);
      return NextResponse.json(
        { error: "Failed to fetch student data" },
        { status: 500 }
      );
    }

    // 쿼리 파라미터에서 교과와 개수 정보 추출
    const { searchParams } = new URL(request.url);
    const subjectsParam = searchParams.getAll("subjects");
    const subjectCounts = new Map<string, number>();
    
    if (subjectsParam.length > 0) {
      // 교과별 개수 파라미터 파싱
      subjectsParam.forEach((subject) => {
        const countParam = searchParams.get(`count_${subject}`);
        const count = countParam ? parseInt(countParam, 10) : 1;
        if (!isNaN(count) && count > 0) {
          subjectCounts.set(subject, count);
        }
      });
    }

    const recommendations = await getRecommendedMasterContents(
      supabase,
      user.userId,
      student?.tenant_id || null,
      subjectCounts.size > 0 ? subjectCounts : undefined
    );

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("[api/recommended-master-contents] 추천 생성 실패", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}

