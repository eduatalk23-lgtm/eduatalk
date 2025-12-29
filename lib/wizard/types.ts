/**
 * 통합 위저드 타입 정의
 *
 * 모든 위저드(new-group, quick-create, content-add)에서 공통으로 사용하는 타입
 *
 * @module lib/wizard/types
 */

// ContentAdd 모드에서 사용하는 외부 타입 import
import type {
  StudyType as PlanStudyType,
  RangeUnit as PlanRangeUnit,
} from "@/lib/types/plan/contentPlanGroup";

// ============================================
// 기본 타입
// ============================================

/**
 * 위저드 모드
 */
export type WizardMode =
  | "full"
  | "quick"
  | "content-add"
  | "edit"
  | "template"
  // 관리자 모드
  | "admin-batch-plan"
  | "admin-reschedule"
  | "admin-camp-template";

/**
 * 위저드 단계 상태
 */
export type StepStatus = "pending" | "current" | "completed" | "error" | "skipped";

/**
 * 위저드 단계 정의
 */
export interface WizardStepDefinition {
  /** 단계 ID (고유) */
  id: string;
  /** 단계 번호 (1부터 시작) */
  number: number;
  /** 단계 레이블 */
  label: string;
  /** 단계 설명 */
  description?: string;
  /** 아이콘 이름 (lucide-react) */
  icon?: string;
  /** 필수 여부 */
  required: boolean;
  /** 특정 모드에서만 표시 */
  modes?: WizardMode[];
  /** 이 단계로 진입 가능한지 검증 */
  canEnter?: (data: BaseWizardData) => boolean;
  /** 다음 단계로 진행 가능한지 검증 */
  canProceed?: (data: BaseWizardData) => ValidationResult;
  /** 조건부 표시 - 조건이 false면 단계 건너뜀 */
  visibleWhen?: (data: BaseWizardData) => boolean;
  /** 필드별 표시 조건 */
  fieldVisibility?: Record<string, (data: BaseWizardData) => boolean>;
  /** 이 단계가 의존하는 다른 단계 ID 목록 (cross-step 검증용) */
  dependsOn?: string[];
}

/**
 * 기본 위저드 데이터 (모든 모드 공통)
 */
export interface BaseWizardData {
  /** 모드 */
  mode: WizardMode;
  /** 현재 단계 ID */
  currentStepId: string;
  /** 방문한 단계 ID 목록 */
  visitedSteps: string[];
  /** 메타데이터 */
  meta: {
    /** 생성 시간 */
    createdAt: string;
    /** 마지막 수정 시간 */
    updatedAt: string;
    /** 드래프트 ID (저장된 경우) */
    draftId?: string | null;
    /** 변경 여부 */
    isDirty: boolean;
  };
}

/**
 * Full 모드 위저드 데이터 (7단계)
 */
export interface FullWizardData extends BaseWizardData {
  mode: "full" | "edit" | "template";
  /** 기본 정보 */
  basicInfo: {
    name: string;
    planPurpose: "" | "내신대비" | "모의고사(수능)";
    periodStart: string;
    periodEnd: string;
    targetDate?: string;
    blockSetId: string;
    schedulerType: "1730_timetable" | "";
  };
  /** 스케줄 설정 */
  schedule: {
    exclusions: ExclusionItem[];
    academySchedules: AcademyScheduleItem[];
    timeSettings?: TimeSettings;
  };
  /** 콘텐츠 */
  contents: {
    studentContents: ContentItem[];
    recommendedContents: ContentItem[];
  };
  /** 고급 옵션 */
  options: {
    studyReviewCycle?: { studyDays: number; reviewDays: number };
    studentLevel?: "high" | "medium" | "low";
    subjectAllocations?: Record<string, number>;
    contentAllocations?: Record<string, number>;
  };
  /** 캠프/템플릿 설정 */
  templateConfig?: {
    planType?: "normal" | "camp";
    campTemplateId?: string;
    campInvitationId?: string;
    lockedFields?: string[];
  };
}

/**
 * Quick 모드 위저드 데이터 (3단계)
 */
export interface QuickWizardData extends BaseWizardData {
  mode: "quick";
  /** 콘텐츠 선택 */
  content: {
    source: "existing" | "free" | "recent";
    contentId?: string;
    contentType?: "book" | "lecture" | "custom";
    title: string;
    isFreeLearning?: boolean;
    freeLearningType?: FreeLearningType;
    estimatedMinutes?: number;
    startRange?: number;
    endRange?: number;
  } | null;
  /** 스케줄 */
  schedule: {
    planDate: string;
    startTime?: string;
    endTime?: string;
    repeatType: "none" | "daily" | "weekly";
    repeatEndDate?: string;
    repeatDays?: number[];
  };
}

/**
 * ContentAdd 모드 위저드 데이터 (4단계)
 *
 * 주의: 이 모드는 lib/types/plan의 외부 타입(PlanStudyType, PlanRangeUnit)을 사용합니다.
 * FullWizardData와 QuickWizardData는 다른 타입을 사용합니다.
 */
