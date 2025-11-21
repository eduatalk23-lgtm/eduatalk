import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 학교 검색 API
 * GET /api/schools/search?q=검색어&type=대학교
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || ""; // 중학교, 고등학교, 대학교
    const name = searchParams.get("name"); // 학교명으로 직접 조회

    const supabase = await createSupabaseServerClient();

    // ID로 조회
    if (id) {
      const { data: school, error } = await supabase
        .from("schools")
        .select("id, name, type, region")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[api/schools/search] ID 조회 실패:", error);
        return NextResponse.json(
          { error: "학교 조회에 실패했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({ schools: school ? [school] : [] });
    }

    // 학교명으로 직접 조회
    if (name) {
      const { data: schools, error } = await supabase
        .from("schools")
        .select("id, name, type, region")
        .eq("name", name)
        .limit(1); // 여러 개가 있어도 첫 번째만 반환

      if (error) {
        console.error("[api/schools/search] 이름 조회 실패:", error);
        return NextResponse.json(
          { error: "학교 조회에 실패했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({ schools: schools || [] });
    }

    // 검색 쿼리
    let schoolsQuery = supabase
      .from("schools")
      .select("id, name, type, region")
      .order("name", { ascending: true })
      .limit(50);

    // 검색어가 있으면 필터링
    if (query.trim()) {
      schoolsQuery = schoolsQuery.ilike("name", `%${query.trim()}%`);
    }

    // 타입 필터
    if (type && ["중학교", "고등학교", "대학교"].includes(type)) {
      schoolsQuery = schoolsQuery.eq("type", type);
    }

    const { data: schools, error } = await schoolsQuery;

    if (error) {
      console.error("[api/schools/search] 검색 실패:", error);
      return NextResponse.json(
        { error: "학교 검색에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ schools: schools || [] });
  } catch (error) {
    console.error("[api/schools/search] 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

