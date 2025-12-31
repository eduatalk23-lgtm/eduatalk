/**
 * Block 도메인 Service
 *
 * 비즈니스 로직을 캡슐화합니다.
 * Repository를 통해 데이터에 접근합니다.
 */

import * as repo from "./repository";
import { checkBlockOverlap } from "@/lib/blocks/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BlockActionResult,
  BlockServiceContext,
} from "./types";

// ============================================
// 상수
// ============================================

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

// ============================================
// Block Service
// ============================================

/**
 * 블록 추가
 * - 활성 세트 또는 지정 세트에 추가
 * - 시간 겹침 검증
 */
export async function addBlock(
  ctx: BlockServiceContext,
  input: {
    blockSetId?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }
): Promise<BlockActionResult<{ blockId: string }>> {
  const { userId, tenantId } = ctx;

  // 블록 세트 결정
  const targetSetId = await resolveBlockSetId(userId, tenantId, input.blockSetId);
  if (!targetSetId.success || !targetSetId.blockSetId) {
    return { success: false, error: targetSetId.error ?? "블록 세트를 찾을 수 없습니다" };
  }

  // 시간 겹침 검증
  const overlapCheck = await checkTimeOverlap(
    targetSetId.blockSetId,
    userId,
    input.dayOfWeek,
    input.startTime,
    input.endTime
  );

  if (!overlapCheck.valid) {
    return { success: false, error: overlapCheck.error };
  }

  // 블록 생성
  const result = await repo.createBlock({
    tenant_id: tenantId,
    student_id: userId,
    block_set_id: targetSetId.blockSetId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "블록 추가 중 오류가 발생했습니다" };
  }

  return { success: true, data: { blockId: result.blockId! } };
}

/**
 * 블록 수정
 * - 소유권 검증
 * - 시간 겹침 검증 (자기 자신 제외)
 */
export async function updateBlock(
  ctx: BlockServiceContext,
  blockId: string,
  input: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }
): Promise<BlockActionResult> {
  const { userId } = ctx;

  // 기존 블록 조회 (소유권 검증)
  const existingBlock = await repo.findBlockById(blockId, userId);
  if (!existingBlock) {
    return { success: false, error: "블록을 찾을 수 없습니다" };
  }

  const blockSetId = existingBlock.block_set_id;
  if (!blockSetId) {
    return { success: false, error: "블록이 속한 세트를 찾을 수 없습니다" };
  }

  // 시간 겹침 검증 (자기 자신 제외)
  const overlapCheck = await checkTimeOverlap(
    blockSetId,
    userId,
    input.dayOfWeek,
    input.startTime,
    input.endTime,
    blockId // 자기 자신 제외
  );

  if (!overlapCheck.valid) {
    return { success: false, error: overlapCheck.error };
  }

  // 블록 업데이트
  const result = await repo.updateBlock(blockId, userId, {
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "블록 수정 중 오류가 발생했습니다" };
  }

  return { success: true };
}

/**
 * 블록 삭제
 */
export async function deleteBlock(
  ctx: BlockServiceContext,
  blockId: string
): Promise<BlockActionResult> {
  const result = await repo.deleteBlock(blockId, ctx.userId);

  if (!result.success) {
    return { success: false, error: result.error ?? "블록 삭제 중 오류가 발생했습니다" };
  }

  return { success: true };
}

/**
 * 블록 복제 (다른 요일로)
 */
export async function duplicateBlock(
  ctx: BlockServiceContext,
  blockId: string,
  targetDay: number
): Promise<BlockActionResult<{ blockId: string }>> {
  const { userId, tenantId } = ctx;

  // 원본 블록 조회
  const sourceBlock = await repo.findBlockById(blockId, userId);
  if (!sourceBlock?.start_time || !sourceBlock?.end_time) {
    return { success: false, error: "블록을 찾을 수 없습니다" };
  }

  // 활성 세트 또는 원본 세트 사용
  const activeSetId = await repo.findActiveBlockSetId(userId);
  const targetSetId = activeSetId ?? sourceBlock.block_set_id;

  if (!targetSetId) {
    return { success: false, error: "블록 세트를 찾을 수 없습니다" };
  }

  // 대상 요일 겹침 검증
  const overlapCheck = await checkTimeOverlap(
    targetSetId,
    userId,
    targetDay,
    sourceBlock.start_time,
    sourceBlock.end_time
  );

  if (!overlapCheck.valid) {
    return { success: false, error: "대상 요일에 이미 등록된 시간 블록과 겹칩니다" };
  }

  // 블록 생성
  const result = await repo.createBlock({
    tenant_id: tenantId,
    student_id: userId,
    block_set_id: targetSetId,
    day_of_week: targetDay,
    start_time: sourceBlock.start_time,
    end_time: sourceBlock.end_time,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "블록 복제 중 오류가 발생했습니다" };
  }

  return { success: true, data: { blockId: result.blockId! } };
}

/**
 * 여러 요일에 블록 일괄 추가
 * - 겹치는 요일은 스킵하고 나머지만 추가
 */
