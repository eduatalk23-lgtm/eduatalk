/**
 * 시간 관리(Time Management) 관련 타입 정의
 */

/**
 * 요일 타입 (0: 일요일 ~ 6: 토요일)
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 시간 형식 (HH:MM)
 */
export type TimeString = string; // "HH:MM" 형식

/**
 * 시간 블록 (Block)
 * 
 * 특정 요일의 시작 시간부터 종료 시간까지의 시간대를 나타냅니다.
 */
export interface Block {
  /** 블록 ID */
  id: string;
  /** 요일 (0: 일요일, 1: 월요일, ..., 6: 토요일) */
  day_of_week: DayOfWeek;
  /** 시작 시간 (HH:MM 형식) */
  start_time: TimeString;
  /** 종료 시간 (HH:MM 형식) */
  end_time: TimeString;
  /** 블록 세트 ID (선택적) */
  block_set_id?: string | null;
}

/**
 * 블록 세트 (BlockSet)
 * 
 * 여러 시간 블록을 그룹화한 세트입니다.
 */
export interface BlockSet {
  /** 블록 세트 ID */
  id: string;
  /** 세트 이름 */
  name: string;
  /** 세트 설명 (선택적) */
  description?: string | null;
  /** 포함된 블록 목록 */
  blocks?: Block[];
  /** 표시 순서 (선택적) */
  display_order?: number;
}

/**
 * 블록 통계 정보
 */
export interface BlockStats {
  /** 블록 개수 */
  blockCount: number;
  /** 총 시간 (시간 단위) */
  totalHours: number;
  /** 남은 분 (시간 단위로 변환 후 나머지) */
  remainingMinutes: number;
  /** 요일별 블록 개수 분포 */
  dayDistribution: Record<string, number>;
}

/**
 * 블록 세트와 통계 정보를 포함한 확장 타입
 */
export interface BlockSetWithStats extends BlockSet {
  /** 블록 통계 정보 */
  blockCount: number;
  /** 총 시간 (시간 단위) */
  totalHours: number;
  /** 남은 분 */
  remainingMinutes: number;
  /** 요일별 블록 개수 분포 */
  dayDistribution: Record<string, number>;
}

/**
 * 블록 유효성 검사 결과
 */
export interface BlockValidationResult {
  /** 유효성 검사 통과 여부 */
  isValid: boolean;
  /** 에러 메시지 목록 */
  errors: string[];
}

/**
 * 시간 계산 결과
 */
export interface TimeCalculationResult {
  /** 총 분 수 */
  totalMinutes: number;
  /** 시간 단위 */
  hours: number;
  /** 분 단위 (나머지) */
  minutes: number;
}

