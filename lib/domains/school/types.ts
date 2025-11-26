/**
 * School 도메인 타입 정의
 *
 * Supabase Database 타입에서 파생됩니다.
 * @see lib/supabase/database.types.ts
 */

import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/lib/supabase/database.types";

// ============================================
// Database 타입에서 파생된 타입
// ============================================

/**
 * 지역 (Region) 타입
 */
export type Region = Tables<"regions">;

/**
 * 지역 생성 입력 타입
 */
export type RegionInsert = TablesInsert<"regions">;

/**
 * 지역 수정 입력 타입
 */
export type RegionUpdate = TablesUpdate<"regions">;

/**
 * 학교 타입
 */
export type School = Tables<"schools">;

/**
 * 학교 생성 입력 타입
 */
export type SchoolInsert = TablesInsert<"schools">;

/**
 * 학교 수정 입력 타입
 */
export type SchoolUpdate = TablesUpdate<"schools">;

// ============================================
// Enum 타입
// ============================================

/**
 * 학교 유형
 */
export type SchoolType = Enums<"school_type">;

/**
 * 고등학교 유형
 */
export type HighSchoolCategory = Enums<"school_category">;

/**
 * 대학교 유형
 */
export type UniversityType = Enums<"university_type">;

/**
 * 대학교 설립 유형
 */
export type UniversityOwnership = Enums<"university_ownership">;

// ============================================
// 비즈니스 로직용 타입 (도메인 내부 사용)
// ============================================

/**
 * 학교 조회 옵션
 */
export type GetSchoolsOptions = {
  regionId?: string;
  type?: SchoolType;
  includeInactive?: boolean;
};

/**
 * 지역 조회 옵션
 */
export type GetRegionsOptions = {
  level?: 1 | 2 | 3;
  parentId?: string;
  includeInactive?: boolean;
};

/**
 * 학교 생성 입력 (서비스용)
 */
export type CreateSchoolInput = {
  name: string;
  type: SchoolType;
  region_id?: string | null;
  address?: string | null;
  postal_code?: string | null;
  address_detail?: string | null;
  city?: string | null;
  district?: string | null;
  phone?: string | null;
  // 고등학교 속성
  category?: HighSchoolCategory | null;
  // 대학교 속성
  university_type?: UniversityType | null;
  university_ownership?: UniversityOwnership | null;
  campus_name?: string | null;
};

/**
 * 학교 수정 입력 (서비스용)
 */
export type UpdateSchoolInput = Partial<CreateSchoolInput> & {
  id: string;
};

// ============================================
// 응답 타입
// ============================================

/**
 * 학교 액션 결과
 */
export type SchoolActionResult = {
  success: boolean;
  error?: string;
  data?: School;
};

// ============================================
// 클라이언트용 간소화 타입
// ============================================

/**
 * 간소화된 학교 정보 (목록, 선택 등에서 사용)
 */
export type SchoolSimple = {
  id: string;
  name: string;
  type: SchoolType;
  region: string | null;
};
