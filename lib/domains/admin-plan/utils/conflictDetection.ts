/**
 * 플랜 시간 충돌 감지 유틸리티
 * 동일 날짜 내에서 시간이 겹치는 플랜을 감지합니다.
 */

export interface TimeSlot {
  id: string;
  title: string;
  startTime: string | null; // HH:mm 형식
  endTime: string | null; // HH:mm 형식
}

export interface ConflictInfo {
  conflictingPlanId: string;
  conflictingPlanTitle: string;
  overlapMinutes: number;
  message: string;
}

/**
 * 시간 문자열을 분으로 변환
 * @param time HH:mm 형식의 시간 문자열
 * @returns 0시부터의 분 단위 값
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 두 시간 범위의 겹침 시간(분) 계산
 * @returns 겹치는 시간(분), 겹치지 않으면 0
 */
function calculateOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): number {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * 플랜 목록에서 시간 충돌을 감지합니다.
 *
 * @param plans 시간 정보가 있는 플랜 목록
 * @returns planId를 키로 하는 충돌 정보 Map
 *
 * @example
 * ```ts
 * const plans = [
 *   { id: '1', title: '수학', startTime: '10:00', endTime: '11:00' },
 *   { id: '2', title: '영어', startTime: '10:30', endTime: '11:30' },
 * ];
 * const conflicts = detectTimeConflicts(plans);
 * // Map { '1' => { conflictingPlanId: '2', overlapMinutes: 30, ... }, '2' => ... }
 * ```
 */
export function detectTimeConflicts(
  plans: TimeSlot[]
): Map<string, ConflictInfo> {
  const conflicts = new Map<string, ConflictInfo>();

  // 시간 정보가 있는 플랜만 필터링
  const plansWithTime = plans.filter(
    (plan): plan is TimeSlot & { startTime: string; endTime: string } =>
      plan.startTime !== null && plan.endTime !== null
  );

  // 플랜이 2개 미만이면 충돌 없음
  if (plansWithTime.length < 2) {
    return conflicts;
  }

  // 시작 시간 기준 정렬 (O(n log n))
  const sortedPlans = [...plansWithTime].sort((a, b) => {
    const aStart = timeToMinutes(a.startTime);
    const bStart = timeToMinutes(b.startTime);
    return aStart - bStart;
  });

  // 인접 플랜 간 충돌 검사 (O(n))
  for (let i = 0; i < sortedPlans.length - 1; i++) {
    const current = sortedPlans[i];
    const next = sortedPlans[i + 1];

    const currentStart = timeToMinutes(current.startTime);
    const currentEnd = timeToMinutes(current.endTime);
    const nextStart = timeToMinutes(next.startTime);
    const nextEnd = timeToMinutes(next.endTime);

    const overlapMinutes = calculateOverlap(
      currentStart,
      currentEnd,
      nextStart,
      nextEnd
    );

    if (overlapMinutes > 0) {
      // 양쪽 플랜 모두에 충돌 정보 추가
      if (!conflicts.has(current.id)) {
        conflicts.set(current.id, {
          conflictingPlanId: next.id,
          conflictingPlanTitle: next.title,
          overlapMinutes,
          message: `${next.startTime}-${next.endTime} "${next.title}"과(와) ${overlapMinutes}분 겹침`,
        });
      }

      if (!conflicts.has(next.id)) {
        conflicts.set(next.id, {
          conflictingPlanId: current.id,
          conflictingPlanTitle: current.title,
          overlapMinutes,
          message: `${current.startTime}-${current.endTime} "${current.title}"과(와) ${overlapMinutes}분 겹침`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * 단일 플랜이 다른 플랜들과 충돌하는지 확인
 * @param plan 확인할 플랜
 * @param existingPlans 기존 플랜 목록
 * @returns 충돌 정보 또는 null
 */
export function checkSinglePlanConflict(
  plan: TimeSlot,
  existingPlans: TimeSlot[]
): ConflictInfo | null {
  if (!plan.startTime || !plan.endTime) {
    return null;
  }

  const planStart = timeToMinutes(plan.startTime);
  const planEnd = timeToMinutes(plan.endTime);

  for (const existing of existingPlans) {
    if (existing.id === plan.id) continue;
    if (!existing.startTime || !existing.endTime) continue;

    const existingStart = timeToMinutes(existing.startTime);
    const existingEnd = timeToMinutes(existing.endTime);

    const overlapMinutes = calculateOverlap(
      planStart,
      planEnd,
      existingStart,
      existingEnd
    );

    if (overlapMinutes > 0) {
      return {
        conflictingPlanId: existing.id,
        conflictingPlanTitle: existing.title,
        overlapMinutes,
        message: `${existing.startTime}-${existing.endTime} "${existing.title}"과(와) ${overlapMinutes}분 겹침`,
      };
    }
  }

  return null;
}
