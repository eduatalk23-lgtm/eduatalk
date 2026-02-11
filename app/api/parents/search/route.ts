import { NextRequest } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

type SearchableParentRow = {
  id: string;
  name: string | null;
};

/**
 * 학부모 검색 API (이름 기반)
 * GET /api/parents/search?q=검색어
 *
 * Route Handler를 사용하여 서버 액션의 라우터 캐시 무효화 문제를 방지
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return apiUnauthorized("인증이 필요합니다.");
    }

    if (role !== "admin" && role !== "consultant") {
      return apiForbidden("접근 권한이 없습니다.");
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() || "";

    if (query.length < 2) {
      return apiBadRequest("최소 2글자 이상 입력해주세요.");
    }

    const supabase = await createSupabaseServerClient();

    const { data: parents, error } = await supabase
      .from("parent_users")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(10);

    if (error) {
      return apiSuccess([]);
    }

    const results = (parents ?? [])
      .filter((p: SearchableParentRow) => p.name !== null)
      .map((p: SearchableParentRow) => ({
        id: p.id,
        name: p.name,
        email: null,
      }));

    return apiSuccess(results);
  } catch (error) {
    return handleApiError(error, "[api/parents/search]");
  }
}
