/**
 * 학생 검색 통합 함수
 * 
 * 이름 검색과 연락처 교차 검색(4자리 부분 매칭)을 서버 사이드로 처리합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseClientForRLSBypass, type SupabaseClientForStudentQuery } from "@/lib/supabase/clientSelector";
import type { StudentDivision } from "@/lib/constants/students";

export type StudentSearchParams = {
  query: string;
  searchType?: "name" | "phone" | "all";
  filters?: {
    grade?: string;
    class?: string;
    division?: StudentDivision | null;
    isActive?: boolean;
  };
  limit?: number;
  offset?: number;
  role?: "admin" | "parent";
  excludeStudentIds?: string[];
  tenantId?: string | null;
};

export type StudentSearchResult = {
  id: string;
  name: string | null;
  grade: string | null;
  class: string | null;
  division: StudentDivision | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  matched_field: "name" | "phone" | "mother_phone" | "father_phone" | null;
};

export type StudentSearchResponse = {
  students: StudentSearchResult[];
  total: number;
};

/**
 * 검색 타입을 자동 감지합니다.
 * 
 * @param query - 검색어
 * @returns 검색 타입 ("name" | "phone" | "all")
 */
export function detectSearchType(query: string): "name" | "phone" | "all" {
  const trimmedQuery = query.trim();
  
  if (!trimmedQuery) {
    return "name";
  }
  
  // 숫자만 추출 (하이픈, 공백 제거)
  const normalizedQuery = trimmedQuery.replace(/[-\s]/g, "");
  
  // 숫자만 추출하여 4자리 이상인지 확인
  const digitsOnly = normalizedQuery.replace(/\D/g, "");
  const hasEnoughDigits = digitsOnly.length >= 4;
  
  // 한글이 포함되어 있는지 확인
  const hasKorean = /[가-힣]/.test(trimmedQuery);
  
  // 숫자만 4자리 이상이고 한글이 없는 경우 → 연락처 검색
  const isPhoneSearch = /^\d{4,}$/.test(normalizedQuery);
  
  // 숫자와 한글이 모두 포함된 경우 → 전체 검색
  if (hasEnoughDigits && hasKorean) {
    return "all";
  }
  
  // 숫자만 4자리 이상인 경우 → 연락처 검색
  if (isPhoneSearch) {
    return "phone";
  }
  
  // 한글이 포함된 경우 → 이름 검색
  if (hasKorean) {
    return "name";
  }
  
  // 기본값: 이름 검색으로 처리
  return "name";
}

/**
 * baseQuery 빌더 함수
 * 필터 조건을 적용한 기본 쿼리를 생성합니다.
 */
function buildBaseQuery(
  adminClient: SupabaseClientForStudentQuery | null,
  filters: StudentSearchParams["filters"],
  excludeStudentIds: string[],
  tenantId?: string | null
) {
  if (!adminClient) {
    throw new Error("Admin Client가 필요합니다.");
  }
  let baseQuery = adminClient
    .from("students")
    .select("id, name, grade, class, division, is_active");

  // tenant_id 필터 (있는 경우)
  if (tenantId) {
    baseQuery = baseQuery.eq("tenant_id", tenantId);
  }

  // 필터 적용
  if (filters?.grade) {
    baseQuery = baseQuery.eq("grade", filters.grade);
  }
  if (filters?.class) {
    baseQuery = baseQuery.eq("class", filters.class);
  }
  if (filters?.division !== undefined) {
    if (filters.division === null) {
      baseQuery = baseQuery.is("division", null);
    } else {
      baseQuery = baseQuery.eq("division", filters.division);
    }
  }
  if (filters?.isActive !== undefined) {
    baseQuery = baseQuery.eq("is_active", filters.isActive);
  }

  // 제외할 학생 ID 필터
  if (excludeStudentIds.length > 0) {
    baseQuery = baseQuery.not("id", "in", `(${excludeStudentIds.join(",")})`);
  }

  return baseQuery;
}

