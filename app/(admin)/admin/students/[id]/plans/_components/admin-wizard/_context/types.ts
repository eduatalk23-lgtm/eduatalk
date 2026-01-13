/**
 * Admin Wizard Context Types
 *
 * Phase 2: 4-Layer Context 구조를 위한 확장된 타입 정의
 * Student 위저드의 7단계 구조를 Admin에 맞게 조정
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/types
 */

// ============================================
// 기본 타입 (기존 호환)
// ============================================

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PlanPurpose = "내신대비" | "모의고사" | "수능" | "기타" | "";

export type ContentType = "book" | "lecture" | "custom";

export type SubjectType = "strategy" | "weakness" | null;

// ============================================
// 콘텐츠 관련 타입
// ============================================

/**
 * 선택된 콘텐츠
 */
export interface SelectedContent {
  contentId: string;
  contentType: ContentType;
  title: string;
  subject?: string;
  subjectCategory?: string;
  startRange: number;
  endRange: number;
  totalRange: number;
  subjectType?: SubjectType;
  displayOrder?: number;
  /** 전략 과목 주간 배정일 (2, 3, 4). 전략 과목인 경우에만 유효 */
  weeklyDays?: 2 | 3 | 4 | null;

  // 플랜 이름 자동 생성 관련 필드
  /** 자동 생성된 플랜 그룹 이름 (예: "[수학] 수학의 정석 p.100-200") */
  generatedGroupName?: string;
  /** 사용자가 수정한 플랜 그룹 이름 (없으면 generatedGroupName 사용) */
  customGroupName?: string;
  /** 회차 번호 (동일 콘텐츠 플랜 생성 순서, 2회차부터 표시) */
  round?: number;
}

/**
 * 학생 콘텐츠 (DB 조회용)
 */
export interface StudentContent {
  id: string;
  type: ContentType;
  title: string;
  subject?: string;
  subjectCategory?: string;
  totalPages?: number;
  totalEpisodes?: number;
}

// ============================================
// 시간 범위 타입 (Planner 호환)
// ============================================

/**
 * 시간 범위 (HH:mm 형식)
 * Planner의 study_hours, self_study_hours, lunch_time과 호환
 */
export interface TimeRange {
  start: string; // HH:mm format
  end: string;   // HH:mm format
}

/**
 * 비학습 시간 블록
 * Planner의 non_study_time_blocks와 호환
 */
export interface NonStudyTimeBlock {
  type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "기타";
  start_time: string;  // HH:mm format
  end_time: string;    // HH:mm format
  day_of_week?: number[];  // 0-6 (일-토), 비어있으면 매일
  description?: string;
}

// ============================================
// 스케줄 관련 타입
// ============================================

/**
 * 제외 일정
 */
export interface ExclusionSchedule {
  exclusion_date: string;
  exclusion_type: "holiday" | "event" | "personal";
  reason?: string;
  source?: "manual" | "academy" | "template" | "planner" | "imported";
  is_locked?: boolean;
}

/**
 * 학원 스케줄
 */
export interface AcademySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
  source?: "manual" | "imported" | "planner";
  is_locked?: boolean;
}

/**
 * 시간 설정
 */
export interface TimeSettings {
  studyStartTime?: string;
  studyEndTime?: string;
  breakDuration?: number;
  sessionDuration?: number;
}

/**
 * 스케줄러 옵션
 */
export interface SchedulerOptions {
  study_days?: number;
  review_days?: number;
  student_level?: "high" | "medium" | "low";
  weak_subject_focus?: "low" | "medium" | "high";
  [key: string]: unknown;
}

// ============================================
// 과목 배분 타입
// ============================================

/**
 * 과목 배분 설정
 */
export interface SubjectAllocation {
  subject: string;
  ratio: number;
  subjectType: SubjectType;
}

/**
 * 콘텐츠 배분 설정
 */
export interface ContentAllocation {
  contentId: string;
  dailyAmount: number;
  priority: number;
}

// ============================================
// Wizard Data 타입 (확장)
// ============================================

/**
 * Admin Wizard 데이터 (7단계용 확장)
 */
export interface AdminWizardData {
  // 플래너 연결 (선택적)
  plannerId?: string | null;

  // Step 1: 기본 정보
  name: string;
  planPurpose: PlanPurpose;
  periodStart: string;
  periodEnd: string;
  targetDate?: string;
  blockSetId?: string;

  // Step 2: 시간 설정
  schedulerType: "1730_timetable" | "custom" | "";
  timeSettings?: TimeSettings;
  academySchedules: AcademySchedule[];
  exclusions: ExclusionSchedule[];

  // Step 2: 플래너 호환 시간 설정 (NEW)
  // 플래너 선택 시 자동 상속, 미선택 시 null
  studyHours?: TimeRange | null;           // 학습시간 (기본: 10:00-19:00)
  selfStudyHours?: TimeRange | null;       // 자율학습시간 (기본: 19:00-22:00)
  lunchTime?: TimeRange | null;            // 점심시간 (기본: 12:00-13:00)
  nonStudyTimeBlocks?: NonStudyTimeBlock[]; // 비학습 블록 (식사, 수면 등)

  // Step 3: 스케줄 미리보기 (데이터 없음, UI만)

  // Step 4: 콘텐츠 선택
  selectedContents: SelectedContent[];
  skipContents: boolean;

