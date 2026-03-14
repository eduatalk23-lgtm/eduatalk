import { NextRequest } from "next/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { detectSearchType } from "@/lib/data/studentSearch";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import type { StudentDivision } from "@/lib/constants/students";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

/**
 * 학생 통합 검색 API
 * GET /api/students/search
 *
 * search_students_admin RPC를 사용하여 DB 1회 쿼리로 처리
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, role } = await getCachedUserRole();

    if (!userId || !role) {
      return apiUnauthorized("인증이 필요합니다.");
    }

    if (role !== "admin" && role !== "parent" && role !== "consultant") {
      return apiForbidden("접근 권한이 없습니다.");
    }

    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId ?? null;

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const searchType = searchParams.get("type") as "name" | "phone" | "all" | null;
    const grade = searchParams.get("grade") || undefined;
    const classFilter = searchParams.get("class") || undefined;
    const divisionParam = searchParams.get("division") || undefined;
    const isActiveParam = searchParams.get("isActive");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const excludeIdsParam = searchParams.get("excludeIds");

    if (!query.trim()) {
      return apiBadRequest("검색어를 입력해주세요.");
    }

    if (!tenantId) {
      return apiBadRequest("테넌트 정보를 찾을 수 없습니다.");
    }

    const limit = Math.min(limitParam ? parseInt(limitParam, 10) : 50, 100);
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    const excludeIds = excludeIdsParam
      ? excludeIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : null;

    const gradeNum = grade ? parseInt(grade, 10) : null;
    const isActive = isActiveParam !== null && isActiveParam !== undefined
      ? isActiveParam === "true"
      : null;
    const division = divisionParam === "null"
      ? null
      : (divisionParam as StudentDivision | undefined) ?? null;

    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: true,
    });

    if (!adminClient) {
      return apiBadRequest("클라이언트 초기화 실패");
    }

    const detectedType = searchType || detectSearchType(query);
    const { data, error } = await adminClient.rpc("search_students_admin", {
      p_tenant_id: tenantId,
      p_query: query.trim(),
      p_search_type: detectedType,
      p_division: division ?? undefined,
      p_grade: gradeNum && !isNaN(gradeNum) ? gradeNum : undefined,
      p_class: classFilter ?? undefined,
      p_status: undefined,
      p_is_active: isActive ?? undefined,
      p_exclude_ids: excludeIds ?? undefined,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw error;
    }

    const rows = data as Array<Record<string, unknown>> | null;
    const total = rows?.[0] ? Number(rows[0].total_count ?? 0) : 0;

    return apiSuccess({
      students: (rows ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        grade: r.grade,
        class: r.class,
        division: r.division,
        phone: r.phone,
        mother_phone: r.mother_phone ?? null,
        father_phone: r.father_phone ?? null,
        school_name: r.school_name ?? null,
        gender: r.gender ?? null,
        is_active: r.is_active ?? true,
        status: r.status ?? null,
        has_email: r.has_email ?? false,
        matched_field: r.matched_field ?? null,
        profile_image_url: r.profile_image_url ?? null,
      })),
      total,
    });
  } catch (error) {
    return handleApiError(error, "[api/students/search]");
  }
}
