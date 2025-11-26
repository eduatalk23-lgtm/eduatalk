import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentBookDetails, getStudentLectureEpisodes } from "@/lib/data/contentMasters";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { role } = await getCurrentUserRole();
    
    if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const contentType = searchParams.get("contentType");
    const contentId = searchParams.get("contentId");
    const includeMetadata = searchParams.get("includeMetadata") === "true";
    // 관리자/컨설턴트의 경우 student_id를 쿼리 파라미터로 받음 (캠프 모드)
    const studentId = searchParams.get("student_id");

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: "contentType and contentId are required" },
        { status: 400 }
      );
    }

    // 관리자/컨설턴트의 경우 student_id가 필요
    if ((role === "admin" || role === "consultant") && !studentId) {
      return NextResponse.json(
        { error: "관리자/컨설턴트의 경우 student_id가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const targetStudentId = role === "student" ? user.userId : studentId!;

    if (contentType === "book") {
      const details = await getStudentBookDetails(contentId, targetStudentId);
      
      if (includeMetadata) {
        // 교재 메타데이터 조회
        const { data: bookData } = await supabase
          .from("books")
          .select("subject, semester, revision, difficulty_level, publisher")
          .eq("id", contentId)
          .eq("student_id", targetStudentId)
          .maybeSingle();

        return NextResponse.json({
          details,
          metadata: bookData || null,
        });
      }

      return NextResponse.json({ details });
    } else if (contentType === "lecture") {
      const episodes = await getStudentLectureEpisodes(contentId, targetStudentId);
      
      if (includeMetadata) {
        // 강의 메타데이터 조회
        const { data: lectureData } = await supabase
          .from("lectures")
          .select("subject, semester, revision, difficulty_level, platform")
          .eq("id", contentId)
          .eq("student_id", targetStudentId)
          .maybeSingle();

        return NextResponse.json({
          episodes,
          metadata: lectureData || null,
        });
      }

      return NextResponse.json({ episodes });
    } else {
      return NextResponse.json(
        { error: "Invalid contentType. Must be 'book' or 'lecture'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[api/student-content-details] 조회 실패", error);
    return NextResponse.json(
      { error: "Failed to fetch content details" },
      { status: 500 }
    );
  }
}

