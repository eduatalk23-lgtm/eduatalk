/**
 * Student 도메인 타입 정의
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
 * 학생 타입
 */
export type Student = Tables<"students">;

/**
 * 학생 생성 입력 타입
 */
export type StudentInsert = TablesInsert<"students">;

/**
 * 학생 수정 입력 타입
 */
export type StudentUpdate = TablesUpdate<"students">;

// ============================================
// 비즈니스 로직용 타입
// ============================================

/**
 * 학생 조회 필터
 */
export type GetStudentsFilter = {
  tenantId: string;
  schoolId?: string;
  grade?: number;
};

// ============================================
// 응답 타입
// ============================================

/**
 * 학생 액션 결과
 */
export type StudentActionResult = {
  success: boolean;
  error?: string;
  studentId?: string;
  student?: Student;
};

// ============================================
// 검색 관련 타입
// ============================================

/**
 * 학생 검색 API 응답 타입
 */
export type StudentSearchApiResponse = {
  id: string;
  name: string;
  grade: number | null;
  class: string | null;
  division: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  is_active: boolean | null;
};

/**
 * 학생 검색 결과 타입 (UI 표시용)
 * 
 * API 응답을 UI에 표시하기 위해 변환된 타입입니다.
 */
export type StudentSearchResult = {
  id: string;
  name: string;
  grade: number | null;
  class: string | null;
  division: string | null;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  is_active: boolean;
};