  // Step 5: 배분 설정
  schedulerOptions: SchedulerOptions;
  subjectAllocations?: SubjectAllocation[];
  contentAllocations?: ContentAllocation[];
  // 플랜 그룹 레벨 학습 유형 설정
  studyType?: SubjectType; // 'strategy' | 'weakness' | null
  strategyDaysPerWeek?: 2 | 3 | 4 | null; // 전략 학습 시 주간 학습일

  // Step 6: 최종 검토 (데이터 없음, UI만)

  // Step 7: 생성 옵션
  generateAIPlan: boolean;
  aiMode?: "hybrid" | "ai-only";
}

// ============================================
// Wizard State 타입
// ============================================

/**
 * Admin Wizard 전체 상태
 */
export interface AdminWizardState {
  // 데이터
  wizardData: AdminWizardData;
  initialWizardData: AdminWizardData;

  // 네비게이션
  currentStep: WizardStep;

  // 검증
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: Map<string, string>;

  // 상태
  draftGroupId: string | null;
  createdGroupId: string | null;
  isSubmitting: boolean;
  isDirty: boolean;
  error: string | null;
}

// ============================================
// Action 타입
// ============================================

/**
 * 데이터 관련 액션
 */
export type DataAction =
  | { type: "UPDATE_DATA"; payload: Partial<AdminWizardData> }
  | { type: "UPDATE_DATA_FN"; payload: (prev: AdminWizardData) => Partial<AdminWizardData> }
  | { type: "SET_DRAFT_ID"; payload: string | null }
  | { type: "SET_CREATED_GROUP_ID"; payload: string | null }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET_DIRTY_STATE" }
  | { type: "RESET" };

/**
 * 단계 네비게이션 액션
 */
export type StepAction =
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_STEP"; payload: WizardStep };

/**
 * 검증 관련 액션
 */
export type ValidationAction =
  | { type: "SET_ERRORS"; payload: string[] }
  | { type: "SET_WARNINGS"; payload: string[] }
  | { type: "SET_FIELD_ERROR"; payload: { field: string; error: string } }
  | { type: "SET_FIELD_ERRORS"; payload: Map<string, string> }
  | { type: "CLEAR_FIELD_ERROR"; payload: string }
  | { type: "CLEAR_VALIDATION" };

/**
 * 전체 액션 타입
 */
export type AdminWizardAction = DataAction | StepAction | ValidationAction;

// ============================================
// Type Guards
// ============================================

export function isDataAction(action: AdminWizardAction): action is DataAction {
  return [
    "UPDATE_DATA",
    "UPDATE_DATA_FN",
    "SET_DRAFT_ID",
    "SET_CREATED_GROUP_ID",
    "SET_SUBMITTING",
    "SET_ERROR",
    "RESET_DIRTY_STATE",
    "RESET",
  ].includes(action.type);
}

export function isStepAction(action: AdminWizardAction): action is StepAction {
  return ["NEXT_STEP", "PREV_STEP", "SET_STEP"].includes(action.type);
}

export function isValidationAction(action: AdminWizardAction): action is ValidationAction {
  return [
    "SET_ERRORS",
    "SET_WARNINGS",
    "SET_FIELD_ERROR",
    "SET_FIELD_ERRORS",
    "CLEAR_FIELD_ERROR",
    "CLEAR_VALIDATION",
  ].includes(action.type);
}

// ============================================
// Context Value 타입
// ============================================

/**
 * Data Context 값 타입
 */
export interface AdminWizardDataContextValue {
  wizardData: AdminWizardData;
  initialWizardData: AdminWizardData;
  draftGroupId: string | null;
  createdGroupId: string | null;
  isDirty: boolean;
  isSubmitting: boolean;
  error: string | null;
  updateData: (updates: Partial<AdminWizardData>) => void;
  updateDataFn: (fn: (prev: AdminWizardData) => Partial<AdminWizardData>) => void;
  setDraftId: (id: string | null) => void;
  setCreatedGroupId: (id: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (error: string | null) => void;
  resetDirtyState: () => void;
  reset: () => void;
}

/**
 * Step Context 값 타입
 */
export interface AdminWizardStepContextValue {
  currentStep: WizardStep;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: WizardStep) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

/**
 * Validation Context 값 타입
 */
export interface AdminWizardValidationContextValue {
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: Map<string, string>;
  setErrors: (errors: string[]) => void;
  setWarnings: (warnings: string[]) => void;
  setFieldError: (field: string, error: string) => void;
  setFieldErrors: (errors: Map<string, string>) => void;
  clearFieldError: (field: string) => void;
  clearValidation: () => void;
  hasErrors: boolean;
  hasWarnings: boolean;
}

// ============================================
// Props 타입
// ============================================

/**
 * Admin Wizard Provider Props
 */
export interface AdminWizardProviderProps {
  children: React.ReactNode;
  studentId: string;
  tenantId: string;
  studentName: string;
  initialData?: Partial<AdminWizardData>;
  initialStep?: WizardStep;
  initialDraftId?: string | null;
}

/**
 * Admin Plan Creation Wizard Props
 */
export interface AdminPlanCreationWizardProps {
  studentId: string;
  tenantId: string;
  studentName: string;
  /** 플래너 ID (플랜 그룹 생성 시 필수) */
  plannerId?: string;
  onClose: () => void;
  onSuccess: (groupId: string, generateAI: boolean) => void;
}
