import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Region = {
  id: string;
  name: string;
  parent_id?: string | null;
  level: number; // 1: 시/도, 2: 시/군/구, 3: 읍/면/동
  code?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type School = {
  id: string;
  name: string;
  type: "중학교" | "고등학교" | "대학교";
  region_id?: string | null;
  region?: string | null; // JOIN 결과 (하위 호환성)
  address?: string | null;
  postal_code?: string | null;
  address_detail?: string | null;
  city?: string | null;
  district?: string | null;
  phone?: string | null;
  // 고등학교 속성
  category?: "일반고" | "특목고" | "자사고" | "특성화고" | null;
  // 대학교 속성
  university_type?: "4년제" | "2년제" | null;
  university_ownership?: "국립" | "사립" | null;
  campus_name?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

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
    const errorDetails = {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    };
    console.error("[data/schools] 지역 조회 실패", errorDetails);
    return [];
  }

  return (data as Region[] | null) ?? [];
}

/**
 * 상위 지역별 하위 지역 조회
 * @param parentId 상위 지역 ID
 */
export async function getRegionsByParent(
  parentId: string
): Promise<Region[]> {
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
 * @param level 지역 레벨 (1: 시/도, 2: 시/군/구, 3: 읍/면/동)
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

/**
 * 지역 위계 구조 조회 (트리 구조)
 * @param regionId 지역 ID (선택사항, 없으면 최상위부터)
 */
export async function getRegionHierarchy(
  regionId?: string
): Promise<Region[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("regions").select("*").eq("is_active", true);

  if (regionId) {
    query = query.eq("id", regionId);
  } else {
    // 최상위 지역만 조회 (parent_id가 NULL인 경우)
    query = query.is("parent_id", null);
  }

  const { data, error } = await query
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[data/schools] 지역 위계 조회 실패", error);
    return [];
  }

  return (data as Region[] | null) ?? [];
}

/**
 * 학교 목록 조회 (전역 관리)
 * @param options 필터 옵션
 */
export async function getSchools(options?: {
  regionId?: string;
  type?: "중학교" | "고등학교" | "대학교";
  includeInactive?: boolean;
}): Promise<School[]> {
  const supabase = await createSupabaseServerClient();

  // JOIN 쿼리 시도 (에러 발생 시 fallback)
  let query = supabase
    .from("schools")
    .select(`
      *,
      regions:region_id (
        id,
        name
      )
    `);
  
  // JOIN이 실패할 경우를 대비한 fallback 쿼리 준비
  const fallbackQuery = supabase
    .from("schools")
    .select("*");

  if (options?.regionId) {
    query = query.eq("region_id", options.regionId);
  }

  if (options?.type) {
    query = query.eq("type", options.type);
  }

  // is_active 컬럼이 없을 수 있으므로 조건부로만 추가
  // includeInactive가 false이고 is_active 컬럼이 있는 경우에만 필터링
  // (실제로는 쿼리 실행 후 에러로 확인)

  let { data, error } = await query
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  // is_active 컬럼이 없는 경우 에러 처리
  if (error && error.code === "42703" && error.message?.includes("is_active")) {
    // is_active 컬럼이 없으므로 해당 필터 제거하고 재시도
    console.warn("[data/schools] is_active 컬럼이 없어 필터 제거 후 재시도");
    
    // 쿼리 재구성 (is_active 필터 제외)
    let retryQuery = supabase
      .from("schools")
      .select(`
        *,
        regions:region_id (
          id,
          name
        )
      `);
    
    if (options?.regionId) {
      retryQuery = retryQuery.eq("region_id", options.regionId);
    }
    
    if (options?.type) {
      retryQuery = retryQuery.eq("type", options.type);
    }
    
    // is_active 필터는 제외
    
    const retryResult = await retryQuery
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    
    if (!retryResult.error) {
      // 재시도 성공
      data = retryResult.data;
      error = null;
    } else {
      // 재시도도 실패 - JOIN 에러일 수 있음
      error = retryResult.error;
    }
  }

  // JOIN 에러인 경우 fallback 쿼리 시도
  if (error && (error.code === "42703" || error.message?.includes("relation") || error.message?.includes("column"))) {
    console.warn("[data/schools] JOIN 쿼리 실패, fallback 쿼리 시도:", {
      code: error.code,
      message: error.message,
    });
    
    // Fallback: JOIN 없이 기본 쿼리만 실행
    let fallbackQueryBuilder = fallbackQuery;
    
    if (options?.regionId) {
      fallbackQueryBuilder = fallbackQueryBuilder.eq("region_id", options.regionId);
    }
    
    if (options?.type) {
      fallbackQueryBuilder = fallbackQueryBuilder.eq("type", options.type);
    }
    
    // is_active 컬럼이 없을 수 있으므로 필터 제외
    
    const fallbackResult = await fallbackQueryBuilder
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    
    if (!fallbackResult.error) {
      // Fallback 성공
      data = fallbackResult.data;
      error = null;
    } else {
      // Fallback도 실패
      error = fallbackResult.error;
    }
  }

  if (error) {
    // 에러 객체를 개별적으로 출력 (객체 직렬화 문제 회피)
    console.error("[data/schools] 학교 조회 실패");
    console.error("  - error 타입:", typeof error);
    console.error("  - error instanceof Error:", error instanceof Error);
    console.error("  - error.constructor:", error?.constructor?.name);
    console.error("  - error.toString():", String(error));
    
    // 각 속성을 개별적으로 확인
    console.error("  - error.code:", (error as any)?.code);
    console.error("  - error.message:", (error as any)?.message);
    console.error("  - error.details:", (error as any)?.details);
    console.error("  - error.hint:", (error as any)?.hint);
    console.error("  - error.status:", (error as any)?.status);
    console.error("  - error.name:", (error as any)?.name);
    
    // Object.keys 확인
    const keys = Object.keys(error);
    console.error("  - Object.keys(error):", keys.length > 0 ? keys : "[]");
    
    // Object.getOwnPropertyNames 확인
    const ownProps = Object.getOwnPropertyNames(error);
    console.error("  - Object.getOwnPropertyNames(error):", ownProps.length > 0 ? ownProps : "[]");
    
    // 각 속성 값 직접 출력
    if (ownProps.length > 0) {
      console.error("  - 속성 값들:");
      for (const key of ownProps) {
        try {
          const value = (error as any)[key];
          const valueType = typeof value;
          if (valueType === 'object' && value !== null) {
            console.error(`    ${key}: [${valueType}]`, value);
          } else {
            console.error(`    ${key}: [${valueType}]`, String(value));
          }
        } catch (e) {
          console.error(`    ${key}: [접근 실패]`, e instanceof Error ? e.message : String(e));
        }
      }
    }
    
    // JSON 직렬화 시도
    try {
      const jsonStr = JSON.stringify(error, null, 2);
      console.error("  - JSON.stringify:", jsonStr);
    } catch (e) {
      console.error("  - JSON.stringify 실패:", e instanceof Error ? e.message : String(e));
    }
    
    // 에러가 실제로 truthy인지 확인
    console.error("  - error가 truthy:", !!error);
    console.error("  - error === null:", error === null);
    console.error("  - error === undefined:", error === undefined);
    
    // 에러 객체 자체를 직접 출력
    console.error("  - error 객체 직접 출력:", error);
    
    return [];
  }

  // JOIN 결과를 평탄화
  return ((data as any[]) ?? []).map((school) => ({
    ...school,
    region: school.regions?.name || null,
    // 새 속성들 포함
    postal_code: school.postal_code || null,
    address_detail: school.address_detail || null,
    city: school.city || null,
    district: school.district || null,
    category: school.category || null,
    university_type: school.university_type || null,
    university_ownership: school.university_ownership || null,
    campus_name: school.campus_name || null,
  })) as School[];
}

