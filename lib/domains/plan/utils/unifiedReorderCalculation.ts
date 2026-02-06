/**
 * 통합 타임라인 재정렬 알고리즘
 *
 * 핵심 규칙:
 * - 여유 있음 (밀기/Push): 삽입 위치 뒤 아이템들이 뒤로 밀림, 원래 위치는 빈 공간으로 남음
 * - 여유 없음 (당기기/Pull): 슬롯 시작부터 연속 재계산, 빈 공간 없이 빽빽하게 배치
 */

import {
  type TimelineItem,
  type TimeSlotBoundary,
  type ReorderResult,
  parseTimeToMinutes,
  minutesToTimeString,
} from '@/lib/types/unifiedTimeline';

/**
 * 통합 재정렬 계산
 *
 * @param orderedItems - 드래그 후 정렬된 아이템 목록 (새 순서, empty 포함 가능)
 * @param slot - 현재 슬롯 경계 정보
 * @param movedItemId - 이동한 아이템 ID
 * @param originalItems - 이동 전 원본 아이템 목록 (empty 포함 가능)
 * @returns 재정렬 결과 (새 시간 포함)
 */
export function calculateUnifiedReorder(
  orderedItems: TimelineItem[],
  slot: TimeSlotBoundary,
  movedItemId: string,
  originalItems: TimelineItem[]
): ReorderResult {
  console.log('[calculateUnifiedReorder] Input:', {
    orderedItemsCount: orderedItems.length,
    originalItemsCount: originalItems.length,
    movedItemId,
    slot,
  });
  console.log('[calculateUnifiedReorder] Ordered items:', orderedItems.map(i => ({ id: i.id, type: i.type, start: i.startTime, end: i.endTime })));
  console.log('[calculateUnifiedReorder] Original items:', originalItems.map(i => ({ id: i.id, type: i.type, start: i.startTime, end: i.endTime })));

  // 슬롯 용량 계산
  const slotStartMinutes = parseTimeToMinutes(slot.start);
  const slotEndMinutes = parseTimeToMinutes(slot.end);
  const slotCapacity = slotEndMinutes - slotStartMinutes;

  // 실제 아이템만 필터 (empty 제외) - 시간 계산에서 빈 시간은 제외
  const actualOrderedItems = orderedItems.filter(item => item.type !== 'empty');
  const actualOriginalItems = originalItems.filter(item => item.type !== 'empty');

  // 플랜만 필터 (용량 계산용) - 비학습시간은 고정 위치이므로 제외
  const planOnlyItems = actualOrderedItems.filter(item => item.type === 'plan');

  // 플랜 총 소요 시간 계산 (비학습시간 제외)
  const totalPlanRequired = planOnlyItems.reduce(
    (sum, item) => sum + item.durationMinutes,
    0
  );

  // 비학습시간의 총 소요 시간
  const nonStudyItems = actualOrderedItems.filter(item => item.type === 'nonStudy');
  const totalNonStudyRequired = nonStudyItems.reduce(
    (sum, item) => sum + item.durationMinutes,
    0
  );

  // 여유 공간 판단 (비학습시간을 제외한 실제 가용 용량으로 계산)
  const availableCapacity = slotCapacity - totalNonStudyRequired;
  const hasCapacity = totalPlanRequired <= availableCapacity;

  console.log('[calculateUnifiedReorder] Capacity check:', {
    totalPlanRequired,
    totalNonStudyRequired,
    slotCapacity,
    availableCapacity,
    hasCapacity,
    mode: hasCapacity ? 'push' : 'pull',
  });

  if (hasCapacity) {
    // 밀기 모드 (Push)
    return calculatePushMode(
      actualOrderedItems,
      slot,
      movedItemId,
      actualOriginalItems,
      slotStartMinutes,
      slotEndMinutes
    );
  } else {
    // 당기기 모드 (Pull)
    return calculatePullMode(actualOrderedItems, slotStartMinutes);
  }
}

/**
 * 밀기 모드 (Push) 계산
 *
 * Push 모드의 핵심 개념: "삽입"
 * - 이동한 아이템이 드롭 위치 아이템의 바로 뒤에 "삽입"됨
 * - 삽입으로 인해 겹치는 아이템들만 뒤로 밀림
 * - 이동한 아이템의 원래 위치는 빈 공간으로 남음
 *
 * @param orderedItems - 드래그 후 새 순서
 * @param slot - 슬롯 경계
 * @param movedItemId - 이동한 아이템 ID
 * @param originalItems - 드래그 전 순서
 * @param slotStartMinutes - 슬롯 시작 (분)
 * @param slotEndMinutes - 슬롯 끝 (분)
 */
