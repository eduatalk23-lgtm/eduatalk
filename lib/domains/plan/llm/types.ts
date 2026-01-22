/**
 * LLM 플랜 생성 관련 타입 정의
 *
 * Claude API를 사용한 자동 플랜 생성을 위한 타입들입니다.
 */

// ============================================
// 입력 타입
// ============================================

/**
 * 학생 기본 정보
 */
export interface StudentInfo {
  id: string;
  name: string;
  grade: number; // 학년 (1-12)
  school?: string;
  targetUniversity?: string;
  targetMajor?: string;
}

/**
 * 과목별 성적 정보
 */
export interface SubjectScore {
  subject: string;
  subjectCategory?: string; // 국어, 수학, 영어, 탐구 등
  score?: number; // 원점수
  grade?: number; // 등급 (1-9)
  percentile?: number; // 백분위
  standardScore?: number; // 표준점수
  isWeak?: boolean; // 취약 과목 여부
  recentTrend?: "improving" | "stable" | "declining";
}

/**
 * 학습 콘텐츠 정보
 */
export interface ContentInfo {
  id: string;
  title: string;
  subject: string;
  subjectCategory?: string;
  contentType: "book" | "lecture" | "video" | "custom";
  totalPages?: number;
  totalLectures?: number;
  estimatedHoursTotal?: number;
  difficulty?: "easy" | "medium" | "hard";
  priority?: "high" | "medium" | "low";
}

/**
 * 학습 이력 요약
 */
export interface LearningHistory {
  totalPlansCompleted: number;
  averageCompletionRate: number; // 0-100
  averageDailyStudyMinutes: number;
  preferredStudyTimes?: string[]; // "morning", "afternoon", "evening", "night"
  strongDays?: number[]; // 0-6 (일-토)
  weakDays?: number[]; // 0-6 (일-토)
  frequentlyIncompleteSubjects?: string[];
}

/**
 * 학습 스타일
 */
export type LearningStyleType = "visual" | "auditory" | "kinesthetic" | "reading";

export interface LearningStyle {
  primary: LearningStyleType; // 주요 학습 스타일
  secondary?: LearningStyleType; // 보조 학습 스타일
  preferences?: {
    preferVideo?: boolean; // 영상 강의 선호
    preferProblemSolving?: boolean; // 문제 풀이 선호
    preferSummary?: boolean; // 요약 정리 선호
    preferRepetition?: boolean; // 반복 학습 선호
  };
}

/**
 * 시험 일정
 */
export interface ExamSchedule {
  examDate: string; // YYYY-MM-DD
  examName: string; // 시험 이름 (예: "1학기 중간고사", "6월 모의고사")
  examType: "midterm" | "final" | "mock" | "suneung" | "other";
  subjects?: string[]; // 해당 시험 과목 (없으면 전체)
  importance?: "high" | "medium" | "low"; // 중요도
}

/**
 * 플랜 생성 설정
 */
export interface PlanGenerationSettings {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dailyStudyMinutes: number; // 하루 총 학습 시간 (분)
  breakIntervalMinutes?: number; // 쉬는 시간 간격
  breakDurationMinutes?: number; // 쉬는 시간 길이
  excludeDays?: number[]; // 제외할 요일 (0-6)
  excludeDates?: string[]; // 제외할 특정 날짜
  prioritizeWeakSubjects?: boolean; // 취약 과목 우선
  balanceSubjects?: boolean; // 과목 균형 맞추기
  includeReview?: boolean; // 복습 포함
  reviewRatio?: number; // 복습 비율 (0-1)
}

/**
 * 시간 슬롯 정보
 */
export interface TimeSlotInfo {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: "study" | "break" | "meal" | "free";
  availableDays?: number[]; // 사용 가능한 요일
}

/**
 * LLM 플랜 생성 요청
 */
export interface LLMPlanGenerationRequest {
  student: StudentInfo;
  scores?: SubjectScore[];
  contents: ContentInfo[];
  learningHistory?: LearningHistory;
  learningStyle?: LearningStyle;
  examSchedules?: ExamSchedule[];
  settings: PlanGenerationSettings;
  timeSlots?: TimeSlotInfo[];
  additionalInstructions?: string;
  
  /** 
   * 플랜 생성 모드 
   * - strategy: 전략 모드 (기존, 유연한 제약)
   * - schedule: 배정 모드 (엄격한 시간 제약)
   */
  planningMode?: "strategy" | "schedule";
  
