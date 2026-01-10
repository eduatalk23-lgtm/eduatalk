/**
 * Wizard Base Types
 *
 * 역할/모드 설정 및 기본 타입 정의
 * 모든 위자드 구현에서 공통으로 사용됩니다.
 *
 * @module lib/features/wizard/types/base
 */

// ============================================
// 역할 및 모드 타입
// ============================================

/**
 * 위자드를 사용할 수 있는 사용자 역할
 */
export type WizardRole = "student" | "admin" | "consultant" | "parent";

/**
 * 위자드 동작 모드
 */
export type WizardMode =
  | "structured" // 전체 7단계 위자드
  | "quick" // 빠른 생성 (3단계)
  | "template" // 템플릿 기반
  | "camp" // 캠프 기반
  | "batch"; // 배치 생성 (관리자 전용)

/**
 * 위자드 단계 타입 (1-7)
 */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ============================================
// 기능 플래그
// ============================================

/**
 * 역할/모드별 활성화되는 기능 플래그
 */
export interface WizardFeatures {
  /** AI 플랜 생성 가능 여부 */
  hasAIGeneration: boolean;
  /** 자동 저장 기능 */
  hasAutoSave: boolean;
  /** 템플릿 모드 지원 */
  hasTemplateSupport: boolean;
  /** 캠프 모드 지원 */
  hasCampSupport: boolean;
  /** 콘텐츠 선택 건너뛰기 가능 */
  hasContentSkip: boolean;
  /** 슬롯 모드 지원 */
  hasSlotMode: boolean;
  /** 최대 단계 수 */
  maxSteps: number;
}

// ============================================
// 설정 타입
// ============================================

/**
 * 위자드 전체 설정
 */
export interface WizardConfig {
  /** 사용자 역할 */
  role: WizardRole;
  /** 동작 모드 */
  mode: WizardMode;
  /** 활성화된 기능들 */
  features: WizardFeatures;
  /** 총 단계 수 */
  totalSteps: number;
  /** 단계별 레이블 */
  stepLabels: string[];
}

// ============================================
// 기본 설정 상수
// ============================================

/**
 * 학생용 기본 설정
 */
export const STUDENT_WIZARD_CONFIG: WizardConfig = {
  role: "student",
  mode: "structured",
  features: {
    hasAIGeneration: false,
    hasAutoSave: true,
    hasTemplateSupport: true,
    hasCampSupport: true,
    hasContentSkip: false,
    hasSlotMode: true,
    maxSteps: 7,
  },
  totalSteps: 7,
  stepLabels: [
    "기본정보",
    "시간설정",
    "스케줄 미리보기",
    "콘텐츠 선택",
    "추천 콘텐츠",
    "최종 검토",
    "플랜 생성",
  ],
};

/**
 * 관리자용 기본 설정
 */
export const ADMIN_WIZARD_CONFIG: WizardConfig = {
  role: "admin",
  mode: "structured",
  features: {
    hasAIGeneration: true,
    hasAutoSave: true,
    hasTemplateSupport: false,
    hasCampSupport: false,
    hasContentSkip: true,
    hasSlotMode: true,
    maxSteps: 7,
  },
  totalSteps: 7,
  stepLabels: [
    "기본정보",
    "시간설정",
    "스케줄 미리보기",
    "콘텐츠 선택",
    "배분 설정",
    "최종 검토",
    "플랜 생성",
  ],
};

/**
 * 빠른 생성 모드 설정
 */
export const QUICK_WIZARD_CONFIG: WizardConfig = {
  role: "student",
  mode: "quick",
  features: {
    hasAIGeneration: false,
    hasAutoSave: false,
    hasTemplateSupport: false,
    hasCampSupport: false,
    hasContentSkip: false,
    hasSlotMode: false,
    maxSteps: 3,
  },
  totalSteps: 3,
  stepLabels: ["콘텐츠 선택", "스케줄 설정", "확인"],
};

// ============================================
// 상수
// ============================================

/**
 * 위자드 단계 상수
 */
export const WIZARD_STEPS = {
  BASIC_INFO: 1 as WizardStep,
  TIME_SETTINGS: 2 as WizardStep,
  SCHEDULE_PREVIEW: 3 as WizardStep,
  CONTENT_SELECTION: 4 as WizardStep,
  ALLOCATION_SETTINGS: 5 as WizardStep,
  FINAL_REVIEW: 6 as WizardStep,
  RESULT: 7 as WizardStep,
} as const;

/**
 * 타이밍 상수
 */
export const TIMING = {
  /** 자동 저장 디바운스 (ms) */
  AUTO_SAVE_DEBOUNCE_MS: 2000,
  /** Dirty 상태 체크 디바운스 (ms) */
  DIRTY_CHECK_DEBOUNCE_MS: 300,
  /** 저장 완료 표시 유지 시간 (ms) */
  SAVED_STATUS_DURATION_MS: 2000,
} as const;

// ============================================
// 공통 필드 타입
// ============================================

/**
 * 플랜 목적 타입
 */
export type PlanPurpose = "내신대비" | "모의고사" | "수능" | "기타" | "";

/**
 * 콘텐츠 타입
 */
export type ContentType = "book" | "lecture" | "custom";

/**
 * 과목 타입 (전략/취약)
 */
export type SubjectType = "strategy" | "weakness" | null;

/**
 * 스케줄러 타입
 *
 * Note: lib/scheduler/types.ts에 동일한 정의가 있습니다.
 * 순환 참조 방지를 위해 이 파일에서 직접 정의합니다.
 */
export type SchedulerType = "1730_timetable" | "default" | "custom" | "" | null;

/**
 * 학생 레벨
 */
export type StudentLevel = "high" | "medium" | "low";

/**
 * 제외일 타입
 */
export type ExclusionType = "휴가" | "개인사정" | "휴일지정" | "기타" | "holiday" | "event" | "personal";

/**
 * 제외일/학원일정 소스
 */
export type ScheduleSource = "template" | "student" | "time_management" | "manual" | "academy" | "imported";
