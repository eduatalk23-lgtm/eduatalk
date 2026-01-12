/**
 * 스케줄러 설정
 * 
 * 학습 계획 생성 및 스케줄링에서 사용하는 시간 계산 관련 상수들을 중앙 관리합니다.
 * 매직 넘버를 제거하고 설정 기반으로 관리하여 유지보수성을 향상시킵니다.
 */

export const SCHEDULER_CONFIG = {
  // 콘텐츠별 기본 소요 시간 (단위: 분)
  DURATION: {
    DEFAULT_BASE: 60,      // 기본 단위 시간
    DEFAULT_EPISODE: 30,   // 강의 1강당 시간
    DEFAULT_PAGE: 6,       // 교재 1페이지당 시간 (기본값: 60분 / 10페이지 = 6분)
  },

  // 교재 난이도별 페이지당 소요 시간 (단위: 분)
  // 난이도가 높을수록 1페이지를 읽는 데 더 오래 걸림
  DIFFICULTY_MULTIPLIER: {
    '기초': 4,
    '기본': 6,
    '심화': 8,
    '최상': 10,
  } as Record<string, number>,

  // 1730 Timetable 관련 설정
  REVIEW: {
    TIME_RATIO: 0.5, // 복습일은 학습일 소요시간의 50%로 계산
  },

  // 제약 조건
  LIMITS: {
    MAX_CONTENTS: 9,              // 플랜에 담을 수 있는 최대 콘텐츠 수
    CUSTOM_CONTENT_PAGE_THRESHOLD: 100, // 커스텀 콘텐츠가 이 숫자 이상이면 페이지로 간주
  },

  // 학생 수준별 소요시간 보정 계수
  // 상위권은 빠르게, 하위권은 충분한 시간 제공
  STUDENT_LEVEL: {
    high: 0.8,    // 상위권: 80% 시간 (빠른 학습)
    medium: 1.0,  // 중위권: 100% 시간 (기본)
    low: 1.2,     // 하위권: 120% 시간 (충분한 시간)
  } as Record<string, number>,
} as const;