  /**
   * 사용 가능한 시간 슬롯 (Schedule 모드일 때 필수)
   * AI는 이 슬롯들에만 학습을 배정해야 함
   */
  availableSlots?: Array<{
    date: string;
    startTime: string;
    endTime: string;
  }>;

  /**
   * 점유된 시간대 (다른 플랜 그룹의 기존 플랜)
   * AI는 이 시간대를 피해서 플랜을 생성해야 함
   */
  occupiedSlots?: Array<{
    date: string;
    startTime: string;
    endTime: string;
    contentTitle?: string; // 어떤 콘텐츠가 점유하고 있는지 (참고용)
  }>;
}

// ============================================
// 출력 타입
// ============================================

/**
 * 생성된 개별 플랜 아이템
 */
export interface GeneratedPlanItem {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  slotId?: string; // 시간 슬롯 ID
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  contentId: string;
  contentTitle: string;
  contentType?: "book" | "lecture"; // 콘텐츠 유형 (DB 저장용)
  subject: string;
  subjectCategory?: string;
  rangeStart?: number; // 시작 페이지/강 번호
  rangeEnd?: number; // 종료 페이지/강 번호
  rangeDisplay?: string; // "p.1-20" 또는 "1-2강"
  estimatedMinutes: number;
  isReview?: boolean;
  notes?: string;
  priority?: "high" | "medium" | "low";

  // 콘텐츠 분할 관련 필드
  partIndex?: number;        // 현재 파트 번호 (1-based, 예: 1, 2, 3...)
  totalParts?: number;       // 총 파트 수 (예: 2이면 1/2, 2/2)
  isPartialContent?: boolean; // 분할된 콘텐츠 여부 (명시적으로 true일 때만)
}

/**
 * 일별 플랜 그룹
 */
export interface DailyPlanGroup {
  date: string;
  dayOfWeek: number;
  totalMinutes: number;
  plans: GeneratedPlanItem[];
  dailySummary?: string;
}

/**
 * 주간 플랜 매트릭스
 */
export interface WeeklyPlanMatrix {
  weekNumber: number;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  days: DailyPlanGroup[];
  weeklySummary?: string;
}

/**
 * LLM 생성 메타데이터
 */
export interface GenerationMetadata {
  modelId: string;
  confidence: number; // 0-1
  reasoning: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  generatedAt: string;
  warnings?: string[];
}

/**
 * 추천 및 조언
 */
export interface Recommendations {
  studyTips: string[];
  warnings: string[];
  suggestedAdjustments?: string[];
  focusAreas?: string[];
}

export type ContentType = "book" | "lecture" | "video" | "custom";

/**
 * 플랜 생성 결과
 */
export interface GeneratePlanResult {
  success: boolean;
  data?: LLMPlanGenerationResponse;
  error?: string;
  metadata?: GenerationMetadata & { estimatedCost?: number };
  webSearchResults?: {
    searchQueries: string[];
    resultsCount: number;
    savedCount?: number;
    results: any[]; // WebSearchResult imported locally or any
  };
}

/**
 * LLM 플랜 생성 응답
 */
export interface LLMPlanGenerationResponse {
  success: boolean;
  meta: GenerationMetadata;
  weeklyMatrices: WeeklyPlanMatrix[];
  totalPlans: number;
  recommendations: Recommendations;
  error?: string;
}

// ============================================
// 부분 재생성 타입
// ============================================

/**
 * 부분 재생성 요청
 */
export interface PartialRegenerationRequest {
  originalRequest: LLMPlanGenerationRequest;
  regenerateScope: {
    type: "date" | "dateRange" | "subject" | "content";
    dates?: string[];
    dateRange?: { start: string; end: string };
    subjects?: string[];
    contentIds?: string[];
  };
  feedback?: string;
  keepExisting?: boolean;
}

// ============================================
// 스트리밍 타입
// ============================================

/**
 * 스트리밍 이벤트 타입
 */
export type StreamEventType =
  | "start"
  | "progress"
  | "plan_item"
  | "daily_complete"
  | "weekly_complete"
  | "recommendations"
  | "complete"
  | "error";

/**
 * 스트리밍 이벤트
 */
export interface StreamEvent {
  type: StreamEventType;
  data?: GeneratedPlanItem | DailyPlanGroup | WeeklyPlanMatrix | Recommendations | string;
  progress?: number; // 0-100
  message?: string;
}

