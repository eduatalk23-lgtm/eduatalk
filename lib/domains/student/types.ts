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