/**
 * 지역별 학교 조회
 * @param regionId 지역 ID
 */
export async function getSchoolsByRegion(
  regionId: string
): Promise<School[]> {
  return getSchools({ regionId });
}

/**
 * 학교 상세 조회
 * @param schoolId 학교 ID
 */
export async function getSchoolById(
  schoolId: string
): Promise<School | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("schools")
    .select(`
      *,
      regions:region_id (
        id,
        name
      )
    `)
    .eq("id", schoolId)
    .maybeSingle();

  if (error) {
    const errorDetails = {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    };
    console.error("[data/schools] 학교 조회 실패", errorDetails);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    region: (data as any).regions?.name || null,
    // 새 속성들 포함
    postal_code: data.postal_code || null,
    address_detail: data.address_detail || null,
    city: data.city || null,
    district: data.district || null,
    category: data.category || null,
    university_type: data.university_type || null,
    university_ownership: data.university_ownership || null,
    campus_name: data.campus_name || null,
  } as School;
}

/**
 * 학교명으로 학교 조회
 * @param name 학교명
 * @param type 학교 타입 (선택사항)
 */
export async function getSchoolByName(
  name: string,
  type?: "중학교" | "고등학교" | "대학교"
): Promise<School | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("schools")
    .select(`
      *,
      regions:region_id (
        id,
        name
      )
    `)
    .eq("name", name);

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    const errorDetails = {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    };
    console.error("[data/schools] 학교 조회 실패", errorDetails);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    region: (data as any).regions?.name || null,
    // 새 속성들 포함
    postal_code: data.postal_code || null,
    address_detail: data.address_detail || null,
    city: data.city || null,
    district: data.district || null,
    category: data.category || null,
    university_type: data.university_type || null,
    university_ownership: data.university_ownership || null,
    campus_name: data.campus_name || null,
  } as School;
}

/**
 * 학교 중복 확인
 * @param name 학교명
 * @param type 학교 타입
 * @param regionId 지역 ID (선택사항)
 * @param campusName 캠퍼스명 (대학교 선택사항)
 * @param excludeId 제외할 학교 ID (수정 시 자기 자신 제외)
 */
export async function checkSchoolDuplicate(
  name: string,
  type: "중학교" | "고등학교" | "대학교",
  regionId?: string | null,
  campusName?: string | null,
  excludeId?: string
): Promise<School | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("schools")
    .select(`
      *,
      regions:region_id (
        id,
        name
      )
    `)
    .eq("name", name)
    .eq("type", type);

  // 지역이 있는 경우 지역 조건 추가
  if (regionId) {
    query = query.eq("region_id", regionId);
  } else {
    // 지역이 없는 경우 NULL인 학교만 확인
    query = query.is("region_id", null);
  }

  // 대학교이고 캠퍼스명이 있는 경우
  if (type === "대학교" && campusName) {
    query = query.eq("campus_name", campusName);
  } else if (type === "대학교" && !campusName) {
    // 대학교이고 캠퍼스명이 없는 경우, 캠퍼스명이 NULL인 학교만 확인
    query = query.is("campus_name", null);
  }

  // 수정 시 자기 자신 제외
  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[data/schools] 학교 중복 확인 실패", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    region: (data as any).regions?.name || null,
    // 새 속성들 포함
    postal_code: data.postal_code || null,
    address_detail: data.address_detail || null,
    city: data.city || null,
    district: data.district || null,
    category: data.category || null,
    university_type: data.university_type || null,
    university_ownership: data.university_ownership || null,
    campus_name: data.campus_name || null,
  } as School;
}

