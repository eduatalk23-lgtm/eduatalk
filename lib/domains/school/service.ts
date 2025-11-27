/**
 * School 도메인 Service
 *
 * 새 테이블 구조:
 * - school_info: 중·고등학교 (읽기 전용)
 * - universities: 대학교 (읽기 전용)
 * - university_campuses: 대학교 캠퍼스 (읽기 전용)
 * - all_schools_view: 통합 조회 VIEW
 *
 * 주의: 새 테이블들은 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.
 * CRUD 작업이 필요한 경우 별도 관리 테이블을 사용해야 합니다.
 */

import * as repository from "./repository";
import type {
  SchoolType,
  SchoolTypeKor,
  Region,
  AllSchoolsView,
  SchoolSimple,
  SchoolInfo,
  University,
  UniversityWithCampus,
  GetSchoolsOptions,
  SearchSchoolsOptions,
  SchoolActionResult,
  SCHOOL_TYPE_MAP,
  toSchoolSimple,
  parseSchoolId,
} from "./types";

// 상수
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

// ============================================
// Region Service
// ============================================

/**
 * 모든 활성 지역 조회
 */
export async function getAllRegions(): Promise<Region[]> {
  try {
    return await repository.findAllRegions();
  } catch (error) {
    console.error("[school/service] 지역 조회 실패:", error);
    return [];
  }
}

/**
 * 레벨별 지역 조회
 */
export async function getRegionsByLevel(level: 1 | 2 | 3): Promise<Region[]> {
  try {
    return await repository.findRegionsByLevel(level);
  } catch (error) {
    console.error("[school/service] 레벨별 지역 조회 실패:", error);
    return [];
  }
}

/**
 * 상위 지역의 하위 지역 조회
 */
export async function getRegionsByParent(parentId: string): Promise<Region[]> {
  try {
    return await repository.findRegionsByParent(parentId);
  } catch (error) {
    console.error("[school/service] 하위 지역 조회 실패:", error);
    return [];
  }
}

/**
 * 지역 ID 유효성 검증
 */
export async function isValidRegionId(regionId: string): Promise<boolean> {
  try {
    const region = await repository.findRegionById(regionId);
    return region !== null;
  } catch (error) {
    console.error("[school/service] 지역 검증 실패:", error);
    return false;
  }
}

/**
 * 지역명으로 지역 ID 찾기
 */
export async function findRegionIdByName(regionName: string): Promise<string | null> {
  try {
    const regions = await repository.findAllRegions();
    const matchedRegion = regions.find((r) => r.name === regionName);
    return matchedRegion?.id ?? null;
  } catch (error) {
    console.error("[school/service] 지역 ID 검색 실패:", error);
    return null;
  }
}

// ============================================
// 통합 학교 Service
// ============================================

/**
 * 통합 학교 목록 조회
 */
export async function getAllSchools(options?: GetSchoolsOptions): Promise<AllSchoolsView[]> {
  try {
    return await repository.findAllSchools(options);
  } catch (error) {
    console.error("[school/service] 학교 조회 실패:", error);
    return [];
  }
}

/**
 * 통합 학교 검색
 */
export async function searchSchools(options: SearchSchoolsOptions): Promise<SchoolSimple[]> {
  try {
    const schools = await repository.searchSchools(options);
    return schools.map((s) => ({
      id: s.id,
      name: s.name,
      schoolType: s.school_type,
      region: s.region,
      sourceTable: s.source_table,
      sourceId: s.source_id,
    }));
  } catch (error) {
    console.error("[school/service] 학교 검색 실패:", error);
    return [];
  }
}

/**
 * 통합 학교 ID로 조회
 */
export async function getSchoolByUnifiedId(unifiedId: string): Promise<AllSchoolsView | null> {
  try {
    return await repository.findSchoolByUnifiedId(unifiedId);
  } catch (error) {
    console.error("[school/service] 학교 조회 실패:", error);
    return null;
  }
}

/**
 * 학교명으로 조회
 */
