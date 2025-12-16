/**
 * 블록 겹침 검증 유틸리티
 */

import { timeToMinutes } from "@/lib/utils/time";

type TimeBlock = {
  startTime: string; // HH:MM 형식
  endTime: string; // HH:MM 형식
};

/**
 * 두 시간 블록이 겹치는지 확인
 */
function isOverlapping(block1: TimeBlock, block2: TimeBlock): boolean {
  const start1 = timeToMinutes(block1.startTime);
  const end1 = timeToMinutes(block1.endTime);
  const start2 = timeToMinutes(block2.startTime);
  const end2 = timeToMinutes(block2.endTime);

  // 블록1이 블록2와 겹치는 경우:
  // - 블록1의 시작이 블록2의 끝보다 앞이고, 블록1의 끝이 블록2의 시작보다 뒤인 경우
  return start1 < end2 && end1 > start2;
}

/**
 * 새 블록이 기존 블록들과 겹치는지 확인
 */
export function checkBlockOverlap(
  newBlock: TimeBlock,
  existingBlocks: TimeBlock[]
): boolean {
  // 시작 시간이 종료 시간보다 크거나 같은 경우는 유효하지 않음
  if (timeToMinutes(newBlock.startTime) >= timeToMinutes(newBlock.endTime)) {
    return true; // 유효하지 않은 블록은 "겹침"으로 처리
  }

  return existingBlocks.some((existing) => isOverlapping(newBlock, existing));
}

/**
 * 블록의 시간 길이 계산 (분 단위)
 */
export function calculateBlockDuration(block: TimeBlock): number {
  const start = timeToMinutes(block.startTime);
  const end = timeToMinutes(block.endTime);
  return end - start;
}

