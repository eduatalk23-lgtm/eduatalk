/**
 * AI Framework 타입 정의
 *
 * 하이브리드 플랜 생성을 위한 AI 전략 프레임워크입니다.
 * AI가 전략적 결정을 제공하고, 코드 기반 스케줄러가 정확한 시간 배치를 처리합니다.
 *
 * @module lib/domains/plan/llm/types/aiFramework
 */

// ============================================
// 과목 분류 타입
// ============================================

/**
 * 과목 분류 유형
 * - strategy: 전략 과목 (상위권 진입 가능, 집중 투자)
 * - weakness: 취약 과목 (보강 필요, 우선 배치)
 * - neutral: 중립 (현상 유지)
 */
export type SubjectClassificationType = "strategy" | "weakness" | "neutral";

/**
 * AI가 분석한 과목 분류
 */
export interface SubjectClassification {
  /** 과목 카테고리 (예: "수학", "영어") */
  subjectCategory: string;
  /** 과목 ID (정확한 매칭용, 선택) */
  subjectId?: string;
  /** AI가 결정한 분류 */
  classification: SubjectClassificationType;
  /** 분류 확신도 (0-1) */
  confidence: number;
  /** 분류 근거 */
  reasoning: string;
  /** 권장 주간 학습일 (2-7일) */
  recommendedWeeklyDays: number;
  /** 우선순위 순위 (1이 가장 높음) */
  priorityRank: number;
}

// ============================================
// 일별/주별 전략 타입
// ============================================

/**
 * 일별 집중도 유형
 */
export type DailyFocusType = "intensive" | "balanced" | "light" | "review";

/**
 * 일별 학습 전략
 */
export interface DailyStrategy {
  /** 요일 (0=일요일, 6=토요일) */
  dayOfWeek: number;
  /** 집중도 유형 */
  focusType: DailyFocusType;
  /** 주요 집중 과목 */
  primarySubjects: string[];
  /** 보조 과목 */
  secondarySubjects: string[];
  /** 전략 설명 */
  strategyDescription: string;
  /** 권장 총 학습 시간 (분) */
  recommendedMinutes: number;
}

/**
 * 주별 전략 요약
 */
export interface WeeklyStrategy {
  /** 주차 번호 */
  weekNumber: number;
  /** 주간 테마 */
  theme: string;
  /** 주간 목표 */
  goals: string[];
  /** 일별 전략 */
  dailyStrategies: DailyStrategy[];
}

// ============================================
// 시간 힌트 타입
// ============================================

/**
 * 선호 시간대
 */
export type PreferredTimeSlot = "morning" | "afternoon" | "evening";

/**
 * 과목별 최적 학습 시간 힌트
 */
export interface TimeHint {
  /** 과목 카테고리 */
  subjectCategory: string;
  /** 선호 시간대 */
  preferredTimeSlot: PreferredTimeSlot;
  /** 최적 학습 시간 (분) */
  optimalDurationMinutes: number;
  /** 최소 효과적 시간 (분) */
  minDurationMinutes: number;
  /** 피로 전 최대 시간 (분) */
  maxDurationMinutes: number;
  /** 권장 이유 */
  reasoning: string;
}

// ============================================
// 콘텐츠 우선순위 타입
// ============================================

/**
 * 긴급도 수준
 */
export type UrgencyLevel = "critical" | "high" | "medium" | "low";

/**
 * 콘텐츠 우선순위
 */
export interface ContentPriority {
  /** 콘텐츠 ID */
  contentId: string;
  /** 우선순위 순위 (1이 가장 높음) */
  priorityRank: number;
  /** 과목 유형 분류 */
  subjectType: SubjectClassificationType;
  /** 같은 과목 내 순서 */
  orderInSubject: number;
  /** 긴급도 */
  urgency: UrgencyLevel;
  /** 우선순위 결정 이유 */
  reasoning: string;
}

// ============================================
// 추천사항 타입
// ============================================

/**
 * AI 추천사항
 */