/**
 * 연락처 검색으로 매칭된 학생 ID를 수집합니다.
 */
async function collectPhoneMatchedIds(
  adminClient: SupabaseClientForStudentQuery | null,
  normalizedQuery: string
): Promise<Set<string>> {
  if (!adminClient) {
    return new Set<string>();
  }
  const phoneMatchedIds = new Set<string>();

  // student_profiles에서 연락처 검색
  const { data: profiles, error: profilesError } = await adminClient
    .from("student_profiles")
    .select("id, phone, mother_phone, father_phone")
    .or(
      `phone.ilike.%${normalizedQuery}%,mother_phone.ilike.%${normalizedQuery}%,father_phone.ilike.%${normalizedQuery}%`
    );

  if (profilesError) {
    console.error("[studentSearch] student_profiles 조회 실패", profilesError);
  }

  // student_profiles에서 매칭된 ID 수집
  if (profiles) {
    profiles.forEach((profile) => {
      if (
        profile.phone?.includes(normalizedQuery) ||
        profile.mother_phone?.includes(normalizedQuery) ||
        profile.father_phone?.includes(normalizedQuery)
      ) {
        phoneMatchedIds.add(profile.id);
      }
    });
  }

  // parent_student_links를 통해 연결된 학부모 연락처 검색
  try {
    const { data: links, error: linksError } = await adminClient
      .from("parent_student_links")
      .select("student_id, relation, parent_id")
      .limit(1000); // 성능을 위해 제한

    if (!linksError && links && links.length > 0) {
      const parentIds = Array.from(
        new Set(links.map((link: { parent_id: string }) => link.parent_id))
      );

      // auth.users에서 phone 조회
      const adminAuthClient = createSupabaseAdminClient();
      if (adminAuthClient && parentIds.length > 0) {
        try {
          const { data: authUsers, error: authError } =
            await adminAuthClient.auth.admin.listUsers();

          if (!authError && authUsers?.users) {
            // 검색어와 일치하는 phone을 가진 학부모 찾기
            const matchingParentIds = new Set<string>();
            authUsers.users.forEach((user) => {
              if (user.phone && user.phone.includes(normalizedQuery)) {
                matchingParentIds.add(user.id);
              }
            });

            // 매칭된 학부모와 연결된 학생 ID 수집
            links.forEach((link: { parent_id: string; student_id: string }) => {
              if (matchingParentIds.has(link.parent_id)) {
                phoneMatchedIds.add(link.student_id);
              }
            });
          }
        } catch (error) {
          console.error("[studentSearch] auth.users phone 조회 실패", error);
        }
      }
    }
  } catch (error) {
    console.error("[studentSearch] parent_student_links 처리 중 오류", error);
  }

  return phoneMatchedIds;
}

/**
 * 매칭된 필드를 결정합니다.
 */
function determineMatchedField(
  student: { name: string | null },
  phoneData: { phone?: string | null; mother_phone?: string | null; father_phone?: string | null } | undefined,
  searchQuery: string,
  normalizedQuery: string,
  detectedType: "name" | "phone" | "all"
): "name" | "phone" | "mother_phone" | "father_phone" | null {
  let matchedField: "name" | "phone" | "mother_phone" | "father_phone" | null = null;

  if (detectedType === "name" || detectedType === "all") {
    if (student.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
      matchedField = "name";
    }
  }

  if (detectedType === "phone" || detectedType === "all") {
    if (!matchedField && phoneData) {
      if (phoneData.phone?.includes(normalizedQuery)) {
        matchedField = "phone";
      } else if (phoneData.mother_phone?.includes(normalizedQuery)) {
        matchedField = "mother_phone";
      } else if (phoneData.father_phone?.includes(normalizedQuery)) {
        matchedField = "father_phone";
      }
    }
  }

  return matchedField;
}

