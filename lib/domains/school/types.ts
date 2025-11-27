/**
 * School 도메인 타입 정의
 *
 * 새 테이블 구조 기반:
 * - school_info: 중·고등학교
 * - universities: 대학교
 * - university_campuses: 대학교 캠퍼스
 * - all_schools_view: 통합 조회 VIEW
 */

// ============================================
// 학교 유형 Enum
// ============================================

/**
 * 학교 유형 (통합)
 */
export type SchoolType = "MIDDLE" | "HIGH" | "UNIVERSITY";

/**
 * 학교 유형 (한글)
 */
export type SchoolTypeKor = "중학교" | "고등학교" | "대학교";

/**
 * 학교 유형 매핑
 */
export const SCHOOL_TYPE_MAP: Record<SchoolType, SchoolTypeKor> = {
  MIDDLE: "중학교",
  HIGH: "고등학교",
  UNIVERSITY: "대학교",
};

export const SCHOOL_TYPE_REVERSE_MAP: Record<SchoolTypeKor, SchoolType> = {
  "중학교": "MIDDLE",
  "고등학교": "HIGH",
  "대학교": "UNIVERSITY",
};

// ============================================
// 중·고등학교 타입 (school_info)
// ============================================

/**
 * 중·고등학교 정보 (school_info 테이블)
 */
export type SchoolInfo = {
  id: number;
  district_id: number | null;
  region: string | null;
  school_code: string;
  school_name: string;
  school_level: "중" | "고";
  establishment_type: string | null; // "국립" | "공립" | "사립"
  school_property: string | null;
  branch_flag: string | null;
  establishment_form: string | null;
  postal_code: string | null;
  addr_road: string | null;
  addr_detail: string | null;
  address_full: string | null;
  latitude: number | null;
  longitude: number | null;
  phone_number: string | null;
  fax_number: string | null;
  homepage_url: string | null;
  coeducation_type: string | null;
  closed_flag: string | null;
  closed_date: string | null;
  temporary_close_flag: string | null;
  created_at: string;
};

// ============================================
// 대학교 타입 (universities, university_campuses)
// ============================================

/**
 * 대학교 기본 정보 (universities 테이블)
 */
export type University = {
  id: number;
  university_code: string;
  name_kor: string;
  name_eng: string | null;
  name_chi: string | null;
  establishment_type: string | null; // "국립" | "사립"
  corporation_name: string | null;
  legal_basis: string | null;
  university_type: string | null; // "대학", "전문대학", "특수대학원" 등
  status: string | null;
  homepage_url: string | null;
  president_name: string | null;
  founded_date: string | null;
  created_at: string;
};

/**
 * 대학교 캠퍼스 정보 (university_campuses 테이블)
 */
export type UniversityCampus = {
  id: number;
  university_id: number;
  campus_type: string | null; // "본교" | "제2캠퍼스" 등
  campus_name: string;
  region: string | null;
  address_kor: string | null;
  address_eng: string | null;
  address_chi: string | null;
  postal_code: string | null;
  phone_number: string | null;
  fax_number: string | null;
  campus_status: string | null;
  created_at: string;
};

/**
 * 대학교 + 캠퍼스 JOIN 결과
 */
export type UniversityWithCampus = UniversityCampus & {
  university: University;
};

// ============================================
// 통합 타입 (all_schools_view)
// ============================================

/**
 * 통합 학교 정보 (all_schools_view)
 */
export type AllSchoolsView = {
  id: string; // "SCHOOL_123" 또는 "UNIV_456" 형식
  school_type: SchoolType;
  name: string;
  code: string | null;
  region: string | null;
  address: string | null;
  postal_code: string | null;
  phone: string | null;
  website: string | null;
  establishment_type: string | null;
  campus_name: string | null; // 대학교만
  university_type: string | null; // 대학교만
  source_table: "school_info" | "university_campuses";
  source_id: number;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

// ============================================
// 서비스/API용 타입
// ============================================

/**
 * 학교 검색 결과 (간소화)
 */
export type SchoolSimple = {
  id: string; // 통합 ID ("SCHOOL_123" 또는 "UNIV_456")
  name: string;
  schoolType: SchoolType;
  region: string | null;
  sourceTable: "school_info" | "university_campuses";
  sourceId: number;
};

/**
 * 학교 검색 옵션
 */
export type SearchSchoolsOptions = {
  query?: string;
  schoolType?: SchoolType;
  region?: string;
  limit?: number;
};

/**
 * 학교 조회 옵션
 */
export type GetSchoolsOptions = {
  schoolType?: SchoolType;
  region?: string;
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * 학교 액션 결과
 */
export type SchoolActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ============================================
// Region 타입 (기존 유지)
// ============================================

/**
 * 지역 정보
 */
export type Region = {
  id: string;
  name: string;
  parent_id: string | null;
  level: number; // 1: 시/도, 2: 시/군/구, 3: 읍/면/동
  code: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================
// Deprecated 타입 (하위 호환성)
// ============================================

/**
 * @deprecated 새 타입 AllSchoolsView 또는 SchoolSimple 사용
 */
export type School = {
  id: string;
  name: string;
  type: SchoolTypeKor;
  region: string | null;
  address?: string | null;
  phone?: string | null;
};

/**
 * 기존 타입 → 새 타입 변환 헬퍼
 */
export function toSchoolSimple(school: AllSchoolsView): SchoolSimple {
  return {
    id: school.id,
    name: school.name,
    schoolType: school.school_type,
    region: school.region,
    sourceTable: school.source_table,
    sourceId: school.source_id,
  };
}

/**
 * 새 타입 → 기존 타입 변환 헬퍼 (하위 호환성)
 */
export function toLegacySchool(school: AllSchoolsView): School {
  return {
    id: school.id,
    name: school.name,
    type: SCHOOL_TYPE_MAP[school.school_type],
    region: school.region,
    address: school.address,
    phone: school.phone,
  };
}

/**
 * 통합 ID에서 source 정보 추출
 */
export function parseSchoolId(id: string): {
  sourceTable: "school_info" | "university_campuses";
  sourceId: number;
} | null {
  if (id.startsWith("SCHOOL_")) {
    const sourceId = parseInt(id.replace("SCHOOL_", ""), 10);
    if (!isNaN(sourceId)) {
      return { sourceTable: "school_info", sourceId };
    }
  } else if (id.startsWith("UNIV_")) {
    const sourceId = parseInt(id.replace("UNIV_", ""), 10);
    if (!isNaN(sourceId)) {
      return { sourceTable: "university_campuses", sourceId };
    }
  }
  return null;
}
