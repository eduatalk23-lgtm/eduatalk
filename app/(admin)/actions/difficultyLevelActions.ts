"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getDifficultyLevels,
  getDifficultyLevelById,
  createDifficultyLevel,
  updateDifficultyLevel,
  deleteDifficultyLevel,
} from "@/lib/data/difficultyLevels";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 난이도 목록 조회
 */
export const getDifficultyLevelsAction = withErrorHandling(
  async (contentType?: "book" | "lecture" | "custom" | "common") => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await getDifficultyLevels(contentType);
  }
);

/**
 * ID로 난이도 조회
 */
export const getDifficultyLevelByIdAction = withErrorHandling(
  async (id: string) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await getDifficultyLevelById(id);
  }
);

/**
 * 난이도 생성
 */
export const createDifficultyLevelAction = withErrorHandling(
  async (
    name: string,
    contentType: "book" | "lecture" | "custom" | "common",
    displayOrder?: number
  ) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }

    // display_order가 제공되지 않으면 자동 계산
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const existingLevels = await getDifficultyLevels(contentType);
      finalDisplayOrder =
        existingLevels.length > 0
          ? Math.max(...existingLevels.map((l) => l.display_order ?? 0)) + 1
          : 0;
    }

    return await createDifficultyLevel({
      name,
      content_type: contentType,
      display_order: finalDisplayOrder,
    });
  }
);

/**
 * 난이도 수정
 */
export const updateDifficultyLevelAction = withErrorHandling(
  async (
    id: string,
    updates: Partial<{
      name: string;
      display_order: number;
      is_active: boolean;
      description: string;
    }>
  ) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await updateDifficultyLevel(id, updates);
  }
);

/**
 * 난이도 삭제
 */
export const deleteDifficultyLevelAction = withErrorHandling(
  async (id: string) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 401, true);
    }
    return await deleteDifficultyLevel(id);
  }
);

