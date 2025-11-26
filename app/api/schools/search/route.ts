import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

type School = {
  id: string;
  name: string;
  type: string | null;
  region: string | null;
};

/**
 * 학교 검색 API
 * GET /api/schools/search?q=검색어&type=대학교
 *
 * @returns
 * 성공: { success: true, data: { schools: School[] } }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "";
    const name = searchParams.get("name");

    const supabase = await createSupabaseServerClient();

    // ID로 조회
    if (id) {
      const { data: school, error } = await supabase
        .from("schools")
        .select("id, name, type, region")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        return handleApiError(error, "[api/schools/search] ID 조회 실패");
      }

      return apiSuccess({ schools: school ? [school] : [] });
    }

    // 학교명으로 직접 조회
    if (name) {
      const { data: schools, error } = await supabase
        .from("schools")
        .select("id, name, type, region")
        .eq("name", name)
        .limit(1);

      if (error) {
        return handleApiError(error, "[api/schools/search] 이름 조회 실패");
      }

      return apiSuccess({ schools: (schools as School[]) || [] });
    }

    // 타입 검증
    if (type && !["중학교", "고등학교", "대학교"].includes(type)) {
      return apiBadRequest("유효하지 않은 학교 타입입니다.", { validTypes: ["중학교", "고등학교", "대학교"] });
    }

    // 검색 쿼리
    let schoolsQuery = supabase
      .from("schools")
      .select("id, name, type, region")
      .order("name", { ascending: true })
      .limit(50);

    if (query.trim()) {
      schoolsQuery = schoolsQuery.ilike("name", `%${query.trim()}%`);
    }

    if (type) {
      schoolsQuery = schoolsQuery.eq("type", type);
    }

    const { data: schools, error } = await schoolsQuery;

    if (error) {
      return handleApiError(error, "[api/schools/search] 검색 실패");
    }

    return apiSuccess({ schools: (schools as School[]) || [] });
  } catch (error) {
    return handleApiError(error, "[api/schools/search] 오류");
  }
}
