/**
 * 슬롯 내 점유 구간(occupied intervals) 기반 gap-aware 배치 유틸리티
 *
 * 기존 플랜이 슬롯 중간에 위치할 때 실제 빈 구간(gap)을 찾아 배치하기 위한 헬퍼.
 * occupiedIntervals는 항상 시작 시각 오름차순으로 정렬되고, 겹침/인접 구간은 병합된 상태를 유지.
 */

import { timeToMinutes } from "@/lib/utils/time";

/** 기존 플랜의 시간 정보 (SchedulerEngine의 ExistingPlanInfo와 동일 구조) */
interface PlanTimeInfo {
  start_time: string;
  end_time: string;
}

/**
 * 슬롯 내에서 requiredMinutes 이상의 첫 번째 빈 구간(gap)의 시작 시각을 반환.
 * 찾지 못하면 null.
 */
export function findFirstFreeGap(
  slotStartMin: number,
  slotEndMin: number,
  occupied: [number, number][],
  requiredMinutes: number
): number | null {
  let cursor = slotStartMin;

  for (const [occStart, occEnd] of occupied) {
    // 현재 커서에서 다음 점유 구간 시작까지의 gap
    if (occStart > cursor) {
      const gapSize = occStart - cursor;
      if (gapSize >= requiredMinutes) {
        return cursor;
      }
    }
    // 커서를 점유 구간 끝으로 이동
    if (occEnd > cursor) {
      cursor = occEnd;
    }
  }

  // 마지막 점유 구간 이후 ~ 슬롯 끝까지의 gap
  if (slotEndMin > cursor) {
    const gapSize = slotEndMin - cursor;
    if (gapSize >= requiredMinutes) {
      return cursor;
    }
  }

  return null;
}

/**
 * 슬롯 내에서 가장 큰 빈 구간(gap)을 반환. (부분 배치용)
 * 빈 구간이 없으면 null.
 */
export function findLargestFreeGap(
  slotStartMin: number,
  slotEndMin: number,
  occupied: [number, number][]
): { start: number; size: number } | null {
  let best: { start: number; size: number } | null = null;
  let cursor = slotStartMin;

  for (const [occStart, occEnd] of occupied) {
    if (occStart > cursor) {
      const gapSize = occStart - cursor;
      if (!best || gapSize > best.size) {
        best = { start: cursor, size: gapSize };
      }
    }
    if (occEnd > cursor) {
      cursor = occEnd;
    }
  }

  // 마지막 점유 구간 이후
  if (slotEndMin > cursor) {
    const gapSize = slotEndMin - cursor;
    if (!best || gapSize > best.size) {
      best = { start: cursor, size: gapSize };
    }
  }

  return best;
}

/**
 * 점유 구간 배열에 새 구간을 삽입하고, 겹침/인접 구간을 병합하여 반환.
 * 원본 배열을 변경하지 않고 새 배열을 반환.
 */
export function insertOccupiedInterval(
  intervals: [number, number][],
  newStart: number,
  newEnd: number
): [number, number][] {
  const result: [number, number][] = [];
  let merged: [number, number] = [newStart, newEnd];
  let inserted = false;

  for (const [s, e] of intervals) {
    if (e < merged[0]) {
      // 현재 구간이 병합 대상보다 앞에 있음
      result.push([s, e]);
    } else if (s > merged[1]) {
      // 현재 구간이 병합 대상보다 뒤에 있음
      if (!inserted) {
        result.push(merged);
        inserted = true;
      }
      result.push([s, e]);
    } else {
      // 겹침 또는 인접 → 병합
      merged = [Math.min(s, merged[0]), Math.max(e, merged[1])];
    }
  }

  if (!inserted) {
    result.push(merged);
  }

  return result;
}

/**
 * 기존 플랜 목록에서 슬롯 경계로 클리핑된 점유 구간 배열을 생성.
 * 결과는 시작 시각 오름차순으로 정렬되고 겹침/인접 구간이 병합된 상태.
 */
export function buildOccupiedIntervals(
  slotStartMin: number,
  slotEndMin: number,
  existingPlans: PlanTimeInfo[]
): [number, number][] {
  const raw: [number, number][] = [];

  for (const plan of existingPlans) {
    const planStart = timeToMinutes(plan.start_time);
    const planEnd = timeToMinutes(plan.end_time);

    // 슬롯 경계로 클리핑
    const clippedStart = Math.max(slotStartMin, planStart);
    const clippedEnd = Math.min(slotEndMin, planEnd);

    if (clippedEnd > clippedStart) {
      raw.push([clippedStart, clippedEnd]);
    }
  }

  // 시작 시각 기준 정렬
  raw.sort((a, b) => a[0] - b[0]);

  // 겹침/인접 구간 병합
  if (raw.length === 0) return [];

  const merged: [number, number][] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const last = merged[merged.length - 1];
    const [s, e] = raw[i];
    if (s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }

  return merged;
}
