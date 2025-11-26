import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { role } = await getCurrentUserRole();
    
    if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const contentType = searchParams.get("content_type");
    const contentId = searchParams.get("content_id");
    // 관리자/컨설턴트의 경우 student_id를 쿼리 파라미터로 받음 (캠프 모드)
    const studentId = searchParams.get("student_id");

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: "content_type과 content_id가 필요합니다." },
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
      // 학생 교재 조회 (master_content_id 확인)
      const { data: studentBook, error: bookError } = await supabase
        .from("books")
        .select("id, title, subject_category, master_content_id, total_pages")
        .eq("id", contentId)
        .eq("student_id", targetStudentId)
        .maybeSingle();

      if (bookError) {
        console.error("[student-content-info] 교재 조회 실패", bookError);
        return NextResponse.json({ error: "교재 조회 실패" }, { status: 500 });
      }

      if (!studentBook) {
        return NextResponse.json({ error: "교재를 찾을 수 없습니다." }, { status: 404 });
      }

      // master_content_id가 있으면 원본 마스터 콘텐츠에서 subject_category 조회
      if (studentBook.master_content_id) {
        const { data: masterBook } = await supabase
          .from("master_books")
          .select("subject_category")
          .eq("id", studentBook.master_content_id)
          .maybeSingle();

      if (masterBook?.subject_category) {
        return NextResponse.json({
          title: studentBook.title,
          subject_category: masterBook.subject_category,
          total_pages: studentBook.total_pages || masterBook.total_pages || null,
        });
      }
    }

    return NextResponse.json({
      title: studentBook.title,
      subject_category: studentBook.subject_category || null,
      total_pages: studentBook.total_pages || null,
    });
  } else if (contentType === "lecture") {
    // 학생 강의 조회 (master_content_id 확인)
    const { data: studentLecture, error: lectureError } = await supabase
      .from("lectures")
      .select("id, title, subject_category, master_content_id, duration")
      .eq("id", contentId)
      .eq("student_id", targetStudentId)
      .maybeSingle();

      if (lectureError) {
        console.error("[student-content-info] 강의 조회 실패", lectureError);
        return NextResponse.json({ error: "강의 조회 실패" }, { status: 500 });
      }

      if (!studentLecture) {
        return NextResponse.json({ error: "강의를 찾을 수 없습니다." }, { status: 404 });
      }

      // master_content_id가 있으면 원본 마스터 콘텐츠에서 subject_category 조회
      if (studentLecture.master_content_id) {
        const { data: masterLecture } = await supabase
          .from("master_lectures")
          .select("subject_category, total_episodes")
          .eq("id", studentLecture.master_content_id)
          .maybeSingle();

        if (masterLecture?.subject_category) {
          return NextResponse.json({
            title: studentLecture.title,
            subject_category: masterLecture.subject_category,
            total_episodes: masterLecture.total_episodes || null,
          });
        }
      }

      return NextResponse.json({
        title: studentLecture.title,
        subject_category: studentLecture.subject_category || null,
        total_episodes: null, // 학생 강의에는 episode 정보가 없을 수 있음
      });
    } else {
      return NextResponse.json(
        { error: "지원하지 않는 콘텐츠 타입입니다." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[student-content-info] 에러", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