// ============================================
// 변환 컨텍스트 (응답 변환 시 필요한 정보)
// ============================================

/**
 * 블록 정보
 */
export interface BlockInfo {
  id: string;
  block_index: number;
  day_of_week: number; // 0-6 (일-토)
  start_time: string; // HH:mm
  end_time: string; // HH:mm
}

/**
 * 과목/콘텐츠 할당 정보
 */
export interface SubjectAllocation {
  contentId: string;
  subject: string;
  subjectCategory?: string;
  subject_type: "strategy" | "weakness" | null;
  weeklyDays?: number;
}

/**
 * 학원 일정 정보 (프롬프트/검증용)
 */
export interface AcademyScheduleInfo {
  id: string;
  day_of_week: number; // 0-6
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  academy_name?: string;
  subject?: string;
  travel_time?: number; // 분
}

/**
 * 콘텐츠 상세 시간 정보
 */
export interface ContentDuration {
  contentId: string;
  contentType: "book" | "lecture" | "custom";
  totalPages?: number;
  totalEpisodes?: number;
  totalDurationMinutes?: number;
  episodeDurations?: Map<number, number>; // 에피소드 번호 -> 분
}

/**
 * LLM 응답 변환 컨텍스트
 *
 * AI 응답을 DB 저장 형식으로 변환할 때 필요한 정보들입니다.
 */
export interface TransformContext {
  /** contentId -> ContentType 매핑 */
  contentTypeMap: Map<string, "book" | "lecture" | "custom">;
  /** 블록 세트 정보 (시간 -> 블록 인덱스 계산용) */
  blockSets: BlockInfo[];
  /** contentId -> SubjectAllocation 매핑 */
  allocationMap: Map<string, SubjectAllocation>;
  /** 학원 일정 (검증용) */
  academySchedules?: AcademyScheduleInfo[];
  /** 제외 요일 (0-6) */
  excludeDays?: number[];
  /** 제외 날짜 (YYYY-MM-DD) */
  excludeDates?: string[];
  /** 날짜 -> day_type 매핑 (study_days/review_days 기반) */
  dayTypeMap?: Map<string, "학습일" | "복습일">;
}

// ============================================
// 모델 설정
// ============================================

/**
 * 모델 티어
 */
export type ModelTier = "fast" | "standard" | "advanced";

/**
 * 모델 설정
 */
export interface ModelConfig {
  tier: ModelTier;
  modelId: string;
  maxTokens: number;
  temperature: number;
}

export const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "claude-3-5-haiku-20241022",
    maxTokens: 4096,
    temperature: 0.3,
  },
  standard: {
    tier: "standard",
    modelId: "claude-sonnet-4-20250514",
    maxTokens: 8192,
    temperature: 0.5,
  },
  advanced: {
    tier: "advanced",
    modelId: "claude-sonnet-4-20250514",
    maxTokens: 16384,
    temperature: 0.7,
  },
};

// ============================================
// 파이프라인 에러 타입 (P2-1: 통합 에러 시스템)
// ============================================

/**
 * 파이프라인 실패 단계 (통합)
 *
 * 모든 AI 플랜 생성 파이프라인에서 공통으로 사용하는 실패 단계입니다.
 */
export const PIPELINE_ERROR_STAGES = [
  // 공통 단계
  "validation",
  "data_loading",
  "planner_resolution",
  // Unified/Batch 단계
  "content_resolution",
  "scheduler_context",
  "schedule_generation",
  "validation_adjustment",
  "persistence",
  "markdown_export",
  // Hybrid 단계
  "plan_group_validation",
  "ai_generation",
  // Batch 단계
  "student_loading",
  "content_fetching",
  "web_search",
  "llm_generation",
  "response_parsing",
  "plan_group_creation",
  "plan_saving",
] as const;

export type PipelineErrorStage = (typeof PIPELINE_ERROR_STAGES)[number];

/**
 * 파이프라인 에러 코드
 *
 * 세부적인 에러 원인을 식별하기 위한 코드입니다.
 */
