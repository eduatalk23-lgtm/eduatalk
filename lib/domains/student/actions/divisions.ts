"use server";

/**
 * Student 도메인 Server Actions
 *
 * 권한 검증 + Repository 호출 + 캐시 재검증을 담당합니다.
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { logActionError } from "@/lib/logging/actionLogger";
import type { StudentDivision } from "@/lib/constants/students";
import * as repository from "../repository";

// ============================================
// 학부 관리 Actions (학생에게 학부 할당)
// from: app/actions/students.ts
// ============================================

/**
 * 학부 값 검증 헬퍼 함수
 */
function validateDivision(
  division: StudentDivision | null
): { valid: boolean; error?: string } {
  if (
    division !== null &&
    division !== "고등부" &&
    division !== "중등부" &&
    division !== "졸업"
  ) {
    return {
      valid: false,
      error: "유효하지 않은 학부입니다. 고등부, 중등부, 졸업 중 하나를 선택해주세요.",
    };
  }
  return { valid: true };
}

/**
 * 학생 학부 업데이트 (관리자만)
 */
export async function updateStudentDivisionAction(
  studentId: string,
  division: StudentDivision | null
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (!isAdminRole(role)) {
    return {
      success: false,
      error: "권한이 없습니다. 관리자만 학부를 수정할 수 있습니다.",
    };
  }

  const validation = validateDivision(division);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const result = await repository.updateStudentDivision(studentId, division);

  if (result.success) {
    revalidatePath("/admin/students");
  }

  return result;
}

/**
 * 학생 학년 개별 업데이트 (관리자만)
 */
export async function updateStudentGradeAction(
  studentId: string,
  grade: number | null
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (!isAdminRole(role)) {
    return {
      success: false,
      error: "권한이 없습니다. 관리자만 학년을 수정할 수 있습니다.",
    };
  }

  if (grade !== null && (grade < 1 || grade > 3)) {
    return {
      success: false,
      error: "학년은 1~3 범위여야 합니다.",
    };
  }

  const result = await repository.updateStudentGrade(studentId, grade);

  if (result.success) {
    revalidatePath("/admin/students");
  }

  return result;
}

/**
 * 구분별 학생 목록 조회 (관리자만)
 */
export async function getStudentsByDivisionAction(
  division: StudentDivision | null
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (!isAdminRole(role)) {
    return {
      success: false,
      error: "권한이 없습니다. 관리자만 학생 목록을 조회할 수 있습니다.",
    };
  }

  try {
    const students = await repository.getStudentsByDivision(division);
    return {
      success: true,
      data: students,
    };
  } catch (error) {
    logActionError(
      { domain: "student", action: "getStudentsByDivision" },
      error,
      { division }
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "학생 목록 조회에 실패했습니다.",
    };
  }
}

/**
 * 구분별 학생 통계 조회 (관리자만)
 */
export async function getStudentDivisionStatsAction(): Promise<{
  success: boolean;
  data?: Array<{ division: StudentDivision | null; count: number; gradeBreakdown: Record<number, number> }>;
  error?: string;
}> {
  const { role } = await getCurrentUserRole();

  if (!isAdminRole(role)) {
    return {
      success: false,
      error: "권한이 없습니다. 관리자만 통계를 조회할 수 있습니다.",
    };
  }

  try {
    const stats = await repository.getStudentDivisionStats();
    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    logActionError(
      { domain: "student", action: "getStudentDivisionStats" },
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "통계 조회에 실패했습니다.",
    };
  }
}

/**
 * 학부 일괄 업데이트 (관리자만)
 */
export async function batchUpdateStudentDivisionAction(
  studentIds: string[],
  division: StudentDivision | null
): Promise<{
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: Array<{ studentId: string; error: string }>;
}> {
  const { role } = await getCurrentUserRole();

  if (!isAdminRole(role)) {
    return {
      success: false,
      successCount: 0,
      failureCount: studentIds.length,
      errors: studentIds.map((id) => ({
        studentId: id,
        error: "권한이 없습니다. 관리자만 학부를 수정할 수 있습니다.",
      })),
    };
  }

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return {
      success: false,
      successCount: 0,
      failureCount: 0,
      errors: [{ studentId: "", error: "학생을 선택해주세요." }],
    };
  }

  const validation = validateDivision(division);
  if (!validation.valid) {
    return {
      success: false,
      successCount: 0,
      failureCount: studentIds.length,
      errors: studentIds.map((id) => ({
        studentId: id,
        error: validation.error || "유효하지 않은 학부입니다.",
      })),
    };
  }

  const result = await repository.batchUpdateStudentDivision(studentIds, division);

  if (result.success) {
    revalidatePath("/admin/students");
  }

  return result;
}

/**
 * 학년 일괄 업데이트 (관리자만)
 * @param mode - "promote": 진급 (+1), "set": 직접 지정
 * @param targetGrade - 직접 지정 모드 시 목표 학년 (1~3)
 */
export async function batchUpdateStudentGradeAction(
  studentIds: string[],
  mode: "promote" | "set",
  targetGrade?: number | null
): Promise<{
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: Array<{ studentId: string; error: string }>;
}> {
  const { role } = await getCurrentUserRole();

  if (!isAdminRole(role)) {
    return {
      success: false,
      successCount: 0,
      failureCount: studentIds.length,
      errors: studentIds.map((id) => ({
        studentId: id,
        error: "권한이 없습니다. 관리자만 학년을 수정할 수 있습니다.",
      })),
    };
  }

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return {
      success: false,
      successCount: 0,
      failureCount: 0,
      errors: [{ studentId: "", error: "학생을 선택해주세요." }],
    };
  }

  if (mode !== "promote" && mode !== "set") {
    return {
      success: false,
      successCount: 0,
      failureCount: studentIds.length,
      errors: studentIds.map((id) => ({
        studentId: id,
        error: "유효하지 않은 모드입니다.",
      })),
    };
  }

  if (mode === "set" && (targetGrade == null || targetGrade < 1 || targetGrade > 3)) {
    return {
      success: false,
      successCount: 0,
      failureCount: studentIds.length,
      errors: studentIds.map((id) => ({
        studentId: id,
        error: "학년은 1~3 범위여야 합니다.",
      })),
    };
  }

  const result = await repository.batchUpdateStudentGrade(studentIds, mode, targetGrade);

  if (result.success) {
    revalidatePath("/admin/students");
  }

  return result;
}