/**
 * 통합 학생 검색 함수
 * 
 * 개선된 로직:
 * 1. 이름 검색과 연락처 검색에서 매칭된 학생 ID를 먼저 수집 (Set 사용하여 중복 제거)
 * 2. 수집된 ID로 단일 쿼리 실행하여 페이지네이션 적용
 * 3. 정확한 total 카운트 계산
 * 
 * @param params - 검색 파라미터
 * @returns 검색 결과
 */
export async function searchStudentsUnified(
  params: StudentSearchParams
): Promise<StudentSearchResponse> {
  const {
    query,
    searchType,
    filters = {},
    limit = 50,
    offset = 0,
    excludeStudentIds = [],
    tenantId,
  } = params;

  const searchQuery = query.trim();
  
  if (!searchQuery) {
    return { students: [], total: 0 };
  }

  const adminClient = await getSupabaseClientForRLSBypass({
    forceAdmin: true,
    fallbackToServer: true,
  });
  if (!adminClient) {
    return { students: [], total: 0 };
  }

  if (!adminClient) {
    throw new Error("Admin client를 초기화할 수 없습니다.");
  }

  // 검색 타입 감지
  const detectedType = searchType || detectSearchType(searchQuery);
  const normalizedQuery = searchQuery.replace(/[-\s]/g, "");

  // 1단계: 매칭된 학생 ID 수집 (페이지네이션 없이)
  const matchedStudentIds = new Set<string>();

  // 이름 검색 - ID만 수집
  if (detectedType === "name" || detectedType === "all") {
    const baseQuery = buildBaseQuery(adminClient, filters, excludeStudentIds, tenantId);
    const { data: nameMatches, error: nameError } = await baseQuery
      .select("id")
      .ilike("name", `%${searchQuery}%`);

    if (nameError) {
      console.error("[studentSearch] 이름 검색 ID 수집 실패", nameError);
    } else if (nameMatches) {
      nameMatches.forEach((row: { id: string }) => matchedStudentIds.add(row.id));
    }
  }

  // 연락처 검색 - ID만 수집
  if (detectedType === "phone" || detectedType === "all") {
    const phoneMatchedIds = await collectPhoneMatchedIds(adminClient, normalizedQuery);
    phoneMatchedIds.forEach((id) => matchedStudentIds.add(id));
  }

  // 2단계: 수집된 ID로 페이지네이션 적용
  const total = matchedStudentIds.size;
  const studentIds = Array.from(matchedStudentIds).slice(offset, offset + limit);

  if (studentIds.length === 0) {
    return { students: [], total: 0 };
  }

  // 3단계: 페이지네이션된 ID로 실제 데이터 조회
  const baseQuery = buildBaseQuery(adminClient, filters, excludeStudentIds, tenantId);
  const { data: students, error: studentsError } = await baseQuery
    .in("id", studentIds)
    .select("id, name, grade, class, division, is_active");

  if (studentsError) {
    console.error("[studentSearch] 학생 데이터 조회 실패", studentsError);
    return { students: [], total: 0 };
  }

  if (!students || students.length === 0) {
    return { students: [], total: 0 };
  }

  // 4단계: 연락처 정보 일괄 조회
  const { getStudentPhonesBatch } = await import("@/lib/utils/studentPhoneUtils");
  const phoneDataList = await getStudentPhonesBatch(studentIds);
  const phoneDataMap = new Map(phoneDataList.map((p) => [p.id, p]));

  // 5단계: 결과 매핑 및 matched_field 설정
  const results: StudentSearchResult[] = students.map((student) => {
    const phoneData = phoneDataMap.get(student.id);
    const matchedField = determineMatchedField(
      student,
      phoneData,
      searchQuery,
      normalizedQuery,
      detectedType
    );

    return {
      id: student.id,
      name: student.name,
      grade: student.grade,
      class: student.class,
      division: student.division as StudentDivision | null,
      phone: phoneData?.phone ?? null,
      mother_phone: phoneData?.mother_phone ?? null,
      father_phone: phoneData?.father_phone ?? null,
      matched_field: matchedField,
    };
  });

  return {
    students: results,
    total: total,
  };
}

