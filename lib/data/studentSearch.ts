/**
 * 학생 검색 통합 함수
 * 
 * 이름 검색과 연락처 교차 검색(4자리 부분 매칭)을 서버 사이드로 처리합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
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
  const normalizedQuery = query.trim().replace(/[-\s]/g, "");
  
  // 숫자만 4자리 이상이면 연락처 검색
  const isPhoneSearch = /^\d{4,}$/.test(normalizedQuery);
  
  // 한글이 포함되어 있으면 이름 검색
  const isNameSearch = /[가-힣]/.test(query);
  
  if (isPhoneSearch && isNameSearch) {
    return "all";
  } else if (isPhoneSearch) {
    return "phone";
  } else if (isNameSearch) {
    return "name";
  }
  
  // 기본값: 이름 검색으로 처리
  return "name";
}

/**
 * 통합 학생 검색 함수
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

  const supabase = await createSupabaseServerClient();
  const adminClient = await getSupabaseClientForRLSBypass({
    forceAdmin: true,
    fallbackToServer: true,
  });

  if (!adminClient) {
    throw new Error("Admin client를 초기화할 수 없습니다.");
  }

  // 검색 타입 감지
  const detectedType = searchType || detectSearchType(searchQuery);
  const normalizedQuery = searchQuery.replace(/[-\s]/g, "");

  // 학생 기본 정보 조회 쿼리 빌드
  let baseQuery = adminClient
    .from("students")
    .select("id, name, grade, class, division, is_active", { count: "exact" });

  // tenant_id 필터 (있는 경우)
  if (tenantId) {
    baseQuery = baseQuery.eq("tenant_id", tenantId);
  }

  // 필터 적용
  if (filters.grade) {
    baseQuery = baseQuery.eq("grade", filters.grade);
  }
  if (filters.class) {
    baseQuery = baseQuery.eq("class", filters.class);
  }
  if (filters.division !== undefined) {
    if (filters.division === null) {
      baseQuery = baseQuery.is("division", null);
    } else {
      baseQuery = baseQuery.eq("division", filters.division);
    }
  }
  if (filters.isActive !== undefined) {
    baseQuery = baseQuery.eq("is_active", filters.isActive);
  }

  // 제외할 학생 ID 필터
  if (excludeStudentIds.length > 0) {
    baseQuery = baseQuery.not("id", "in", `(${excludeStudentIds.join(",")})`);
  }

  let students: Array<{
    id: string;
    name: string | null;
    grade: string | null;
    class: string | null;
    division: StudentDivision | null;
    is_active: boolean | null;
  }> = [];
  let total = 0;

  // 이름 검색
  if (detectedType === "name" || detectedType === "all") {
    let nameQuery = baseQuery.ilike("name", `%${searchQuery}%`);
    
    // 페이지네이션
    nameQuery = nameQuery.range(offset, offset + limit - 1);
    
    const { data, error, count } = await nameQuery;
    
    if (error) {
      console.error("[studentSearch] 이름 검색 실패", error);
    } else {
      students = (data || []) as typeof students;
      total = count || 0;
    }
  }

  // 연락처 검색
  if (detectedType === "phone" || detectedType === "all") {
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

    // parent_student_links를 통해 연결된 학부모 연락처 검색
    let linkedStudentIds: string[] = [];
    
    try {
      const { data: links, error: linksError } = await adminClient
        .from("parent_student_links")
        .select("student_id, relation, parent_id")
        .limit(1000); // 성능을 위해 제한

      if (!linksError && links && links.length > 0) {
        const parentIds = Array.from(
          new Set(links.map((link: any) => link.parent_id))
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
              links.forEach((link: any) => {
                if (matchingParentIds.has(link.parent_id)) {
                  linkedStudentIds.push(link.student_id);
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

    // 연락처로 매칭된 학생 ID 수집
    const phoneMatchedIds = new Set<string>();
    
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

    // 연결된 학부모 연락처로 매칭된 학생 ID 추가
    linkedStudentIds.forEach((id) => phoneMatchedIds.add(id));

    if (phoneMatchedIds.size > 0) {
      // 학생 기본 정보 조회
      let phoneQuery = baseQuery.in("id", Array.from(phoneMatchedIds));
      
      // 페이지네이션
      phoneQuery = phoneQuery.range(offset, offset + limit - 1);
      
      const { data, error, count } = await phoneQuery;

      if (error) {
        console.error("[studentSearch] 연락처 검색 학생 조회 실패", error);
      } else {
        // 이름 검색 결과와 병합 (중복 제거)
        const existingIds = new Set(students.map((s) => s.id));
        const phoneStudents = (data || []) as typeof students;
        
        phoneStudents.forEach((student) => {
          if (!existingIds.has(student.id)) {
            students.push(student);
          }
        });

        // total 업데이트 (더 큰 값 사용)
        if (count && count > total) {
          total = count;
        }
      }
    }
  }

  // 학생 ID 목록 추출
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return { students: [], total: 0 };
  }

  // 연락처 정보 일괄 조회
  const { getStudentPhonesBatch } = await import("@/lib/utils/studentPhoneUtils");
  const phoneDataList = await getStudentPhonesBatch(studentIds);
  const phoneDataMap = new Map(phoneDataList.map((p) => [p.id, p]));

  // 결과 매핑 및 matched_field 설정
  const results: StudentSearchResult[] = students.map((student) => {
    const phoneData = phoneDataMap.get(student.id);
    
    // 매칭된 필드 확인
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
    total: total || results.length,
  };
}

