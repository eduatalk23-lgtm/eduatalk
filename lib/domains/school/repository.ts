/**
 * School 도메인 Repository
 *
 * 이 파일은 순수한 데이터 접근만을 담당합니다.
 * - Supabase 쿼리만 수행
 * - 비즈니스 로직 없음
 * - 에러 처리는 최소화 (상위 레이어에서 처리)
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  School,
  Region,
  SchoolType,
  CreateSchoolInput,
  UpdateSchoolInput,
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
// School Repository
// ============================================

/**
 * 학교 목록 조회 (JOIN 포함)
 */
export async function findAllSchools(options?: {
  regionId?: string;
  type?: SchoolType;
}): Promise<School[]> {
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

  if (error) throw error;

  return ((data ?? []) as any[]).map((school) => ({
    ...school,
    region: school.regions?.name || null,
  })) as School[];
}

/**
 * 학교 목록 조회 (JOIN 없이 - fallback용)
 */
export async function findAllSchoolsSimple(options?: {
  regionId?: string;
  type?: SchoolType;
}): Promise<School[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("schools").select("*");

  if (options?.regionId) {
    query = query.eq("region_id", options.regionId);
  }

  if (options?.type) {
    query = query.eq("type", options.type);
  }

  const { data, error } = await query
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as School[]).map((school) => ({
    ...school,
    region: null,
  }));
}

/**
 * 학교 ID로 조회
 */
export async function findSchoolById(schoolId: string): Promise<School | null> {
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

  if (error) throw error;

  if (!data) return null;

  return {
    ...data,
    region: (data as any).regions?.name || null,
  } as School;
}

/**
 * 학교명으로 조회
 */
export async function findSchoolByName(
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

  if (error) throw error;

  if (!data) return null;

  return {
    ...data,
    region: (data as any).regions?.name || null,
  } as School;
}

/**
 * 학교 중복 확인용 조회
 */
export async function findSchoolByConditions(
  name: string,
  type: SchoolType,
  regionId?: string | null,
  campusName?: string | null,
  excludeId?: string
): Promise<School | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("schools")
    .select("*")
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

  if (error) throw error;
  return data as School | null;
}

/**
 * 학교 생성
 */
export async function insertSchool(input: CreateSchoolInput): Promise<School> {
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
      university_ownership:
        input.type === "대학교" ? input.university_ownership : null,
      campus_name: input.type === "대학교" ? input.campus_name : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as School;
}

/**
 * 학교 수정
 */
export async function updateSchoolById(
  input: UpdateSchoolInput
): Promise<School> {
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
      university_type:
        updateData.type === "대학교" ? updateData.university_type : null,
      university_ownership:
        updateData.type === "대학교" ? updateData.university_ownership : null,
      campus_name:
        updateData.type === "대학교" ? updateData.campus_name : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as School;
}

/**
 * 학교 삭제
 */
export async function deleteSchoolById(schoolId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);

  if (error) throw error;
}

