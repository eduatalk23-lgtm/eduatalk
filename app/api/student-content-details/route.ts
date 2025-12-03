import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentBookDetails, getStudentLectureEpisodes } from "@/lib/data/contentMasters";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

/**
 * 학생 콘텐츠 상세 정보 조회 API
 * GET /api/student-content-details?contentType=book&contentId=...&student_id=...
 *
 * @returns
 * 성공: { success: true, data: { details/episodes, metadata? } }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { role } = await getCurrentUserRole();

    if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
      return apiUnauthorized();
    }

    const searchParams = request.nextUrl.searchParams;
    const contentType = searchParams.get("contentType");
    const contentId = searchParams.get("contentId");
    const includeMetadata = searchParams.get("includeMetadata") === "true";
    const studentId = searchParams.get("student_id");

    if (!contentType || !contentId) {
      return apiBadRequest("contentType과 contentId가 필요합니다.");
    }

    // 관리자/컨설턴트의 경우 student_id가 필요
    if ((role === "admin" || role === "consultant") && !studentId) {
      return apiBadRequest("관리자/컨설턴트의 경우 student_id가 필요합니다.");
    }

    const supabase = await createSupabaseServerClient();
    const targetStudentId = role === "student" ? user.userId : studentId!;

    if (contentType === "book") {
      const details = await getStudentBookDetails(contentId, targetStudentId);

      // 총 페이지수 조회
      const { data: studentBook } = await supabase
        .from("books")
        .select("total_pages, master_content_id")
        .eq("id", contentId)
        .eq("student_id", targetStudentId)
        .maybeSingle();

      let totalPages: number | null = studentBook?.total_pages || null;

      // master_content_id가 있으면 마스터에서도 조회 (fallback)
      if (!totalPages && studentBook?.master_content_id) {
        const { data: masterBook } = await supabase
          .from("master_books")
          .select("total_pages")
          .eq("id", studentBook.master_content_id)
          .maybeSingle();
        totalPages = masterBook?.total_pages || null;
      }

      if (includeMetadata) {
        const { data: bookData } = await supabase
          .from("books")
          .select("subject, semester, revision, difficulty_level, publisher")
          .eq("id", contentId)
          .eq("student_id", targetStudentId)
          .maybeSingle();

        return apiSuccess({
          details,
          total_pages: totalPages,
          metadata: bookData || null,
        });
      }

      return apiSuccess({ 
        details,
        total_pages: totalPages,
      });
    } else if (contentType === "lecture") {
      const episodes = await getStudentLectureEpisodes(contentId, targetStudentId);

      // 총 회차 조회
      const { data: studentLecture } = await supabase
        .from("lectures")
        .select("master_content_id")
        .eq("id", contentId)
        .eq("student_id", targetStudentId)
        .maybeSingle();

      let totalEpisodes: number | null = null;

      // master_content_id가 있으면 마스터에서 조회
      if (studentLecture?.master_content_id) {
        const { data: masterLecture } = await supabase
          .from("master_lectures")
          .select("total_episodes")
          .eq("id", studentLecture.master_content_id)
          .maybeSingle();
        totalEpisodes = masterLecture?.total_episodes || null;
      }

      if (includeMetadata) {
        const { data: lectureData } = await supabase
          .from("lectures")
          .select("subject, semester, revision, difficulty_level, platform")
          .eq("id", contentId)
          .eq("student_id", targetStudentId)
          .maybeSingle();

        return apiSuccess({
          episodes,
          total_episodes: totalEpisodes,
          metadata: lectureData || null,
        });
      }

      return apiSuccess({ 
        episodes,
        total_episodes: totalEpisodes,
      });
    } else {
      return apiBadRequest("지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요.");
    }
  } catch (error) {
    return handleApiError(error, "[api/student-content-details]");
  }
}
