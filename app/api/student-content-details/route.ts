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

// 캐시 설정: 콘텐츠 상세 정보는 자주 변경되지 않으므로 5분 캐시
export const revalidate = 300;

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
      // 병렬 처리: 상세 정보와 메타데이터를 동시에 조회
      // books 테이블 조회를 단일 쿼리로 통합 (total_pages, master_content_id, 메타데이터 필드 포함)
      const selectFields = includeMetadata
        ? "total_pages, master_content_id, subject, semester, revision, difficulty_level, publisher"
        : "total_pages, master_content_id";

      const [details, { data: studentBookRaw }] = await Promise.all([
        getStudentBookDetails(contentId, targetStudentId),
        supabase
          .from("books")
          .select(selectFields)
          .eq("id", contentId)
          .eq("student_id", targetStudentId)
          .maybeSingle(),
      ]);

      type StudentBook = {
        total_pages: number | null;
        master_content_id: string | null;
        subject?: string | null;
        semester?: string | null;
        revision?: string | null;
        difficulty_level?: string | null;
        publisher?: string | null;
      };

      const studentBook = studentBookRaw as StudentBook | null;
      let totalPages: number | null = studentBook?.total_pages || null;

      // master_content_id가 있으면 마스터에서도 조회 (fallback) - 조건부 병렬 처리
      const masterBookPromise = !totalPages && studentBook?.master_content_id
        ? supabase
            .from("master_books")
            .select("total_pages")
            .eq("id", studentBook.master_content_id)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const { data: masterBook } = await masterBookPromise;
      totalPages = totalPages || (masterBook as { total_pages: number | null } | null)?.total_pages || null;

      return apiSuccess({
        details,
        total_pages: totalPages,
        metadata: includeMetadata && studentBook
          ? {
              subject: studentBook.subject,
              semester: studentBook.semester,
              revision: studentBook.revision,
              difficulty_level: studentBook.difficulty_level,
              publisher: studentBook.publisher,
            }
          : undefined,
      });
    } else if (contentType === "lecture") {
      // 병렬 처리: episode 정보와 메타데이터를 동시에 조회
      // lectures 테이블 조회를 단일 쿼리로 통합 (master_content_id, total_episodes, 메타데이터 필드 포함)
      const selectFields = includeMetadata
        ? "master_content_id, total_episodes, subject, semester, revision, difficulty_level, platform"
        : "master_content_id, total_episodes";

      const [episodes, { data: studentLectureRaw }] = await Promise.all([
        getStudentLectureEpisodes(contentId, targetStudentId),
        supabase
          .from("lectures")
          .select(selectFields)
          .eq("id", contentId)
          .eq("student_id", targetStudentId)
          .maybeSingle(),
      ]);

      type StudentLecture = {
        master_content_id: string | null;
        total_episodes: number | null;
        subject?: string | null;
        semester?: string | null;
        revision?: string | null;
        difficulty_level?: string | null;
        platform?: string | null;
      };

      const studentLecture = studentLectureRaw as StudentLecture | null;
      let totalEpisodes: number | null = studentLecture?.total_episodes || null;

      // master_content_id가 있으면 마스터에서도 조회 (fallback) - 조건부 병렬 처리
      const masterLecturePromise = !totalEpisodes && studentLecture?.master_content_id
        ? supabase
            .from("master_lectures")
            .select("total_episodes")
            .eq("id", studentLecture.master_content_id)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const { data: masterLecture } = await masterLecturePromise;
      totalEpisodes = totalEpisodes || (masterLecture as { total_episodes: number | null } | null)?.total_episodes || null;

      return apiSuccess({
        episodes,
        total_episodes: totalEpisodes,
        metadata: includeMetadata && studentLecture
          ? {
              subject: studentLecture.subject,
              semester: studentLecture.semester,
              revision: studentLecture.revision,
              difficulty_level: studentLecture.difficulty_level,
              platform: studentLecture.platform,
            }
          : undefined,
      });
    } else {
      return apiBadRequest("지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요.");
    }
  } catch (error) {
    return handleApiError(error, "[api/student-content-details]");
  }
}
