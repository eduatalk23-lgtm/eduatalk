/**
 * School 도메인 Repository
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
  SchoolInfo,
  University,
  UniversityCampus,
  UniversityWithCampus,
  AllSchoolsView,
  Region,
  GetSchoolsOptions,
  SearchSchoolsOptions,
} from "./types";

// ============================================
// Region Repository
// ============================================

/**
 * 모든 활성 지역 조회
 */
export async function findAllRegions(): Promise<Region[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as Region[]) ?? [];
}

/**
 * 레벨별 지역 조회
 */
export async function findRegionsByLevel(level: 1 | 2 | 3): Promise<Region[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("level", level)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as Region[]) ?? [];
}

/**
 * 상위 지역별 하위 지역 조회
 */
export async function findRegionsByParent(parentId: string): Promise<Region[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as Region[]) ?? [];
}

/**
 * 지역 ID로 조회
 */
export async function findRegionById(regionId: string): Promise<Region | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("id", regionId)
    .maybeSingle();

  if (error) throw error;
  return data as Region | null;
}

// ============================================
// 통합 학교 Repository (all_schools_view)
// ============================================

/**
 * 통합 학교 목록 조회 (각 테이블 직접 조회)
 */
export async function findAllSchools(options?: GetSchoolsOptions): Promise<AllSchoolsView[]> {
  // lib/data/schools.ts의 getAllSchools를 사용
  const { getAllSchools } = await import("@/lib/data/schools");
  return getAllSchools(options);
}

/**
 * 통합 학교 검색 (각 테이블 직접 조회)
 */
export async function searchSchools(options: SearchSchoolsOptions): Promise<AllSchoolsView[]> {
  // lib/data/schools.ts의 searchAllSchools를 사용하고 AllSchoolsView로 변환
  const { searchAllSchools, getSchoolByUnifiedId } = await import("@/lib/data/schools");
  const simpleResults = await searchAllSchools(options);
  
  // SchoolSimple을 AllSchoolsView로 변환
  const results: AllSchoolsView[] = [];
  for (const simple of simpleResults) {
    const full = await getSchoolByUnifiedId(simple.id);
    if (full) {
      results.push(full);
    }
  }
  
  return results;
}

/**
 * 통합 학교 ID로 조회 (각 테이블 직접 조회)
 */
export async function findSchoolByUnifiedId(unifiedId: string): Promise<AllSchoolsView | null> {
  // lib/data/schools.ts의 getSchoolByUnifiedId를 사용
  const { getSchoolByUnifiedId } = await import("@/lib/data/schools");
  return getSchoolByUnifiedId(unifiedId);
}

/**
 * 학교명으로 조회 (각 테이블 직접 조회)
 */
export async function findSchoolByName(
  name: string,
  schoolType?: SchoolType
): Promise<AllSchoolsView | null> {
  // lib/data/schools.ts의 searchAllSchools를 사용
  const { searchAllSchools, getSchoolByUnifiedId } = await import("@/lib/data/schools");
  const results = await searchAllSchools({
    query: name,
    schoolType,
    limit: 1,
  });
  
  if (results.length === 0) return null;
  
  return getSchoolByUnifiedId(results[0].id);
}

// ============================================
// 중·고등학교 Repository (school_info)
// ============================================

/**
 * 중·고등학교 목록 조회
 */
export async function findSchoolInfoList(options?: {
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

  if (error) throw error;
  return (data as SchoolInfo[]) ?? [];
}

/**
 * 중·고등학교 ID로 조회
 */
export async function findSchoolInfoById(id: number): Promise<SchoolInfo | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("school_info")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
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

  if (error) throw error;
  return (data as SchoolInfo[]) ?? [];
}

// ============================================
// 대학교 Repository (universities, university_campuses)
// ============================================

/**
 * 대학교 목록 조회
 */
export async function findUniversities(options?: {
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

  if (error) throw error;
  return (data as University[]) ?? [];
}

/**
 * 대학교 ID로 조회
 */
export async function findUniversityById(id: number): Promise<University | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("universities")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as University | null;
}

/**
 * 대학교 캠퍼스 목록 조회
 */
export async function findUniversityCampuses(options?: {
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

  if (error) throw error;
  return (data as UniversityWithCampus[]) ?? [];
}

/**
 * 대학교 캠퍼스 ID로 조회
 */
export async function findUniversityCampusById(id: number): Promise<UniversityWithCampus | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("university_campuses")
    .select(`
      *,
      university:universities(*)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
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

  // 캠퍼스명 또는 대학명으로 검색
  const { data, error } = await supabase
    .from("university_campuses")
    .select(`
      *,
      university:universities(*)
    `)
    .eq("campus_status", "기존")
    .ilike("campus_name", `%${query}%`)
    .limit(limit)
    .order("campus_name", { ascending: true });

  if (error) throw error;
  return (data as UniversityWithCampus[]) ?? [];
}
