"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { detectSearchType } from "@/lib/data/studentSearch";
import { logActionError } from "@/lib/utils/serverActionLogger";

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
 * search_students_admin RPC를 사용하여 DB 1회 쿼리로 처리
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