function calculatePushMode(
  orderedItems: TimelineItem[],
  slot: TimeSlotBoundary,
  movedItemId: string,
  originalItems: TimelineItem[],
  slotStartMinutes: number,
  slotEndMinutes: number
): ReorderResult {
  console.log('[calculatePushMode] movedItemId:', movedItemId);
  console.log('[calculatePushMode] orderedItems IDs:', orderedItems.map(i => i.id));
  console.log('[calculatePushMode] originalItems IDs:', originalItems.map(i => i.id));

  // 이동한 아이템 정보
  const originalMovedItem = originalItems.find(
    (item) => item.id === movedItemId
  );
  if (!originalMovedItem) {
    console.log('[calculatePushMode] movedItem not found, falling back to pull mode');
    return calculatePullMode(orderedItems, slotStartMinutes);
  }

  const originalIndex = originalItems.findIndex(
    (item) => item.id === movedItemId
  );
  const newIndex = orderedItems.findIndex((item) => item.id === movedItemId);

  console.log('[calculatePushMode] Index change:', { originalIndex, newIndex });

  // 이동하지 않은 경우
  if (originalIndex === newIndex) {
    console.log('[calculatePushMode] No index change, returning original items');
    return {
      items: originalItems.map((item) => ({ ...item })),
      emptySlot: undefined,
      mode: 'push',
    };
  }

  const movedItemDuration = originalMovedItem.durationMinutes;

  // 원본 아이템들의 시간 정보를 맵으로 저장
  const originalTimeMap = new Map<string, { start: number; end: number; index: number }>();
  for (let i = 0; i < originalItems.length; i++) {
    const item = originalItems[i];
    originalTimeMap.set(item.id, {
      start: parseTimeToMinutes(item.startTime),
      end: parseTimeToMinutes(item.endTime),
      index: i,
    });
  }

  // 이동한 아이템의 원래 시간
  const movedItemOrigStart = parseTimeToMinutes(originalMovedItem.startTime);
  const movedItemOrigEnd = parseTimeToMinutes(originalMovedItem.endTime);

  // ============================================
  // 1. 이동한 아이템의 삽입 시간 결정
  // ============================================
  // 새 순서에서 이동한 아이템 바로 앞 아이템의 "원래" 끝 시간
  let insertStartTime: number;

  if (newIndex > 0) {
    const prevItemInNewOrder = orderedItems[newIndex - 1];
    const prevOrigTime = originalTimeMap.get(prevItemInNewOrder.id);
    insertStartTime = prevOrigTime ? prevOrigTime.end : slotStartMinutes;
  } else {
    insertStartTime = slotStartMinutes;
  }

  const movedItemNewEnd = insertStartTime + movedItemDuration;

  // ============================================
  // 2. 결과 아이템들 구성
  // ============================================
  const resultItems: TimelineItem[] = [];

  // 이동한 아이템 먼저 추가
  resultItems.push({
    ...originalMovedItem,
    startTime: minutesToTimeString(insertStartTime),
    endTime: minutesToTimeString(movedItemNewEnd),
  });

  // 다른 아이템들: 원래 시간 기준, 이동한 아이템과 겹치면 뒤로 밀기
  for (const item of originalItems) {
    if (item.id === movedItemId) continue;

    const origTime = originalTimeMap.get(item.id)!;
    let newStart = origTime.start;
    let newEnd = origTime.end;

    // 이동한 아이템과 겹치는지? (두 구간이 overlap)
    // 겹침 조건: start1 < end2 && end1 > start2
    if (newStart < movedItemNewEnd && newEnd > insertStartTime) {
      // 겹침 → 이동한 아이템 뒤로 배치
      newStart = movedItemNewEnd;
      newEnd = newStart + item.durationMinutes;
    }

    resultItems.push({
      ...item,
      startTime: minutesToTimeString(newStart),
      endTime: minutesToTimeString(newEnd),
    });
  }

  // 시간순 정렬
  resultItems.sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );

  // ============================================
  // 3. 연쇄 충돌 해결 (앞 아이템과 겹치면 밀기)
  // ============================================
  for (let i = 1; i < resultItems.length; i++) {
    const prevEnd = parseTimeToMinutes(resultItems[i - 1].endTime);
    const currStart = parseTimeToMinutes(resultItems[i].startTime);

    if (currStart < prevEnd) {
      const duration = resultItems[i].durationMinutes;
      resultItems[i] = {
        ...resultItems[i],
        startTime: minutesToTimeString(prevEnd),
        endTime: minutesToTimeString(prevEnd + duration),
      };
    }
  }

  // ============================================
  // 4. 빈 공간 계산 (이동한 아이템의 원래 위치)
  // ============================================
  let emptySlot: ReorderResult['emptySlot'] | undefined;

  // 이동한 아이템의 원래 위치가 다른 아이템에 의해 점유되었는지 확인
  const isOrigPosOccupied = resultItems.some(item => {
    if (item.id === movedItemId) return false;
    const start = parseTimeToMinutes(item.startTime);
    const end = parseTimeToMinutes(item.endTime);
    // 원래 위치와 겹치는지 확인
    return start < movedItemOrigEnd && end > movedItemOrigStart;
  });

  if (!isOrigPosOccupied) {
    emptySlot = {
      start: minutesToTimeString(movedItemOrigStart),
      end: minutesToTimeString(movedItemOrigEnd),
      durationMinutes: movedItemDuration,
    };
  }

  // 슬롯 끝 초과 검증
  const lastItem = resultItems[resultItems.length - 1];
  if (lastItem && parseTimeToMinutes(lastItem.endTime) > slotEndMinutes) {
    console.log('[calculatePushMode] Exceeds slot end, falling back to pull mode');
    return calculatePullMode(orderedItems, slotStartMinutes);
  }

  console.log('[calculatePushMode] Result:', resultItems.map(i => ({ id: i.id.substring(0, 8), start: i.startTime, end: i.endTime })));

  return {
    items: resultItems,
    emptySlot,
    mode: 'push',
  };
}

