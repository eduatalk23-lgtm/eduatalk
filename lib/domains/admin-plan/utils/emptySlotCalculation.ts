/**
 * 빈 시간 슬롯 계산 유틸리티
 *
 * DailyDock에서 플랜과 비학습시간 사이의 빈 시간 슬롯을 계산합니다.
 */

/**
 * 시간 슬롯 인터페이스
 */
export interface TimeSlot {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

/**
 * 빈 시간 슬롯 인터페이스
 */
export interface EmptySlot {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  durationMinutes: number;
  /** 이 슬롯 이전에 있는 아이템의 ID (없으면 undefined) */
  afterItemId?: string;
  /** 이 슬롯 다음에 있는 아이템의 ID (없으면 undefined) */
  beforeItemId?: string;
}

/**
 * "HH:mm" 형식의 시간 문자열을 분 단위로 변환
 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.substring(0, 5).split(':').map(Number);
  return h * 60 + m;
}

/**
 * 분 단위 시간을 "HH:mm" 형식으로 변환
 */
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 점유된 시간 슬롯 (플랜 또는 비학습시간)
 */
export interface OccupiedSlot {
  id: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  type: 'plan' | 'nonStudy';
}

/**
 * 하루의 시간 범위 내에서 빈 시간 슬롯을 계산합니다.
 *
 * @param occupiedSlots 점유된 시간 슬롯 배열 (플랜 + 비학습시간)
 * @param dayStartTime 하루 시작 시간 (기본: "06:00")
 * @param dayEndTime 하루 종료 시간 (기본: "23:00")
 * @param minEmptyMinutes 최소 빈 시간 (기본: 15분)
 * @returns 빈 시간 슬롯 배열
 */
export function calculateEmptySlots(
  occupiedSlots: OccupiedSlot[],
  dayStartTime = '06:00',
  dayEndTime = '23:00',
  minEmptyMinutes = 15
): EmptySlot[] {
  if (occupiedSlots.length === 0) {
    // 점유된 슬롯이 없으면 전체가 빈 시간
    const startMinutes = parseTimeToMinutes(dayStartTime);
    const endMinutes = parseTimeToMinutes(dayEndTime);
    const duration = endMinutes - startMinutes;

    if (duration >= minEmptyMinutes) {
      return [
        {
          startTime: dayStartTime,
          endTime: dayEndTime,
          durationMinutes: duration,
        },
      ];
    }
    return [];
  }

  // 시간순 정렬
  const sorted = [...occupiedSlots].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );

  const emptySlots: EmptySlot[] = [];
  const dayStart = parseTimeToMinutes(dayStartTime);
  const dayEnd = parseTimeToMinutes(dayEndTime);

  // 1. 하루 시작 ~ 첫 번째 슬롯 사이
  const firstSlotStart = parseTimeToMinutes(sorted[0].startTime);
  if (firstSlotStart > dayStart) {
    const duration = firstSlotStart - dayStart;
    if (duration >= minEmptyMinutes) {
      emptySlots.push({
        startTime: dayStartTime,
        endTime: sorted[0].startTime,
        durationMinutes: duration,
        beforeItemId: sorted[0].id,
      });
    }
  }

  // 2. 슬롯 사이의 빈 시간
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = parseTimeToMinutes(sorted[i].endTime);
    const nextStart = parseTimeToMinutes(sorted[i + 1].startTime);

    if (nextStart > currentEnd) {
      const duration = nextStart - currentEnd;
      if (duration >= minEmptyMinutes) {
        emptySlots.push({
          startTime: sorted[i].endTime,
          endTime: sorted[i + 1].startTime,
          durationMinutes: duration,
          afterItemId: sorted[i].id,
          beforeItemId: sorted[i + 1].id,
        });
      }
    }
  }

  // 3. 마지막 슬롯 ~ 하루 종료 사이
  const lastSlotEnd = parseTimeToMinutes(sorted[sorted.length - 1].endTime);
  if (lastSlotEnd < dayEnd) {
    const duration = dayEnd - lastSlotEnd;
    if (duration >= minEmptyMinutes) {
      emptySlots.push({
        startTime: sorted[sorted.length - 1].endTime,
        endTime: dayEndTime,
        durationMinutes: duration,
        afterItemId: sorted[sorted.length - 1].id,
      });
    }
  }

  return emptySlots;
}

/**
 * 분 단위 시간을 읽기 좋은 형식으로 변환
 * 예: 90 → "1시간 30분", 45 → "45분"
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}분`;
  }
  if (mins === 0) {
    return `${hours}시간`;
  }
  return `${hours}시간 ${mins}분`;
}
