import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { searchMasterLectures } from "@/lib/data/contentMasters";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

/**
 * 마스터 강의 검색 API
 * GET /api/master-lectures?search=...&subject_category=...&semester=...&page=1&limit=20
 *
 * @returns
 * 성공: { success: true, data: { lectures, pagination: { total, page, limit, totalPages } } }
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
    
    // 검색 파라미터
    const search = searchParams.get("search") || undefined;
    const subject_category = searchParams.get("subject_category") || undefined;
    const semester = searchParams.get("semester") || undefined;
    const revision = searchParams.get("revision") || undefined;
    const difficulty_level = searchParams.get("difficulty_level") || undefined;
    const platform = searchParams.get("platform") || undefined;
    
    // 페이지네이션
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100 // 최대 100개
    );

    if (page < 1 || limit < 1) {
      return apiBadRequest("page와 limit은 1 이상이어야 합니다.");
    }

    const offset = (page - 1) * limit;

    // 검색 실행
    const result = await searchMasterLectures({
      search,
      limit,
      offset,
    });

    const totalPages = Math.ceil(result.total / limit);

    return apiSuccess({
      lectures: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    return handleApiError(error, "[api/master-lectures]");
  }
}

