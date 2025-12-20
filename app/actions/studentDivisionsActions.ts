"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getStudentDivisions,
  getActiveStudentDivisions,
  getStudentDivisionById,
  createStudentDivision,
  updateStudentDivision,
  deleteStudentDivision,
} from "@/lib/data/studentDivisions";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";

/**
 * 학생 구분 항목 목록 조회
 */
export const getStudentDivisionsAction = withActionResponse(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await getStudentDivisions();
});

/**
 * 활성 학생 구분 항목만 조회
 */
export const getActiveStudentDivisionsAction = withActionResponse(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await getActiveStudentDivisions();
});

/**
 * 학생 구분 항목 생성
 */
export const createStudentDivisionAction = withActionResponse(
  async (name: string, displayOrder?: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    // display_order가 제공되지 않으면 자동 계산
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const existingDivisions = await getStudentDivisions();
      finalDisplayOrder =
        existingDivisions.length > 0
          ? Math.max(...existingDivisions.map((d) => d.display_order ?? 0)) + 1
          : 0;
    }
    return await createStudentDivision(name, finalDisplayOrder);
  }
);

/**
 * 학생 구분 항목 수정
 */
export const updateStudentDivisionAction = withActionResponse(
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
    return await updateStudentDivision(id, updates);
  }
);

/**
 * 학생 구분 항목 삭제
 */
export const deleteStudentDivisionAction = withActionResponse(
  async (id: string) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await deleteStudentDivision(id);
  }
);

