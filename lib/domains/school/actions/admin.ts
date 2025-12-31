"use server";

/**
 * 관리자용 학교 관련 Server Actions
 *
 * 새 테이블 구조:
 * - school_info: 중·고등학교 (읽기 전용, 나이스 데이터)
 * - universities: 대학교 (읽기 전용)
 * - university_campuses: 대학교 캠퍼스 (읽기 전용)
 * - all_schools_view: 통합 조회 VIEW
 *
 * 주의: 새 테이블들은 외부 데이터 기반으로 읽기 전용입니다.
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  getAllSchools,
  searchAllSchools,
  getSchoolByUnifiedId,
  getSchoolInfoList,
  getUniversityCampuses,
  getRegions,
  getRegionsByLevel,
  getRegionsByParent,
} from "@/lib/data/schools";
import type {
  School,
  Region,
  AllSchoolsView,
  SchoolInfo,
  UniversityWithCampus,
} from "@/lib/data/schools";
import type {
  SchoolType,
  SchoolTypeKor,
} from "@/lib/domains/school/types";

// Re-export types
export type { School, Region };

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
 * 학교 목록 조회 (클라이언트용)
 */
export async function getSchoolsAction(options?: {
  regionId?: string;
  type?: SchoolTypeKor;
  includeInactive?: boolean;
}): Promise<School[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  const schoolType = options?.type ? SCHOOL_TYPE_REVERSE_MAP[options.type] : undefined;
  
  const allSchools = await getAllSchools({
    schoolType,
    limit: 1000,
  });

  return allSchools.map((s) => ({
    id: s.id,
    name: s.name,
    type: SCHOOL_TYPE_MAP[s.school_type],
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
 * 지역 목록 조회 (클라이언트용)
 */
export async function getRegionsAction(): Promise<Region[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  return await getRegions();
}

/**
 * 레벨별 지역 조회 (클라이언트용)
 */
export async function getRegionsByLevelAction(
  level: 1 | 2 | 3
): Promise<Region[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  return await getRegionsByLevel(level);
}

/**
 * 상위 지역별 하위 지역 조회 (클라이언트용)
 */
export async function getRegionsByParentAction(
  parentId: string
): Promise<Region[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  return await getRegionsByParent(parentId);
}

/**
 * 통합 학교 목록 조회 (새 API)
 */
export async function getAllSchoolsAction(options?: {
  schoolType?: SchoolType;
  region?: string;
  limit?: number;
}): Promise<AllSchoolsView[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  return await getAllSchools(options);
}

/**
 * 중·고등학교 목록 조회 (새 API)
 */
export async function getSchoolInfoListAction(options?: {
  schoolLevel?: "중" | "고";
  region?: string;
  limit?: number;
}): Promise<SchoolInfo[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  return await getSchoolInfoList(options);
}

/**
 * 대학교 캠퍼스 목록 조회 (새 API)
 */
export async function getUniversityCampusesAction(options?: {
  universityId?: number;
  region?: string;
  limit?: number;
}): Promise<UniversityWithCampus[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  return await getUniversityCampuses(options);
}

/**
 * 학교 검색 (새 API)
 */
export async function searchSchoolsAction(
  query: string,
  schoolType?: SchoolType,
  limit = 50
): Promise<{ id: string; name: string; schoolType: SchoolType; region: string | null }[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  return await searchAllSchools({
    query,
    schoolType,
    limit,
  });
}

// ============================================
// Deprecated Functions (읽기 전용으로 변경됨)
// ============================================

import { AppError, ErrorCode } from "@/lib/errors";
import { logActionWarn } from "@/lib/logging/actionLogger";
import { withActionResponse } from "@/lib/utils/serverActionHandler";

/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 생성은 더 이상 지원되지 않습니다.
 */
async function _createSchool(formData: FormData): Promise<void> {
  logActionWarn(
    { domain: "school", action: "createSchool" },
    "createSchool은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다."
  );
  throw new AppError(
    "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다. 학교 추가가 필요하면 관리자에게 문의하세요.",
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}

export const createSchool = withActionResponse(_createSchool);

/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 수정은 더 이상 지원되지 않습니다.
 */
async function _updateSchool(formData: FormData): Promise<void> {
  logActionWarn(
    { domain: "school", action: "updateSchool" },
    "updateSchool은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다."
  );
  throw new AppError(
    "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.",
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}

export const updateSchool = withActionResponse(_updateSchool);

/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 삭제는 더 이상 지원되지 않습니다.
 */
async function _deleteSchool(schoolId: string): Promise<void> {
  logActionWarn(
    { domain: "school", action: "deleteSchool" },
    "deleteSchool은 더 이상 지원되지 않습니다. 새 테이블은 읽기 전용입니다.",
    { schoolId }
  );
  throw new AppError(
    "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다.",
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}

export const deleteSchool = withActionResponse(_deleteSchool);
