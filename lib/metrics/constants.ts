/**
 * Metrics 관련 상수 정의
 * 
 * 성적, 목표, 학습시간 등 메트릭 계산에 사용되는 기준값들을 중앙 관리
 */

/**
 * 성적 관련 상수
 */
export const SCORE_CONSTANTS = {
  /**
   * 성적 하락 기준: 최근 2회 연속 등급 하락 시 경고
   */
  DECLINING_TREND_THRESHOLD: 2,
  
  /**
   * 저등급 기준: 7등급 이하를 저등급으로 간주
   */
  LOW_GRADE_THRESHOLD: 7,
} as const;

/**
 * 취약 과목 관련 상수
 */
export const WEAK_SUBJECT_CONSTANTS = {
  /**
   * 취약 과목 기준 점수: risk_score >= 50인 과목을 취약 과목으로 간주
   */
  RISK_SCORE_THRESHOLD: 50,
} as const;

/**
 * 학습 연속일 관련 상수
 */
export const STREAK_CONSTANTS = {
  /**
   * 학습일 기준 시간 (분): 하루에 30분 이상 학습한 경우를 학습일로 간주
   */
  MIN_STUDY_MINUTES_PER_DAY: 30,
  
  /**
   * 연속일 계산 기간: 최근 30일 내에서 연속일 계산
   */
  CALCULATION_PERIOD_DAYS: 30,
} as const;

/**
 * Today Progress 관련 상수
 */
export const TODAY_PROGRESS_CONSTANTS = {
  /**
   * 실행률 가중치: (오늘 실행률 * 0.7)
   */
  EXECUTION_RATE_WEIGHT: 0.7,
  
  /**
   * 집중 타이머 가중치: (집중 타이머 누적/예상 * 0.3)
   */
  FOCUS_TIMER_WEIGHT: 0.3,
  
  /**
   * 예상 학습 시간 (분): 플랜 1개당 평균 60분 가정
   */
  EXPECTED_MINUTES_PER_PLAN: 60,
} as const;

/**
 * 목표 관련 상수
 */
export const GOAL_CONSTANTS = {
  /**
   * 마감 임박 기준 (일): D-7 이내 목표
   */
  NEAR_DEADLINE_DAYS: 7,
  
  /**
   * 매우 임박 기준 (일): D-3 이내 목표
   */
  VERY_NEAR_DEADLINE_DAYS: 3,
  
  /**
   * 저진행률 기준: 진행률 30% 미만
   */
  LOW_PROGRESS_THRESHOLD: 30,
  
  /**
   * 매우 저진행률 기준: 진행률 50% 미만
   */
  VERY_LOW_PROGRESS_THRESHOLD: 50,
} as const;

/**
 * 히스토리 패턴 관련 상수
 */
export const HISTORY_PATTERN_CONSTANTS = {
  /**
   * 히스토리 조회 기간 (일): 최근 30일 히스토리 조회
   */
  HISTORY_LOOKBACK_DAYS: 30,
  
  /**
   * 최근 이벤트 목록 크기: 최근 20개 이벤트만 반환
   */
  RECENT_EVENTS_LIMIT: 20,
} as const;

/**
 * 성적 추이 관련 상수
 */
export const SCORE_TREND_CONSTANTS = {
  /**
   * 최근 성적 조회 개수: 최근 20개 성적 조회
   */
  RECENT_SCORES_LIMIT: 20,
  
  /**
   * 반환할 최근 성적 개수: 최근 10개만 반환
   */
  RETURN_SCORES_LIMIT: 10,
} as const;

