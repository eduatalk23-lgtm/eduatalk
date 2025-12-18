"use server";

import { updateStudentDivision, getStudentsByDivision, getStudentDivisionStats, batchUpdateStudentDivision } from "@/lib/data/students";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import type { StudentDivision } from "@/lib/constants/students";

/**
 * 구분 값 검증 헬퍼 함수
 */
function validateDivision(division: StudentDivision | null): { valid: boolean; error?: string } {
  if (division !== null && division !== "고등부" && division !== "중등부" && division !== "기타") {
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

  // 입력 검증
  const validation = validateDivision(division);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  return await updateStudentDivision(studentId, division);
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
    const students = await getStudentsByDivision(division);
    return {
      success: true,
      data: students,
    };
  } catch (error) {
    console.error("[actions/students] 구분별 학생 목록 조회 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "학생 목록 조회에 실패했습니다.",
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
    const stats = await getStudentDivisionStats();
    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error("[actions/students] 구분별 통계 조회 실패", error);
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

  // 입력 검증
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

  return await batchUpdateStudentDivision(studentIds, division);
}

