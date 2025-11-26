/**
 * School 도메인 타입 정의
 */

// ============================================
// 지역 (Region) 타입
// ============================================

export type Region = {
  id: string;
  name: string;
  parent_id?: string | null;
  level: number; // 1: 시/도, 2: 시/군/구, 3: 읍/면/동
  code?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

// ============================================
// 학교 (School) 타입
// ============================================

export type SchoolType = "중학교" | "고등학교" | "대학교";

export type HighSchoolCategory = "일반고" | "특목고" | "자사고" | "특성화고";

export type UniversityType = "4년제" | "2년제";

export type UniversityOwnership = "국립" | "사립";

export type School = {
  id: string;
  name: string;
  type: SchoolType;
  region_id?: string | null;
  region?: string | null; // JOIN 결과 (하위 호환성)
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
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

// ============================================
// 조회 옵션 타입
// ============================================

export type GetSchoolsOptions = {
  regionId?: string;
  type?: SchoolType;
  includeInactive?: boolean;
};

export type GetRegionsOptions = {
  level?: 1 | 2 | 3;
  parentId?: string;
  includeInactive?: boolean;
};

// ============================================
// 생성/수정 입력 타입
// ============================================

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

export type UpdateSchoolInput = Partial<CreateSchoolInput> & {
  id: string;
};

// ============================================
// 응답 타입
// ============================================

export type SchoolActionResult = {
  success: boolean;
  error?: string;
  data?: School;
};

// ============================================
// 간소화된 School 타입 (클라이언트용)
// ============================================

export type SchoolSimple = {
  id: string;
  name: string;
  type: SchoolType;
  region: string | null;
};

