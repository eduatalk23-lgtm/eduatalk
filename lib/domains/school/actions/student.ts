"use server";

/**
 * 학생용 학교 관련 Server Actions
 *
 * 새 테이블 구조:
 * - school_info: 중·고등학교 (읽기 전용)
 * - universities: 대학교 (읽기 전용)
 * - university_campuses: 대학교 캠퍼스 (읽기 전용)
 * - all_schools_view: 통합 조회 VIEW
 */

import {
  getAllSchools,
  searchAllSchools,
  getSchoolByUnifiedId,
  getRegions,
} from "@/lib/data/schools";
import type {
  SchoolType,
  SchoolTypeKor,
} from "@/lib/domains/school/types";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";

// 상수
const SCHOOL_TYPE_REVERSE_MAP: Record<SchoolTypeKor, SchoolType> = {
  "중학교": "MIDDLE",
  "고등학교": "HIGH",
  "대학교": "UNIVERSITY",
};

const SCHOOL_TYPE_MAP: Record<SchoolType, SchoolTypeKor> = {
  MIDDLE: "중학교",
  HIGH: "고등학교",
  UNIVERSITY: "대학교",
};

/**
 * 학교 간소화 타입 (클라이언트용)
 */
export type School = {
  id: string;
  name: string;
  type: SchoolTypeKor;
  region: string | null;
};

/**
 * 학교 ID로 학교 정보 조회
 */
export async function getSchoolById(schoolId: string): Promise<School | null> {
  try {
    const school = await getSchoolByUnifiedId(schoolId);
    if (!school) {
      return null;
    }

    return {
      id: school.id,
      name: school.name,
      type: SCHOOL_TYPE_MAP[school.school_type],
      region: school.region,
    };
  } catch (error) {
    logActionError({ domain: "school", action: "getSchoolById" }, error, { schoolId });
    return null;
  }
}

/**
 * 학교명으로 학교 정보 조회
 */
export async function getSchoolByName(
  schoolName: string,
  type?: SchoolTypeKor
): Promise<School | null> {
  try {
    const schoolType = type ? SCHOOL_TYPE_REVERSE_MAP[type] : undefined;

    const results = await searchAllSchools({
      query: schoolName,
      schoolType,
      limit: 1,
    });

    if (results.length === 0) {
      return null;
    }

    const school = await getSchoolByUnifiedId(results[0].id);
    if (!school) {
      return null;
    }

    return {
      id: school.id,
      name: school.name,
      type: SCHOOL_TYPE_MAP[school.school_type],
      region: school.region,
    };
  } catch (error) {
    logActionError({ domain: "school", action: "getSchoolByName" }, error, { schoolName, type });
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
  type?: SchoolTypeKor
): Promise<School[]> {
  try {
    const schoolType = type ? SCHOOL_TYPE_REVERSE_MAP[type] : undefined;

    const results = await searchAllSchools({
      query,
      schoolType,
      limit: 50,
    });

    return results.map((school) => ({
      id: school.id,
      name: school.name,
      type: SCHOOL_TYPE_MAP[school.schoolType],
      region: school.region,
    }));
  } catch (error) {
    logActionError({ domain: "school", action: "searchSchools" }, error, { query, type });
    return [];
  }
}

/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 자동 등록은 더 이상 지원되지 않습니다.
 */
export async function autoRegisterSchool(
  name: string,
  type: SchoolTypeKor,
  region?: string | null
): Promise<School | null> {
  logActionWarn({ domain: "school", action: "autoRegisterSchool" }, "autoRegisterSchool은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.", { name, type, region });

  // 기존 학교 검색만 수행
  const existing = await getSchoolByName(name, type);
  if (existing) {
    return existing;
  }

  // 등록 불가 - 읽기 전용
  return null;
}
