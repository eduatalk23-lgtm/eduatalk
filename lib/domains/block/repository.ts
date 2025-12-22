/**
 * Block 도메인 Repository
 *
 * DB 접근 로직을 캡슐화합니다.
 * 기존 lib/data/blockSets.ts를 활용합니다.
 */

import {
  createBlock as createBlockData,
  updateBlock as updateBlockData,
  deleteBlock as deleteBlockData,
  getBlockById as getBlockByIdData,
  getBlocksBySetId as getBlocksBySetIdData,
  getBlockSetById as getBlockSetByIdData,
  createBlockSet as createBlockSetData,
  updateBlockSet as updateBlockSetData,
  deleteBlockSet as deleteBlockSetData,
  fetchBlockSetsWithBlocks as fetchBlockSetsWithBlocksData,
  getBlockSetCount as getBlockSetCountData,
  type BlockSetWithBlocks,
} from "@/lib/data/blockSets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Block,
  BlockSet,
  CreateBlockInput,
  UpdateBlockInput,
  CreateBlockSetInput,
  UpdateBlockSetInput,
} from "./types";

// Re-export for convenience
export type { BlockSetWithBlocks };

// ============================================
// Block Repository
// ============================================

export async function findBlockById(
  blockId: string,
  studentId: string
): Promise<Block | null> {
  return getBlockByIdData(blockId, studentId);
}

export async function findBlocksBySetId(
  setId: string,
  studentId: string,
  dayOfWeek?: number
): Promise<Block[]> {
  return getBlocksBySetIdData(setId, studentId, dayOfWeek);
}

export async function createBlock(
  input: CreateBlockInput
): Promise<{ success: boolean; blockId?: string; error?: string }> {
  return createBlockData(input);
}

export async function updateBlock(
  blockId: string,
  studentId: string,
  input: UpdateBlockInput
): Promise<{ success: boolean; error?: string }> {
  return updateBlockData(blockId, studentId, input);
}

export async function deleteBlock(
  blockId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  return deleteBlockData(blockId, studentId);
}

// ============================================
// BlockSet Repository
// ============================================

export async function findBlockSetById(
  setId: string,
  studentId: string
): Promise<BlockSet | null> {
  return getBlockSetByIdData(setId, studentId);
}

export async function findBlockSetsByStudentId(
  studentId: string
): Promise<BlockSetWithBlocks[]> {
  return fetchBlockSetsWithBlocksData(studentId);
}

export async function createBlockSet(
  input: CreateBlockSetInput
): Promise<{ success: boolean; blockSetId?: string; error?: string }> {
  return createBlockSetData(input);
}

export async function updateBlockSet(
  setId: string,
  studentId: string,
  input: UpdateBlockSetInput
): Promise<{ success: boolean; error?: string }> {
  return updateBlockSetData(setId, studentId, input);
}

export async function deleteBlockSet(
  setId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  return deleteBlockSetData(setId, studentId);
}

export async function getBlockSetCount(
  studentId: string
): Promise<number> {
  // getBlockSetCountData는 이미 number를 반환
  return getBlockSetCountData(studentId);
}

// ============================================
// 추가 Repository 함수
// ============================================

/**
 * 학생의 활성 블록 세트 ID 조회
 */
export async function findActiveBlockSetId(
  studentId: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("students")
    .select("active_block_set_id")
    .eq("id", studentId)
    .single();

  return data?.active_block_set_id ?? null;
}

/**
 * 학생의 활성 블록 세트 ID 업데이트
 */
export async function updateActiveBlockSetId(
  studentId: string,
  blockSetId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("students")
    .update({ active_block_set_id: blockSetId })
    .eq("id", studentId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * 기본 블록 세트 찾기 또는 생성
 */
export async function findOrCreateDefaultBlockSet(
  studentId: string,
  tenantId: string | null
): Promise<{ success: boolean; blockSetId?: string; error?: string }> {
  const allSets = await findBlockSetsByStudentId(studentId);
  const defaultSet = allSets.find((set) => set.name === "기본");

  if (defaultSet) {
    return { success: true, blockSetId: defaultSet.id };
  }

  // 기본 세트 생성
  return createBlockSet({
    tenant_id: tenantId,
    student_id: studentId,
    name: "기본",
    description: "기본 시간 블록 세트",
    display_order: 0,
  });
}
