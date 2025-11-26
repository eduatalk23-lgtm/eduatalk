"use server";

import {
  getSchoolById as getSchoolByIdData,
  getSchoolByName as getSchoolByNameData,
  getSchools,
  getRegions,
} from "@/lib/data/schools";
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
    const school = await getSchoolByIdData(schoolId);
    if (!school) {
      return null;
    }

    return {
      id: school.id,
      name: school.name,
      type: school.type,
      region: school.region,
    };
  } catch (error) {
    console.error("[schoolActions] ID 조회 오류:", error);
    return null;
  }
}

/**
 * 학교명으로 학교 정보 조회
 */
export async function getSchoolByName(
  schoolName: string,
  type?: "중학교" | "고등학교" | "대학교"
): Promise<School | null> {
  try {
    const school = await getSchoolByNameData(schoolName, type);
    if (!school) {
      return null;
    }

    return {
      id: school.id,
      name: school.name,
      type: school.type,
      region: school.region,
    };
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
    const schools = await getSchools({ type, includeInactive: false });

    // 검색어 필터링 (클라이언트 사이드)
    const filtered = query.trim()
      ? schools.filter((school) =>
          school.name.toLowerCase().includes(query.toLowerCase())
        )
      : schools;

    return filtered.map((school) => ({
      id: school.id,
      name: school.name,
      type: school.type,
      region: school.region,
    }));
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
    const existing = await getSchoolByNameData(name, type);
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        type: existing.type,
        region: existing.region,
      };
    }

    // 지역 매칭 (region 텍스트로 region_id 찾기)
    let regionId: string | null = null;
    if (region) {
      const regions = await getRegions();
      const matchedRegion = regions.find((r) => r.name === region);
      if (matchedRegion) {
        regionId = matchedRegion.id;
      }
    }

    // 새로 등록
    const { data: school, error } = await supabase
      .from("schools")
      .insert({
        name,
        type,
        region_id: regionId,
      })
      .select("id, name, type")
      .single();

    if (error) {
      console.error("[schoolActions] 자동 등록 실패:", error);
      return null;
    }

    // 지역 정보 포함하여 반환
    const schoolWithRegion = await getSchoolByNameData(name, type);
    return schoolWithRegion
      ? {
          id: schoolWithRegion.id,
          name: schoolWithRegion.name,
          type: schoolWithRegion.type,
          region: schoolWithRegion.region,
        }
      : {
          id: school.id,
          name: school.name,
          type: school.type,
          region: null,
        };
  } catch (error) {
    console.error("[schoolActions] 자동 등록 오류:", error);
    return null;
  }
}

