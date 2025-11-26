"use server";

/**
 * School 도메인 Server Actions
 *
 * 이 파일은 학교 관련 모든 Server Actions를 통합합니다.
 * 기존의 분산된 schoolActions.ts 파일들을 대체합니다.
 *
 * 역할별 권한:
 * - admin, consultant: 학교 CRUD 모든 권한
 * - student: 학교 조회, 자동 등록만 가능
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSchoolSchema, updateSchoolSchema } from "./validation";
import {
  getSchools as getSchoolsQuery,
  getSchoolById as getSchoolByIdQuery,
  getSchoolByName as getSchoolByNameQuery,
  getRegions as getRegionsQuery,
  getRegionsByLevel as getRegionsByLevelQuery,
  getRegionsByParent as getRegionsByParentQuery,
  checkSchoolDuplicate,
  validateRegionId,
  createSchool as createSchoolQuery,
  updateSchool as updateSchoolQuery,
  deleteSchool as deleteSchoolQuery,
} from "./queries";
import type {
  School,
  Region,
  SchoolType,
  SchoolSimple,
  SchoolActionResult,
} from "./types";

// ============================================
// 공통 헬퍼 함수
// ============================================

function parseFormString(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function parseFormStringOrNull(value: FormDataEntryValue | null): string | null {
  const str = parseFormString(value);
  return str || null;
}

// ============================================
// 조회 Actions (모든 사용자 접근 가능)
// ============================================

/**
 * 학교 목록 조회
 */
export async function getSchoolsAction(options?: {
  regionId?: string;
  type?: SchoolType;
  includeInactive?: boolean;
}): Promise<School[]> {
  return getSchoolsQuery(options);
}

/**
 * 학교 ID로 조회
 */
export async function getSchoolByIdAction(schoolId: string): Promise<School | null> {
  return getSchoolByIdQuery(schoolId);
}

/**
 * 학교명으로 조회
 */
export async function getSchoolByNameAction(
  name: string,
  type?: SchoolType
): Promise<School | null> {
  return getSchoolByNameQuery(name, type);
}

/**
 * 학교 검색 (간소화된 응답)
 */
export async function searchSchoolsAction(
  query: string,
  type?: SchoolType
): Promise<SchoolSimple[]> {
  const schools = await getSchoolsQuery({ type });

  const filtered = query.trim()
    ? schools.filter((school) =>
        school.name.toLowerCase().includes(query.toLowerCase())
      )
    : schools;

  return filtered.map((school) => ({
    id: school.id,
    name: school.name,
    type: school.type,
    region: school.region ?? null,
  }));
}

/**
 * 지역 목록 조회
 */
export async function getRegionsAction(): Promise<Region[]> {
  return getRegionsQuery();
}

/**
 * 레벨별 지역 조회
 */
export async function getRegionsByLevelAction(level: 1 | 2 | 3): Promise<Region[]> {
  return getRegionsByLevelQuery(level);
}

/**
 * 상위 지역별 하위 지역 조회
 */
export async function getRegionsByParentAction(parentId: string): Promise<Region[]> {
  return getRegionsByParentQuery(parentId);
}

// ============================================
// 관리자 전용 Actions (admin, consultant만)
// ============================================

/**
 * 학교 생성 (관리자 전용)
 */
export async function createSchoolAction(
  formData: FormData
): Promise<SchoolActionResult> {
  // 권한 확인
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  // FormData 파싱
  const rawData = {
    name: parseFormString(formData.get("name")),
    type: parseFormString(formData.get("type")) as SchoolType,
    region_id: parseFormStringOrNull(formData.get("region_id")),
    address: parseFormStringOrNull(formData.get("address")),
    postal_code: parseFormStringOrNull(formData.get("postal_code")),
    address_detail: parseFormStringOrNull(formData.get("address_detail")),
    city: parseFormStringOrNull(formData.get("city")),
    district: parseFormStringOrNull(formData.get("district")),
    phone: parseFormStringOrNull(formData.get("phone")),
    category: parseFormStringOrNull(formData.get("category")) as any,
    university_type: parseFormStringOrNull(formData.get("university_type")) as any,
    university_ownership: parseFormStringOrNull(formData.get("university_ownership")) as any,
    campus_name: parseFormStringOrNull(formData.get("campus_name")),
  };

  // 검증
  const validation = createSchoolSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return { success: false, error: firstError?.message || "입력값이 올바르지 않습니다." };
  }

  const data = validation.data;

  // 지역 ID 검증
  if (data.region_id) {
    const isValidRegion = await validateRegionId(data.region_id);
    if (!isValidRegion) {
      return { success: false, error: "유효하지 않은 지역입니다." };
    }
  }

  // 중복 확인
  const duplicate = await checkSchoolDuplicate(
    data.name,
    data.type,
    data.region_id,
    data.type === "대학교" ? data.campus_name : null
  );

  if (duplicate) {
    return { success: false, error: "이미 등록된 학교입니다." };
  }

  // 생성
  const result = await createSchoolQuery(data);

  if (result.success) {
    revalidatePath("/admin/schools");
  }

  return result;
}

