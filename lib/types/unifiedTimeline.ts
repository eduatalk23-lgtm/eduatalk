/**
 * 통합 타임라인 재정렬 시스템 타입 정의
 *
 * 플랜과 비학습시간을 하나의 통합 타임라인으로 관리하고,
 * 슬롯 범위의 여유 공간에 따라 "밀기(Push)" 또는 "당기기(Pull)" 동작을 수행합니다.
 */

/** 타임라인 아이템 타입 */
export type TimelineItemType = 'plan' | 'nonStudy' | 'empty';

/** 비학습시간 하위 타입 (점심, 학원, 이동 등) */
export type NonStudySubType = '점심식사' | '학원' | '이동시간' | '휴식' | string;

/**
 * 통합 타임라인 아이템
 *
 * 플랜과 비학습시간 모두 이 인터페이스로 표현됩니다.
 */
export interface TimelineItem {
  /** 고유 ID (플랜: plan.id, 비학습: `nonStudy-${sourceIndex}`) */
  id: string;
  /** 아이템 타입 */
  type: TimelineItemType;
  /** 시작 시간 (HH:mm) */
  startTime: string;
  /** 종료 시간 (HH:mm) */
  endTime: string;
  /** 소요 시간 (분) */
  durationMinutes: number;
  /** 플랜 ID (type === 'plan'인 경우) */
  planId?: string;
  /** 비학습시간 하위 타입 (type === 'nonStudy'인 경우) */
  nonStudyType?: NonStudySubType;
  /** 비학습시간 원본 인덱스 (오버라이드 저장용) */
  sourceIndex?: number;
  /** 원본 시작 시간 (오버라이드 전) */
  originalStartTime?: string;
  /** 원본 종료 시간 (오버라이드 전) */
  originalEndTime?: string;
}

/**
 * 시간 슬롯 경계 정보
 *
 * 학습시간/자율학습 슬롯의 범위를 정의합니다.
 */
export interface TimeSlotBoundary {
  /** 슬롯 타입 */
  type: '학습시간' | '자율학습';
  /** 시작 시간 (HH:mm) */
  start: string;
  /** 종료 시간 (HH:mm) */
  end: string;
  /** 슬롯 총 용량 (분) */
  capacityMinutes: number;
}

/**
 * 재정렬 결과
 */
export interface ReorderResult {
  /** 재정렬된 아이템 목록 (새로운 시간 포함) */
  items: TimelineItem[];
  /** 밀기 모드에서 발생한 빈 슬롯 (있는 경우) */
  emptySlot?: {
    start: string;
    end: string;
    durationMinutes: number;
  };
  /** 사용된 모드 */
  mode: 'push' | 'pull';
}

/** 재정렬 입력 아이템 */
export interface ReorderInputItem {
  id: string;
  type: TimelineItemType;
  durationMinutes: number;
  /** 현재 시작 시간 (HH:mm) */
  startTime: string;
  /** 현재 종료 시간 (HH:mm) */
  endTime: string;
  /** 플랜인 경우 플랜 ID */
  planId?: string;
  /** 비학습시간인 경우 추가 데이터 */
  nonStudyData?: {
    sourceIndex: number;
    originalType: NonStudySubType;
    originalStartTime: string;
    originalEndTime: string;
    /** 새 테이블 레코드 ID (student_non_study_time.id) */
    recordId?: string;
  };
}

/**
 * 통합 재정렬 입력
 */
export interface UnifiedReorderInput {
  /** 학생 ID */
  studentId: string;
  /** 플래너 ID */
  plannerId: string;
  /** 플랜 날짜 (YYYY-MM-DD) */
  planDate: string;
  /** 정렬된 아이템 목록 (드래그 후 순서) */
  orderedItems: ReorderInputItem[];
  /** 원본 아이템 목록 (드래그 전 순서) - Push 모드 빈 공간 계산용 */
  originalItems: ReorderInputItem[];
  /** 슬롯 경계 정보 */
  slotBoundary: TimeSlotBoundary;
  /** 이동한 아이템 ID */
  movedItemId: string;
  /** 삽입 위치 인덱스 */
  insertIndex: number;
}

/**
 * 드래그 데이터 (DnD 컨텍스트용)
 */
export interface UnifiedDragData {
  /** 아이템 ID */
  id: string;
  /** 아이템 타입 */
  type: TimelineItemType;
  /** 소요 시간 (분) */
  durationMinutes: number;
  /** 제목 (드래그 오버레이 표시용) */
  title: string;
  /** 시작 시간 */
  startTime: string;
  /** 종료 시간 */
  endTime: string;
  /** 플랜 ID (플랜인 경우) */
  planId?: string;
  /** 비학습시간 데이터 (비학습시간인 경우) */
  nonStudyData?: {
    sourceIndex: number;
    originalType: NonStudySubType;
    /** 새 테이블 레코드 ID (student_non_study_time.id) */
    recordId?: string;
  };
}

/**
 * 시간 문자열(HH:mm)을 분 단위 숫자로 변환
 *
 * @param time - HH:mm 형식의 시간 문자열
 * @returns 자정부터의 분 단위 숫자 (유효하지 않은 입력 시 0)
 */
export function parseTimeToMinutes(time: string): number {
  if (!time || typeof time !== 'string') return 0;

  const colonIndex = time.indexOf(':');
  if (colonIndex === -1) return 0;

  const hours = parseInt(time.substring(0, colonIndex), 10);
  const minutes = parseInt(time.substring(colonIndex + 1, colonIndex + 3), 10);

  if (isNaN(hours) || isNaN(minutes)) return 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;

  return hours * 60 + minutes;
}

/**
 * 분 단위 숫자를 시간 문자열(HH:mm)로 변환
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 통합 아이템 ID 생성 (간단 버전)
 *
 * @param type - 아이템 타입 ('plan' | 'nonStudy')
 * @param id - 원본 ID (문자열 또는 숫자)
 * @returns 통합 ID (예: 'unified-plan-abc123')
 */
export function createUnifiedId(
  type: TimelineItemType,
  id: string | number
): string {
  return `unified-${type}-${id}`;
}

/**
 * 통합 아이템 ID 생성 (객체 버전)
 *
 * @deprecated createUnifiedId(type, id) 사용 권장
 */
export function createUnifiedItemId(item: {
  type: TimelineItemType;
  planId?: string;
  sourceIndex?: number;
}): string {
  if (item.type === 'plan' && item.planId) {
    return createUnifiedId('plan', item.planId);
  }
  if (item.type === 'nonStudy' && item.sourceIndex !== undefined) {
    return createUnifiedId('nonStudy', item.sourceIndex);
  }
  throw new Error('Invalid item for unified ID creation');
}

/**
 * 통합 아이템 ID 파싱
 *
 * @param unifiedId - 통합 ID (예: 'unified-plan-abc123')
 * @returns 파싱된 정보 또는 null
 */
export function parseUnifiedId(unifiedId: string): {
  type: TimelineItemType;
  originalId: string;
} | null {
  const match = unifiedId.match(/^unified-(plan|nonStudy|empty)-(.+)$/);
  if (!match) return null;

  return {
    type: match[1] as TimelineItemType,
    originalId: match[2],
  };
}

/**
 * 통합 아이템 ID에서 원본 정보 추출
 *
 * @deprecated parseUnifiedId 사용 권장
 */
export function parseUnifiedItemId(unifiedId: string): {
  type: TimelineItemType;
  originalId: string;
} | null {
  return parseUnifiedId(unifiedId);
}