export interface ContentAddWizardData extends BaseWizardData {
  mode: "content-add";
  /** 템플릿 정보 */
  templateId: string;
  templateSettings?: InheritedTemplateSettings;
  /** 콘텐츠 선택 */
  content: {
    id: string;
    type: "book" | "lecture" | "custom";
    name: string;
    totalUnits?: number;
    subject?: string;
    subjectCategory?: string;
  } | null;
  /** 범위 설정 - PlanRangeUnit 사용 (page, episode, day, chapter, unit) */
  range: {
    start: number;
    end: number;
    unit: PlanRangeUnit;
  } | null;
  /** 학습 유형 - PlanStudyType 사용 (strategy, weakness) */
  studyType: {
    type: PlanStudyType;
    daysPerWeek?: 2 | 3 | 4;
    reviewEnabled?: boolean;
  } | null;
  /** 오버라이드 */
  overrides?: {
    period?: { startDate: string; endDate: string };
    weekdays?: number[];
  };
}

// ============================================
// 관리자 위저드 타입
// ============================================

/**
 * 관리자 위저드 모드
 */
export type AdminWizardMode =
  | "admin-batch-plan" // 일괄 플랜 생성
  | "admin-reschedule" // 일정 재조정
  | "admin-camp-template"; // 캠프 템플릿 생성/수정

/**
 * 참가자 정보 (배치 작업용)
 */
export interface AdminParticipant {
  groupId: string;
  studentId: string;
  studentName: string;
  status?: "pending" | "accepted" | "declined";
}

/**
 * 배치 플랜 위저드 데이터 (4단계)
 *
 * Step 1: 콘텐츠 추천 설정
 * Step 2: 범위 조절
 * Step 3: 플랜 미리보기
 * Step 4: 결과
 */
export interface BatchPlanWizardData extends BaseWizardData {
  mode: "admin-batch-plan";
  /** 템플릿 ID */
  templateId: string;
  /** 대상 참가자 목록 */
  participants: AdminParticipant[];
  /** Step 1: 콘텐츠 추천 설정 */
  contentRecommendation: {
    subjectCounts: Record<string, Record<string, number>>; // groupId -> (subject -> count)
    replaceExisting: boolean;
  } | null;
  /** Step 2: 범위 조절 */
  rangeAdjustments: Record<
    string,
    Array<{
      contentId: string;
      contentType: "book" | "lecture";
      startRange: number;
      endRange: number;
    }>
  > | null;
  /** Step 3: 플랜 미리보기 */
  planPreview: {
    selectedGroupIds: Set<string>;
    previewResults?: Record<
      string,
      {
        planCount: number;
        previewData?: unknown[];
        error?: string;
      }
    >;
  } | null;
  /** Step 4: 결과 */
  results: {
    contentRecommendation: BatchOperationResult;
    rangeAdjustment: BatchOperationResult;
    planGeneration: BatchOperationResult;
  } | null;
}

/**
 * 배치 작업 결과
 */
export interface BatchOperationResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: Array<{ groupId: string; error: string }>;
}

/**
 * 일정 재조정 위저드 데이터 (3단계)
 *
 * Step 1: 날짜 범위 선택
 * Step 2: 콘텐츠 조정
 * Step 3: 미리보기 및 적용
 */
export interface RescheduleWizardData extends BaseWizardData {
  mode: "admin-reschedule";
  /** 그룹 ID */
  groupId: string;
  /** 템플릿 ID */
  templateId: string;
  /** Step 1: 날짜 범위 */
  dateRange: {
    /** 재조정 대상 기간 */
    from: string;
    to: string;
    /** 오늘 포함 여부 */
    includeToday: boolean;
  } | null;
  /** Step 2: 콘텐츠 조정 */
  contentAdjustments: Array<{
    contentId: string;
    adjustmentType: "skip" | "move" | "extend";
    targetDate?: string;
    reason?: string;
  }> | null;
  /** Step 3: 미리보기 결과 */
  previewResult: {
    originalPlans: unknown[];
    adjustedPlans: unknown[];
    conflictWarnings?: string[];
  } | null;
}

/**
 * 캠프 템플릿 위저드 데이터 (5단계)
 *
 * Step 1: 기본 정보
 * Step 2: 기간 및 일정 설정
 * Step 3: 시간 블록 설정
 * Step 4: 콘텐츠 프리셋
 * Step 5: 검토 및 완료
 */
