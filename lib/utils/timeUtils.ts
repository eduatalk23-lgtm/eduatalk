/**
 * 시간 관리(Time Management) 관련 유틸리티 함수
 */

import type {
  Block,
  BlockStats,
  BlockSetWithStats,
  TimeCalculationResult,
  BlockValidationResult,
} from "@/lib/types/time-management";
import { isStartTimeBeforeEndTime } from "@/lib/validation/timeSchema";

/**
 * 요일 이름 배열 (한글)
 */
export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * 요일 이름 가져오기
 * 
 * @param dayOfWeek 요일 (0: 일요일 ~ 6: 토요일)
 * @returns 요일 이름 (예: "월")
 */
export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "";
}

/**
 * 시간 문자열을 분 단위로 변환
 * 
 * @param timeString 시간 문자열 (HH:MM 형식)
 * @returns 분 단위 값
 */
export function timeStringToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위를 시간 문자열로 변환
 *
 * @param minutes 분 단위 값
 * @returns 시간 문자열 (HH:MM 형식)
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * 시간 문자열을 HH:MM 형식으로 정규화
 *
 * 지원 형식:
 * - "09:00" -> "09:00" (이미 정규화됨)
 * - "09:00:00" -> "09:00" (초 제거)
 * - "9:00" -> "09:00" (한 자리 시간 패딩)
 * - null/undefined/빈 문자열 -> "" (빈 문자열 반환)
 *
 * @param timeString 시간 문자열 (HH:MM 또는 HH:MM:SS 형식)
 * @returns HH:MM 형식의 시간 문자열 또는 빈 문자열
 */
export function normalizeTimeToHHMM(timeString: string | null | undefined): string {
  if (!timeString || typeof timeString !== "string" || timeString.trim() === "") {
    return "";
  }

  const trimmed = timeString.trim();
  const parts = trimmed.split(":");

  if (parts.length < 2) {
    return "";
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) {
    return "";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * 블록의 지속 시간 계산 (분 단위)
 * 
 * @param block 시간 블록
 * @returns 지속 시간 (분 단위), 유효하지 않으면 0
 */
export function calculateBlockDuration(block: Block): number {
  const startMinutes = timeStringToMinutes(block.start_time);
  const endMinutes = timeStringToMinutes(block.end_time);
  const duration = endMinutes - startMinutes;
  return duration > 0 ? duration : 0;
}

/**
 * 블록 배열의 총 시간 계산
 * 
 * @param blocks 시간 블록 배열
 * @returns 시간 계산 결과
 */
export function calculateTotalTime(blocks: Block[]): TimeCalculationResult {
  const totalMinutes = blocks.reduce((acc, block) => {
    return acc + calculateBlockDuration(block);
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.max(0, totalMinutes % 60);

  return {
    totalMinutes,
    hours,
    minutes,
  };
}

/**
 * 블록 배열의 요일별 분포 계산
 * 
 * @param blocks 시간 블록 배열
 * @returns 요일별 블록 개수 분포
 */
export function calculateDayDistribution(
  blocks: Block[]
): Record<string, number> {
  return blocks.reduce((acc, block) => {
    const dayName = getDayName(block.day_of_week);
    acc[dayName] = (acc[dayName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * 블록 통계 계산
 * 
 * @param blocks 시간 블록 배열
 * @returns 블록 통계 정보
 */
export function calculateBlockStats(blocks: Block[]): BlockStats {
  const { hours, minutes } = calculateTotalTime(blocks);
  const dayDistribution = calculateDayDistribution(blocks);

  return {
    blockCount: blocks.length,
    totalHours: hours,
    remainingMinutes: minutes,
    dayDistribution,
  };
}

/**
 * 블록 세트에 통계 정보 추가
 * 
 * @param blockSet 블록 세트
 * @returns 통계 정보가 포함된 블록 세트
 */
export function enrichBlockSetWithStats(
  blockSet: { id: string; name: string; description?: string | null; blocks?: Block[] }
): BlockSetWithStats {
  const blocks = blockSet.blocks ?? [];
  const stats = calculateBlockStats(blocks);

  return {
    ...blockSet,
    blocks,
    ...stats,
  };
}

/**
 * 블록 유효성 검사
 * 
 * @param block 검증할 블록
 * @returns 유효성 검사 결과
 */
export function validateBlock(block: Block): BlockValidationResult {
  const errors: string[] = [];

  // 시작 시간이 종료 시간보다 이전인지 확인
  if (!isStartTimeBeforeEndTime(block.start_time, block.end_time)) {
    errors.push("시작 시간은 종료 시간보다 이전이어야 합니다.");
  }

  // 요일 범위 확인
  if (block.day_of_week < 0 || block.day_of_week > 6) {
    errors.push("요일은 0(일요일)부터 6(토요일)까지여야 합니다.");
  }

  // 시간 형식 확인
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(block.start_time)) {
    errors.push("시작 시간은 HH:MM 형식이어야 합니다.");
  }
  if (!timeRegex.test(block.end_time)) {
    errors.push("종료 시간은 HH:MM 형식이어야 합니다.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 블록 배열 유효성 검사
 * 
 * @param blocks 검증할 블록 배열
 * @returns 유효성 검사 결과
 */
export function validateBlocks(blocks: Block[]): BlockValidationResult {
  const errors: string[] = [];

  blocks.forEach((block, index) => {
    const result = validateBlock(block);
    if (!result.isValid) {
      result.errors.forEach((error) => {
        errors.push(`블록 ${index + 1}: ${error}`);
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 블록 배열의 통계 정보와 함께 반환
 * 
 * @param blocks 시간 블록 배열
 * @returns 블록 배열과 통계 정보를 포함한 객체
 * 
 * @example
 * ```typescript
 * const result = getBlocksWithStats(blocks);
 * console.log(result.blocks); // Block[]
 * console.log(result.stats.blockCount); // number
 * console.log(result.stats.totalHours); // number
 * ```
 */
export function getBlocksWithStats(blocks: Block[]) {
  const stats = calculateBlockStats(blocks);
  return {
    blocks,
    stats,
  };
}