/**
 * 당기기 모드 (Pull) 계산
 *
 * 슬롯 시작부터 연속으로 배치됩니다.
 * 빈 공간 없이 빽빽하게 배치됩니다.
 */
function calculatePullMode(
  orderedItems: TimelineItem[],
  slotStartMinutes: number
): ReorderResult {
  console.log('[calculatePullMode] Input items:', orderedItems.map(i => ({ id: i.id.substring(0, 8), duration: i.durationMinutes })));

  const resultItems: TimelineItem[] = [];
  let currentTime = slotStartMinutes;

  for (const item of orderedItems) {
    const newStartTime = minutesToTimeString(currentTime);
    const newEndTime = minutesToTimeString(currentTime + item.durationMinutes);

    resultItems.push({
      ...item,
      startTime: newStartTime,
      endTime: newEndTime,
    });

    currentTime += item.durationMinutes;
  }

  console.log('[calculatePullMode] Result:', resultItems.map(i => ({ id: i.id.substring(0, 8), start: i.startTime, end: i.endTime })));

  return {
    items: resultItems,
    emptySlot: undefined,
    mode: 'pull',
  };
}

/**
 * 재정렬 가능 여부 확인
 *
 * 아이템 총 시간이 슬롯 용량을 초과하면 재정렬 불가
 */
export function canReorder(
  items: TimelineItem[],
  slot: TimeSlotBoundary
): { canReorder: boolean; excessMinutes?: number } {
  const slotCapacity = slot.capacityMinutes;
  // 실제 아이템만 계산 (empty 제외)
  const actualItems = items.filter(item => item.type !== 'empty');
  const totalRequired = actualItems.reduce(
    (sum, item) => sum + item.durationMinutes,
    0
  );

  if (totalRequired > slotCapacity) {
    return {
      canReorder: false,
      excessMinutes: totalRequired - slotCapacity,
    };
  }

  return { canReorder: true };
}

/**
 * 예상 재정렬 모드 판단
 *
 * 드래그 중 시각적 피드백을 위해 사용
 */
export function predictReorderMode(
  items: TimelineItem[],
  slot: TimeSlotBoundary
): 'push' | 'pull' {
  const slotCapacity = slot.capacityMinutes;
  // 실제 아이템만 계산 (empty 제외)
  const actualItems = items.filter(item => item.type !== 'empty');
  const totalRequired = actualItems.reduce(
    (sum, item) => sum + item.durationMinutes,
    0
  );

  return totalRequired < slotCapacity ? 'push' : 'pull';
}