export const PIPELINE_ERROR_CODES = {
  // 검증 에러
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_PERIOD: "INVALID_PERIOD",
  INVALID_TIME_SETTINGS: "INVALID_TIME_SETTINGS",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // 데이터 로딩 에러
  STUDENT_NOT_FOUND: "STUDENT_NOT_FOUND",
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  PLAN_GROUP_NOT_FOUND: "PLAN_GROUP_NOT_FOUND",
  CONTENT_NOT_FOUND: "CONTENT_NOT_FOUND",
  BLOCK_SET_MISSING: "BLOCK_SET_MISSING",

  // 플래너 에러
  PLANNER_NOT_FOUND: "PLANNER_NOT_FOUND",
  PLANNER_CREATION_FAILED: "PLANNER_CREATION_FAILED",
  PLANNER_VALIDATION_FAILED: "PLANNER_VALIDATION_FAILED",

  // 콘텐츠 해결 에러
  NO_AVAILABLE_CONTENT: "NO_AVAILABLE_CONTENT",
  CONTENT_RESOLUTION_FAILED: "CONTENT_RESOLUTION_FAILED",
  AI_RECOMMENDATION_FAILED: "AI_RECOMMENDATION_FAILED",

  // 스케줄 생성 에러
  SCHEDULE_GENERATION_FAILED: "SCHEDULE_GENERATION_FAILED",
  TIMELINE_ERROR: "TIMELINE_ERROR",
  SCHEDULE_CONFLICT: "SCHEDULE_CONFLICT",
  NO_AVAILABLE_SLOTS: "NO_AVAILABLE_SLOTS",

  // AI/LLM 에러
  LLM_GENERATION_FAILED: "LLM_GENERATION_FAILED",
  LLM_RESPONSE_PARSE_FAILED: "LLM_RESPONSE_PARSE_FAILED",
  LLM_RATE_LIMIT: "LLM_RATE_LIMIT",
  LLM_TIMEOUT: "LLM_TIMEOUT",

  // 저장 에러
  DB_WRITE_FAILED: "DB_WRITE_FAILED",
  PLAN_GROUP_CREATION_FAILED: "PLAN_GROUP_CREATION_FAILED",
  PLAN_SAVING_FAILED: "PLAN_SAVING_FAILED",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",

  // 기타
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  DRY_RUN_MODE: "DRY_RUN_MODE",
} as const;

export type PipelineErrorCode =
  (typeof PIPELINE_ERROR_CODES)[keyof typeof PIPELINE_ERROR_CODES];

/**
 * 파이프라인 경고
 *
 * 치명적이지 않지만 사용자에게 알려야 할 정보입니다.
 */
export interface PipelineWarning {
  code: string;
  message: string;
  severity: "info" | "warning";
  stage?: PipelineErrorStage;
  context?: Record<string, unknown>;
}

/**
 * 파이프라인 에러 상세
 */
export interface PipelineErrorDetail {
  code: PipelineErrorCode;
  message: string;
  stage: PipelineErrorStage;
  context?: Record<string, unknown>;
  cause?: Error | unknown;
}

/**
 * 파이프라인 결과 기본 인터페이스
 *
 * 모든 AI 플랜 생성 파이프라인 결과의 기본 형태입니다.
 */