export async function addBlocksToMultipleDays(
  ctx: BlockServiceContext,
  input: {
    blockSetId?: string;
    targetDays: number[];
    startTime: string;
    endTime: string;
  }
): Promise<BlockActionResult> {
  const { userId, tenantId } = ctx;

  if (input.targetDays.length === 0) {
    return { success: false, error: "추가할 요일을 최소 1개 이상 선택해주세요" };
  }

  // 블록 세트 결정
  const targetSetId = await resolveBlockSetId(userId, tenantId, input.blockSetId);
  if (!targetSetId.success || !targetSetId.blockSetId) {
    return { success: false, error: targetSetId.error ?? "블록 세트를 찾을 수 없습니다" };
  }

  // 각 요일별로 처리
  const results = await Promise.all(
    input.targetDays.map(async (targetDay) => {
      // 겹침 검증
      const overlapCheck = await checkTimeOverlap(
        targetSetId.blockSetId!,
        userId,
        targetDay,
        input.startTime,
        input.endTime
      );

      if (!overlapCheck.valid) {
        return { targetDay, skipped: true, reason: "이미 등록된 시간 블록과 겹칩니다" };
      }

      // 블록 생성
      const result = await repo.createBlock({
        tenant_id: tenantId,
        student_id: userId,
        block_set_id: targetSetId.blockSetId!,
        day_of_week: targetDay,
        start_time: input.startTime,
        end_time: input.endTime,
      });

      if (!result.success) {
        return { targetDay, skipped: true, reason: result.error ?? "블록 추가 중 오류 발생" };
      }

      return { targetDay, skipped: false };
    })
  );

  const successResults = results.filter((r) => !r.skipped);
  const skippedResults = results.filter((r) => r.skipped);

  // 모든 요일이 실패한 경우
  if (successResults.length === 0) {
    const skippedDays = skippedResults.map((r) => DAY_NAMES[r.targetDay]).join(", ");
    return {
      success: false,
      error: `모든 요일(${skippedDays})로의 추가가 실패했습니다`,
    };
  }

  // 부분 성공
  if (skippedResults.length > 0) {
    const successDays = successResults.map((r) => DAY_NAMES[r.targetDay]);
    const skippedDays = skippedResults.map((r) => DAY_NAMES[r.targetDay]);

    return {
      success: true,
      details: {
        successCount: successResults.length,
        skippedCount: skippedResults.length,
        skippedDays,
      },
    };
  }

  return { success: true };
}

// ============================================
// Helper Functions
// ============================================

/**
 * 블록 세트 ID 결정
 * - 제공된 ID가 있으면 소유권 검증 후 사용
 * - 없으면 활성 세트 또는 기본 세트 사용
 */
async function resolveBlockSetId(
  userId: string,
  tenantId: string | null,
  providedSetId?: string
): Promise<{ success: boolean; blockSetId?: string; error?: string }> {
  // 제공된 ID가 있으면 검증 후 사용
  if (providedSetId) {
    const providedSet = await repo.findBlockSetById(providedSetId, userId);
    if (!providedSet) {
      return { success: false, error: "블록 세트를 찾을 수 없습니다" };
    }
    return { success: true, blockSetId: providedSet.id };
  }

  // 활성 세트 확인
  const activeSetId = await repo.findActiveBlockSetId(userId);
  if (activeSetId) {
    return { success: true, blockSetId: activeSetId };
  }

  // 기본 세트 찾기 또는 생성
  const defaultSetResult = await repo.findOrCreateDefaultBlockSet(userId, tenantId);
  if (!defaultSetResult.success || !defaultSetResult.blockSetId) {
    return { success: false, error: defaultSetResult.error ?? "기본 블록 세트 생성 중 오류" };
  }

  // 활성 세트로 설정
  await repo.updateActiveBlockSetId(userId, defaultSetResult.blockSetId);

  return { success: true, blockSetId: defaultSetResult.blockSetId };
}

/**
 * 시간 겹침 검증
 * P2 개선: 학원 일정과의 겹침도 검사
 */
async function checkTimeOverlap(
  blockSetId: string,
  userId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeBlockId?: string
): Promise<{ valid: boolean; error?: string }> {
  const existingBlocks = await repo.findBlocksBySetId(blockSetId, userId, dayOfWeek);

  // 자기 자신 제외
  const blocksToCheck = excludeBlockId
    ? existingBlocks.filter((b) => b.id !== excludeBlockId)
    : existingBlocks;

  // 1. 기존 블록과 겹침 검사
  if (blocksToCheck.length > 0) {
    const hasBlockOverlap = checkBlockOverlap(
      { startTime, endTime },
      blocksToCheck.map((b) => ({
        startTime: b.start_time,
        endTime: b.end_time,
      }))
    );

    if (hasBlockOverlap) {
      return {
        valid: false,
        error: "이미 등록된 시간 블록과 겹칩니다. 다른 시간대를 선택해주세요.",
      };
    }
  }

  // 2. 학원 일정과 겹침 검사
  const academySchedules = await getAcademySchedulesForDay(userId, dayOfWeek);
  if (academySchedules.length > 0) {
    const hasAcademyOverlap = checkBlockOverlap(
      { startTime, endTime },
      academySchedules.map((a) => ({
        startTime: a.start_time,
        endTime: a.end_time,
      }))
    );

    if (hasAcademyOverlap) {
      const overlappingAcademy = academySchedules.find((a) => {
        return checkBlockOverlap(
          { startTime, endTime },
          [{ startTime: a.start_time, endTime: a.end_time }]
        );
      });
      const academyName = overlappingAcademy?.academy_name || "학원";
      return {
        valid: false,
        error: `${academyName} 일정(${overlappingAcademy?.start_time}~${overlappingAcademy?.end_time})과 시간이 겹칩니다. 다른 시간대를 선택해주세요.`,
      };
    }
  }

  return { valid: true };
}

/**
 * P2 개선: 특정 요일의 학원 일정 조회
 */
async function getAcademySchedulesForDay(
  studentId: string,
  dayOfWeek: number
): Promise<Array<{ start_time: string; end_time: string; academy_name: string | null }>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("academy_schedules")
      .select("start_time, end_time, academy_name")
      .eq("student_id", studentId)
      .eq("day_of_week", dayOfWeek);

    if (error) {
      console.error("[block/service] 학원 일정 조회 오류:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[block/service] 학원 일정 조회 중 예외:", err);
    return [];
  }
}
