import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStudentBookDetails,
  getStudentLectureEpisodes,
  getMasterBookById,
  getMasterLectureById,
} from "@/lib/data/contentMasters";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";
import { createTypedSingleQuery } from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";

// 동적 렌더링 설정: 인증이 필요하므로 동적 렌더링 필수
export const dynamic = 'force-dynamic';

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
      const selectFields = includeMetadata
        ? "total_pages, master_content_id, subject, semester, revision, difficulty_level, difficulty_level_id, publisher"
        : "total_pages, master_content_id";

      const [details, studentBook] = await Promise.all([
        getStudentBookDetails(contentId, targetStudentId),
        createTypedSingleQuery(
          async () => {
            const result = await supabase
              .from("books")
              .select(selectFields)
              .eq("id", contentId)
              .eq("student_id", targetStudentId)
              .maybeSingle();
            return { data: result.data, error: result.error };
          },
          {
            context: "[api/student-content-details] books 조회",
            defaultValue: null,
          }
        ),
      ]);

      type StudentBook = {
        total_pages: number | null;
        master_content_id: string | null;
        subject?: string | null;
        semester?: string | null;
        revision?: string | null;
        difficulty_level?: string | null;
        difficulty_level_id?: string | null;
        publisher?: string | null;
      };

      const studentBookData = studentBook as StudentBook | null;
      let totalPages: number | null = studentBookData?.total_pages || null;

      // master_content_id가 있으면 마스터에서도 조회 (fallback) - 조건부 병렬 처리
      if (!totalPages && studentBookData?.master_content_id) {
        const masterBookResult = await getMasterBookById(studentBookData.master_content_id);
        totalPages = masterBookResult.book?.total_pages || null;
      }

      return apiSuccess({
        details,
        total_pages: totalPages,
        metadata: includeMetadata && studentBookData
          ? {
              subject: studentBookData.subject,
              semester: studentBookData.semester,
              revision: studentBookData.revision,
              difficulty_level: studentBookData.difficulty_level,
              difficulty_level_id: studentBookData.difficulty_level_id,
              publisher: studentBookData.publisher,
            }
          : undefined,
      });
    } else if (contentType === "lecture") {
      // 병렬 처리: episode 정보와 메타데이터를 동시에 조회
      const selectFields = includeMetadata
        ? "master_content_id, total_episodes, subject, semester, revision, difficulty_level, difficulty_level_id, platform"
        : "master_content_id, total_episodes";

      const [episodes, studentLecture] = await Promise.all([
        getStudentLectureEpisodes(contentId, targetStudentId),
        createTypedSingleQuery(
          async () => {
            const result = await supabase
              .from("lectures")
              .select(selectFields)
              .eq("id", contentId)
              .eq("student_id", targetStudentId)
              .maybeSingle();
            return { data: result.data, error: result.error };
          },
          {
            context: "[api/student-content-details] lectures 조회",
            defaultValue: null,
          }
        ),
      ]);

      type StudentLecture = {
        master_content_id: string | null;
        total_episodes: number | null;
        subject?: string | null;
        semester?: string | null;
        revision?: string | null;
        difficulty_level?: string | null;
        difficulty_level_id?: string | null;
        platform?: string | null;
      };

      const studentLectureData = studentLecture as StudentLecture | null;
      let totalEpisodes: number | null = studentLectureData?.total_episodes || null;

      // master_content_id가 있으면 마스터에서도 조회 (fallback) - 조건부 병렬 처리
      if (!totalEpisodes && studentLectureData?.master_content_id) {
        const masterLectureResult = await getMasterLectureById(studentLectureData.master_content_id);
        totalEpisodes = masterLectureResult.lecture?.total_episodes || null;
      }

      return apiSuccess({
        episodes,
        total_episodes: totalEpisodes,
        metadata: includeMetadata && studentLectureData
          ? {
              subject: studentLectureData.subject,
              semester: studentLectureData.semester,
              revision: studentLectureData.revision,
              difficulty_level: studentLectureData.difficulty_level,
              difficulty_level_id: studentLectureData.difficulty_level_id,
              platform: studentLectureData.platform,
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
