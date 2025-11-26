"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  getRegions,
  getSchools,
  getRegionsByLevel,
  getRegionsByParent,
  checkSchoolDuplicate,
} from "@/lib/data/schools";
import type { School, Region } from "@/lib/data/schools";

/**
 * 학교 목록 조회 (클라이언트용)
 */
export async function getSchoolsAction(options?: {
  regionId?: string;
  type?: "중학교" | "고등학교" | "대학교";
  includeInactive?: boolean;
}): Promise<School[]> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return [];
  }

  return await getSchools(options);
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
 * 학교 생성
 */
export async function createSchool(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const regionId = String(formData.get("region_id") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const addressDetail = String(formData.get("address_detail") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const district = String(formData.get("district") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  // 고등학교 속성
  const category = String(formData.get("category") ?? "").trim() || null;
  
  // 대학교 속성
  const universityType = String(formData.get("university_type") ?? "").trim() || null;
  const universityOwnership = String(formData.get("university_ownership") ?? "").trim() || null;
  const campusName = String(formData.get("campus_name") ?? "").trim() || null;

  if (!name || !type) {
    return { success: false, error: "학교명과 타입은 필수입니다." };
  }

  if (!["중학교", "고등학교", "대학교"].includes(type)) {
    return { success: false, error: "올바른 학교 타입을 선택하세요." };
  }

  const supabase = await createSupabaseServerClient();

  // region_id 유효성 검증
  if (regionId) {
    const { data: region } = await supabase
      .from("regions")
      .select("id")
      .eq("id", regionId)
      .maybeSingle();

    if (!region) {
      return { success: false, error: "유효하지 않은 지역입니다." };
    }
  }

  // 타입별 속성 유효성 검증
  if (type === "고등학교" && category) {
    if (!["일반고", "특목고", "자사고", "특성화고"].includes(category)) {
      return { success: false, error: "올바른 고등학교 유형을 선택하세요." };
    }
  }

  if (type === "대학교") {
    if (universityType && !["4년제", "2년제"].includes(universityType)) {
      return { success: false, error: "올바른 대학교 유형을 선택하세요." };
    }
    if (universityOwnership && !["국립", "사립"].includes(universityOwnership)) {
      return { success: false, error: "올바른 설립 유형을 선택하세요." };
    }
  }

  // 우편번호 형식 검증 (5자리 또는 6자리 숫자)
  if (postalCode && !/^\d{5,6}$/.test(postalCode)) {
    return { success: false, error: "우편번호는 5자리 또는 6자리 숫자여야 합니다." };
  }

  // 중복 확인 (이름 + 타입 + 지역 + 캠퍼스명 조합)
  const existing = await checkSchoolDuplicate(
    name,
    type as "중학교" | "고등학교" | "대학교",
    regionId,
    type === "대학교" ? campusName : null
  );

  if (existing) {
    return { success: false, error: "이미 등록된 학교입니다." };
  }

  const { error } = await supabase.from("schools").insert({
    name,
    type,
    region_id: regionId,
    address,
    postal_code: postalCode,
    address_detail: addressDetail,
    city,
    district,
    phone,
    category: type === "고등학교" ? category : null,
    university_type: type === "대학교" ? universityType : null,
    university_ownership: type === "대학교" ? universityOwnership : null,
    campus_name: type === "대학교" ? campusName : null,
  });

  if (error) {
    console.error("[actions/schoolActions] 학교 생성 실패:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 학교 수정
 */
export async function updateSchool(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const regionId = String(formData.get("region_id") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const addressDetail = String(formData.get("address_detail") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const district = String(formData.get("district") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  // 고등학교 속성
  const category = String(formData.get("category") ?? "").trim() || null;
  
  // 대학교 속성
  const universityType = String(formData.get("university_type") ?? "").trim() || null;
  const universityOwnership = String(formData.get("university_ownership") ?? "").trim() || null;
  const campusName = String(formData.get("campus_name") ?? "").trim() || null;

  if (!id || !name || !type) {
    return { success: false, error: "필수 필드를 입력하세요." };
  }

  if (!["중학교", "고등학교", "대학교"].includes(type)) {
    return { success: false, error: "올바른 학교 타입을 선택하세요." };
  }

  const supabase = await createSupabaseServerClient();

  // region_id 유효성 검증
  if (regionId) {
    const { data: region } = await supabase
      .from("regions")
      .select("id")
      .eq("id", regionId)
      .maybeSingle();

    if (!region) {
      return { success: false, error: "유효하지 않은 지역입니다." };
    }
  }

  // 타입별 속성 유효성 검증
  if (type === "고등학교" && category) {
    if (!["일반고", "특목고", "자사고", "특성화고"].includes(category)) {
      return { success: false, error: "올바른 고등학교 유형을 선택하세요." };
    }
  }

  if (type === "대학교") {
    if (universityType && !["4년제", "2년제"].includes(universityType)) {
      return { success: false, error: "올바른 대학교 유형을 선택하세요." };
    }
    if (universityOwnership && !["국립", "사립"].includes(universityOwnership)) {
      return { success: false, error: "올바른 설립 유형을 선택하세요." };
    }
  }

  // 우편번호 형식 검증 (5자리 또는 6자리 숫자)
  if (postalCode && !/^\d{5,6}$/.test(postalCode)) {
    return { success: false, error: "우편번호는 5자리 또는 6자리 숫자여야 합니다." };
  }

  // 중복 확인 (자기 자신 제외)
  const existing = await checkSchoolDuplicate(
    name,
    type as "중학교" | "고등학교" | "대학교",
    regionId,
    type === "대학교" ? campusName : null,
    id
  );

  if (existing) {
    return { success: false, error: "이미 등록된 학교입니다." };
  }

  const { error } = await supabase
    .from("schools")
    .update({
      name,
      type,
      region_id: regionId,
      address,
      postal_code: postalCode,
      address_detail: addressDetail,
      city,
      district,
      phone,
      category: type === "고등학교" ? category : null,
      university_type: type === "대학교" ? universityType : null,
      university_ownership: type === "대학교" ? universityOwnership : null,
      campus_name: type === "대학교" ? campusName : null,
    })
    .eq("id", id);

  if (error) {
    console.error("[actions/schoolActions] 학교 수정 실패:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 학교 삭제
 */
export async function deleteSchool(
  schoolId: string
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("schools").delete().eq("id", schoolId);

  if (error) {
    console.error("[actions/schoolActions] 학교 삭제 실패:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

