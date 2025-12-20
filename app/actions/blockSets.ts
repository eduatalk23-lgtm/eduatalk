"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import {
  fetchBlockSetsWithBlocks,
  createBlockSet,
  updateBlockSet,
  deleteBlockSet,
  getBlockSetById,
  getBlockSetCount,
} from "@/lib/data/blockSets";
import { getStudentById } from "@/lib/data/students";

const MAX_BLOCK_SETS = 5;

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

  // 학생 정보 조회 (tenant_id 필요)
  const student = await getStudentById(user.userId, user.tenantId);
  if (!student || !student.tenant_id) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 세트 개수 제한 확인
  const count = await getBlockSetCount(user.userId);
  if (count >= MAX_BLOCK_SETS) {
    throw new AppError(
      `블록 세트는 최대 ${MAX_BLOCK_SETS}개까지 생성할 수 있습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 중복 이름 확인
  const existingSets = await fetchBlockSetsWithBlocks(user.userId);
  if (existingSets.some((set) => set.name === name.trim())) {
    throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // display_order 계산 (가장 큰 값 + 1)
  const maxDisplayOrder = existingSets.length > 0 
    ? Math.max(...existingSets.map((_, index) => index))
    : -1;
  const displayOrder = maxDisplayOrder + 1;

  // lib/data/blockSets.ts의 createBlockSet 사용
  const result = await createBlockSet({
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

  // 세트 소유권 확인
  const existingSet = await getBlockSetById(setId, user.userId);
  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 이름 변경 시 중복 확인 (자기 자신 제외)
  if (existingSet.name !== name.trim()) {
    const allSets = await fetchBlockSetsWithBlocks(user.userId);
    if (allSets.some((set) => set.id !== setId && set.name === name.trim())) {
      throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
  }

  // lib/data/blockSets.ts의 updateBlockSet 사용
  const result = await updateBlockSet(setId, user.userId, {
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

  // 세트 소유권 확인
  const existingSet = await getBlockSetById(setId, user.userId);
  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 활성 세트인지 확인
  const student = await getStudentById(user.userId, user.tenantId);
  if (student && (student as any).active_block_set_id === setId) {
    // 활성 세트를 삭제하는 경우, 다른 세트를 활성화하거나 NULL로 설정
    const allSets = await fetchBlockSetsWithBlocks(user.userId);
    const otherSet = allSets.find((set) => set.id !== setId);

    if (otherSet) {
      const supabase = await createSupabaseServerClient();
      await supabase
        .from("students")
        .update({ active_block_set_id: otherSet.id })
        .eq("id", user.userId);
    } else {
      const supabase = await createSupabaseServerClient();
      await supabase
        .from("students")
        .update({ active_block_set_id: null })
        .eq("id", user.userId);
    }
  }

  // lib/data/blockSets.ts의 deleteBlockSet 사용
  const result = await deleteBlockSet(setId, user.userId);

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

  // 세트 소유권 확인
  const existingSet = await getBlockSetById(setId, user.userId);
  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 활성 세트 설정
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

  // 원본 세트 조회
  const sourceSet = await getBlockSetById(sourceSetId, user.userId);
  if (!sourceSet) {
    throw new AppError("원본 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 세트 개수 제한 확인
  const count = await getBlockSetCount(user.userId);
  if (count >= MAX_BLOCK_SETS) {
    throw new AppError(
      `블록 세트는 최대 ${MAX_BLOCK_SETS}개까지 생성할 수 있습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 중복 이름 확인
  const allSets = await fetchBlockSetsWithBlocks(user.userId);
  if (allSets.some((set) => set.name === newName.trim())) {
    throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 원본 세트의 블록들 조회
  const { getBlocksBySetId } = await import("@/lib/data/blockSets");
  const sourceBlocks = await getBlocksBySetId(sourceSetId, user.userId);

  // 새 세트 생성
  const createResult = await createBlockSet({
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

  // 블록들 복제
  if (sourceBlocks && sourceBlocks.length > 0) {
    const { createBlock } = await import("@/lib/data/blockSets");
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
      // 롤백: 새 세트 삭제
      await deleteBlockSet(createResult.blockSetId, user.userId);
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

  // 공통 함수 사용
  return await fetchBlockSetsWithBlocks(user.userId);
}

// 에러 핸들링 래퍼 적용
export const createBlockSet = withErrorHandling(_createBlockSet);
export const updateBlockSet = withErrorHandling(_updateBlockSet);
export const deleteBlockSet = withErrorHandling(_deleteBlockSet);
export const setActiveBlockSet = withErrorHandling(_setActiveBlockSet);
export const duplicateBlockSet = withErrorHandling(_duplicateBlockSet);
export const getBlockSets = withErrorHandling(_getBlockSets);

