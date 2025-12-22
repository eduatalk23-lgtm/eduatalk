"use server";

/**
 * Block 도메인 Server Actions
 *
 * 권한 검증 + Service 호출 + 캐시 재검증만 담당합니다.
 * 비즈니스 로직은 service.ts에 있습니다.
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode } from "@/lib/errors";
import { validateFormData } from "@/lib/validation/schemas";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import { getStudentById, type Student } from "@/lib/data/students";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as service from "./service";
import {
  fetchBlockSetsWithBlocks,
  createBlockSet as createBlockSetData,
  updateBlockSet as updateBlockSetData,
  deleteBlockSet as deleteBlockSetData,
  getBlockSetById,
  getBlockSetCount,
  getBlocksBySetId,
  createBlock,
} from "@/lib/data/blockSets";
import { blockSchema, type BlockActionResult, type BlockServiceContext } from "./types";

const MAX_BLOCK_SETS = 5;

// ============================================
// Context Helper
// ============================================

async function getServiceContext(): Promise<BlockServiceContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const student = await getStudentById(user.userId, user.tenantId);
  if (!student) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  return {
    userId: user.userId,
    tenantId: student.tenant_id ?? "",
    studentId: user.userId,
  };
}

// ============================================
// Actions (FormData 기반 - 기존 호환)
// ============================================

async function _addBlock(formData: FormData): Promise<void> {
  const validation = validateFormData(formData, blockSchema);
  if (!validation.success) {
    throw validation.errors;
  }

  const { day, start_time: startTime, end_time: endTime } = validation.data;
  const blockSetId = formData.get("block_set_id");

  const ctx = await getServiceContext();

  const result = await service.addBlock(ctx, {
    blockSetId: typeof blockSetId === "string" ? blockSetId : undefined,
    dayOfWeek: day,
    startTime,
    endTime,
  });

  if (!result.success) {
    throw new AppError(
      result.error ?? "블록 추가 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _updateBlock(formData: FormData): Promise<void> {
  const blockId = formData.get("id");
  if (!blockId || typeof blockId !== "string") {
    throw new AppError("블록 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const validation = validateFormData(formData, blockSchema);
  if (!validation.success) {
    throw validation.errors;
  }

  const { day, start_time: startTime, end_time: endTime } = validation.data;

  const ctx = await getServiceContext();

  const result = await service.updateBlock(ctx, blockId, {
    dayOfWeek: day,
    startTime,
    endTime,
  });

  if (!result.success) {
    throw new AppError(
      result.error ?? "블록 수정 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _deleteBlock(formData: FormData): Promise<void> {
  const blockId = formData.get("id");
  if (!blockId || typeof blockId !== "string") {
    throw new AppError("블록 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const ctx = await getServiceContext();

  const result = await service.deleteBlock(ctx, blockId);

  if (!result.success) {
    throw new AppError(
      result.error ?? "블록 삭제 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _duplicateBlock(formData: FormData): Promise<void> {
  const blockId = formData.get("id");
  const targetDay = formData.get("target_day");

  if (!blockId || typeof blockId !== "string") {
    throw new AppError("블록 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!targetDay || typeof targetDay !== "string") {
    throw new AppError("대상 요일이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const targetDayNum = Number(targetDay);
  if (isNaN(targetDayNum) || targetDayNum < 0 || targetDayNum > 6) {
    throw new AppError("올바른 요일을 선택해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const ctx = await getServiceContext();

  const result = await service.duplicateBlock(ctx, blockId, targetDayNum);

  if (!result.success) {
    throw new AppError(
      result.error ?? "블록 복제 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _addBlocksToMultipleDays(formData: FormData): Promise<void> {
  const targetDays = formData.get("target_days");
  const startTime = formData.get("start_time");
  const endTime = formData.get("end_time");
  const blockSetId = formData.get("block_set_id");

  if (!targetDays || typeof targetDays !== "string") {
    throw new AppError("대상 요일이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!startTime || typeof startTime !== "string") {
    throw new AppError("시작 시간이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!endTime || typeof endTime !== "string") {
    throw new AppError("종료 시간이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const targetDayNums = targetDays
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => !isNaN(d) && d >= 0 && d <= 6);

  if (targetDayNums.length === 0) {
    throw new AppError(
      "추가할 요일을 최소 1개 이상 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const ctx = await getServiceContext();

  const result = await service.addBlocksToMultipleDays(ctx, {
    blockSetId: typeof blockSetId === "string" ? blockSetId : undefined,
    targetDays: targetDayNums,
    startTime,
    endTime,
  });

  if (!result.success) {
    throw new AppError(
      result.error ?? "블록 추가 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");

  // 부분 성공 메시지 처리
  if (result.details && result.details.skippedCount > 0) {
    const skippedDays = result.details.skippedDays?.join(", ") ?? "";
    throw new AppError(
      `INFO: ${result.details.successCount}개 요일에 블록이 추가되었습니다. ${skippedDays}요일은 겹치는 시간대가 있어 스킵되었습니다.`,
      ErrorCode.BUSINESS_LOGIC_ERROR,
      200,
      true
    );
  }
}

// ============================================
// Exported Actions (withActionResponse 래핑)
// ============================================

export const addBlock = withActionResponse(_addBlock);
export const updateBlock = withActionResponse(_updateBlock);
export const deleteBlock = withActionResponse(_deleteBlock);
export const duplicateBlock = withActionResponse(_duplicateBlock);
export const addBlocksToMultipleDays = withActionResponse(_addBlocksToMultipleDays);

// ============================================
// Direct Service Actions (JSON 기반 - 새 API)
// ============================================

/**
 * 블록 추가 (JSON 입력)
 */
