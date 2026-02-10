"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { searchStudentsUnified } from "@/lib/data/studentSearch";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";

export type StudentSearchItem = {
  id: string;
  name: string | null;
  grade: number | null;
  class: string | null;
  phone: string | null;
  division: string | null;
  school_name: string | null;
  gender: "남" | "여" | null;
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
  query: string
): Promise<SearchStudentsResult> {
  try {
    await requireAdminOrConsultant();
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId ?? null;

    // 쿼리가 있으면 통합 검색 사용
    if (query.trim()) {
      const result = await searchStudentsUnified({
        query,
        limit: 50,
        offset: 0,
        role: "admin",
        tenantId,
      });

      return {
        success: true,
        students: result.students.map((s) => ({
          id: s.id,
          name: s.name,
          grade: s.grade,
          class: s.class,
          phone: s.phone,
          division: s.division,
          school_name: s.school_name ?? null,
          gender: s.gender ?? null,
        })),
        total: result.total,
      };
    }

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
      .select("id, name, grade, class, division, is_active, school_name", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(50);

    if (tenantId) {
      baseQuery = baseQuery.eq("tenant_id", tenantId);
    }

    const { data, count, error } = await baseQuery;

    if (error) {
      return { success: false, students: [], total: 0, error: error.message };
    }

    // 연락처 + 성별 정보 일괄 조회
    const studentIds = (data ?? []).map((s: { id: string }) => s.id);
    let phoneMap = new Map<string, string | null>();
    let genderMap = new Map<string, string | null>();

    if (studentIds.length > 0) {
      const { getStudentPhonesBatch } = await import("@/lib/utils/studentPhoneUtils");
      const [phoneDataList, genderResult] = await Promise.all([
        getStudentPhonesBatch(studentIds),
        adminClient.from("student_profiles").select("id, gender").in("id", studentIds),
      ]);
      phoneMap = new Map(phoneDataList.map((p) => [p.id, p.phone ?? null]));
      genderMap = new Map(
        (genderResult.data ?? []).map((p: { id: string; gender: string | null }) => [p.id, p.gender])
      );
    }

    return {
      success: true,
      students: (data ?? []).map((s: { id: string; name: string | null; grade: number | null; class: string | null; division: string | null; school_name: string | null }) => ({
        id: s.id,
        name: s.name,
        grade: s.grade,
        class: s.class,
        phone: phoneMap.get(s.id) ?? null,
        division: s.division,
        school_name: s.school_name ?? null,
        gender: (genderMap.get(s.id) as "남" | "여" | null) ?? null,
      })),
      total: count ?? 0,
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
