/**
 * 성적 대시보드 API 응답 타입 정의
 * 
 * 이 파일은 /api/students/[id]/score-dashboard 의 응답 구조를 정의합니다.
 * DB 스키마가 아닌 API 응답 구조를 기준으로 프론트엔드가 구현되어야 합니다.
 */

/**
 * 전략 유형
 */
export type StrategyType = "BALANCED" | "MOCK_ADVANTAGE" | "INTERNAL_ADVANTAGE" | "SPECIAL_HIGH_SCHOOL";

/**
 * 학생 프로필 정보
 */
export interface StudentProfile {
  id: string;
  name: string;
  grade: number | null;
  class: number | null;
  schoolType: string | null; // school_info.school_property 값 (일반고, 특목고 등)
  schoolYear: number | null;
  termGrade: number | null; // 해당 학기의 학년
  semester: number | null;
}

/**
 * 내신 분석 결과
 */
export interface InternalAnalysis {
  totalGpa: number | null; // 전체 평균 평점
  zIndex: number | null; // Z-점수 지수
  subjectStrength: Record<string, number>; // 교과군별 GPA (예: { "국어": 3.5, "수학": 4.0 })
}

/**
 * 모의고사 분석 결과
 */
export interface MockAnalysis {
  recentExam: {
    examDate: string;
    examTitle: string;
  } | null;
  avgPercentile: number | null; // 평균 백분위
  totalStdScore: number | null; // 표준점수 합
  best3GradeSum: number | null; // 상위 3개 등급 합
}

/**
 * 수시/정시 전략 분석 결과
 */
export interface StrategyResult {
  type: StrategyType;
  message: string;
  data: {
    internalPct: number | null; // 내신 환산 백분위
    mockPct: number | null; // 모의고사 평균 백분위
    diff: number | null; // 차이
  };
}

/**
 * 성적 대시보드 API 응답
 */
export interface ScoreDashboardResponse {
  studentProfile: StudentProfile;
  internalAnalysis: InternalAnalysis;
  mockAnalysis: MockAnalysis;
  strategyResult: StrategyResult;
}

/**
 * API 호출 파라미터
 */
export interface ScoreDashboardParams {
  studentId: string;
  tenantId: string;
  termId?: string;
  grade?: number;
  semester?: number;
}

