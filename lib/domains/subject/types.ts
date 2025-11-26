/**
 * Subject 도메인 타입 정의
 *
 * Supabase Database 타입에서 파생됩니다.
 * @see lib/supabase/database.types.ts
 */

import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/database.types";

// ============================================
// Database 타입에서 파생된 타입
// ============================================

/**
 * 교과 그룹 타입
 */
export type SubjectGroup = Tables<"subject_groups">;

/**
 * 교과 그룹 생성 입력 타입
 */
export type SubjectGroupInsert = TablesInsert<"subject_groups">;

/**
 * 교과 그룹 수정 입력 타입
 */
export type SubjectGroupUpdate = TablesUpdate<"subject_groups">;

/**
 * 과목 타입
 */
export type Subject = Tables<"subjects">;

/**
 * 과목 생성 입력 타입
 */
export type SubjectInsert = TablesInsert<"subjects">;

/**
 * 과목 수정 입력 타입
 */
export type SubjectUpdate = TablesUpdate<"subjects">;

/**
 * 과목 구분 타입
 */
export type SubjectType = Tables<"subject_types">;

/**
 * 과목 구분 생성 입력 타입
 */
export type SubjectTypeInsert = TablesInsert<"subject_types">;

/**
 * 과목 구분 수정 입력 타입
 */
export type SubjectTypeUpdate = TablesUpdate<"subject_types">;

// ============================================
// 비즈니스 로직용 타입
// ============================================

/**
 * 교과 그룹 조회 필터
 */
export type GetSubjectGroupsFilter = {
  tenantId?: string | null;
};

/**
 * 과목 조회 필터
 */
export type GetSubjectsFilter = {
  tenantId?: string | null;
  subjectGroupId?: string;
};

// ============================================
// 응답 타입
// ============================================

/**
 * 교과 액션 결과
 */
export type SubjectActionResult = {
  success: boolean;
  error?: string;
  subjectId?: string;
  subject?: Subject;
};