export interface AIRecommendations {
  /** 학습 팁 */
  studyTips: string[];
  /** 경고 사항 */
  warnings: string[];
  /** 조정 제안 */
  suggestedAdjustments: string[];
  /** 집중 영역 */
  focusAreas: string[];
  /** 동기부여 메시지 (선택) */
  motivationalNotes?: string[];
}

// ============================================
// AI Framework 메인 타입
// ============================================

/**
 * AI Framework 메타데이터
 */
export interface AIFrameworkMeta {
  /** 사용된 모델 ID */
  modelId: string;
  /** 토큰 사용량 */
  tokensUsed: {
    input: number;
    output: number;
  };
  /** 전체 확신도 (0-1) */
  confidence: number;
  /** 처리 시간 (ms) */
  processingTimeMs: number;
}

/**
 * AI Framework - 전략적 플랜 가이드라인
 *
 * AI가 생성한 고수준 전략으로, 코드 기반 스케줄러에 전달됩니다.
 */
export interface AIFramework {
  /** 버전 (호환성 체크용) */
  version: "1.0";
  /** 생성 시각 */
  generatedAt: string;
  /** 학생 맞춤 전략 요약 */
  strategySummary: string;
  /** 과목별 분류 */
  subjectClassifications: SubjectClassification[];
  /** 주별 전략 */
  weeklyStrategies: WeeklyStrategy[];
  /** 시간 힌트 */
  timeHints: TimeHint[];
  /** 콘텐츠 우선순위 */
  contentPriority: ContentPriority[];
  /** 추천사항 */
  recommendations: AIRecommendations;
  /** 메타데이터 */
  meta: AIFrameworkMeta;
}

// ============================================
// AI Framework 입력 타입
// ============================================

/**
 * 학생 정보 (프레임워크 생성용)
 */
export interface AIFrameworkStudentInfo {
  id: string;
  name: string;
  grade: string;
  school?: string;
}

/**
 * 성적 정보 (프레임워크 생성용)
 */
export interface AIFrameworkScoreInfo {
  subject: string;
  subjectCategory: string;
  score?: number;
  percentile?: number;
  trend?: "improving" | "stable" | "declining";
}

/**
 * 콘텐츠 정보 (프레임워크 생성용)
 */
export interface AIFrameworkContentInfo {
  id: string;
  title: string;
  subject: string;
  subjectCategory: string;
  contentType: "book" | "lecture" | "custom";
  estimatedHours: number;
  difficulty?: "easy" | "medium" | "hard";
}

/**
 * 학습 이력 요약
 */
export interface AIFrameworkLearningHistory {
  completionRate: number;
  averageDailyMinutes: number;
  preferredTimes: string[];
  weakPatterns: string[];
}

/**
 * 기간 정보
 */
export interface AIFrameworkPeriod {
  startDate: string;
  endDate: string;
  totalDays: number;
  studyDays: number;
}

/**
 * AI Framework 생성 입력
 */
export interface AIFrameworkInput {
  /** 학생 정보 */
  student: AIFrameworkStudentInfo;
  /** 성적 정보 */
  scores: AIFrameworkScoreInfo[];
  /** 콘텐츠 목록 */
  contents: AIFrameworkContentInfo[];
  /** 학습 이력 (선택) */
  learningHistory?: AIFrameworkLearningHistory;
  /** 기간 정보 */
  period: AIFrameworkPeriod;
  /** 추가 지시사항 (선택) */
  additionalInstructions?: string;
}

// ============================================
// 변환 결과 타입
// ============================================

/**
 * AIFramework → SchedulerOptions 변환 결과
 */
export interface FrameworkConversionResult {
  /** 변환된 스케줄러 옵션 */
  schedulerOptions: {
    weak_subject_focus: "low" | "medium" | "high";
    study_days: number;
    review_days: number;
    subject_allocations: Array<{
      subject_id: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days: number;
    }>;
    content_allocations?: Array<{
      content_id: string;
      content_type: "book" | "lecture" | "custom";
      subject_type: "strategy" | "weakness";
      weekly_days: number;
    }>;
  };
  /** 콘텐츠 정렬 순서 */
  contentOrdering: Map<string, number>;
  /** AI 추천사항 (플랜에 첨부) */
  aiRecommendations: AIRecommendations;
}