export interface PipelineResultBase {
  success: boolean;
  error?: string;
  errorCode?: PipelineErrorCode;
  failedAt?: PipelineErrorStage;
  warnings?: PipelineWarning[];
  timing?: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

/**
 * 파이프라인 성공 결과
 */
export interface PipelineSuccess<T> extends PipelineResultBase {
  success: true;
  data: T;
}

/**
 * 파이프라인 실패 결과
 */
export interface PipelineFailure extends PipelineResultBase {
  success: false;
  error: string;
  errorCode: PipelineErrorCode;
  failedAt: PipelineErrorStage;
  details?: Record<string, unknown>;
}

/**
 * 파이프라인 결과 유니온 타입
 */
export type PipelineResult<T> = PipelineSuccess<T> | PipelineFailure;

/**
 * 파이프라인 에러 생성 헬퍼
 */
export function createPipelineError(
  stage: PipelineErrorStage,
  code: PipelineErrorCode,
  message: string,
  details?: Record<string, unknown>
): PipelineFailure {
  return {
    success: false,
    error: message,
    errorCode: code,
    failedAt: stage,
    details,
  };
}

/**
 * 파이프라인 경고 생성 헬퍼
 */
export function createPipelineWarning(
  code: string,
  message: string,
  severity: "info" | "warning" = "warning",
  stage?: PipelineErrorStage,
  context?: Record<string, unknown>
): PipelineWarning {
  return { code, message, severity, stage, context };
}

/**
 * 에러에서 메시지 추출 헬퍼
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "알 수 없는 오류가 발생했습니다.";
}

// ============================================
// 진행 상태 추적 (P2-4: Progress Tracking)
// ============================================

/**
 * 플랜 생성 단계
 */
export const PLAN_GENERATION_STEPS = [
  "initializing",
  "validating",
  "loading_data",
  "resolving_planner",
  "resolving_content",
  "building_context",
  "generating_schedule",
  "validating_schedule",
  "saving_to_db",
  "generating_output",
  "completed",
  "failed",
] as const;

export type PlanGenerationStep = (typeof PLAN_GENERATION_STEPS)[number];

/**
 * 단계별 진행률 가중치 (합계: 100)
 */
export const STEP_PROGRESS_WEIGHTS: Record<PlanGenerationStep, number> = {
  initializing: 2,
  validating: 5,
  loading_data: 10,
  resolving_planner: 5,
  resolving_content: 15,
  building_context: 10,
  generating_schedule: 25,
  validating_schedule: 8,
  saving_to_db: 15,
  generating_output: 5,
  completed: 0,
  failed: 0,
};

/**
 * 단계별 한글 레이블
 */
export const STEP_LABELS: Record<PlanGenerationStep, string> = {
  initializing: "초기화 중",
  validating: "입력 검증 중",
  loading_data: "데이터 로딩 중",
  resolving_planner: "플래너 확인 중",
  resolving_content: "콘텐츠 확인 중",
  building_context: "스케줄러 준비 중",
  generating_schedule: "스케줄 생성 중",
  validating_schedule: "스케줄 검증 중",
  saving_to_db: "저장 중",
  generating_output: "결과 생성 중",
  completed: "완료",
  failed: "실패",
};

/**
 * 진행 상태 정보
 */
export interface PlanGenerationProgress {
  /** 현재 단계 */
  currentStep: PlanGenerationStep;
  /** 전체 진행률 (0-100) */
  overallProgress: number;
  /** 현재 단계 진행률 (0-100) */
  stepProgress: number;
  /** 현재 단계 메시지 */
  message: string;
  /** 시작 시간 */
  startedAt: Date;
  /** 예상 남은 시간 (초) */
  estimatedRemainingSeconds?: number;
  /** 처리 중인 아이템 수 */
  itemsProcessed?: number;
  /** 전체 아이템 수 */
  totalItems?: number;
}

/**
 * 진행 상태 업데이트 콜백
 */
export type ProgressCallback = (progress: PlanGenerationProgress) => void;

/**
 * 진행 상태 추적기 생성
 */
export function createProgressTracker(
  onProgress?: ProgressCallback
): {
  updateStep: (step: PlanGenerationStep, message?: string) => void;
  updateStepProgress: (progress: number) => void;
  updateItems: (processed: number, total: number) => void;
  getProgress: () => PlanGenerationProgress;
  complete: () => void;
  fail: (error: string) => void;
} {
  const state: PlanGenerationProgress = {
    currentStep: "initializing",
    overallProgress: 0,
    stepProgress: 0,
    message: STEP_LABELS.initializing,
    startedAt: new Date(),
  };

  const calculateOverallProgress = (): number => {
    let accumulated = 0;
    for (const step of PLAN_GENERATION_STEPS) {
      if (step === state.currentStep) {
        accumulated += (STEP_PROGRESS_WEIGHTS[step] * state.stepProgress) / 100;
        break;
      }
      accumulated += STEP_PROGRESS_WEIGHTS[step];
    }
    return Math.min(100, Math.round(accumulated));
  };

  const notify = () => {
    state.overallProgress = calculateOverallProgress();
    onProgress?.(state);
  };

  return {
    updateStep: (step: PlanGenerationStep, message?: string) => {
      state.currentStep = step;
      state.stepProgress = 0;
      state.message = message || STEP_LABELS[step];
      notify();
    },
    updateStepProgress: (progress: number) => {
      state.stepProgress = Math.min(100, Math.max(0, progress));
      notify();
    },
    updateItems: (processed: number, total: number) => {
      state.itemsProcessed = processed;
      state.totalItems = total;
      if (total > 0) {
        state.stepProgress = Math.round((processed / total) * 100);
      }
      notify();
    },
    getProgress: () => ({ ...state }),
    complete: () => {
      state.currentStep = "completed";
      state.stepProgress = 100;
      state.overallProgress = 100;
      state.message = STEP_LABELS.completed;
      notify();
    },
    fail: (error: string) => {
      state.currentStep = "failed";
      state.message = error;
      notify();
    },
  };
}
