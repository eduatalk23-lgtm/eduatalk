"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

const MAX_BLOCK_SETS = 5;

async function _createBlockSet(formData: FormData): Promise<{ blockSetId: string; name: string }> {
  const name = formData.get("name");
  const description = formData.get("description");

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new AppError("세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (name.length > 100) {
    throw new AppError("세트 이름은 100자 이하여야 합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 학생 정보 조회 (tenant_id 필요)
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!student || !student.tenant_id) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 세트 개수 제한 확인
  const { count } = await supabase
    .from("student_block_sets")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id);

  if ((count ?? 0) >= MAX_BLOCK_SETS) {
    throw new AppError(
      `블록 세트는 최대 ${MAX_BLOCK_SETS}개까지 생성할 수 있습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 중복 이름 확인
  const { data: existingSet } = await supabase
    .from("student_block_sets")
    .select("id")
    .eq("student_id", user.id)
    .eq("name", name.trim())
    .single();

  if (existingSet) {
    throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // display_order 계산 (가장 큰 값 + 1)
  const { data: lastSet } = await supabase
    .from("student_block_sets")
    .select("display_order")
    .eq("student_id", user.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  const displayOrder = (lastSet?.display_order ?? -1) + 1;

  const { data: newSet, error } = await supabase
    .from("student_block_sets")
    .insert({
      tenant_id: student.tenant_id,
      student_id: user.id,
      name: name.trim(),
      description: description && typeof description === "string" ? description.trim() : null,
      display_order: displayOrder,
    })
    .select("id, name")
    .single();

  if (error) {
    throw error;
  }

  if (!newSet) {
    throw new AppError("블록 세트 생성에 실패했습니다.", ErrorCode.INTERNAL_ERROR, 500, true);
  }

  revalidatePath("/blocks");
  return { blockSetId: newSet.id, name: newSet.name };
}

async function _updateBlockSet(formData: FormData): Promise<void> {
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

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 세트 소유권 확인
  const { data: existingSet } = await supabase
    .from("student_block_sets")
    .select("id, name")
    .eq("id", setId)
    .eq("student_id", user.id)
    .single();

  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 이름 변경 시 중복 확인 (자기 자신 제외)
  if (existingSet.name !== name.trim()) {
    const { data: duplicateSet } = await supabase
      .from("student_block_sets")
      .select("id")
      .eq("student_id", user.id)
      .eq("name", name.trim())
      .neq("id", setId)
      .single();

    if (duplicateSet) {
      throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
  }

  const { error } = await supabase
    .from("student_block_sets")
    .update({
      name: name.trim(),
      description: description && typeof description === "string" ? description.trim() : null,
    })
    .eq("id", setId)
    .eq("student_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/blocks");
}

async function _deleteBlockSet(formData: FormData): Promise<void> {
  const setId = formData.get("id");

  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 세트 소유권 확인
  const { data: existingSet } = await supabase
    .from("student_block_sets")
    .select("id")
    .eq("id", setId)
    .eq("student_id", user.id)
    .single();

  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 활성 세트인지 확인
  const { data: student } = await supabase
    .from("students")
    .select("active_block_set_id")
    .eq("id", user.id)
    .single();

  if (student?.active_block_set_id === setId) {
    // 활성 세트를 삭제하는 경우, 다른 세트를 활성화하거나 NULL로 설정
    const { data: otherSet } = await supabase
      .from("student_block_sets")
      .select("id")
      .eq("student_id", user.id)
      .neq("id", setId)
      .order("display_order", { ascending: true })
      .limit(1)
      .single();

    if (otherSet) {
      await supabase
        .from("students")
        .update({ active_block_set_id: otherSet.id })
        .eq("id", user.id);
    } else {
      await supabase
        .from("students")
        .update({ active_block_set_id: null })
        .eq("id", user.id);
    }
  }

  // 세트 삭제 (CASCADE로 블록도 함께 삭제됨)
  const { error } = await supabase
    .from("student_block_sets")
    .delete()
    .eq("id", setId)
    .eq("student_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/blocks");
}

async function _setActiveBlockSet(formData: FormData): Promise<void> {
  const setId = formData.get("id");

  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 세트 소유권 확인
  const { data: existingSet } = await supabase
    .from("student_block_sets")
    .select("id")
    .eq("id", setId)
    .eq("student_id", user.id)
    .single();

  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 활성 세트 설정
  const { error } = await supabase
    .from("students")
    .update({ active_block_set_id: setId })
    .eq("id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/blocks");
}

async function _duplicateBlockSet(formData: FormData): Promise<void> {
  const sourceSetId = formData.get("source_id");
  const newName = formData.get("name");

  if (!sourceSetId || typeof sourceSetId !== "string") {
    throw new AppError("원본 세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!newName || typeof newName !== "string" || newName.trim() === "") {
    throw new AppError("새 세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 원본 세트 조회
  const { data: sourceSet } = await supabase
    .from("student_block_sets")
    .select("tenant_id, name, description, display_order")
    .eq("id", sourceSetId)
    .eq("student_id", user.id)
    .single();

  if (!sourceSet) {
    throw new AppError("원본 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 세트 개수 제한 확인
  const { count } = await supabase
    .from("student_block_sets")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id);

  if ((count ?? 0) >= MAX_BLOCK_SETS) {
    throw new AppError(
      `블록 세트는 최대 ${MAX_BLOCK_SETS}개까지 생성할 수 있습니다.`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 중복 이름 확인
  const { data: existingSet } = await supabase
    .from("student_block_sets")
    .select("id")
    .eq("student_id", user.id)
    .eq("name", newName.trim())
    .single();

  if (existingSet) {
    throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 원본 세트의 블록들 조회
  const { data: sourceBlocks } = await supabase
    .from("student_block_schedule")
    .select("day_of_week, start_time, end_time")
    .eq("block_set_id", sourceSetId)
    .eq("student_id", user.id)
    .order("day_of_week")
    .order("start_time");

  // 새 세트 생성
  const { data: newSet, error: insertError } = await supabase
    .from("student_block_sets")
    .insert({
      tenant_id: sourceSet.tenant_id,
      student_id: user.id,
      name: newName.trim(),
      description: sourceSet.description,
      display_order: (sourceSet.display_order ?? 0) + 1,
    })
    .select()
    .single();

  if (insertError || !newSet) {
    throw insertError || new AppError("세트 생성에 실패했습니다.", ErrorCode.INTERNAL_ERROR, 500, true);
  }

  // 블록들 복제
  if (sourceBlocks && sourceBlocks.length > 0) {
    const blocksToInsert = sourceBlocks.map((block) => ({
      tenant_id: sourceSet.tenant_id,
      student_id: user.id,
      block_set_id: newSet.id,
      day_of_week: block.day_of_week,
      start_time: block.start_time,
      end_time: block.end_time,
    }));

    const { error: blocksError } = await supabase
      .from("student_block_schedule")
      .insert(blocksToInsert);

    if (blocksError) {
      // 롤백: 새 세트 삭제
      await supabase.from("student_block_sets").delete().eq("id", newSet.id);
      throw blocksError;
    }
  }

  revalidatePath("/blocks");
}

async function _getBlockSets(): Promise<Array<{ id: string; name: string; blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const { data: blockSets, error: setsError } = await supabase
    .from("student_block_sets")
    .select("id, name")
    .eq("student_id", user.id)
    .order("display_order", { ascending: true });

  if (setsError) {
    throw setsError;
  }

  if (!blockSets || blockSets.length === 0) {
    return [];
  }

  // 각 블록 세트의 시간 블록 조회
  const blockSetsWithBlocks = await Promise.all(
    blockSets.map(async (set) => {
      const { data: blocks, error: blocksError } = await supabase
        .from("student_block_schedule")
        .select("id, day_of_week, start_time, end_time")
        .eq("block_set_id", set.id)
        .eq("student_id", user.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blocksError) {
        console.error(`[blockSets] 블록 조회 실패 (세트 ${set.id}):`, blocksError);
        return { ...set, blocks: [] };
      }

      return {
        ...set,
        blocks: (blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? [],
      };
    })
  );

  return blockSetsWithBlocks;
}

// 에러 핸들링 래퍼 적용
export const createBlockSet = withErrorHandling(_createBlockSet);
export const updateBlockSet = withErrorHandling(_updateBlockSet);
export const deleteBlockSet = withErrorHandling(_deleteBlockSet);
export const setActiveBlockSet = withErrorHandling(_setActiveBlockSet);
export const duplicateBlockSet = withErrorHandling(_duplicateBlockSet);
export const getBlockSets = withErrorHandling(_getBlockSets);

