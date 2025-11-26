import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  apiNotFound,
  handleApiError,
} from "@/lib/api";

type StudentContentInfoResponse = {
  title: string;
  subject_category: string | null;
  total_pages?: number | null;
  total_episodes?: number | null;
};

/**
 * 학생 콘텐츠 정보 조회 API
 * GET /api/student-content-info?content_type=book&content_id=...&student_id=...
 *
 * @returns
 * 성공: { success: true, data: { title, subject_category, ... } }
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
    const contentType = searchParams.get("content_type");
    const contentId = searchParams.get("content_id");
    const studentId = searchParams.get("student_id");

    if (!contentType || !contentId) {
      return apiBadRequest("content_type과 content_id가 필요합니다.");
    }

    // 관리자/컨설턴트의 경우 student_id가 필요
    if ((role === "admin" || role === "consultant") && !studentId) {
      return apiBadRequest("관리자/컨설턴트의 경우 student_id가 필요합니다.");
    }

    const supabase = await createSupabaseServerClient();
    const targetStudentId = role === "student" ? user.userId : studentId!;

    if (contentType === "book") {
      const { data: studentBook, error: bookError } = await supabase
        .from("books")
        .select("id, title, subject_category, master_content_id, total_pages")
        .eq("id", contentId)
        .eq("student_id", targetStudentId)
        .maybeSingle();

      if (bookError) {
        return handleApiError(bookError, "[api/student-content-info] 교재 조회 실패");
      }

      if (!studentBook) {
        return apiNotFound("교재를 찾을 수 없습니다.");
      }

      // master_content_id가 있으면 원본 마스터 콘텐츠에서 subject_category 조회
      if (studentBook.master_content_id) {
        const { data: masterBook } = await supabase
          .from("master_books")
          .select("subject_category, total_pages")
          .eq("id", studentBook.master_content_id)
          .maybeSingle();

        if (masterBook?.subject_category) {
          return apiSuccess<StudentContentInfoResponse>({
            title: studentBook.title,
            subject_category: masterBook.subject_category,
            total_pages: studentBook.total_pages || masterBook.total_pages || null,
          });
        }
      }

      return apiSuccess<StudentContentInfoResponse>({
        title: studentBook.title,
        subject_category: studentBook.subject_category || null,
        total_pages: studentBook.total_pages || null,
      });
    } else if (contentType === "lecture") {
      const { data: studentLecture, error: lectureError } = await supabase
        .from("lectures")
        .select("id, title, subject_category, master_content_id, duration")
        .eq("id", contentId)
        .eq("student_id", targetStudentId)
        .maybeSingle();

      if (lectureError) {
        return handleApiError(lectureError, "[api/student-content-info] 강의 조회 실패");
      }

      if (!studentLecture) {
        return apiNotFound("강의를 찾을 수 없습니다.");
      }

      // master_content_id가 있으면 원본 마스터 콘텐츠에서 subject_category 조회
      if (studentLecture.master_content_id) {
        const { data: masterLecture } = await supabase
          .from("master_lectures")
          .select("subject_category, total_episodes")
          .eq("id", studentLecture.master_content_id)
          .maybeSingle();

        if (masterLecture?.subject_category) {
          return apiSuccess<StudentContentInfoResponse>({
            title: studentLecture.title,
            subject_category: masterLecture.subject_category,
            total_episodes: masterLecture.total_episodes || null,
          });
        }
      }

      return apiSuccess<StudentContentInfoResponse>({
        title: studentLecture.title,
        subject_category: studentLecture.subject_category || null,
        total_episodes: null,
      });
    } else {
      return apiBadRequest("지원하지 않는 콘텐츠 타입입니다.");
    }
  } catch (error) {
    return handleApiError(error, "[api/student-content-info]");
  }
}
