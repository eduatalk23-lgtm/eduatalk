import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { fetchAllStudentContents } from "@/lib/data/planContents";
import type { ContentItem } from "@/lib/data/planContents";

export const dynamic = "force-dynamic";

/**
 * 학생 콘텐츠 목록 조회 API
 * GET /api/student-contents
 *
 * @returns
 * 성공: { success: true, data: { books: ContentItem[], lectures: ContentItem[], custom: ContentItem[] } }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return apiUnauthorized();
    }

    const data = await fetchAllStudentContents(user.userId);

    return apiSuccess<{
      books: ContentItem[];
      lectures: ContentItem[];
      custom: ContentItem[];
    }>(data);
  } catch (error) {
    return handleApiError(error, "[api/student-contents] 오류");
  }
}

