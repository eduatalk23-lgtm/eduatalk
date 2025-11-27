/**
 * 학교 데이터 조회 함수
 *
 * 새 테이블 구조:
 * - school_info: 중·고등학교
 * - universities: 대학교
 * - university_campuses: 대학교 캠퍼스
 * - all_schools_view: 통합 조회 VIEW
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  SchoolType,
  SchoolTypeKor,
  SchoolInfo,
  University,
  UniversityCampus,
  UniversityWithCampus,
  AllSchoolsView,
  SchoolSimple,
  SearchSchoolsOptions,
  GetSchoolsOptions,
  Region,
  SCHOOL_TYPE_MAP,
  SCHOOL_TYPE_REVERSE_MAP,
  parseSchoolId,
} from "@/lib/domains/school/types";

// Re-export types for convenience
export type {
  SchoolType,
  SchoolTypeKor,
  SchoolInfo,
  University,
  UniversityCampus,
  UniversityWithCampus,
  AllSchoolsView,
  SchoolSimple,
  Region,
};

// ============================================
// 하위 호환성을 위한 타입 (Deprecated)
// ============================================

/**
 * @deprecated 새 타입 AllSchoolsView 또는 SchoolSimple 사용
 */
export type School = {
  id: string;
  name: string;
  type: SchoolTypeKor;
  region: string | null;
  region_id?: string | null;
  address?: string | null;
  postal_code?: string | null;
  address_detail?: string | null;
  city?: string | null;
  district?: string | null;
  phone?: string | null;
  category?: string | null;
  university_type?: string | null;
  university_ownership?: string | null;
  campus_name?: string | null;
  display_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

// ============================================
// Region 조회 함수
// ============================================

/**
 * 지역 목록 조회 (전역 관리)
 */
export async function getRegions(): Promise<Region[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/schools] 지역 조회 실패", error);
    return [];
  }

  return (data as Region[] | null) ?? [];
}

/**
 * 상위 지역별 하위 지역 조회
 */
export async function getRegionsByParent(parentId: string): Promise<Region[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/schools] 하위 지역 조회 실패", error);
    return [];
  }

  return (data as Region[] | null) ?? [];
}

/**
 * 레벨별 지역 조회
 */
export async function getRegionsByLevel(level: 1 | 2 | 3): Promise<Region[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("level", level)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/schools] 레벨별 지역 조회 실패", error);
    return [];
  }

  return (data as Region[] | null) ?? [];
}

// ============================================
// 통합 학교 조회 (all_schools_view)
// ============================================

/**
 * 통합 학교 목록 조회 (all_schools_view)
 */
export async function getAllSchools(options?: GetSchoolsOptions): Promise<AllSchoolsView[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("all_schools_view").select("*");

  if (options?.schoolType) {
    query = query.eq("school_type", options.schoolType);
  }

  if (options?.region) {
    query = query.ilike("region", `%${options.region}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("[data/schools] 통합 학교 조회 실패", error);
    return [];
  }

  return (data as AllSchoolsView[]) ?? [];
}

/**
 * 통합 학교 검색
 */
export async function searchAllSchools(options: SearchSchoolsOptions): Promise<SchoolSimple[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("all_schools_view").select("id, school_type, name, region, source_table, source_id");

  if (options.schoolType) {
    query = query.eq("school_type", options.schoolType);
  }

  if (options.query && options.query.trim()) {
    query = query.ilike("name", `%${options.query.trim()}%`);
  }

  if (options.region) {
    query = query.ilike("region", `%${options.region}%`);
  }

  const limit = options.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("[data/schools] 학교 검색 실패", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    schoolType: row.school_type,
    region: row.region,
    sourceTable: row.source_table,
    sourceId: row.source_id,
  }));
}

/**
 * 통합 학교 ID로 조회
 */
export async function getSchoolByUnifiedId(unifiedId: string): Promise<AllSchoolsView | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("all_schools_view")
    .select("*")
    .eq("id", unifiedId)
    .maybeSingle();

  if (error) {
    console.error("[data/schools] 통합 학교 조회 실패", error);
    return null;
  }

  return data as AllSchoolsView | null;
}

// ============================================
// 중·고등학교 조회 (school_info)
// ============================================

/**
 * 중·고등학교 목록 조회
 */
export async function getSchoolInfoList(options?: {
  schoolLevel?: "중" | "고";
  region?: string;
  limit?: number;
}): Promise<SchoolInfo[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("school_info")
    .select("*")
    .eq("closed_flag", "N");

  if (options?.schoolLevel) {
    query = query.eq("school_level", options.schoolLevel);
  }

  if (options?.region) {
    query = query.ilike("region", `%${options.region}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.order("school_name", { ascending: true });

  if (error) {
    console.error("[data/schools] 중·고등학교 조회 실패", error);
    return [];
  }

  return (data as SchoolInfo[]) ?? [];
}

/**
 * 중·고등학교 ID로 조회
 */
export async function getSchoolInfoById(id: number): Promise<SchoolInfo | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("school_info")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[data/schools] 중·고등학교 조회 실패", error);
    return null;
  }

  return data as SchoolInfo | null;
}

