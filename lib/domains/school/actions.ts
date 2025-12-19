"use server";

/**
 * School 도메인 Server Actions
 *
 * 이 파일은 Server Actions만 담당합니다.
 * - 권한 검사
 * - FormData 파싱
 * - Service 호출
 * - Cache 무효화
 *
 * 비즈니스 로직은 service.ts에서 처리합니다.
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSchoolSchema, updateSchoolSchema, type CreateSchoolFormData, type UpdateSchoolFormData } from "./validation";
import * as service from "./service";
import { getFormString, getFormUuid } from "@/lib/utils/formDataHelpers";
import type {
  School,
  Region,
  SchoolType,
  SchoolSimple,
  SchoolActionResult,
} from "./types";
import { toLegacySchool } from "./types";

// ============================================
// 조회 Actions (모든 사용자 접근 가능)
// ============================================

/**
 * 학교 목록 조회
 */
export async function getSchoolsAction(options?: {
  regionId?: string;
  type?: SchoolType;
}): Promise<School[]> {
  const schools = await service.getAllSchools(
    options
      ? {
          region: options.regionId,
          schoolType: options.type,
        }
      : undefined
  );
  return schools.map(toLegacySchool);
}

/**
 * 학교 ID로 조회
 */
export async function getSchoolByIdAction(
  schoolId: string
): Promise<School | null> {
  const school = await service.getSchoolByUnifiedId(schoolId);
  return school ? toLegacySchool(school) : null;
}

/**
 * 학교명으로 조회
 */
export async function getSchoolByNameAction(
  name: string,
  type?: SchoolType
): Promise<School | null> {
  const school = await service.getSchoolByName(name, type);
  return school ? toLegacySchool(school) : null;
}

/**
 * 학교 검색 (간소화된 응답)
 */
export async function searchSchoolsAction(
  query: string,
  type?: SchoolType
): Promise<SchoolSimple[]> {
  return service.searchSchools({
    query,
    schoolType: type,
  });
}

/**
 * 지역 목록 조회
 */
export async function getRegionsAction(): Promise<Region[]> {
  return service.getAllRegions();
}

/**
 * 레벨별 지역 조회
 */
export async function getRegionsByLevelAction(
  level: 1 | 2 | 3
): Promise<Region[]> {
  return service.getRegionsByLevel(level);
}

/**
 * 상위 지역별 하위 지역 조회
 */
export async function getRegionsByParentAction(
  parentId: string
): Promise<Region[]> {
  return service.getRegionsByParent(parentId);
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
    name: getFormString(formData, "name") || "",
    type: (getFormString(formData, "type") || "") as SchoolType,
    region_id: getFormUuid(formData, "region_id"),
    address: getFormString(formData, "address"),
    postal_code: getFormString(formData, "postal_code"),
    address_detail: getFormString(formData, "address_detail"),
    city: getFormString(formData, "city"),
    district: getFormString(formData, "district"),
    phone: getFormString(formData, "phone"),
    category: getFormString(formData, "category") as CreateSchoolFormData["category"] | null,
    university_type: getFormString(formData, "university_type") as CreateSchoolFormData["university_type"] | null,
    university_ownership: getFormString(formData, "university_ownership") as CreateSchoolFormData["university_ownership"] | null,
    campus_name: getFormString(formData, "campus_name"),
  };

  // 검증
  const validation = createSchoolSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return {
      success: false,
      error: firstError?.message || "입력값이 올바르지 않습니다.",
    };
  }

  // Service 호출 (deprecated: 읽기 전용)
  const result = await service.createSchool();

  // Cache 무효화
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
    id: getFormString(formData, "id") || "",
    name: getFormString(formData, "name") || "",
    type: (getFormString(formData, "type") || "") as SchoolType,
    region_id: getFormUuid(formData, "region_id"),
    address: getFormString(formData, "address"),
    postal_code: getFormString(formData, "postal_code"),
    address_detail: getFormString(formData, "address_detail"),
    city: getFormString(formData, "city"),
    district: getFormString(formData, "district"),
    phone: getFormString(formData, "phone"),
    category: getFormString(formData, "category") as UpdateSchoolFormData["category"] | null,
    university_type: getFormString(formData, "university_type") as UpdateSchoolFormData["university_type"] | null,
    university_ownership: getFormString(formData, "university_ownership") as UpdateSchoolFormData["university_ownership"] | null,
    campus_name: getFormString(formData, "campus_name"),
  };

  // 검증
  const validation = updateSchoolSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return {
      success: false,
      error: firstError?.message || "입력값이 올바르지 않습니다.",
    };
  }

  // Service 호출 (deprecated: 읽기 전용)
  const result = await service.updateSchool();

  // Cache 무효화
  if (result.success) {
    revalidatePath("/admin/schools");
    revalidatePath(`/admin/schools/${validation.data.id}`);
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

  // Service 호출 (deprecated: 읽기 전용)
  const result = await service.deleteSchool();

  // Cache 무효화
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
 */
export async function autoRegisterSchoolAction(
  name: string,
  type: SchoolType,
  region?: string | null
): Promise<SchoolSimple | null> {
  // deprecated: 읽기 전용
  return service.autoRegisterSchool();
}
