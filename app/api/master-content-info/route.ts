import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterBookById, getMasterLectureById } from "@/lib/data/contentMasters";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  apiNotFound,
  handleApiError,
} from "@/lib/api";

type MasterContentInfoResponse = {
  total_pages: number | null;
  total_episodes: number | null;
};

/**
 * 마스터 콘텐츠 정보 조회 API
 * GET /api/master-content-info?content_type=book&content_id=...
 *
 * @returns
 * 성공: { success: true, data: { total_pages, total_episodes } }
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

    if (!contentType || !contentId) {
      return apiBadRequest("content_type과 content_id가 필요합니다.");
    }

    if (contentType === "book") {
      const { book } = await getMasterBookById(contentId);
      if (!book) {
        return apiNotFound("교재를 찾을 수 없습니다.");
      }
      return apiSuccess<MasterContentInfoResponse>({
        total_pages: book.total_pages,
        total_episodes: null,
      });
    } else if (contentType === "lecture") {
      const { lecture } = await getMasterLectureById(contentId);
      if (!lecture) {
        return apiNotFound("강의를 찾을 수 없습니다.");
      }
      return apiSuccess<MasterContentInfoResponse>({
        total_pages: null,
        total_episodes: lecture.total_episodes,
      });
    } else {
      return apiBadRequest("지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요.");
    }
  } catch (error) {
    return handleApiError(error, "[api/master-content-info]");
  }
}
