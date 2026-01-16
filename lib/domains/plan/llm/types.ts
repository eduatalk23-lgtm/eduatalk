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
