"use server";

/**
 * Admin 블록셋 Server Actions
 *
 * Admin이 특정 학생의 블록셋을 조회/생성할 때 사용합니다.
 *
 * @module lib/domains/admin-plan/actions/blockSets
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError, logActionWarn } from "@/lib/utils/serverActionLogger";
import {
  createBlockSet,
  getBlockSetCount,
} from "@/lib/data/blockSets";

/** 블록셋 최대 개수 제한 */
const MAX_BLOCK_SETS = 5;

export type BlockSetWithBlocks = {
  id: string;
  name: string;
  blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
};

/**
 * 특정 학생의 블록셋 목록을 조회합니다 (Admin용)
 *
 * @param studentId 학생 ID
 * @returns 블록셋 목록
 */
export async function getBlockSetsForStudent(
  studentId: string
): Promise<BlockSetWithBlocks[]> {
  const user = await getCurrentUser();
  if (!user) {
    logActionError("blockSets.getBlockSetsForStudent", "로그인 필요");
    return [];
  }

  // Admin 권한 검증
  if (user.role !== "admin" && user.role !== "consultant") {
    logActionError("blockSets.getBlockSetsForStudent", `권한 없음: ${user.role}`);
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // 블록 세트 목록과 모든 블록을 병렬로 조회 (N+1 문제 해결)
  const [blockSetsResult, blocksResult] = await Promise.all([
    supabase
      .from("student_block_sets")
      .select("id, name")
      .eq("student_id", studentId)
      .order("display_order", { ascending: true }),
    supabase
      .from("student_block_schedule")
      .select("id, block_set_id, day_of_week, start_time, end_time")
      .eq("student_id", studentId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  const { data: blockSetsData, error: setsError } = blockSetsResult;
  const { data: allBlocks, error: blocksError } = blocksResult;

  if (setsError) {
    logActionError("blockSets.getBlockSetsForStudent", `블록 세트 조회 실패: ${setsError.message}`);
    return [];
  }

  if (blocksError) {
    logActionWarn("blockSets.getBlockSetsForStudent", `블록 조회 실패: ${blocksError.message}`);
    // 블록 조회 실패 시 빈 블록 배열로 처리
  }

  if (!blockSetsData || blockSetsData.length === 0) {
    return [];
  }

  // 블록을 block_set_id로 그룹화
  const blocksBySetId = new Map<
    string,
    Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>
  >();

  if (allBlocks) {
    for (const block of allBlocks) {
      if (!block.block_set_id) continue;

      if (!blocksBySetId.has(block.block_set_id)) {
        blocksBySetId.set(block.block_set_id, []);
      }

      blocksBySetId.get(block.block_set_id)!.push({
        id: block.id,
        day_of_week: block.day_of_week,
        start_time: block.start_time,
        end_time: block.end_time,
      });
    }
  }

  // 블록 세트에 블록 정보 매핑
  return blockSetsData.map((set) => ({
    id: set.id,
    name: set.name,
    blocks: blocksBySetId.get(set.id) ?? [],
  }));
}

// ============================================
// 블록셋 생성 (Admin용)
// ============================================

export type CreateBlockSetInput = {
  studentId: string;
  name: string;
  blocks: Array<{
    day_of_week: number; // 0-6 (일-토)
    start_time: string;  // HH:mm
    end_time: string;    // HH:mm
  }>;
};

export type CreateBlockSetResult = {
  success: boolean;
  blockSetId?: string;
  error?: string;
};

/**
 * Admin이 학생의 블록셋을 생성합니다.
 *
 * @param input 블록셋 생성 입력
 * @returns 생성 결과
 */
export async function createBlockSetForStudent(
  input: CreateBlockSetInput
): Promise<CreateBlockSetResult> {
  // 1. 로그인 및 권한 검증
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  if (user.role !== "admin" && user.role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const { studentId, name, blocks } = input;

  // 2. 입력값 검증
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "블록셋 이름을 입력해주세요." };
  }

  if (trimmedName.length > 100) {
    return { success: false, error: "블록셋 이름은 100자 이내로 입력해주세요." };
  }

  if (blocks.length === 0) {
    return { success: false, error: "최소 1개 이상의 시간 블록을 추가해주세요." };
  }

  // 3. 시간 블록 유효성 검증
  for (const block of blocks) {
    if (block.day_of_week < 0 || block.day_of_week > 6) {
      return { success: false, error: "요일은 0(일)~6(토) 범위여야 합니다." };
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(block.start_time) || !timeRegex.test(block.end_time)) {
      return { success: false, error: "시간 형식이 올바르지 않습니다. (HH:mm)" };
    }

    if (block.start_time >= block.end_time) {
      return { success: false, error: "종료 시간은 시작 시간보다 늦어야 합니다." };
    }
  }

  const supabase = await createSupabaseServerClient();

  // 4. 학생 존재 확인 및 tenant_id 조회
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, tenant_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    logActionError("blockSets.createBlockSetForStudent", `학생 조회 실패: ${studentError?.message ?? "not found"}`);
    return { success: false, error: "학생을 찾을 수 없습니다." };
  }

  // 5. 블록셋 개수 제한 확인
  const count = await getBlockSetCount(studentId);
  if (count >= MAX_BLOCK_SETS) {
    return {
      success: false,
      error: `블록셋은 최대 ${MAX_BLOCK_SETS}개까지 생성할 수 있습니다.`,
    };
  }

  // 6. 중복 이름 검증
  const { data: existingSet } = await supabase
    .from("student_block_sets")
    .select("id")
    .eq("student_id", studentId)
    .eq("name", trimmedName)
    .maybeSingle();

  if (existingSet) {
    return { success: false, error: "이미 같은 이름의 블록셋이 있습니다." };
  }

  // 7. 블록셋 생성
  const createResult = await createBlockSet({
    tenant_id: student.tenant_id,
    student_id: studentId,
    name: trimmedName,
    display_order: count, // 기존 개수가 곧 다음 순서
  });

  if (!createResult.success || !createResult.blockSetId) {
    return { success: false, error: createResult.error ?? "블록셋 생성에 실패했습니다." };
  }

  // 8. 시간 블록 일괄 추가
  const blockInserts = blocks.map((block) => ({
    tenant_id: student.tenant_id,
    student_id: studentId,
    block_set_id: createResult.blockSetId!,
    day_of_week: block.day_of_week,
    start_time: block.start_time,
    end_time: block.end_time,
  }));

  const { error: blocksError } = await supabase
    .from("student_block_schedule")
    .insert(blockInserts);

  if (blocksError) {
    logActionWarn("blockSets.createBlockSetForStudent", `블록 생성 실패: ${blocksError.message}`);
    // 블록셋은 이미 생성되었으므로 성공으로 처리하되 경고 로그
    // 사용자가 나중에 블록을 추가할 수 있음
  }

  return { success: true, blockSetId: createResult.blockSetId };
}