/**
 * 중·고등학교 검색
 */
export async function searchSchoolInfo(
  query: string,
  schoolLevel?: "중" | "고",
  limit = 50
): Promise<SchoolInfo[]> {
  const supabase = await createSupabaseServerClient();

  let dbQuery = supabase
    .from("school_info")
    .select("*")
    .eq("closed_flag", "N")
    .ilike("school_name", `%${query}%`);

  if (schoolLevel) {
    dbQuery = dbQuery.eq("school_level", schoolLevel);
  }

  const { data, error } = await dbQuery
    .limit(limit)
    .order("school_name", { ascending: true });

  if (error) {
    console.error("[data/schools] 중·고등학교 검색 실패", error);
    return [];
  }

  return (data as SchoolInfo[]) ?? [];
}

// ============================================
// 대학교 조회 (universities, university_campuses)
// ============================================

/**
 * 대학교 목록 조회
 */
export async function getUniversities(options?: {
  establishmentType?: string;
  universityType?: string;
  limit?: number;
}): Promise<University[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("universities").select("*");

  if (options?.establishmentType) {
    query = query.eq("establishment_type", options.establishmentType);
  }

  if (options?.universityType) {
    query = query.eq("university_type", options.universityType);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.order("name_kor", { ascending: true });

  if (error) {
    console.error("[data/schools] 대학교 조회 실패", error);
    return [];
  }

  return (data as University[]) ?? [];
}

/**
 * 대학교 캠퍼스 목록 조회
 */
export async function getUniversityCampuses(options?: {
  universityId?: number;
  region?: string;
  limit?: number;
}): Promise<UniversityWithCampus[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("university_campuses")
    .select(`
      *,
      university:universities(*)
    `)
    .eq("campus_status", "기존");

  if (options?.universityId) {
    query = query.eq("university_id", options.universityId);
  }

  if (options?.region) {
    query = query.ilike("region", `%${options.region}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.order("campus_name", { ascending: true });

  if (error) {
    console.error("[data/schools] 대학교 캠퍼스 조회 실패", error);
    return [];
  }

  return (data as UniversityWithCampus[]) ?? [];
}

/**
 * 대학교 캠퍼스 ID로 조회
 */
export async function getUniversityCampusById(id: number): Promise<UniversityWithCampus | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("university_campuses")
    .select(`
      *,
      university:universities(*)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[data/schools] 대학교 캠퍼스 조회 실패", error);
    return null;
  }

  return data as UniversityWithCampus | null;
}

/**
 * 대학교/캠퍼스 검색
 */
export async function searchUniversityCampuses(
  query: string,
  limit = 50
): Promise<UniversityWithCampus[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("university_campuses")
    .select(`
      *,
      university:universities!inner(*)
    `)
    .eq("campus_status", "기존")
    .or(`campus_name.ilike.%${query}%,university.name_kor.ilike.%${query}%`)
    .limit(limit)
    .order("campus_name", { ascending: true });

  if (error) {
    console.error("[data/schools] 대학교 검색 실패", error);
    return [];
  }

  return (data as UniversityWithCampus[]) ?? [];
}

// ============================================
// 하위 호환성 함수 (Deprecated)
// ============================================

const SCHOOL_TYPE_MAP_INTERNAL: Record<SchoolType, SchoolTypeKor> = {
  MIDDLE: "중학교",
  HIGH: "고등학교",
  UNIVERSITY: "대학교",
};

const SCHOOL_TYPE_REVERSE_MAP_INTERNAL: Record<SchoolTypeKor, SchoolType> = {
  "중학교": "MIDDLE",
  "고등학교": "HIGH",
  "대학교": "UNIVERSITY",
};

/**
 * @deprecated 새 함수 getAllSchools 사용
 * 기존 코드 호환을 위한 학교 목록 조회
 */
export async function getSchools(options?: {
  regionId?: string;
  type?: SchoolTypeKor;
  includeInactive?: boolean;
}): Promise<School[]> {
  const schoolType = options?.type ? SCHOOL_TYPE_REVERSE_MAP_INTERNAL[options.type] : undefined;
  
  const allSchools = await getAllSchools({
    schoolType,
    limit: 1000,
  });

  return allSchools.map((s) => ({
    id: s.id,
    name: s.name,
    type: SCHOOL_TYPE_MAP_INTERNAL[s.school_type],
    region: s.region,
    region_id: null,
    address: s.address,
    postal_code: s.postal_code,
    phone: s.phone,
    campus_name: s.campus_name,
    university_type: s.university_type,
    display_order: 0,
    is_active: true,
    created_at: s.created_at,
  }));
}

/**
 * @deprecated 새 함수 getSchoolByUnifiedId 사용
 * 기존 코드 호환을 위한 학교 상세 조회
 */
export async function getSchoolById(schoolId: string): Promise<School | null> {
  const school = await getSchoolByUnifiedId(schoolId);
  
  if (!school) return null;

  return {
    id: school.id,
    name: school.name,
    type: SCHOOL_TYPE_MAP_INTERNAL[school.school_type],
    region: school.region,
    address: school.address,
    postal_code: school.postal_code,
    phone: school.phone,
    campus_name: school.campus_name,
    university_type: school.university_type,
  };
}

/**
 * @deprecated 새 함수 searchAllSchools 사용
 * 기존 코드 호환을 위한 학교명 조회
 */
export async function getSchoolByName(
  name: string,
  type?: SchoolTypeKor
): Promise<School | null> {
  const schoolType = type ? SCHOOL_TYPE_REVERSE_MAP_INTERNAL[type] : undefined;
  
  const results = await searchAllSchools({
    query: name,
    schoolType,
    limit: 1,
  });

  if (results.length === 0) return null;

  const school = await getSchoolByUnifiedId(results[0].id);
  if (!school) return null;

  return {
    id: school.id,
    name: school.name,
    type: SCHOOL_TYPE_MAP_INTERNAL[school.school_type],
    region: school.region,
    address: school.address,
    postal_code: school.postal_code,
    phone: school.phone,
    campus_name: school.campus_name,
    university_type: school.university_type,
  };
}

/**
 * @deprecated 통합 테이블에서는 중복 확인이 불필요
 * 기존 코드 호환을 위한 학교 중복 확인
 */
export async function checkSchoolDuplicate(
  name: string,
  type: SchoolTypeKor,
  regionId?: string | null,
  campusName?: string | null,
  excludeId?: string
): Promise<School | null> {
  // 새 테이블 구조에서는 읽기 전용이므로 항상 null 반환
  console.warn("[data/schools] checkSchoolDuplicate는 더 이상 사용되지 않습니다.");
  return null;
}
