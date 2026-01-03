/**
 * 플랜 품질 메트릭 타입
 *
 * Phase 4: 플랜 품질 대시보드
 *
 * 생성된 플랜의 품질을 다양한 차원에서 측정하고 시각화하기 위한 타입입니다.
 *
 * @module lib/domains/admin-plan/types/qualityMetrics
 */

// ============================================
// 품질 점수 타입
// ============================================

/**
 * 개별 품질 차원 점수
 */
export interface QualityDimension {
  /** 점수 (0-100) */
  score: number;
  /** 라벨 */
  label: string;
  /** 설명 */
  description: string;
  /** 상세 정보 */
  details?: string;
  /** 등급 (A-F) */
  grade: "A" | "B" | "C" | "D" | "F";
}

/**
 * 전체 품질 메트릭
 */
export interface PlanQualityMetrics {
  /** 전체 점수 (0-100) */
  overallScore: number;
  /** 전체 등급 */
  overallGrade: "A" | "B" | "C" | "D" | "F";

  /** 균형 점수 - 과목별 학습 시간 분배 */
  balance: QualityDimension;

  /** 충돌 점수 - 시간/일정 충돌 */
  conflicts: QualityDimension & {
    /** 충돌 수 */
    conflictCount: number;
    /** 충돌 상세 */
    conflictDetails?: ConflictDetail[];
  };

  /** 커버리지 점수 - 콘텐츠 포함률 */
  coverage: QualityDimension & {
    /** 포함된 콘텐츠 수 */
    coveredCount: number;
    /** 전체 콘텐츠 수 */
    totalCount: number;
  };

  /** 페이싱 점수 - 일일 학습량 균등 분포 */
  pacing: QualityDimension & {
    /** 일별 학습 시간 (분) */
    dailyMinutes: Record<string, number>;
    /** 평균 일일 학습 시간 */
    averageDaily: number;
    /** 표준편차 */
    standardDeviation: number;
  };
}

/**
 * 충돌 상세 정보
 */
export interface ConflictDetail {
  /** 충돌 유형 */
  type: "time_overlap" | "academy_conflict" | "daily_limit_exceeded";
  /** 관련 날짜 */
  date: string;
  /** 설명 */
  description: string;
  /** 관련 플랜 ID */
  planIds?: string[];
}

// ============================================
// 과목 분포 타입
// ============================================

/**
 * 과목별 학습 시간 분포
 */
export interface SubjectDistribution {
  /** 과목명 */
  subject: string;
  /** 총 학습 시간 (분) */
  totalMinutes: number;
  /** 플랜 수 */
  planCount: number;
  /** 전체 대비 비율 (%) */
  percentage: number;
  /** 색상 코드 */
  color?: string;
}

// ============================================
// 일별 분포 타입
// ============================================

/**
 * 일별 학습 시간 분포
 */
export interface DailyDistribution {
  /** 날짜 */
  date: string;
  /** 요일 (0-6) */
  dayOfWeek: number;
  /** 총 학습 시간 (분) */
  totalMinutes: number;
  /** 플랜 수 */
  planCount: number;
  /** 과목별 시간 */
  bySubject: Record<string, number>;
}

// ============================================
// 대시보드 데이터 타입
// ============================================

/**
 * 플랜 품질 대시보드 데이터
 */
export interface PlanQualityDashboardData {
  /** 품질 메트릭 */
  metrics: PlanQualityMetrics;

  /** 과목별 분포 */
  subjectDistribution: SubjectDistribution[];

  /** 일별 분포 */
  dailyDistribution: DailyDistribution[];

  /** 플랜 그룹 정보 */
  planGroupInfo: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    totalPlans: number;
    totalMinutes: number;
  };

  /** 개선 제안 */
  suggestions: QualitySuggestion[];
}

/**
 * 품질 개선 제안
 */
export interface QualitySuggestion {
  /** 제안 유형 */
  type: "balance" | "conflict" | "coverage" | "pacing";
  /** 심각도 */
  severity: "high" | "medium" | "low";
  /** 제안 메시지 */
  message: string;
  /** 개선 방법 */
  action?: string;
}

// ============================================
// API 응답 타입
// ============================================

/**
 * 품질 분석 API 응답
 */
export interface PlanQualityAnalysisResult {
  success: boolean;
  data?: PlanQualityDashboardData;
  error?: string;
}