export interface CampTemplateWizardData extends BaseWizardData {
  mode: "admin-camp-template";
  /** 기존 템플릿 ID (수정 시) */
  existingTemplateId?: string;
  /** Step 1: 기본 정보 */
  basicInfo: {
    name: string;
    description?: string;
    programType: "camp" | "regular" | "intensive";
    status: "draft" | "active" | "archived";
  } | null;
  /** Step 2: 기간 설정 */
  periodSettings: {
    startDate: string;
    endDate: string;
    weekdays: number[]; // 0-6 (일-토)
    holidays: string[]; // 제외 날짜
  } | null;
  /** Step 3: 시간 블록 설정 */
  timeBlockSettings: {
    blockSetId?: string;
    dailyStartTime: string;
    dailyEndTime: string;
    lunchBreak?: { start: string; end: string };
    sessionDuration: number; // 분 단위
  } | null;
  /** Step 4: 콘텐츠 프리셋 */
  contentPresets: Array<{
    subject: string;
    recommendedCount: number;
    contentTypes: ("book" | "lecture")[];
  }> | null;
  /** Step 5: 검토 데이터 */
  review: {
    isConfirmed: boolean;
    notes?: string;
  } | null;
}

/**
 * 관리자 위저드 데이터 (Union Type)
 */
export type AdminWizardData =
  | BatchPlanWizardData
  | RescheduleWizardData
  | CampTemplateWizardData;

/**
 * 통합 위저드 데이터 (Union Type)
 */
export type UnifiedWizardData =
  | FullWizardData
  | QuickWizardData
  | ContentAddWizardData
  | AdminWizardData;

// ============================================
// 검증 타입
// ============================================

/**
 * 필드 에러
 */
export interface FieldError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  isValid: boolean;
  errors: FieldError[];
  warnings: FieldError[];
}

/**
 * 단계별 검증 함수 타입
 */
export type StepValidator<T extends UnifiedWizardData = UnifiedWizardData> = (
  data: T,
  stepId: string
) => ValidationResult;

// ============================================
// 액션 타입
// ============================================

/**
 * 위저드 액션
 */
export type WizardAction<T extends UnifiedWizardData = UnifiedWizardData> =
  | { type: "INIT"; payload: T }
  | { type: "UPDATE_DATA"; payload: Partial<T> }
  | { type: "UPDATE_FIELD"; payload: { path: string; value: unknown } }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "GO_TO_STEP"; payload: string }
  | { type: "SET_VALIDATION"; payload: ValidationResult }
  | { type: "CLEAR_VALIDATION" }
  | { type: "SET_FIELD_ERROR"; payload: FieldError }
  | { type: "CLEAR_FIELD_ERROR"; payload: string }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_DRAFT_ID"; payload: string | null }
  | { type: "RESET_DIRTY" }
  | { type: "RESET" }
  // Undo/Redo 액션
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "PUSH_HISTORY" };

// ============================================
// 컨텍스트 타입
// ============================================

/**
 * 위저드 컨텍스트 값
 */
export interface WizardContextValue<T extends UnifiedWizardData = UnifiedWizardData> {
  /** 현재 데이터 */
  data: T;
  /** 현재 단계 정의 */
  currentStep: WizardStepDefinition;
  /** 모든 단계 정의 (조건부 필터링 적용) */
  steps: WizardStepDefinition[];
  /** 검증 결과 */
  validation: ValidationResult;
  /** 제출 중 여부 */
  isSubmitting: boolean;
  /** 변경 여부 */
  isDirty: boolean;

  // 액션
  updateData: (updates: Partial<T>) => void;
  updateField: (path: string, value: unknown) => void;
  nextStep: () => boolean;
  prevStep: () => void;
  goToStep: (stepId: string) => boolean;
  validate: (stepId?: string) => ValidationResult;
  validateDependencies: (stepId: string) => ValidationResult;
  setSubmitting: (value: boolean) => void;
  reset: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // 유틸리티
  canGoNext: boolean;
  canGoPrev: boolean;
  progress: number; // 0-100
  stepStatus: (stepId: string) => StepStatus;
  isFieldVisible: (stepId: string, fieldId: string) => boolean;
}

// ============================================
// 공통 서브 타입
// ============================================

export type FreeLearningType =
  | "free"
  | "review"
  | "practice"
  | "reading"
  | "video"
  | "assignment";

export type StudyType = "normal" | "intensive" | "review" | "light";

export type RangeUnit = "page" | "episode" | "chapter" | "unit";

export interface ExclusionItem {
  exclusion_date: string;
  exclusion_type: "holiday" | "vacation" | "custom" | "temple";
  reason?: string;
  source?: "user" | "system" | "admin" | "template";
  is_locked?: boolean;
}

export interface AcademyScheduleItem {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
  source?: "user" | "system" | "admin" | "template";
  is_locked?: boolean;
}

export interface TimeSettings {
  lunch_time?: string;
  camp_study_hours?: number;
  morning_start?: string;
  evening_end?: string;
}

export interface ContentItem {
  id: string;
  type: "book" | "lecture" | "custom";
  name: string;
  subject?: string;
  subjectCategory?: string;
  totalUnits?: number;
  rangeStart?: number;
  rangeEnd?: number;
  rangeUnit?: RangeUnit;
  estimatedMinutes?: number;
  isRecommended?: boolean;
  priority?: number;
}

export interface InheritedTemplateSettings {
  periodStart: string;
  periodEnd: string;
  weekdays: number[];
  blockSetId?: string;
  studyHoursPerDay?: number;
}
