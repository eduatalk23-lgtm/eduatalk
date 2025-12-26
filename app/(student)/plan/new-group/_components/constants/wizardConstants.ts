/**
 * wizardConstants - 위저드 상수 정의
 *
 * 위저드 전반에서 사용되는 매직 넘버를 상수화하여 관리합니다.
 * 유지보수성과 가독성을 향상시킵니다.
 */

/**
 * 위저드 단계 번호
 */
export const WIZARD_STEPS = {
  /** Step 1: 기본 정보 */
  BASIC_INFO: 1,
  /** Step 2: 블록 및 제외일 */
  TIME_SETTINGS: 2,
  /** Step 3: 스케줄 확인 */
  SCHEDULE_PREVIEW: 3,
  /** Step 4: 콘텐츠 선택 */
  CONTENT_SELECTION: 4,
  /** Step 5: 추천 콘텐츠 */
  RECOMMENDED_CONTENT: 5,
  /** Step 6: 최종 검토 */
  FINAL_REVIEW: 6,
  /** Step 7: 결과 확인 */
  RESULT: 7,
} as const;

/**
 * 총 단계 수 (템플릿 모드 제외 시)
 */
export const TOTAL_STEPS = 7;

/**
 * 템플릿 모드에서 마지막 단계
 */
export const TEMPLATE_MODE_LAST_STEP = WIZARD_STEPS.CONTENT_SELECTION;

/**
 * 캠프 모드 (학생)에서 마지막 단계
 */
export const CAMP_MODE_STUDENT_LAST_STEP = WIZARD_STEPS.CONTENT_SELECTION;

/**
 * 각 단계별 진행률 가중치 (%)
 * 6단계까지 합이 100%가 되도록 계산 (16.67 * 5 + 16.65 = 100)
 */
export const STEP_WEIGHTS: Record<number, number> = {
  [WIZARD_STEPS.BASIC_INFO]: 16.67,       // 기본 정보 (1/6)
  [WIZARD_STEPS.TIME_SETTINGS]: 16.67,    // 블록 및 제외일 (2/6)
  [WIZARD_STEPS.SCHEDULE_PREVIEW]: 16.67, // 스케줄 확인 (3/6)
  [WIZARD_STEPS.CONTENT_SELECTION]: 16.67,// 콘텐츠 선택 (4/6)
  [WIZARD_STEPS.RECOMMENDED_CONTENT]: 16.67, // 추천 콘텐츠 (5/6)
  [WIZARD_STEPS.FINAL_REVIEW]: 16.65,     // 최종 확인 (6/6) - 반올림 보정
  [WIZARD_STEPS.RESULT]: 0,               // 스케줄 결과 (완료 후 - 가중치 없음)
};

/**
 * 템플릿 모드에서 제외되는 단계 (가중치 0)
 */
export const TEMPLATE_EXCLUDED_STEPS = [
  WIZARD_STEPS.RECOMMENDED_CONTENT,
  WIZARD_STEPS.FINAL_REVIEW,
  WIZARD_STEPS.RESULT,
] as const;

/**
 * 타이밍 관련 상수 (밀리초)
 */
export const TIMING = {
  /** 오토세이브 디바운스 시간 */
  AUTO_SAVE_DEBOUNCE_MS: 2000,
  /** 저장 완료 상태 표시 시간 */
  SAVED_STATUS_DURATION_MS: 2000,
  /** Dirty 상태 체크 디바운스 시간 */
  DIRTY_CHECK_DEBOUNCE_MS: 300,
  /** 토스트 메시지 표시 시간 */
  TOAST_DURATION_MS: 3000,
} as const;

/**
 * API 관련 상수
 */
export const API = {
  /** 요청 타임아웃 (밀리초) */
  REQUEST_TIMEOUT_MS: 30000,
  /** 재시도 횟수 */
  MAX_RETRIES: 3,
} as const;

/**
 * 캐시 관련 상수
 */
export const CACHE = {
  /** 콘텐츠 캐시 만료 시간 (밀리초) */
  CONTENT_CACHE_TTL_MS: 30 * 60 * 1000, // 30분
  /** 최대 캐시 항목 수 */
  MAX_CACHE_ENTRIES: 100,
} as const;

/**
 * UI 관련 상수
 */
export const UI = {
  /** 스켈레톤 로딩 표시 최소 시간 (밀리초) */
  MIN_SKELETON_DURATION_MS: 500,
  /** 애니메이션 지속 시간 (밀리초) */
  ANIMATION_DURATION_MS: 300,
} as const;

/**
 * 단계 이름 (한국어)
 */
export const STEP_NAMES: Record<number, string> = {
  [WIZARD_STEPS.BASIC_INFO]: "기본 정보",
  [WIZARD_STEPS.TIME_SETTINGS]: "블록 및 제외일",
  [WIZARD_STEPS.SCHEDULE_PREVIEW]: "스케줄 확인",
  [WIZARD_STEPS.CONTENT_SELECTION]: "콘텐츠 선택",
  [WIZARD_STEPS.RECOMMENDED_CONTENT]: "추천 콘텐츠",
  [WIZARD_STEPS.FINAL_REVIEW]: "최종 검토",
  [WIZARD_STEPS.RESULT]: "결과 확인",
};

/**
 * 단계가 유효한지 확인
 */
export function isValidStep(step: number): step is 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return step >= WIZARD_STEPS.BASIC_INFO && step <= WIZARD_STEPS.RESULT;
}

/**
 * 템플릿 모드에서 제외되는 단계인지 확인
 */
export function isTemplateExcludedStep(step: number): boolean {
  return TEMPLATE_EXCLUDED_STEPS.includes(step as typeof TEMPLATE_EXCLUDED_STEPS[number]);
}
