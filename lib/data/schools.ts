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
// 통합 학교 조회 (각 테이블 직접 조회)
// ============================================

/**
 * 통합 학교 목록 조회 (각 테이블 직접 조회 후 합치기)
 */
export async function getAllSchools(options?: GetSchoolsOptions): Promise<AllSchoolsView[]> {
  const supabase = await createSupabaseServerClient();
  const results: AllSchoolsView[] = [];

  try {
    // 중학교/고등학교 조회
    if (!options?.schoolType || options.schoolType === "MIDDLE" || options.schoolType === "HIGH") {
      let schoolInfoQuery = supabase
        .from("school_info")
        .select("*")
        .eq("closed_flag", "N");

      if (options?.schoolType === "MIDDLE") {
        schoolInfoQuery = schoolInfoQuery.eq("school_level", "중");
      } else if (options?.schoolType === "HIGH") {
        schoolInfoQuery = schoolInfoQuery.eq("school_level", "고");
      }

      if (options?.region) {
        schoolInfoQuery = schoolInfoQuery.ilike("region", `%${options.region}%`);
      }

      const limit = options?.limit ? Math.floor(options.limit / 2) : 500;
      const { data: schoolInfoData, error: schoolInfoError } = await schoolInfoQuery
        .limit(limit)
        .order("school_name", { ascending: true });

      if (!schoolInfoError && schoolInfoData) {
        for (const si of schoolInfoData) {
          results.push({
            id: `SCHOOL_${si.id}`,
            school_type: si.school_level === "중" ? "MIDDLE" : "HIGH",
            name: si.school_name,
            code: si.school_code,
            region: si.region,
            address: si.address_full,
            postal_code: si.postal_code,
            phone: si.phone_number,
            website: si.homepage_url,
            establishment_type: si.establishment_type,
            campus_name: null,
            university_type: null,
            source_table: "school_info",
            source_id: si.id,
            latitude: si.latitude,
            longitude: si.longitude,
            created_at: si.created_at,
          });
        }
      }
    }

    // 대학교 조회
    if (!options?.schoolType || options.schoolType === "UNIVERSITY") {
      let campusQuery = supabase
        .from("university_campuses")
        .select(`
          *,
          university:universities(*)
        `)
        .eq("campus_status", "기존");

      if (options?.region) {
        campusQuery = campusQuery.ilike("region", `%${options.region}%`);
      }

      const limit = options?.limit ? Math.floor(options.limit / 2) : 500;
      const { data: campusData, error: campusError } = await campusQuery
        .limit(limit)
        .order("campus_name", { ascending: true });

      if (!campusError && campusData) {
        for (const uc of campusData) {
          const universityCampus = uc as UniversityWithCampus;
          const university = universityCampus.university;
          const campusName = universityCampus.campus_name;
          const universityName = university?.name_kor || campusName;
          
          results.push({
            id: `UNIV_${uc.id}`,
            school_type: "UNIVERSITY",
            name: campusName === universityName 
              ? universityName 
              : `${universityName} (${uc.campus_type || ""})`,
            code: university?.university_code || null,
            region: uc.region,
            address: uc.address_kor,
            postal_code: uc.postal_code,
            phone: uc.phone_number,
            website: university?.homepage_url || null,
            establishment_type: university?.establishment_type || null,
            campus_name: campusName,
            university_type: university?.university_type || null,
            source_table: "university_campuses",
            source_id: uc.id,
            latitude: null,
            longitude: null,
            created_at: uc.created_at,
          });
        }
      }
    }

    // 이름순 정렬
    results.sort((a, b) => a.name.localeCompare(b.name, "ko"));

    // limit 적용
    if (options?.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  } catch (error) {
    console.error("[data/schools] 통합 학교 조회 실패", error);
    return [];
  }
}

/**
 * 통합 학교 검색
 */
export async function searchAllSchools(options: SearchSchoolsOptions): Promise<SchoolSimple[]> {
  const supabase = await createSupabaseServerClient();
  const results: SchoolSimple[] = [];

  try {
    const query = options.query?.trim() || "";

    // 중학교/고등학교 검색
    if (!options.schoolType || options.schoolType === "MIDDLE" || options.schoolType === "HIGH") {
      let schoolInfoQuery = supabase
        .from("school_info")
        .select("id, school_name, school_level, region, school_code")
        .eq("closed_flag", "N");

      if (options.schoolType === "MIDDLE") {
        schoolInfoQuery = schoolInfoQuery.eq("school_level", "중");
      } else if (options.schoolType === "HIGH") {
        schoolInfoQuery = schoolInfoQuery.eq("school_level", "고");
      }

      if (query) {
        schoolInfoQuery = schoolInfoQuery.ilike("school_name", `%${query}%`);
      }

      if (options.region) {
        schoolInfoQuery = schoolInfoQuery.ilike("region", `%${options.region}%`);
      }

      const limit = options.limit ? Math.floor(options.limit / 2) : 25;
      const { data: schoolInfoData, error: schoolInfoError } = await schoolInfoQuery
        .limit(limit)
        .order("school_name", { ascending: true });

      if (!schoolInfoError && schoolInfoData) {
        for (const si of schoolInfoData) {
          results.push({
            id: `SCHOOL_${si.id}`,
            name: si.school_name,
            schoolType: si.school_level === "중" ? "MIDDLE" : "HIGH",
            region: si.region,
            sourceTable: "school_info",
            sourceId: si.id,
          });
        }
      }
    }

    // 대학교 검색
    if (!options.schoolType || options.schoolType === "UNIVERSITY") {
      const limit = options.limit ? Math.floor(options.limit / 2) : 25;
      
      if (query) {
        // 검색어가 있을 때: 두 개의 쿼리로 나누어 검색
        // 1. 캠퍼스명으로 검색
        let campusNameQuery = supabase
          .from("university_campuses")
          .select(`
            id,
            campus_name,
            region,
            campus_type,
            university:universities!inner(university_code, name_kor)
          `)
          .eq("campus_status", "기존")
          .ilike("campus_name", `%${query}%`);

        if (options.region) {
          campusNameQuery = campusNameQuery.ilike("region", `%${options.region}%`);
        }

        const { data: campusNameData, error: campusNameError } = await campusNameQuery
          .limit(limit)
          .order("campus_name", { ascending: true });

        // 2. 대학명으로 검색: universities 테이블에서 먼저 검색 후 university_campuses 조회
        const { data: universitiesData, error: universitiesError } = await supabase
          .from("universities")
          .select("id")
          .ilike("name_kor", `%${query}%`)
          .limit(limit);

        // JOIN된 데이터 타입 정의
        type UniversityCampusWithJoin = UniversityWithCampus;
        
        /**
         * Supabase 조인 쿼리 결과 타입
         * university:universities!inner(...) 형태의 조인은 배열로 반환됩니다.
         */
        type UniversityCampusRowWithJoin = {
          id: number;
          campus_name: string;
          region: string | null;
          campus_type: string | null;
          university: Array<{ university_code: string; name_kor: string }>;
        };

        let universityNameData: UniversityCampusWithJoin[] = [];
        if (!universitiesError && universitiesData && universitiesData.length > 0) {
          const universityIds = universitiesData.map(u => u.id);
          
          let universityCampusQuery = supabase
            .from("university_campuses")
            .select(`
              id,
              campus_name,
              region,
              campus_type,
              university:universities!inner(university_code, name_kor)
            `)
            .eq("campus_status", "기존")
            .in("university_id", universityIds);

          if (options.region) {
            universityCampusQuery = universityCampusQuery.ilike("region", `%${options.region}%`);
          }

          const { data: campusData, error: campusError } = await universityCampusQuery
            .limit(limit)
            .order("campus_name", { ascending: true });

          if (!campusError && campusData) {
            universityNameData = (campusData as UniversityCampusRowWithJoin[]).map((uc) => ({
              ...uc,
              university: Array.isArray(uc.university) ? uc.university[0] : uc.university,
            })) as UniversityWithCampus[];
          }
        }

        // 결과 합치기 (중복 제거)
        const allCampusData: UniversityCampusWithJoin[] = [];
        const seenIds = new Set<number>();

        if (!campusNameError && campusNameData) {
          /**
           * campusNameData는 이미 UniversityCampusRowWithJoin 형태로 조인된 데이터입니다.
           * university 필드를 평탄화하여 UniversityWithCampus 형태로 변환합니다.
           */
          type CampusNameDataWithJoin = {
            id: number;
            campus_name: string;
            region: string | null;
            campus_type: string | null;
            university: Array<{ university_code: string; name_kor: string }> | { university_code: string; name_kor: string };
          };
          
          for (const uc of (campusNameData as CampusNameDataWithJoin[]).map((uc) => ({
            ...uc,
            university: Array.isArray(uc.university) ? uc.university[0] : uc.university,
          })) as UniversityWithCampus[]) {
            if (!seenIds.has(uc.id)) {
              seenIds.add(uc.id);
              allCampusData.push(uc);
            }
          }
        }

        for (const uc of universityNameData as UniversityWithCampus[]) {
          if (!seenIds.has(uc.id)) {
            seenIds.add(uc.id);
            allCampusData.push(uc);
          }
        }

        // 결과 변환
        for (const uc of allCampusData.slice(0, limit)) {
          const university = uc.university;
          const campusName = uc.campus_name;
          const universityName = university?.name_kor || campusName;
          
          // 캠퍼스명이 대학명과 같으면 대학명만, 다르면 "대학명 (캠퍼스명)" 형식
          const displayName = campusName === universityName
            ? universityName
            : `${universityName} (${uc.campus_type || ""})`;
          
          results.push({
            id: `UNIV_${uc.id}`,
            name: displayName,
            schoolType: "UNIVERSITY",
            region: uc.region,
            sourceTable: "university_campuses",
            sourceId: uc.id,
          });
        }
      } else {
        // 검색어가 없을 때: 전체 조회
        let campusQuery = supabase
          .from("university_campuses")
          .select(`
            id,
            campus_name,
            region,
            campus_type,
            university:universities!inner(university_code, name_kor)
          `)
          .eq("campus_status", "기존");

        if (options.region) {
          campusQuery = campusQuery.ilike("region", `%${options.region}%`);
        }

        const { data: campusData, error: campusError } = await campusQuery
          .limit(limit)
          .order("campus_name", { ascending: true });

        if (!campusError && campusData) {
          for (const uc of campusData) {
            const universityCampus = {
              ...uc,
              university: Array.isArray(uc.university) ? uc.university[0] : uc.university,
            } as UniversityWithCampus;
          const university = universityCampus.university;
          const campusName = universityCampus.campus_name;
          const universityName = university?.name_kor || campusName;
            
            // 캠퍼스명이 대학명과 같으면 대학명만, 다르면 "대학명 (캠퍼스명)" 형식
            const displayName = campusName === universityName
              ? universityName
              : `${universityName} (${uc.campus_type || ""})`;
            
            results.push({
              id: `UNIV_${uc.id}`,
              name: displayName,
              schoolType: "UNIVERSITY",
              region: uc.region,
              sourceTable: "university_campuses",
              sourceId: uc.id,
            });
          }
        }
      }
    }

    // 이름순 정렬
    results.sort((a, b) => a.name.localeCompare(b.name, "ko"));

    // limit 적용
    if (options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  } catch (error) {
    console.error("[data/schools] 학교 검색 실패", error);
    return [];
  }
}

/**
 * 통합 학교 ID로 조회
 */
export async function getSchoolByUnifiedId(unifiedId: string): Promise<AllSchoolsView | null> {
  const supabase = await createSupabaseServerClient();

  try {
    // ID 형식 파싱
    if (unifiedId.startsWith("SCHOOL_")) {
      const sourceId = parseInt(unifiedId.replace("SCHOOL_", ""), 10);
      if (isNaN(sourceId)) return null;

      const { data, error } = await supabase
        .from("school_info")
        .select("*")
        .eq("id", sourceId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: `SCHOOL_${data.id}`,
        school_type: data.school_level === "중" ? "MIDDLE" : "HIGH",
        name: data.school_name,
        code: data.school_code,
        region: data.region,
        address: data.address_full,
        postal_code: data.postal_code,
        phone: data.phone_number,
        website: data.homepage_url,
        establishment_type: data.establishment_type,
        campus_name: null,
        university_type: null,
        source_table: "school_info",
        source_id: data.id,
        latitude: data.latitude,
        longitude: data.longitude,
        created_at: data.created_at,
      };
    } else if (unifiedId.startsWith("UNIV_")) {
      const sourceId = parseInt(unifiedId.replace("UNIV_", ""), 10);
      if (isNaN(sourceId)) return null;

      const { data, error } = await supabase
        .from("university_campuses")
        .select(`
          *,
          university:universities(*)
        `)
        .eq("id", sourceId)
        .maybeSingle();

      if (error || !data) return null;

      const universityCampus = data as UniversityWithCampus;
      const university = universityCampus.university;
      const campusName = universityCampus.campus_name;
      const universityName = university?.name_kor || campusName;

      return {
        id: `UNIV_${data.id}`,
        school_type: "UNIVERSITY",
        name: campusName === universityName
          ? universityName
          : `${universityName} (${data.campus_type || ""})`,
        code: university?.university_code || null,
        region: data.region,
        address: data.address_kor,
        postal_code: data.postal_code,
        phone: data.phone_number,
        website: university?.homepage_url || null,
        establishment_type: university?.establishment_type || null,
        campus_name: campusName,
        university_type: university?.university_type || null,
        source_table: "university_campuses",
        source_id: data.id,
        latitude: null,
        longitude: null,
        created_at: data.created_at,
      };
    }

    return null;
  } catch (error) {
    console.error("[data/schools] 통합 학교 조회 실패", error);
    return null;
  }
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

  // 1. 캠퍼스명으로 검색
  const { data: campusNameData, error: campusNameError } = await supabase
    .from("university_campuses")
    .select(`
      *,
      university:universities!inner(*)
    `)
    .eq("campus_status", "기존")
    .ilike("campus_name", `%${query}%`)
    .limit(limit)
    .order("campus_name", { ascending: true });

  // 2. 대학명으로 검색: universities 테이블에서 먼저 검색 후 university_campuses 조회
  const { data: universitiesData, error: universitiesError } = await supabase
    .from("universities")
    .select("id")
    .ilike("name_kor", `%${query}%`)
    .limit(limit);

  /**
   * Supabase 조인 쿼리 결과 타입
   * university:universities!inner(*) 형태의 조인은 배열로 반환됩니다.
   */
  type UniversityCampusRowWithJoin = {
    id: number;
    campus_name: string;
    region: string | null;
    campus_type: string | null;
    university: Array<{ university_code: string; name_kor: string }>;
  };

  let universityNameData: UniversityCampusRowWithJoin[] = [];
  if (!universitiesError && universitiesData && universitiesData.length > 0) {
    const universityIds = universitiesData.map(u => u.id);
    
    const { data: campusData, error: campusError } = await supabase
      .from("university_campuses")
      .select(`
        *,
        university:universities!inner(*)
      `)
      .eq("campus_status", "기존")
      .in("university_id", universityIds)
      .limit(limit)
      .order("campus_name", { ascending: true });

    if (!campusError && campusData) {
      universityNameData = campusData as UniversityCampusRowWithJoin[];
    }
  }

  // 결과 합치기 (중복 제거)
  const allCampusData: UniversityWithCampus[] = [];
  const seenIds = new Set<number>();

  if (!campusNameError && campusNameData) {
    for (const uc of universityNameData) {
      // university 필드를 평탄화하여 UniversityWithCampus 형태로 변환
      const normalized: UniversityWithCampus = {
        ...uc,
        university: Array.isArray(uc.university) ? uc.university[0] : uc.university,
      } as UniversityWithCampus;
      
      if (!seenIds.has(normalized.id)) {
        seenIds.add(normalized.id);
        allCampusData.push(normalized);
      }
    }
  }

  for (const uc of universityNameData) {
    if (!seenIds.has(uc.id)) {
      seenIds.add(uc.id);
      // university 필드를 평탄화하여 UniversityWithCampus 형태로 변환
      const normalized: UniversityWithCampus = {
        ...uc,
        university: Array.isArray(uc.university) ? uc.university[0] : uc.university,
      } as UniversityWithCampus;
      allCampusData.push(normalized);
    }
  }

  return (allCampusData.slice(0, limit) as UniversityWithCampus[]) ?? [];
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