export async function addBlockDirect(input: {
  blockSetId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}): Promise<BlockActionResult<{ blockId: string }>> {
  try {
    const ctx = await getServiceContext();
    const result = await service.addBlock(ctx, input);

    if (result.success) {
      revalidatePath("/blocks");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
    };
  }
}

/**
 * 블록 수정 (JSON 입력)
 */
export async function updateBlockDirect(
  blockId: string,
  input: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }
): Promise<BlockActionResult> {
  try {
    const ctx = await getServiceContext();
    const result = await service.updateBlock(ctx, blockId, input);

    if (result.success) {
      revalidatePath("/blocks");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
    };
  }
}

/**
 * 블록 삭제 (JSON 입력)
 */
export async function deleteBlockDirect(blockId: string): Promise<BlockActionResult> {
  try {
    const ctx = await getServiceContext();
    const result = await service.deleteBlock(ctx, blockId);

    if (result.success) {
      revalidatePath("/blocks");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
    };
  }
}

// ============================================
// Block Set Actions
// from: app/actions/blockSets.ts
// ============================================

async function _createBlockSet(formData: FormData): Promise<{ blockSetId: string; name: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const name = formData.get("name");
  const description = formData.get("description");

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new AppError("세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (name.length > 100) {
    throw new AppError("세트 이름은 100자 이하여야 합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const student = await getStudentById(user.userId, user.tenantId);
  if (!student || !student.tenant_id) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const count = await getBlockSetCount(user.userId);
  if (count >= MAX_BLOCK_SETS) {
    throw new AppError(
      `블록 세트는 최대 ${MAX_BLOCK_SETS}개까지 생성할 수 있습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const existingSets = await fetchBlockSetsWithBlocks(user.userId);
  if (existingSets.some((set) => set.name === name.trim())) {
    throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const maxDisplayOrder = existingSets.length > 0
    ? Math.max(...existingSets.map((_, index) => index))
    : -1;
  const displayOrder = maxDisplayOrder + 1;

  const result = await createBlockSetData({
    tenant_id: student.tenant_id,
    student_id: user.userId,
    name: name.trim(),
    description: description && typeof description === "string" ? description.trim() : null,
    display_order: displayOrder,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "블록 세트 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  return { blockSetId: result.blockSetId!, name: name.trim() };
}

async function _updateBlockSet(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const setId = formData.get("id");
  const name = formData.get("name");
  const description = formData.get("description");

  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new AppError("세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (name.length > 100) {
    throw new AppError("세트 이름은 100자 이하여야 합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const existingSet = await getBlockSetById(setId, user.userId);
  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  if (existingSet.name !== name.trim()) {
    const allSets = await fetchBlockSetsWithBlocks(user.userId);
    if (allSets.some((set) => set.id !== setId && set.name === name.trim())) {
      throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
  }

  const result = await updateBlockSetData(setId, user.userId, {
    name: name.trim(),
    description: description && typeof description === "string" ? description.trim() : null,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "블록 세트 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _deleteBlockSet(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const setId = formData.get("id");
  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const existingSet = await getBlockSetById(setId, user.userId);
  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const student = await getStudentById(user.userId, user.tenantId);
  if (student && (student as { active_block_set_id?: string }).active_block_set_id === setId) {
    const allSets = await fetchBlockSetsWithBlocks(user.userId);
    const otherSet = allSets.find((set) => set.id !== setId);

    const supabase = await createSupabaseServerClient();
    if (otherSet) {
      await supabase
        .from("students")
        .update({ active_block_set_id: otherSet.id })
        .eq("id", user.userId);
    } else {
      await supabase
        .from("students")
        .update({ active_block_set_id: null })
        .eq("id", user.userId);
    }
  }

  const result = await deleteBlockSetData(setId, user.userId);

  if (!result.success) {
    throw new AppError(
      result.error || "블록 세트 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _setActiveBlockSet(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const setId = formData.get("id");
  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const existingSet = await getBlockSetById(setId, user.userId);
  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("students")
    .update({ active_block_set_id: setId })
    .eq("id", user.userId);

  if (error) {
    throw new AppError(
      error.message || "활성 세트 설정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _duplicateBlockSet(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const sourceSetId = formData.get("source_id");
  const newName = formData.get("name");

  if (!sourceSetId || typeof sourceSetId !== "string") {
    throw new AppError("원본 세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!newName || typeof newName !== "string" || newName.trim() === "") {
    throw new AppError("새 세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const sourceSet = await getBlockSetById(sourceSetId, user.userId);
  if (!sourceSet) {
    throw new AppError("원본 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const count = await getBlockSetCount(user.userId);
  if (count >= MAX_BLOCK_SETS) {
    throw new AppError(
      `블록 세트는 최대 ${MAX_BLOCK_SETS}개까지 생성할 수 있습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const allSets = await fetchBlockSetsWithBlocks(user.userId);
  if (allSets.some((set) => set.name === newName.trim())) {
    throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const sourceBlocks = await getBlocksBySetId(sourceSetId, user.userId);

  const createResult = await createBlockSetData({
    tenant_id: sourceSet.tenant_id,
    student_id: user.userId,
    name: newName.trim(),
    description: sourceSet.description,
    display_order: (sourceSet.display_order ?? 0) + 1,
  });

  if (!createResult.success || !createResult.blockSetId) {
    throw new AppError(
      createResult.error || "세트 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  if (sourceBlocks && sourceBlocks.length > 0) {
    const createPromises = sourceBlocks.map((block) =>
      createBlock({
        tenant_id: sourceSet.tenant_id,
        student_id: user.userId,
        block_set_id: createResult.blockSetId!,
        day_of_week: block.day_of_week,
        start_time: block.start_time,
        end_time: block.end_time,
      })
    );

    const results = await Promise.all(createPromises);
    const failedResults = results.filter((r) => !r.success);

    if (failedResults.length > 0) {
      await deleteBlockSetData(createResult.blockSetId, user.userId);
      throw new AppError(
        `블록 복제 중 오류가 발생했습니다: ${failedResults[0].error}`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  revalidatePath("/blocks");
}

async function _getBlockSets(): Promise<Array<{ id: string; name: string; blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }>> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return await fetchBlockSetsWithBlocks(user.userId);
}

// Block Set Actions (withActionResponse 래핑)
export const createBlockSet = withActionResponse(_createBlockSet);
export const updateBlockSet = withActionResponse(_updateBlockSet);
export const deleteBlockSet = withActionResponse(_deleteBlockSet);
export const setActiveBlockSet = withActionResponse(_setActiveBlockSet);
export const duplicateBlockSet = withActionResponse(_duplicateBlockSet);
export const getBlockSets = withActionResponse(_getBlockSets);