export async function getSchoolByName(
  name: string,
  schoolType?: SchoolType
): Promise<AllSchoolsView | null> {
  try {
    return await repository.findSchoolByName(name, schoolType);
  } catch (error) {
    console.error("[school/service] 학교명 조회 실패:", error);
    return null;
  }
}

// ============================================
// 중·고등학교 Service
// ============================================

/**
 * 중·고등학교 목록 조회
 */
export async function getSchoolInfoList(options?: {
  schoolLevel?: "중" | "고";
  region?: string;
  limit?: number;
}): Promise<SchoolInfo[]> {
  try {
    return await repository.findSchoolInfoList(options);
  } catch (error) {
    console.error("[school/service] 중·고등학교 조회 실패:", error);
    return [];
  }
}

/**
 * 중·고등학교 ID로 조회
 */
export async function getSchoolInfoById(id: number): Promise<SchoolInfo | null> {
  try {
    return await repository.findSchoolInfoById(id);
  } catch (error) {
    console.error("[school/service] 중·고등학교 조회 실패:", error);
    return null;
  }
}

/**
 * 중·고등학교 검색
 */
export async function searchSchoolInfo(
  query: string,
  schoolLevel?: "중" | "고",
  limit = 50
): Promise<SchoolInfo[]> {
  try {
    return await repository.searchSchoolInfo(query, schoolLevel, limit);
  } catch (error) {
    console.error("[school/service] 중·고등학교 검색 실패:", error);
    return [];
  }
}

// ============================================
// 대학교 Service
// ============================================

/**
 * 대학교 목록 조회
 */
export async function getUniversities(options?: {
  establishmentType?: string;
  universityType?: string;
  limit?: number;
}): Promise<University[]> {
  try {
    return await repository.findUniversities(options);
  } catch (error) {
    console.error("[school/service] 대학교 조회 실패:", error);
    return [];
  }
}

/**
 * 대학교 캠퍼스 목록 조회
 */
export async function getUniversityCampuses(options?: {
  universityId?: number;
  region?: string;
  limit?: number;
}): Promise<UniversityWithCampus[]> {
  try {
    return await repository.findUniversityCampuses(options);
  } catch (error) {
    console.error("[school/service] 대학교 캠퍼스 조회 실패:", error);
    return [];
  }
}

/**
 * 대학교 캠퍼스 ID로 조회
 */
export async function getUniversityCampusById(id: number): Promise<UniversityWithCampus | null> {
  try {
    return await repository.findUniversityCampusById(id);
  } catch (error) {
    console.error("[school/service] 대학교 캠퍼스 조회 실패:", error);
    return null;
  }
}

/**
 * 대학교/캠퍼스 검색
 */
export async function searchUniversityCampuses(
  query: string,
  limit = 50
): Promise<UniversityWithCampus[]> {
  try {
    return await repository.searchUniversityCampuses(query, limit);
  } catch (error) {
    console.error("[school/service] 대학교 검색 실패:", error);
    return [];
  }
}

// ============================================
// 하위 호환성 함수 (Deprecated)
// ============================================

/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 CRUD 작업은 더 이상 지원되지 않습니다.
 */
export async function createSchool(): Promise<SchoolActionResult> {
  console.warn("[school/service] createSchool은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.");
  return {
    success: false,
    error: "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.",
  };
}

/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 CRUD 작업은 더 이상 지원되지 않습니다.
 */
export async function updateSchool(): Promise<SchoolActionResult> {
  console.warn("[school/service] updateSchool은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.");
  return {
    success: false,
    error: "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.",
  };
}

/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 CRUD 작업은 더 이상 지원되지 않습니다.
 */
export async function deleteSchool(): Promise<SchoolActionResult> {
  console.warn("[school/service] deleteSchool은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.");
  return {
    success: false,
    error: "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.",
  };
}

/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 */
export async function autoRegisterSchool(): Promise<SchoolSimple | null> {
  console.warn("[school/service] autoRegisterSchool은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.");
  return null;
}

/**
 * @deprecated checkDuplicateSchool은 더 이상 필요 없습니다.
 */
export async function checkDuplicateSchool(): Promise<boolean> {
  console.warn("[school/service] checkDuplicateSchool은 더 이상 지원되지 않습니다.");
  return false;
}
