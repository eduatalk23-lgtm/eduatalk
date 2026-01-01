/**
 * Python ML API 클라이언트
 *
 * Python FastAPI 서비스와 통신하여 ML 기반 예측/추천/분석을 수행합니다.
 */

// 환경 변수에서 API URL 가져오기
const ML_API_URL = process.env.PYTHON_ML_API_URL || "http://localhost:8000";

// ============================================
// 타입 정의
// ============================================

export interface ScorePredictionRequest {
  student_id: string;
  subject: string;
  days_ahead?: number;
}

export interface ScorePredictionResponse {
  student_id: string;
  subject: string;
  current_score: number | null;
  predicted_score: number;
  confidence: number;
  trend: "improving" | "stable" | "declining" | "unknown";
  factors: Record<string, unknown>;
}

export interface WorkloadPredictionRequest {
  student_id: string;
  weeks_ahead?: number;
}

export interface WorkloadPredictionResponse {
  student_id: string;
  predicted_plans: number;
  confidence_interval: [number, number];
  recommended_daily_minutes: number;
}

export interface ContentRecommendationRequest {
  student_id: string;
  subject?: string;
  limit?: number;
  include_reasons?: boolean;
}

export interface RecommendedContent {
  content_id: string;
  title: string;
  subject: string;
  content_type: string;
  difficulty: string | null;
  relevance_score: number;
  reason?: string;
}

export interface ContentRecommendationResponse {
  student_id: string;
  recommendations: RecommendedContent[];
  weak_subjects: string[];
  strategy: string;
}

export interface StudyPlanRecommendationRequest {
  student_id: string;
  content_ids: string[];
  days?: number;
  daily_minutes?: number;
}

export interface RecommendedTimeSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  reason: string;
}

export interface StudyPlanRecommendationResponse {
  student_id: string;
  recommended_slots: RecommendedTimeSlot[];
  daily_distribution: Record<string, number>;
  tips: string[];
}

export interface LearningPatternResponse {
  student_id: string;
  daily_distribution: Record<string, unknown> | null;
  hourly_distribution: Record<string, unknown> | null;
  subject_distribution: Record<string, unknown> | null;
  completion_rate: Record<string, unknown> | null;
  average_duration: Record<string, unknown> | null;
}

export interface ScoreTrendResponse {
  student_id: string;
  subject_averages: Record<string, unknown> | null;
  overall_trend: Record<string, unknown> | null;
  grade_distribution: Record<number, number> | null;
  weak_subjects: Record<string, number> | null;
}

export interface EfficiencyResponse {
  student_id: string;
  study_score_correlation: Record<string, unknown> | null;
  recommendations: string[];
}

export interface ComprehensiveReportResponse {
  student_id: string;
  learning_patterns: Record<string, unknown>;
  score_trends: Record<string, unknown>;
  efficiency: Record<string, unknown>;
  insights: string[];
  action_items: string[];
}

export interface PeerComparisonResponse {
  student_id: string;
  overall: {
    student_average: number;
    tenant_average: number;
    percentile: number;
    position: string;
  };
  by_subject: Record<
    string,
    {
      student_avg: number;
      tenant_avg: number;
      difference: number;
    }
  >;
}

// ============================================
// API 클라이언트
// ============================================

class PythonMLClient {
  private baseUrl: string;

  constructor(baseUrl: string = ML_API_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.detail || `Python ML API error: ${response.status}`
      );
    }

    return response.json();
  }

  // ============================================
  // 예측 API
  // ============================================

  /**
   * 성적 예측
   */
  async predictScore(
    request: ScorePredictionRequest
  ): Promise<ScorePredictionResponse> {
    return this.fetch<ScorePredictionResponse>("/api/predictions/score", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * 학습량 예측
   */
  async predictWorkload(
    request: WorkloadPredictionRequest
  ): Promise<WorkloadPredictionResponse> {
    return this.fetch<WorkloadPredictionResponse>("/api/predictions/workload", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * 예측 가능한 과목 목록
   */
  async getPredictableSubjects(
    studentId: string
  ): Promise<{ subjects: string[]; all_subjects: string[]; data_counts: Record<string, number> }> {
    return this.fetch(`/api/predictions/subjects/${studentId}`);
  }

  // ============================================
  // 추천 API
  // ============================================

  /**
   * 콘텐츠 추천
   */
  async recommendContent(
    request: ContentRecommendationRequest
  ): Promise<ContentRecommendationResponse> {
    return this.fetch<ContentRecommendationResponse>(
      "/api/recommendations/content",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * 학습 플랜 추천
   */
  async recommendStudyPlan(
    request: StudyPlanRecommendationRequest
  ): Promise<StudyPlanRecommendationResponse> {
    return this.fetch<StudyPlanRecommendationResponse>(
      "/api/recommendations/study-plan",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * 취약 과목 조회
   */
  async getWeakSubjects(
    studentId: string
  ): Promise<{ weak_subjects: string[]; scores: Record<string, number>; overall_average: number }> {
    return this.fetch(`/api/recommendations/weak-subjects/${studentId}`);
  }

  // ============================================
  // 분석 API
  // ============================================

  /**
   * 학습 패턴 분석
   */
  async getLearningPatterns(
    studentId: string,
    days: number = 90
  ): Promise<LearningPatternResponse> {
    return this.fetch(
      `/api/analysis/learning-patterns/${studentId}?days=${days}`
    );
  }

  /**
   * 성적 트렌드 분석
   */
  async getScoreTrends(
    studentId: string,
    limit: number = 50
  ): Promise<ScoreTrendResponse> {
    return this.fetch(`/api/analysis/score-trends/${studentId}?limit=${limit}`);
  }

  /**
   * 학습 효율성 분석
   */
  async getStudyEfficiency(studentId: string): Promise<EfficiencyResponse> {
    return this.fetch(`/api/analysis/efficiency/${studentId}`);
  }

  /**
   * 종합 리포트
   */
  async getComprehensiveReport(
    studentId: string
  ): Promise<ComprehensiveReportResponse> {
    return this.fetch(`/api/analysis/report/${studentId}`);
  }

  /**
   * 동료 비교
   */
  async compareWithPeers(
    studentId: string,
    tenantId: string
  ): Promise<PeerComparisonResponse> {
    return this.fetch(
      `/api/analysis/compare/${studentId}?tenant_id=${tenantId}`
    );
  }

  // ============================================
  // 유틸리티
  // ============================================

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    return this.fetch("/health");
  }

  /**
   * API 사용 가능 여부 확인
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

// 싱글톤 인스턴스
export const pythonMLClient = new PythonMLClient();

// 팩토리 함수 (테스트용 또는 커스텀 URL용)
export function createPythonMLClient(baseUrl?: string): PythonMLClient {
  return new PythonMLClient(baseUrl);
}