/**
 * 학교 수정 (관리자 전용)
 */
export async function updateSchoolAction(
  formData: FormData
): Promise<SchoolActionResult> {
  // 권한 확인
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  // FormData 파싱
  const rawData = {
    id: parseFormString(formData.get("id")),
    name: parseFormString(formData.get("name")),
    type: parseFormString(formData.get("type")) as SchoolType,
    region_id: parseFormStringOrNull(formData.get("region_id")),
    address: parseFormStringOrNull(formData.get("address")),
    postal_code: parseFormStringOrNull(formData.get("postal_code")),
    address_detail: parseFormStringOrNull(formData.get("address_detail")),
    city: parseFormStringOrNull(formData.get("city")),
    district: parseFormStringOrNull(formData.get("district")),
    phone: parseFormStringOrNull(formData.get("phone")),
    category: parseFormStringOrNull(formData.get("category")) as any,
    university_type: parseFormStringOrNull(formData.get("university_type")) as any,
    university_ownership: parseFormStringOrNull(formData.get("university_ownership")) as any,
    campus_name: parseFormStringOrNull(formData.get("campus_name")),
  };

  // 검증
  const validation = updateSchoolSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return { success: false, error: firstError?.message || "입력값이 올바르지 않습니다." };
  }

  const data = validation.data;

  // 지역 ID 검증
  if (data.region_id) {
    const isValidRegion = await validateRegionId(data.region_id);
    if (!isValidRegion) {
      return { success: false, error: "유효하지 않은 지역입니다." };
    }
  }

  // 중복 확인 (자기 자신 제외)
  const duplicate = await checkSchoolDuplicate(
    data.name,
    data.type,
    data.region_id,
    data.type === "대학교" ? data.campus_name : null,
    data.id
  );

  if (duplicate) {
    return { success: false, error: "이미 등록된 학교입니다." };
  }

  // 수정
  const result = await updateSchoolQuery(data);

  if (result.success) {
    revalidatePath("/admin/schools");
    revalidatePath(`/admin/schools/${data.id}`);
  }

  return result;
}

/**
 * 학교 삭제 (관리자 전용)
 */
export async function deleteSchoolAction(
  schoolId: string
): Promise<SchoolActionResult> {
  // 권한 확인
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const result = await deleteSchoolQuery(schoolId);

  if (result.success) {
    revalidatePath("/admin/schools");
  }

  return result;
}

// ============================================
// 학생용 Actions
// ============================================

/**
 * 학교 자동 등록 (학생용)
 * DB에 없는 학교를 자동으로 등록합니다.
 */
export async function autoRegisterSchoolAction(
  name: string,
  type: SchoolType,
  region?: string | null
): Promise<SchoolSimple | null> {
  try {
    // 기존 학교 확인
    const existing = await getSchoolByNameQuery(name, type);
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        type: existing.type,
        region: existing.region ?? null,
      };
    }

    // 지역 ID 매칭 (region 텍스트로)
    let regionId: string | null = null;
    if (region) {
      const regions = await getRegionsQuery();
      const matchedRegion = regions.find((r) => r.name === region);
      if (matchedRegion) {
        regionId = matchedRegion.id;
      }
    }

    // 새로 등록
    const result = await createSchoolQuery({
      name,
      type,
      region_id: regionId,
    });

    if (!result.success || !result.data) {
      console.error("[domains/school] 자동 등록 실패:", result.error);
      return null;
    }

    // 지역 정보 포함하여 반환
    const school = await getSchoolByNameQuery(name, type);
    return school
      ? {
          id: school.id,
          name: school.name,
          type: school.type,
          region: school.region ?? null,
        }
      : {
          id: result.data.id,
          name: result.data.name,
          type: result.data.type,
          region: null,
        };
  } catch (error) {
    console.error("[domains/school] 자동 등록 오류:", error);
    return null;
  }
}

