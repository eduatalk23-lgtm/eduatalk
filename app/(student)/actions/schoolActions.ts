"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type School = {
  id: string;
  name: string;
  type: "중학교" | "고등학교" | "대학교";
  region: string | null;
};

/**
 * 학교 ID로 학교 정보 조회
 */
export async function getSchoolById(schoolId: string): Promise<School | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: school, error } = await supabase
      .from("schools")
      .select("id, name, type, region")
      .eq("id", schoolId)
      .maybeSingle();

    if (error) {
      console.error("[schoolActions] ID 조회 실패:", error);
      return null;
    }

    return school as School | null;
  } catch (error) {
    console.error("[schoolActions] ID 조회 오류:", error);
    return null;
  }
}

/**
 * 학교명으로 학교 정보 조회
 */
export async function getSchoolByName(
  schoolName: string
): Promise<School | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: schools, error } = await supabase
      .from("schools")
      .select("id, name, type, region")
      .eq("name", schoolName)
      .limit(1);

    if (error) {
      console.error("[schoolActions] 이름 조회 실패:", error);
      return null;
    }

    return (schools && schools.length > 0 ? schools[0] : null) as School | null;
  } catch (error) {
    console.error("[schoolActions] 이름 조회 오류:", error);
    return null;
  }
}

/**
 * 학교 검색
 * @param query 검색어
 * @param type 학교 타입 (중학교, 고등학교, 대학교)
 * @returns 검색된 학교 목록
 */
export async function searchSchools(
  query: string,
  type?: "중학교" | "고등학교" | "대학교"
): Promise<School[]> {
  try {
    const supabase = await createSupabaseServerClient();

    let schoolsQuery = supabase
      .from("schools")
      .select("id, name, type, region")
      .order("name", { ascending: true })
      .limit(50);

    // 검색어가 있으면 필터링
    if (query.trim()) {
      schoolsQuery = schoolsQuery.ilike("name", `%${query.trim()}%`);
    }

    // 타입 필터
    if (type && ["중학교", "고등학교", "대학교"].includes(type)) {
      schoolsQuery = schoolsQuery.eq("type", type);
    }

    const { data: schools, error } = await schoolsQuery;

    if (error) {
      console.error("[schoolActions] 검색 실패:", error);
      return [];
    }

    return (schools || []) as School[];
  } catch (error) {
    console.error("[schoolActions] 검색 오류:", error);
    return [];
  }
}

/**
 * 학교 자동 등록 (DB에 없는 학교를 등록)
 */
export async function autoRegisterSchool(
  name: string,
  type: "중학교" | "고등학교" | "대학교",
  region?: string | null
): Promise<School | null> {
  try {
    const supabase = await createSupabaseServerClient();

    // 중복 확인
    const { data: existing } = await supabase
      .from("schools")
      .select("id, name, type, region")
      .eq("name", name)
      .eq("type", type)
      .maybeSingle();

    if (existing) {
      return existing as School;
    }

    // 새로 등록
    const { data: school, error } = await supabase
      .from("schools")
      .insert({
        name,
        type,
        region: region || null,
      })
      .select("id, name, type, region")
      .single();

    if (error) {
      console.error("[schoolActions] 자동 등록 실패:", error);
      return null;
    }

    return school as School | null;
  } catch (error) {
    console.error("[schoolActions] 자동 등록 오류:", error);
    return null;
  }
}

