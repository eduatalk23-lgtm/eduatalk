"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { searchStudentsUnified } from "@/lib/data/studentSearch";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
 */
export async function searchStudentsAction(
  query: string,
  filters?: StudentSearchFilters
): Promise<SearchStudentsResult> {
  try {
    await requireAdminOrConsultant();
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId ?? null;

    type RawStudent = {
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
      profile_image_url: string | null;
    };

    let rawStudents: RawStudent[];
    let total: number;

    if (query.trim()) {
      // 쿼리가 있으면 통합 검색 사용
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

      rawStudents = result.students.map((s) => ({
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
        profile_image_url: s.profile_image_url ?? null,
      }));
      total = result.total;
    } else {
      // 쿼리가 없으면 전체 조회 (최근 등록순)
      const adminClient = await getSupabaseClientForRLSBypass({
        forceAdmin: true,
        fallbackToServer: true,
      });

      if (!adminClient) {
        return { success: false, students: [], total: 0, error: "클라이언트 초기화 실패" };
      }

      let baseQuery = adminClient
        .from("students")
        .select("id, name, grade, class, division, is_active, status, school_name, phone, gender, profile_image_url", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(50);

      if (tenantId) {
        baseQuery = baseQuery.eq("tenant_id", tenantId);
      }

      // 서버 사이드 필터 적용
      if (filters?.division) {
        baseQuery = baseQuery.eq("division", filters.division);
      }
      if (filters?.grade) {
        const gradeNum = parseInt(filters.grade, 10);
        if (!isNaN(gradeNum)) {
          baseQuery = baseQuery.eq("grade", gradeNum);
        }
      }
      if (filters?.status) {
        baseQuery = baseQuery.eq("status", filters.status);
      }
      if (filters?.isActive !== undefined) {
        baseQuery = baseQuery.eq("is_active", filters.isActive);
      }

      const { data, count, error } = await baseQuery;

      if (error) {
        return { success: false, students: [], total: 0, error: error.message };
      }

      rawStudents = (data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        name: s.name as string | null,
        grade: s.grade as number | null,
        class: s.class as string | null,
        phone: (s.phone as string | null) ?? null,
        division: s.division as string | null,
        school_name: (s.school_name as string | null) ?? null,
        gender: (s.gender as "남" | "여" | null) ?? null,
        is_active: (s.is_active as boolean | null) ?? true,
        status: (s.status as string | null) ?? null,
        profile_image_url: (s.profile_image_url as string | null) ?? null,
      }));
      total = count ?? 0;
    }

    // 이메일 연결 상태 일괄 조회
    const emailMap = await fetchEmailStatusMap(rawStudents.map((s) => s.id));

    return {
      success: true,
      students: rawStudents.map((s) => ({
        ...s,
        has_email: emailMap.get(s.id) ?? false,
      })),
      total,
    };
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
 * 학생 ID 목록에 대한 이메일 연결 상태 조회
 * auth.users의 email 존재 여부를 확인
 */
async function fetchEmailStatusMap(
  studentIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (studentIds.length === 0) return map;

  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) return map;

    const { data, error } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error || !data?.users) return map;

    const studentIdSet = new Set(studentIds);
    for (const user of data.users) {
      if (studentIdSet.has(user.id)) {
        map.set(user.id, !!user.email);
      }
    }
  } catch {
    // 이메일 상태 조회 실패 시 무시 (검색 결과에는 영향 없음)
  }

  return map;
}
