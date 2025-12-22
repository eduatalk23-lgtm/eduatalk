"use server";

/**
 * Student 도메인 Server Actions
 *
 * 권한 검증 + Repository 호출 + 캐시 재검증을 담당합니다.
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
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
    console.error("[student/actions] 구분별 학생 목록 조회 실패", error);
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
    console.error("[student/actions] 구분별 통계 조회 실패", error);
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

// ============================================
// 학생 구분 항목 관리 Actions (구분 목록 CRUD)
// from: app/actions/studentDivisionsActions.ts
// ============================================

/**
 * 학생 구분 항목 목록 조회
 */
export const getStudentDivisionsAction = withActionResponse(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await repository.getStudentDivisions();
});

/**
 * 활성 학생 구분 항목만 조회
 */
export const getActiveStudentDivisionsAction = withActionResponse(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await repository.getActiveStudentDivisions();
});

/**
 * 학생 구분 항목 생성
 */
export const createStudentDivisionItemAction = withActionResponse(
  async (name: string, displayOrder?: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }

    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const existingDivisions = await repository.getStudentDivisions();
      finalDisplayOrder =
        existingDivisions.length > 0
          ? Math.max(...existingDivisions.map((d) => d.display_order ?? 0)) + 1
          : 0;
    }

    const result = await repository.createStudentDivision(name, finalDisplayOrder);
    revalidatePath("/admin/settings");
    return result;
  }
);

/**
 * 학생 구분 항목 수정
 */
export const updateStudentDivisionItemAction = withActionResponse(
  async (
    id: string,
    updates: Partial<{
      name: string;
      display_order: number;
      is_active: boolean;
    }>
  ) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }

    const result = await repository.updateStudentDivisionItem(id, updates);
    revalidatePath("/admin/settings");
    return result;
  }
);

/**
 * 학생 구분 항목 삭제
 */
export const deleteStudentDivisionItemAction = withActionResponse(
  async (id: string) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }

    const result = await repository.deleteStudentDivision(id);
    revalidatePath("/admin/settings");
    return result;
  }
);

// ============================================
// Legacy 호환성 (deprecated)
// ============================================

/**
 * @deprecated createStudentDivisionItemAction 사용
 */
export const createStudentDivisionAction = createStudentDivisionItemAction;

/**
 * @deprecated updateStudentDivisionItemAction 사용
 */
export const updateStudentDivisionItemActionLegacy = updateStudentDivisionItemAction;

/**
 * @deprecated deleteStudentDivisionItemAction 사용
 */
export const deleteStudentDivisionAction = deleteStudentDivisionItemAction;
