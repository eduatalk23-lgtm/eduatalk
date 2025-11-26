import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterBookById, getMasterLectureById } from "@/lib/data/contentMasters";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { role } = await getCurrentUserRole();
    
    if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const contentType = searchParams.get("content_type");
    const contentId = searchParams.get("content_id");

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: "content_type and content_id are required" },
        { status: 400 }
      );
    }

    if (contentType === "book") {
      const { book } = await getMasterBookById(contentId);
      if (!book) {
        return NextResponse.json({ error: "Book not found" }, { status: 404 });
      }
      return NextResponse.json({
        total_pages: book.total_pages,
        total_episodes: null,
      });
    } else if (contentType === "lecture") {
      const { lecture } = await getMasterLectureById(contentId);
      if (!lecture) {
        return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
      }
      return NextResponse.json({
        total_pages: null,
        total_episodes: lecture.total_episodes,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid content_type" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[master-content-info] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

