import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getMasterBookById, getMasterLectureById } from "@/lib/data/contentMasters";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const contentType = searchParams.get("contentType");
    const contentId = searchParams.get("contentId");
    const includeMetadata = searchParams.get("includeMetadata") === "true";

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: "contentType and contentId are required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    if (contentType === "book") {
      const { details } = await getMasterBookById(contentId);
      
      if (includeMetadata) {
        // 마스터 교재 메타데이터 조회
        const { data: bookData } = await supabase
          .from("master_books")
          .select("subject, semester, revision, difficulty_level, publisher")
          .eq("id", contentId)
          .maybeSingle();

        return NextResponse.json({
          details,
          metadata: bookData || null,
        });
      }

      return NextResponse.json({ details });
    } else if (contentType === "lecture") {
      const { episodes } = await getMasterLectureById(contentId);
      
      if (includeMetadata) {
        // 마스터 강의 메타데이터 조회
        const { data: lectureData } = await supabase
          .from("master_lectures")
          .select("subject, semester, revision, difficulty_level, platform")
          .eq("id", contentId)
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
    console.error("[api/master-content-details] 조회 실패", error);
    return NextResponse.json(
      { error: "Failed to fetch content details" },
      { status: 500 }
    );
  }
}

