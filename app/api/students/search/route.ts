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
 * Phase 3: search_students_admin RPC 사용 (fallback: 기존 searchStudentsUnified)
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

    // RPC 호출 (마이그레이션 적용 후 타입 재생성 시 as unknown 제거)
    const detectedType = searchType || detectSearchType(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (adminClient.rpc as any)("search_students_admin", {
      p_tenant_id: tenantId,
      p_query: query.trim(),
      p_search_type: detectedType,
      p_division: division,
      p_grade: gradeNum && !isNaN(gradeNum) ? gradeNum : null,
      p_class: classFilter ?? null,
      p_status: null,
      p_is_active: isActive,
      p_exclude_ids: excludeIds,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      // RPC 미존재 시 fallback (Phase 5에서 제거)
      if (error.code === "42883" || error.message?.includes("does not exist")) {
        const { searchStudentsUnified } = await import("@/lib/data/studentSearch");
        const filters: Record<string, unknown> = {};
        if (grade) filters.grade = grade;
        if (classFilter) filters.class = classFilter;
        if (divisionParam) filters.division = divisionParam === "null" ? null : divisionParam as StudentDivision;
        if (isActiveParam !== null && isActiveParam !== undefined) filters.isActive = isActiveParam === "true";

        const result = await searchStudentsUnified({
          query,
          searchType: searchType || undefined,
          filters,
          limit,
          offset,
          role: role === "consultant" ? "admin" : role,
          excludeStudentIds: excludeIds ?? [],
          tenantId,
        });

        return apiSuccess({ students: result.students, total: result.total });
      }
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
