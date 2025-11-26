"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getCareerFields,
  getAllCareerFields,
  createCareerField,
  updateCareerField,
  deleteCareerField,
} from "@/lib/data/careerFields";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

// 진로 계열 목록 조회 (활성화된 항목만)
export const getCareerFieldsAction = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await getCareerFields();
});

// 진로 계열 목록 조회 (모든 항목, 관리자용)
export const getAllCareerFieldsAction = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  return await getAllCareerFields();
});

// 진로 계열 생성
export const createCareerFieldAction = withErrorHandling(
  async (name: string, display_order?: number) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    const result = await createCareerField(name, display_order);
    if (!result.success) {
      throw new AppError(
        result.error || "진로 계열 생성에 실패했습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }
    return result;
  }
);

// 진로 계열 수정
export const updateCareerFieldAction = withErrorHandling(
  async (
    id: string,
    updates: Partial<{ name: string; display_order: number; is_active: boolean }>
  ) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    const result = await updateCareerField(id, updates);
    if (!result.success) {
      throw new AppError(
        result.error || "진로 계열 수정에 실패했습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }
    return result;
  }
);

// 진로 계열 삭제
export const deleteCareerFieldAction = withErrorHandling(async (id: string) => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  const result = await deleteCareerField(id);
  if (!result.success) {
    throw new AppError(
      result.error || "진로 계열 삭제에 실패했습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }
  return result;
});