/**
 * 기존 아이템 목록에서 특정 아이템을 새 위치로 이동한 결과 생성
 *
 * @param items - 원본 아이템 목록
 * @param movedItemId - 이동할 아이템 ID
 * @param newIndex - 새 위치 인덱스
 * @returns 새 순서의 아이템 목록
 */
export function moveItemToIndex(
  items: TimelineItem[],
  movedItemId: string,
  newIndex: number
): TimelineItem[] {
  const currentIndex = items.findIndex((item) => item.id === movedItemId);
  if (currentIndex === -1) return items;

  const result = [...items];
  const [movedItem] = result.splice(currentIndex, 1);
  result.splice(newIndex, 0, movedItem);

  return result;
}

/**
 * 비학습시간 제약 검증 결과
 */
export interface NonStudyTimeConstraintResult {
  /** 제약 통과 여부 */
  isValid: boolean;
  /** 경고 메시지 (있는 경우) */
  warning?: string;
  /** 경고 수준 */
  severity?: 'info' | 'warning' | 'error';
}

/**
 * 비학습시간 배치 제약 검증
 *
 * 점심시간, 학원 일정 등의 비학습시간이 적절한 시간대에 배치되었는지 검증합니다.
 *
 * @param nonStudyType - 비학습시간 타입 ('점심식사', '학원', '이동시간' 등)
 * @param startTime - 시작 시간 (HH:mm)
 * @param endTime - 종료 시간 (HH:mm)
 * @returns 검증 결과
 */
export function validateNonStudyTimeConstraints(
  nonStudyType: string | undefined,
  startTime: string,
  endTime: string
): NonStudyTimeConstraintResult {
  if (!nonStudyType || !startTime) {
    return { isValid: true };
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  // 점심식사 제약: 11:00 ~ 14:00 사이가 적절
  if (nonStudyType === '점심식사' || nonStudyType === '점심시간') {
    const LUNCH_MIN = 11 * 60; // 11:00
    const LUNCH_MAX = 14 * 60; // 14:00

    if (startMinutes < LUNCH_MIN) {
      return {
        isValid: true, // 허용은 하지만 경고
        warning: `점심시간이 너무 이릅니다 (${startTime}). 11:00 이후를 권장합니다.`,
        severity: 'warning',
      };
    }

    if (startMinutes >= LUNCH_MAX) {
      return {
        isValid: true,
        warning: `점심시간이 너무 늦습니다 (${startTime}). 14:00 이전을 권장합니다.`,
        severity: 'warning',
      };
    }
  }

  // 학원 일정 제약: 보통 오후~저녁 (14:00 ~ 22:00)
  if (nonStudyType === '학원' || nonStudyType === '학원일정') {
    const ACADEMY_MIN = 14 * 60; // 14:00
    const ACADEMY_MAX = 22 * 60; // 22:00

    if (startMinutes < ACADEMY_MIN) {
      return {
        isValid: true,
        warning: `학원 일정이 이른 시간입니다 (${startTime}). 일반적으로 오후 시간에 배치됩니다.`,
        severity: 'info',
      };
    }

    if (endMinutes > ACADEMY_MAX) {
      return {
        isValid: true,
        warning: `학원 일정이 늦은 시간까지 이어집니다 (${endTime} 종료). 22:00 이전 종료를 권장합니다.`,
        severity: 'warning',
      };
    }
  }

  // 이동시간 제약: 단독으로는 의미 없음, 학원과 함께 배치
  if (nonStudyType === '이동시간') {
    const duration = endMinutes - startMinutes;
    if (duration > 60) {
      return {
        isValid: true,
        warning: `이동시간이 ${duration}분으로 긴 편입니다.`,
        severity: 'info',
      };
    }
  }

  return { isValid: true };
}

/**
 * 재정렬 결과에서 비학습시간 제약 검증
 *
 * @param reorderResult - 재정렬 결과
 * @returns 모든 비학습시간 아이템의 제약 검증 결과
 */
export function validateReorderResultConstraints(
  reorderResult: ReorderResult
): NonStudyTimeConstraintResult[] {
  const warnings: NonStudyTimeConstraintResult[] = [];

  for (const item of reorderResult.items) {
    if (item.type === 'nonStudy' && item.nonStudyType) {
      const result = validateNonStudyTimeConstraints(
        item.nonStudyType,
        item.startTime,
        item.endTime
      );
      if (result.warning) {
        warnings.push(result);
      }
    }
  }

  return warnings;
}
