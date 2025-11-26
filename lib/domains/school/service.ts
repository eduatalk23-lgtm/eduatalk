/**
 * School 도메인 Service
 *
 * 이 파일은 비즈니스 로직을 담당합니다.
 * - 데이터 변환 및 가공
 * - 비즈니스 규칙 적용
 * - 중복 확인 등 검증 로직
 * - Repository 호출 및 에러 처리
 */

import * as repository from "./repository";
import type {
  School,
  Region,
  SchoolType,
  SchoolSimple,
  CreateSchoolInput,
  UpdateSchoolInput,
  SchoolActionResult,
} from "./types";

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
export async function findRegionIdByName(
  regionName: string
): Promise<string | null> {
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
// School Service
// ============================================

/**
 * 학교 목록 조회 (fallback 포함)
 */
export async function getAllSchools(options?: {
  regionId?: string;
  type?: SchoolType;
}): Promise<School[]> {
  try {
    return await repository.findAllSchools(options);
  } catch (error) {
    console.error("[school/service] 학교 조회 실패, fallback 시도:", error);

    // JOIN 실패 시 fallback
    try {
      return await repository.findAllSchoolsSimple(options);
    } catch (fallbackError) {
      console.error("[school/service] fallback 조회도 실패:", fallbackError);
      return [];
    }
  }
}

/**
 * 학교 ID로 조회
 */
export async function getSchoolById(schoolId: string): Promise<School | null> {
  try {
    return await repository.findSchoolById(schoolId);
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
  type?: SchoolType
): Promise<School | null> {
  try {
    return await repository.findSchoolByName(name, type);
  } catch (error) {
    console.error("[school/service] 학교명 조회 실패:", error);
    return null;
  }
}

/**
 * 학교 검색 (간소화된 응답)
 */
export async function searchSchools(
  query: string,
  type?: SchoolType
): Promise<SchoolSimple[]> {
  const schools = await getAllSchools({ type });

  const filtered = query.trim()
    ? schools.filter((school) =>
        school.name.toLowerCase().includes(query.toLowerCase())
      )
    : schools;

  return filtered.map(toSchoolSimple);
}

/**
 * 학교 중복 확인
 */
export async function checkDuplicateSchool(
  name: string,
  type: SchoolType,
  regionId?: string | null,
  campusName?: string | null,
  excludeId?: string
): Promise<boolean> {
  try {
    const existing = await repository.findSchoolByConditions(
      name,
      type,
      regionId,
      campusName,
      excludeId
    );
    return existing !== null;
  } catch (error) {
    console.error("[school/service] 중복 확인 실패:", error);
    return false;
  }
}

/**
 * 학교 생성
 */
export async function createSchool(
  input: CreateSchoolInput
): Promise<SchoolActionResult> {
  try {
    // 지역 ID 검증
    if (input.region_id) {
      const isValid = await isValidRegionId(input.region_id);
      if (!isValid) {
        return { success: false, error: "유효하지 않은 지역입니다." };
      }
    }

    // 중복 확인
    const isDuplicate = await checkDuplicateSchool(
      input.name,
      input.type,
      input.region_id,
      input.type === "대학교" ? input.campus_name : null
    );

    if (isDuplicate) {
      return { success: false, error: "이미 등록된 학교입니다." };
    }

    // 생성
    const school = await repository.insertSchool(input);
    return { success: true, data: school };
  } catch (error) {
    console.error("[school/service] 학교 생성 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "학교 생성에 실패했습니다.",
    };
  }
}

/**
 * 학교 수정
 */
export async function updateSchool(
  input: UpdateSchoolInput
): Promise<SchoolActionResult> {
  try {
    // 지역 ID 검증
    if (input.region_id) {
      const isValid = await isValidRegionId(input.region_id);
      if (!isValid) {
        return { success: false, error: "유효하지 않은 지역입니다." };
      }
    }

    // 중복 확인 (자기 자신 제외)
    const isDuplicate = await checkDuplicateSchool(
      input.name,
      input.type,
      input.region_id,
      input.type === "대학교" ? input.campus_name : null,
      input.id
    );

    if (isDuplicate) {
      return { success: false, error: "이미 등록된 학교입니다." };
    }

    // 수정
    const school = await repository.updateSchoolById(input);
    return { success: true, data: school };
  } catch (error) {
    console.error("[school/service] 학교 수정 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "학교 수정에 실패했습니다.",
    };
  }
}

/**
 * 학교 삭제
 */
export async function deleteSchool(schoolId: string): Promise<SchoolActionResult> {
  try {
    await repository.deleteSchoolById(schoolId);
    return { success: true };
  } catch (error) {
    console.error("[school/service] 학교 삭제 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "학교 삭제에 실패했습니다.",
    };
  }
}

/**
 * 학교 자동 등록 (학생용)
 * DB에 없는 학교를 자동으로 등록합니다.
 */
export async function autoRegisterSchool(
  name: string,
  type: SchoolType,
  regionName?: string | null
): Promise<SchoolSimple | null> {
  try {
    // 기존 학교 확인
    const existing = await getSchoolByName(name, type);
    if (existing) {
      return toSchoolSimple(existing);
    }

    // 지역명으로 ID 찾기
    let regionId: string | null = null;
    if (regionName) {
      regionId = await findRegionIdByName(regionName);
    }

    // 새로 등록
    const result = await createSchool({
      name,
      type,
      region_id: regionId,
    });

    if (!result.success || !result.data) {
      console.error("[school/service] 자동 등록 실패:", result.error);
      return null;
    }

    return toSchoolSimple(result.data);
  } catch (error) {
    console.error("[school/service] 자동 등록 오류:", error);
    return null;
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * School을 SchoolSimple로 변환
 */
function toSchoolSimple(school: School): SchoolSimple {
  return {
    id: school.id,
    name: school.name,
    type: school.type,
    region: school.region ?? null,
  };
}

