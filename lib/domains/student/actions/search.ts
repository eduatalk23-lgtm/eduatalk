"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { detectSearchType } from "@/lib/data/studentSearch";
import { logActionError, logActionWarn } from "@/lib/utils/serverActionLogger";

export type StudentSearchItem = {
  id: string;
  name: string | null;
  grade: number | null;
  class: string | null;
  phone: string | null;
  division: string | null;
  school_name: string | null;
  gender: "남" | "여" | null;
  is_active: boolean;
  status: string | null;
  has_email: boolean;
  profile_image_url: string | null;
};

export type StudentSearchFilters = {
  division?: "고등부" | "중등부" | "졸업";
  grade?: string;
  status?: "enrolled" | "on_leave" | "graduated" | "transferred";
  isActive?: boolean;
};

export type SearchStudentsResult = {
  success: boolean;
  students: StudentSearchItem[];
  total: number;
  error?: string;
};

/**
 * 학생 검색 서버 액션 (클라이언트 검색 패널용)
 * 쿼리가 없으면 최근 등록순 전체 조회 (limit 50)
 *
 * Phase 3: search_students_admin RPC 사용 (fallback: 기존 로직)
 */
export async function searchStudentsAction(
  query: string,
  filters?: StudentSearchFilters
): Promise<SearchStudentsResult> {
  try {
    await requireAdminOrConsultant();
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId ?? null;

    if (!tenantId) {
      return { success: false, students: [], total: 0, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: true,
    });

    if (!adminClient) {
      return { success: false, students: [], total: 0, error: "클라이언트 초기화 실패" };
    }

    // RPC 호출 시도
    const searchType = query.trim() ? detectSearchType(query) : "name";
    const gradeNum = filters?.grade ? parseInt(filters.grade, 10) : null;

    const { data, error } = await adminClient.rpc("search_students_admin", {
      p_tenant_id: tenantId,
      p_query: query.trim(),
      p_search_type: searchType,
      p_division: filters?.division ?? undefined,
      p_grade: gradeNum && !isNaN(gradeNum) ? gradeNum : undefined,
      p_class: undefined,
      p_status: filters?.status ?? undefined,
      p_is_active: filters?.isActive ?? undefined,
      p_exclude_ids: undefined,
      p_limit: 50,
      p_offset: 0,
    });

    if (error) {
      // RPC 함수가 아직 없는 경우 (마이그레이션 미적용) → fallback
      if (error.code === "42883" || error.message?.includes("does not exist")) {
        logActionWarn(
          "student.search",
          "search_students_admin RPC 미존재, fallback 사용"
        );
        return searchStudentsActionFallback(query, filters, tenantId, adminClient);
      }
      logActionError("student.search", error.message);
      return { success: false, students: [], total: 0, error: error.message };
    }

    const rows = data as Array<Record<string, unknown>> | null;
    if (!rows || rows.length === 0) {
      return { success: true, students: [], total: 0 };
    }

    const total = Number(rows[0]?.total_count ?? 0);
    const students: StudentSearchItem[] = rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string | null) ?? null,
      grade: (r.grade as number | null) ?? null,
      class: (r.class as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      division: (r.division as string | null) ?? null,
      school_name: (r.school_name as string | null) ?? null,
      gender: (r.gender as "남" | "여" | null) ?? null,
      is_active: (r.is_active as boolean | null) ?? true,
      status: (r.status as string | null) ?? null,
      has_email: (r.has_email as boolean | null) ?? false,
      profile_image_url: (r.profile_image_url as string | null) ?? null,
    }));

    return { success: true, students, total };
  } catch (error) {
    return {
      success: false,
      students: [],
      total: 0,
      error: error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.",
    };
  }
}

/**
 * Fallback: 기존 로직 (search_students_admin RPC가 없을 때)
 * Phase 5에서 제거 예정
 */
async function searchStudentsActionFallback(
  query: string,
  filters: StudentSearchFilters | undefined,
  tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any
): Promise<SearchStudentsResult> {
  try {
    if (query.trim()) {
      const { searchStudentsUnified } = await import("@/lib/data/studentSearch");
      const result = await searchStudentsUnified({
        query,
        limit: 50,
        offset: 0,
        role: "admin",
        tenantId,
        filters: {
          division: filters?.division ?? undefined,
          grade: filters?.grade,
          status: filters?.status,
          isActive: filters?.isActive,
        },
      });

      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const adminAuthClient = createSupabaseAdminClient();
      const emailMap = new Map<string, boolean>();
      if (adminAuthClient) {
        try {
          const { data: authData } = await adminAuthClient.auth.admin.listUsers({ perPage: 1000 });
          if (authData?.users) {
            const idSet = new Set(result.students.map((s) => s.id));
            for (const u of authData.users) {
              if (idSet.has(u.id)) emailMap.set(u.id, !!u.email);
            }
          }
        } catch { /* ignore */ }
      }

      return {
        success: true,
        total: result.total,
        students: result.students.map((s) => ({
          id: s.id,
          name: s.name,
          grade: s.grade,
          class: s.class,
          phone: s.phone,
          division: s.division,
          school_name: s.school_name ?? null,
          gender: s.gender ?? null,
          is_active: s.is_active,
          status: s.status,
          has_email: emailMap.get(s.id) ?? false,
          profile_image_url: s.profile_image_url ?? null,
        })),
      };
    }

    // 쿼리 없으면 전체 조회
    let baseQuery = adminClient
      .from("students")
      .select("id, name, grade, class, division, is_active, status, school_name, phone, gender, profile_image_url", { count: "exact" })
      .order("created_at", { ascending: false })
      .eq("tenant_id", tenantId)
      .limit(50);

    if (filters?.division) baseQuery = baseQuery.eq("division", filters.division);
    if (filters?.grade) {
      const g = parseInt(filters.grade, 10);
      if (!isNaN(g)) baseQuery = baseQuery.eq("grade", g);
    }
    if (filters?.status) baseQuery = baseQuery.eq("status", filters.status);
    if (filters?.isActive !== undefined) baseQuery = baseQuery.eq("is_active", filters.isActive);

    const { data, count, error } = await baseQuery;
    if (error) return { success: false, students: [], total: 0, error: error.message };

    return {
      success: true,
      total: count ?? 0,
      students: (data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        name: (s.name as string | null) ?? null,
        grade: (s.grade as number | null) ?? null,
        class: (s.class as string | null) ?? null,
        phone: (s.phone as string | null) ?? null,
        division: (s.division as string | null) ?? null,
        school_name: (s.school_name as string | null) ?? null,
        gender: (s.gender as "남" | "여" | null) ?? null,
        is_active: (s.is_active as boolean | null) ?? true,
        status: (s.status as string | null) ?? null,
        has_email: false,
        profile_image_url: (s.profile_image_url as string | null) ?? null,
      })),
    };
  } catch (error) {
    return {
      success: false,
      students: [],
      total: 0,
      error: error instanceof Error ? error.message : "fallback 검색 실패",
    };
  }
}
