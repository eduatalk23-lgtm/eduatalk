/**
 * School 도메인 데이터 조회 함수
 * 
 * 이 파일은 Supabase를 통한 데이터 접근을 담당합니다.
 * Server Actions에서 호출되며, 비즈니스 로직은 포함하지 않습니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  School,
  Region,
  GetSchoolsOptions,
  SchoolType,
  CreateSchoolInput,
  UpdateSchoolInput,
} from "./types";

// ============================================
// 지역 (Region) 조회
// ============================================

/**
 * 모든 활성 지역 목록 조회
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
    console.error("[domains/school] 지역 조회 실패:", error.message);
    return [];
  }

  return (data as Region[]) ?? [];
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
    console.error("[domains/school] 레벨별 지역 조회 실패:", error.message);
    return [];
  }

  return (data as Region[]) ?? [];
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
    console.error("[domains/school] 하위 지역 조회 실패:", error.message);
    return [];
  }

  return (data as Region[]) ?? [];
}

/**
 * 지역 ID 유효성 확인
 */
export async function validateRegionId(regionId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("regions")
    .select("id")
    .eq("id", regionId)
    .maybeSingle();

  if (error) {
    console.error("[domains/school] 지역 검증 실패:", error.message);
    return false;
  }

  return !!data;
}

// ============================================
// 학교 (School) 조회
// ============================================

/**
 * 학교 목록 조회
 */
export async function getSchools(options?: GetSchoolsOptions): Promise<School[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("schools").select(`
    *,
    regions:region_id (
      id,
      name
    )
  `);

  if (options?.regionId) {
    query = query.eq("region_id", options.regionId);
  }

  if (options?.type) {
    query = query.eq("type", options.type);
  }

  const { data, error } = await query
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[domains/school] 학교 조회 실패:", error.message);
    
    // JOIN 실패 시 fallback
    const fallbackResult = await supabase
      .from("schools")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (fallbackResult.error) {
      console.error("[domains/school] fallback 조회도 실패:", fallbackResult.error.message);
      return [];
    }

    return (fallbackResult.data ?? []).map((school) => ({
      ...school,
      region: null,
    })) as School[];
  }

  return ((data ?? []) as any[]).map((school) => ({
    ...school,
    region: school.regions?.name || null,
  })) as School[];
}

/**
 * 학교 ID로 조회
 */
export async function getSchoolById(schoolId: string): Promise<School | null> {
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
    console.error("[domains/school] 학교 조회 실패:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    region: (data as any).regions?.name || null,
  } as School;
}

/**
 * 학교명으로 조회
 */
export async function getSchoolByName(
  name: string,
  type?: SchoolType
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
    console.error("[domains/school] 학교명 조회 실패:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    region: (data as any).regions?.name || null,
  } as School;
}

/**
 * 학교 중복 확인
 */
export async function checkSchoolDuplicate(
  name: string,
  type: SchoolType,
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

  if (regionId) {
    query = query.eq("region_id", regionId);
  } else {
    query = query.is("region_id", null);
  }

  if (type === "대학교" && campusName) {
    query = query.eq("campus_name", campusName);
  } else if (type === "대학교" && !campusName) {
    query = query.is("campus_name", null);
  }

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[domains/school] 중복 확인 실패:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    region: (data as any).regions?.name || null,
  } as School;
}

// ============================================
// 학교 CUD (Create, Update, Delete)
// ============================================

/**
 * 학교 생성
 */
export async function createSchool(
  input: CreateSchoolInput
): Promise<{ success: boolean; error?: string; data?: School }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("schools")
    .insert({
      name: input.name,
      type: input.type,
      region_id: input.region_id ?? null,
      address: input.address ?? null,
      postal_code: input.postal_code ?? null,
      address_detail: input.address_detail ?? null,
      city: input.city ?? null,
      district: input.district ?? null,
      phone: input.phone ?? null,
      category: input.type === "고등학교" ? input.category : null,
      university_type: input.type === "대학교" ? input.university_type : null,
      university_ownership: input.type === "대학교" ? input.university_ownership : null,
      campus_name: input.type === "대학교" ? input.campus_name : null,
    })
    .select()
    .single();

  if (error) {
    console.error("[domains/school] 학교 생성 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, data: data as School };
}

/**
 * 학교 수정
 */
export async function updateSchool(
  input: UpdateSchoolInput
): Promise<{ success: boolean; error?: string; data?: School }> {
  const supabase = await createSupabaseServerClient();

  const { id, ...updateData } = input;

  const { data, error } = await supabase
    .from("schools")
    .update({
      name: updateData.name,
      type: updateData.type,
      region_id: updateData.region_id ?? null,
      address: updateData.address ?? null,
      postal_code: updateData.postal_code ?? null,
      address_detail: updateData.address_detail ?? null,
      city: updateData.city ?? null,
      district: updateData.district ?? null,
      phone: updateData.phone ?? null,
      category: updateData.type === "고등학교" ? updateData.category : null,
      university_type: updateData.type === "대학교" ? updateData.university_type : null,
      university_ownership: updateData.type === "대학교" ? updateData.university_ownership : null,
      campus_name: updateData.type === "대학교" ? updateData.campus_name : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[domains/school] 학교 수정 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, data: data as School };
}

/**
 * 학교 삭제
 */
export async function deleteSchool(
  schoolId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);

  if (error) {
    console.error("[domains/school] 학교 삭제 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

