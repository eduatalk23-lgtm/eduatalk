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
// 학생 구분 할당 Actions (학생에게 구분 할당)
// from: app/actions/students.ts
// ============================================

/**
 * 구분 값 검증 헬퍼 함수
 */
function validateDivision(
  division: StudentDivision | null
): { valid: boolean; error?: string } {
  if (
    division !== null &&
    division !== "고등부" &&
    division !== "중등부" &&
    division !== "기타"
  ) {
    return {
      valid: false,
      error: "유효하지 않은 구분입니다. 고등부, 중등부, 기타 중 하나를 선택해주세요.",
    };
  }
  return { valid: true };
}

/**
 * 학생 구분 업데이트 (관리자만)
 */
export async function updateStudentDivisionAction(
  studentId: string,
  division: StudentDivision | null
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (!isAdminRole(role)) {
    return {
      success: false,
      error: "권한이 없습니다. 관리자만 학생 구분을 수정할 수 있습니다.",
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
  data?: Array<{ division: StudentDivision | null; count: number }>;
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
 * 학생 구분 일괄 업데이트 (관리자만)
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
        error: "권한이 없습니다. 관리자만 학생 구분을 수정할 수 있습니다.",
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
        error: validation.error || "유효하지 않은 구분입니다.",
      })),
    };
  }

  const result = await repository.batchUpdateStudentDivision(studentIds, division);

  if (result.success) {
    revalidatePath("/admin/students");
  }

  return result;
}
