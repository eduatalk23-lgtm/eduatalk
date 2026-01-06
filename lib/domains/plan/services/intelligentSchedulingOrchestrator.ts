/**
 * 지능형 스케줄링 오케스트레이터
 *
 * 여러 적응형 서비스들을 통합하여 종합적인 학습 추천을 생성합니다.
 *
 * 통합 서비스:
 * - adaptiveScheduler: 진행 상태 모니터링 및 일정 권장
 * - delayPredictionService: 지연 예측 및 위험 분석
 * - learningPacePredictor: 학습 속도 예측
 * - fatigueModelingService: 피로도 분석
 * - dynamicDifficultyService: 난이도 조정
 * - learningWeightService: 학습 가중치 계산
 * - realtimeFeedbackService: 실시간 피드백 반영
 *
 * @module lib/domains/plan/services/intelligentSchedulingOrchestrator
 */

import { logActionError } from "@/lib/logging/actionLogger";
import { analyzeStudentPattern, predictPlanDelays } from "./delayPredictionService";
import { predictLearningPace, getStudentLearningProfile } from "./learningPacePredictor";
import { calculateFatigueScore, suggestRestDays } from "./fatigueModelingService";
import { getStudentDifficultyProfile, getSubjectsNeedingAdjustment } from "./dynamicDifficultyService";
import { calculateLearningWeights } from "./learningWeightService";
import { generateRealtimeRecommendation } from "./realtimeFeedbackService";
import { monitorAllPlanGroupProgress, generateEnhancedAdaptiveSchedule } from "./adaptiveScheduler";

// ============================================
// 타입 정의
// ============================================

/**
 * 지능형 스케줄링 분석 결과
 */
export type IntelligentSchedulingAnalysis = {
  /** 분석 ID */
  analysisId: string;
  /** 학생 ID */
  studentId: string;
  /** 분석 시간 */
  analyzedAt: string;
  /** 전체 건강 점수 (0-100) */
  overallHealthScore: number;
  /** 건강 상태 */
  healthStatus: "excellent" | "good" | "fair" | "poor" | "critical";
  /** 주요 인사이트 */
  keyInsights: KeyInsight[];
  /** 통합 권장사항 */
  recommendations: UnifiedRecommendation[];
  /** 컴포넌트별 분석 결과 */
  componentAnalysis: ComponentAnalysis;
  /** 예측 메트릭 */
  predictions: PredictionMetrics;
};

/**
 * 주요 인사이트
 */
export type KeyInsight = {
  type: "positive" | "warning" | "critical" | "neutral";
  category: "progress" | "fatigue" | "difficulty" | "pace" | "pattern";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
};

/**
 * 통합 권장사항
 */
export type UnifiedRecommendation = {
  /** 고유 ID */
  id: string;
  /** 권장사항 유형 */
  type:
    | "schedule_adjustment"
    | "workload_change"
    | "rest_needed"
    | "difficulty_adjustment"
    | "time_optimization"
    | "pace_adjustment";
  /** 우선순위 (1-10, 10이 가장 높음) */
  priority: number;
  /** 제목 */
  title: string;
  /** 상세 설명 */
  description: string;
  /** 구체적 행동 지침 */
  actionItems: string[];
  /** 자동 적용 가능 여부 */
  autoApplicable: boolean;
  /** 예상 효과 */
  expectedImpact: string;
  /** 관련 서비스 */
  sourceServices: string[];
};

/**
 * 컴포넌트별 분석 결과
 */
export type ComponentAnalysis = {
  /** 진행 상태 분석 */
  progress?: {
    overallStatus: "good" | "needs-attention" | "critical";
    planGroupsAtRisk: number;
    averageProgressRate: number;
    estimatedCompletionDate?: string;
  };
  /** 피로도 분석 */
  fatigue?: {
    score: number;
    level: "low" | "medium" | "high" | "overload";
    consecutiveStudyDays: number;
    suggestedRestDays: string[];
  };
  /** 학습 속도 분석 */
  pace?: {
    averageVelocity: number;
    trend: "improving" | "stable" | "declining";
    confidence: "high" | "medium" | "low";
    optimalTimeSlot?: string;
  };
  /** 난이도 분석 */
  difficulty?: {
    subjectsNeedingAdjustment: number;
    overallDifficultyFit: "too_easy" | "appropriate" | "too_hard";
    adjustmentRecommendations: string[];
  };
  /** 지연 위험 분석 */
  delay?: {
    averageDelayDays: number;
    highRiskPlanCount: number;
    delayTrend: "increasing" | "stable" | "decreasing";
  };
  /** 실시간 피드백 */
  realtime?: {
    shouldRest: boolean;
    workloadDirection: "increase" | "decrease" | "maintain";
    motivationalMessage?: string;
  };
};

/**
 * 예측 메트릭
 */
export type PredictionMetrics = {
  /** 예상 완료율 (7일 후) */
  expectedCompletionRate7Days: number;
  /** 예상 피로도 변화 */
  fatigueTrajectory: "improving" | "stable" | "worsening";
  /** 권장 주간 학습 시간 */
  recommendedWeeklyMinutes: number;
  /** 리스크 점수 */
  riskScore: number;
};

/**
 * 오케스트레이터 옵션
 */
export type OrchestratorOptions = {
  /** 분석할 일수 (기본: 14일) */
  analysisDays?: number;
  /** 포함할 분석 컴포넌트 */
  includeComponents?: ("progress" | "fatigue" | "pace" | "difficulty" | "delay" | "realtime")[];
  /** 빠른 분석 모드 (일부 분석 생략) */
  quickMode?: boolean;
};

// ============================================
// 상수
// ============================================

const DEFAULT_ANALYSIS_DAYS = 14;

/** 건강 점수 가중치 */
const HEALTH_SCORE_WEIGHTS = {
  progress: 0.25,
  fatigue: 0.20,
  pace: 0.15,
  difficulty: 0.15,
  delay: 0.15,
  realtime: 0.10,
};

// ============================================
// 핵심 함수
// ============================================

/**
 * 종합적인 지능형 스케줄링 분석을 수행합니다.
 *
 * @param studentId - 학생 ID
 * @param options - 분석 옵션
 * @returns 지능형 스케줄링 분석 결과
 */
export async function analyzeIntelligentScheduling(
  studentId: string,
  options: OrchestratorOptions = {}
): Promise<{ success: boolean; data?: IntelligentSchedulingAnalysis; error?: string }> {
  try {
    const analysisDays = options.analysisDays ?? DEFAULT_ANALYSIS_DAYS;
    const includeComponents = options.includeComponents ?? [
      "progress",
      "fatigue",
      "pace",
      "difficulty",
      "delay",
      "realtime",
    ];
    const quickMode = options.quickMode ?? false;

    const componentAnalysis: ComponentAnalysis = {};
    const keyInsights: KeyInsight[] = [];
    const recommendations: UnifiedRecommendation[] = [];
    const scoreComponents: Record<string, number> = {};

    // 1. 진행 상태 분석
    if (includeComponents.includes("progress")) {
      const progressResult = await analyzeProgressComponent(studentId);
      if (progressResult) {
        componentAnalysis.progress = progressResult.analysis;
        keyInsights.push(...progressResult.insights);
        recommendations.push(...progressResult.recommendations);
        scoreComponents.progress = progressResult.score;
      }
    }

    // 2. 피로도 분석
    if (includeComponents.includes("fatigue") && !quickMode) {
      const fatigueResult = await analyzeFatigueComponent(studentId, analysisDays);
      if (fatigueResult) {
        componentAnalysis.fatigue = fatigueResult.analysis;
        keyInsights.push(...fatigueResult.insights);
        recommendations.push(...fatigueResult.recommendations);
        scoreComponents.fatigue = fatigueResult.score;
      }
    }

    // 3. 학습 속도 분석
    if (includeComponents.includes("pace") && !quickMode) {
      const paceResult = await analyzePaceComponent(studentId, analysisDays);
      if (paceResult) {
        componentAnalysis.pace = paceResult.analysis;
        keyInsights.push(...paceResult.insights);
        recommendations.push(...paceResult.recommendations);
        scoreComponents.pace = paceResult.score;
      }
    }

    // 4. 난이도 분석
    if (includeComponents.includes("difficulty") && !quickMode) {
      const difficultyResult = await analyzeDifficultyComponent(studentId, analysisDays);
      if (difficultyResult) {
        componentAnalysis.difficulty = difficultyResult.analysis;
        keyInsights.push(...difficultyResult.insights);
        recommendations.push(...difficultyResult.recommendations);
        scoreComponents.difficulty = difficultyResult.score;
      }
    }

    // 5. 지연 위험 분석
    if (includeComponents.includes("delay")) {
      const delayResult = await analyzeDelayComponent(studentId);
      if (delayResult) {
        componentAnalysis.delay = delayResult.analysis;
        keyInsights.push(...delayResult.insights);
        recommendations.push(...delayResult.recommendations);
        scoreComponents.delay = delayResult.score;
      }
    }

    // 6. 실시간 피드백
    if (includeComponents.includes("realtime")) {
      const realtimeResult = await analyzeRealtimeComponent(studentId);
      if (realtimeResult) {
        componentAnalysis.realtime = realtimeResult.analysis;
        keyInsights.push(...realtimeResult.insights);
        recommendations.push(...realtimeResult.recommendations);
        scoreComponents.realtime = realtimeResult.score;
      }
    }

    // 전체 건강 점수 계산
    const overallHealthScore = calculateOverallHealthScore(scoreComponents);
    const healthStatus = determineHealthStatus(overallHealthScore);

    // 권장사항 우선순위 정렬
    recommendations.sort((a, b) => b.priority - a.priority);

    // 예측 메트릭 계산
    const predictions = calculatePredictions(componentAnalysis, scoreComponents);

    return {
      success: true,
      data: {
        analysisId: generateAnalysisId(),
        studentId,
        analyzedAt: new Date().toISOString(),
        overallHealthScore,
        healthStatus,
        keyInsights: keyInsights.slice(0, 10), // 상위 10개 인사이트
        recommendations: recommendations.slice(0, 8), // 상위 8개 권장사항
        componentAnalysis,
        predictions,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError(
      { domain: "plan", action: "analyzeIntelligentScheduling" },
      error,
      { studentId }
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * 빠른 요약 분석을 수행합니다.
 * (주요 지표만 빠르게 확인)
 */
export async function getQuickSchedulingSummary(
  studentId: string
): Promise<{
  success: boolean;
  data?: {
    healthScore: number;
    status: "excellent" | "good" | "fair" | "poor" | "critical";
    topRecommendation?: string;
    needsAttention: boolean;
  };
  error?: string;
}> {
  const result = await analyzeIntelligentScheduling(studentId, {
    quickMode: true,
    includeComponents: ["progress", "delay", "realtime"],
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const data = result.data;
  return {
    success: true,
    data: {
      healthScore: data.overallHealthScore,
      status: data.healthStatus,
      topRecommendation: data.recommendations[0]?.title,
      needsAttention: data.healthStatus === "poor" || data.healthStatus === "critical",
    },
  };
}

// ============================================
// 컴포넌트 분석 함수
// ============================================

async function analyzeProgressComponent(studentId: string): Promise<{
  analysis: ComponentAnalysis["progress"];
  insights: KeyInsight[];
  recommendations: UnifiedRecommendation[];
  score: number;
} | null> {
  try {
    const progressResult = await monitorAllPlanGroupProgress(studentId);
    if (!progressResult.success || !progressResult.data) return null;

    const data = progressResult.data;
    const atRiskCount = data.criticalCount + data.behindCount;
    // 평균 진행률 계산 (results에서 progressRate 합산)
    const averageProgressRate = data.results.length > 0
      ? data.results.reduce((sum, r) => sum + r.progressRate, 0) / data.results.length
      : 0;

    const analysis: ComponentAnalysis["progress"] = {
      overallStatus: data.overallStatus,
      planGroupsAtRisk: atRiskCount,
      averageProgressRate: Math.round(averageProgressRate),
    };

    const insights: KeyInsight[] = [];
    const recommendations: UnifiedRecommendation[] = [];

    // 인사이트 생성
    if (data.overallStatus === "critical") {
      insights.push({
        type: "critical",
        category: "progress",
        title: "학습 진도 위험",
        description: `${atRiskCount}개의 플랜 그룹이 심각하게 지연되고 있습니다.`,
        impact: "high",
      });
    } else if (data.overallStatus === "needs-attention") {
      insights.push({
        type: "warning",
        category: "progress",
        title: "학습 진도 주의 필요",
        description: "일부 플랜 그룹이 예상보다 뒤처져 있습니다.",
        impact: "medium",
      });
    } else {
      insights.push({
        type: "positive",
        category: "progress",
        title: "학습 진도 양호",
        description: "전체적인 학습 진도가 계획대로 진행되고 있습니다.",
        impact: "low",
      });
    }

    // 권장사항 생성
    if (atRiskCount > 0) {
      recommendations.push({
        id: generateRecommendationId(),
        type: "schedule_adjustment",
        priority: data.overallStatus === "critical" ? 9 : 7,
        title: "지연 플랜 일정 조정",
        description: `${atRiskCount}개의 플랜 그룹 일정을 재조정하세요.`,
        actionItems: [
          "지연된 플랜 그룹 확인",
          "완료 가능한 분량으로 조정",
          "마감일 재설정 검토",
        ],
        autoApplicable: false,
        expectedImpact: "진행 상태 개선 및 스트레스 감소",
        sourceServices: ["adaptiveScheduler"],
      });
    }

    // 점수 계산 (0-100)
    let score = 100;
    if (data.overallStatus === "critical") score = 30;
    else if (data.overallStatus === "needs-attention") score = 60;
    else if (averageProgressRate < 50) score = 70;

    return { analysis, insights, recommendations, score };
  } catch {
    return null;
  }
}

async function analyzeFatigueComponent(
  studentId: string,
  days: number
): Promise<{
  analysis: ComponentAnalysis["fatigue"];
  insights: KeyInsight[];
  recommendations: UnifiedRecommendation[];
  score: number;
} | null> {
  try {
    const fatigueResult = await calculateFatigueScore({ studentId, daysToAnalyze: days });
    if (!fatigueResult.success || !fatigueResult.data) return null;

    const metrics = fatigueResult.data;
    // 향후 7일 날짜 배열 생성
    const next7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      next7Days.push(date.toISOString().split("T")[0]);
    }
    const restResult = suggestRestDays(metrics, next7Days);

    const analysis: ComponentAnalysis["fatigue"] = {
      score: metrics.fatigueScore,
      level: metrics.intensityLevel,
      consecutiveStudyDays: metrics.consecutiveDays,
      suggestedRestDays: restResult.map((r) => r.date),
    };

    const insights: KeyInsight[] = [];
    const recommendations: UnifiedRecommendation[] = [];

    // 인사이트 생성
    if (metrics.intensityLevel === "overload" || metrics.intensityLevel === "high") {
      insights.push({
        type: metrics.intensityLevel === "overload" ? "critical" : "warning",
        category: "fatigue",
        title: metrics.intensityLevel === "overload" ? "피로도 과부하" : "높은 피로도",
        description: `피로도 점수가 ${Math.round(metrics.fatigueScore)}점입니다. 휴식이 필요합니다.`,
        impact: metrics.intensityLevel === "overload" ? "high" : "medium",
      });
    } else if (metrics.intensityLevel === "low") {
      insights.push({
        type: "positive",
        category: "fatigue",
        title: "피로도 적정",
        description: "현재 피로도 수준이 건강한 상태입니다.",
        impact: "low",
      });
    }

    // 권장사항 생성
    if (restResult.length > 0 && restResult[0].priority === "high") {
      recommendations.push({
        id: generateRecommendationId(),
        type: "rest_needed",
        priority: 10,
        title: "즉시 휴식 필요",
        description: restResult[0].reason,
        actionItems: [
          `${restResult[0].date} 휴식일로 지정`,
          "학습 일정 조정",
          "가벼운 활동만 권장",
        ],
        autoApplicable: false,
        expectedImpact: "피로 회복 및 학습 효율 향상",
        sourceServices: ["fatigueModelingService"],
      });
    }

    // 점수 계산
    let score = 100;
    if (metrics.intensityLevel === "overload") score = 20;
    else if (metrics.intensityLevel === "high") score = 50;
    else if (metrics.intensityLevel === "medium") score = 75;

    return { analysis, insights, recommendations, score };
  } catch {
    return null;
  }
}

async function analyzePaceComponent(
  studentId: string,
  _days: number
): Promise<{
  analysis: ComponentAnalysis["pace"];
  insights: KeyInsight[];
  recommendations: UnifiedRecommendation[];
  score: number;
} | null> {
  try {
    const profileResult = await getStudentLearningProfile(studentId);
    if (!profileResult.success || !profileResult.data) return null;

    const data = profileResult.data;

    // 최적 시간대 찾기 (가장 효율이 높은 시간대)
    const bestTimePeriod = data.timePeriodEfficiencies.length > 0
      ? data.timePeriodEfficiencies.reduce((best, curr) =>
          curr.efficiency > best.efficiency ? curr : best
        ).period
      : undefined;

    // 데이터 충분성 기반 신뢰도 결정
    const confidence: "high" | "medium" | "low" =
      data.analyzedPlansCount >= 20 ? "high" :
      data.analyzedPlansCount >= 10 ? "medium" : "low";

    // 속도 트렌드 결정 (간단한 휴리스틱: 강한 시간대 vs 약한 시간대)
    const trend: "improving" | "stable" | "declining" =
      data.strongPeriods.length > data.weakPeriods.length ? "improving" :
      data.strongPeriods.length < data.weakPeriods.length ? "declining" : "stable";

    const analysis: ComponentAnalysis["pace"] = {
      averageVelocity: data.overallVelocity,
      trend,
      confidence,
      optimalTimeSlot: bestTimePeriod,
    };

    const insights: KeyInsight[] = [];
    const recommendations: UnifiedRecommendation[] = [];

    // 인사이트 생성
    if (trend === "declining") {
      insights.push({
        type: "warning",
        category: "pace",
        title: "학습 속도 감소 추세",
        description: "최근 학습 완료 속도가 감소하고 있습니다.",
        impact: "medium",
      });
    } else if (trend === "improving") {
      insights.push({
        type: "positive",
        category: "pace",
        title: "학습 속도 향상 중",
        description: "학습 효율이 점차 개선되고 있습니다.",
        impact: "medium",
      });
    }

    // 권장사항 생성
    if (bestTimePeriod) {
      recommendations.push({
        id: generateRecommendationId(),
        type: "time_optimization",
        priority: 5,
        title: "최적 학습 시간대 활용",
        description: `${bestTimePeriod} 시간대가 가장 효율적입니다.`,
        actionItems: [
          `${bestTimePeriod} 시간대에 주요 학습 배치`,
          "어려운 과목은 최적 시간대에 배정",
        ],
        autoApplicable: true,
        expectedImpact: "학습 효율 10-20% 향상",
        sourceServices: ["learningPacePredictor"],
      });
    }

    // 점수 계산
    let score = 75;
    if (trend === "improving") score = 90;
    else if (trend === "declining") score = 55;
    if (confidence === "high") score += 10;
    else if (confidence === "low") score -= 10;

    return { analysis, insights, recommendations, score: Math.min(100, Math.max(0, score)) };
  } catch {
    return null;
  }
}

async function analyzeDifficultyComponent(
  studentId: string,
  _days: number
): Promise<{
  analysis: ComponentAnalysis["difficulty"];
  insights: KeyInsight[];
  recommendations: UnifiedRecommendation[];
  score: number;
} | null> {
  try {
    const adjustmentResult = await getSubjectsNeedingAdjustment(studentId);
    if (!adjustmentResult.success || !adjustmentResult.data) return null;

    const data = adjustmentResult.data;
    // recommendedAdjustment: -1 = decrease, 0 = maintain, 1 = increase
    const needsAdjustment = data.filter((s) => s.recommendedAdjustment !== 0);

    const analysis: ComponentAnalysis["difficulty"] = {
      subjectsNeedingAdjustment: needsAdjustment.length,
      overallDifficultyFit: needsAdjustment.length === 0
        ? "appropriate"
        : needsAdjustment.some((s) => s.recommendedAdjustment === -1)
          ? "too_hard"
          : "too_easy",
      adjustmentRecommendations: needsAdjustment.map(
        (s) => `${s.subjectType}: ${s.recommendedAdjustment === 1 ? "난이도 상향" : "난이도 하향"}`
      ),
    };

    const insights: KeyInsight[] = [];
    const recommendations: UnifiedRecommendation[] = [];

    // 인사이트 생성
    if (needsAdjustment.length > 0) {
      const hardSubjects = needsAdjustment.filter((s) => s.recommendedAdjustment === -1);
      const easySubjects = needsAdjustment.filter((s) => s.recommendedAdjustment === 1);

      if (hardSubjects.length > 0) {
        insights.push({
          type: "warning",
          category: "difficulty",
          title: "난이도 조정 필요",
          description: `${hardSubjects.map((s) => s.subjectType).join(", ")} 과목이 어렵게 느껴지고 있습니다.`,
          impact: "medium",
        });
      }

      if (easySubjects.length > 0) {
        insights.push({
          type: "neutral",
          category: "difficulty",
          title: "도전 수준 증가 가능",
          description: `${easySubjects.map((s) => s.subjectType).join(", ")} 과목에서 더 도전적인 내용이 가능합니다.`,
          impact: "low",
        });
      }
    } else {
      insights.push({
        type: "positive",
        category: "difficulty",
        title: "난이도 적정",
        description: "현재 학습 난이도가 적절합니다.",
        impact: "low",
      });
    }

    // 권장사항 생성
    if (needsAdjustment.length > 0) {
      recommendations.push({
        id: generateRecommendationId(),
        type: "difficulty_adjustment",
        priority: 6,
        title: "과목별 난이도 조정",
        description: `${needsAdjustment.length}개 과목의 난이도 조정이 권장됩니다.`,
        actionItems: analysis.adjustmentRecommendations,
        autoApplicable: false,
        expectedImpact: "학습 효율 및 만족도 향상",
        sourceServices: ["dynamicDifficultyService"],
      });
    }

    // 점수 계산
    const score = needsAdjustment.length === 0 ? 100 : Math.max(50, 100 - needsAdjustment.length * 15);

    return { analysis, insights, recommendations, score };
  } catch {
    return null;
  }
}

async function analyzeDelayComponent(studentId: string): Promise<{
  analysis: ComponentAnalysis["delay"];
  insights: KeyInsight[];
  recommendations: UnifiedRecommendation[];
  score: number;
} | null> {
  try {
    const patternResult = await analyzeStudentPattern(studentId);
    if (!patternResult.success || !patternResult.data) return null;

    const data = patternResult.data;
    // consecutiveIncompleteStreak를 highRiskPlanCount로 사용
    const highRiskCount = data.consecutiveIncompleteStreak;

    const analysis: ComponentAnalysis["delay"] = {
      averageDelayDays: data.averageDelayDays,
      highRiskPlanCount: highRiskCount,
      delayTrend: data.recentTrend === "declining" ? "increasing" : data.recentTrend === "improving" ? "decreasing" : "stable",
    };

    const insights: KeyInsight[] = [];
    const recommendations: UnifiedRecommendation[] = [];

    // 인사이트 생성
    if (data.averageDelayDays >= 3) {
      insights.push({
        type: data.averageDelayDays >= 5 ? "critical" : "warning",
        category: "pattern",
        title: "지연 패턴 감지",
        description: `평균 ${data.averageDelayDays}일 지연되고 있습니다.`,
        impact: data.averageDelayDays >= 5 ? "high" : "medium",
      });
    }

    if (highRiskCount > 0) {
      insights.push({
        type: "warning",
        category: "pattern",
        title: "연속 미완료 플랜",
        description: `${highRiskCount}일 연속 미완료 플랜이 있습니다.`,
        impact: "medium",
      });
    }

    // 권장사항 생성
    if (data.averageDelayDays >= 2) {
      recommendations.push({
        id: generateRecommendationId(),
        type: "workload_change",
        priority: data.averageDelayDays >= 5 ? 9 : 7,
        title: "학습량 조정 권장",
        description: "지속적인 지연을 줄이기 위해 학습량을 조정하세요.",
        actionItems: [
          "일일 플랜 수 10-20% 감소 검토",
          "우선순위가 낮은 플랜 재조정",
          "마감일에 여유 추가",
        ],
        autoApplicable: false,
        expectedImpact: "지연율 감소 및 완료율 향상",
        sourceServices: ["delayPredictionService"],
      });
    }

    // 점수 계산
    let score = 100;
    if (data.averageDelayDays >= 5) score = 30;
    else if (data.averageDelayDays >= 3) score = 50;
    else if (data.averageDelayDays >= 1) score = 75;
    if (highRiskCount > 5) score -= 20;

    return { analysis, insights, recommendations, score: Math.max(0, score) };
  } catch {
    return null;
  }
}

async function analyzeRealtimeComponent(studentId: string): Promise<{
  analysis: ComponentAnalysis["realtime"];
  insights: KeyInsight[];
  recommendations: UnifiedRecommendation[];
  score: number;
} | null> {
  try {
    const realtimeResult = await generateRealtimeRecommendation(studentId);
    if (!realtimeResult.success || !realtimeResult.data) return null;

    const data = realtimeResult.data;
    const analysis: ComponentAnalysis["realtime"] = {
      shouldRest: data.shouldRest,
      workloadDirection: data.workloadAdjustment?.direction || "maintain",
      motivationalMessage: data.motivationalMessage,
    };

    const insights: KeyInsight[] = [];
    const recommendations: UnifiedRecommendation[] = [];

    // 인사이트 생성
    if (data.shouldRest) {
      insights.push({
        type: "warning",
        category: "fatigue",
        title: "오늘 휴식 권장",
        description: data.restReason || "오늘은 충분히 학습하셨습니다.",
        impact: "medium",
      });
    }

    if (data.motivationalMessage) {
      insights.push({
        type: "positive",
        category: "progress",
        title: "오늘의 격려",
        description: data.motivationalMessage,
        impact: "low",
      });
    }

    // 권장사항 생성
    if (data.workloadAdjustment && data.workloadAdjustment.direction !== "maintain") {
      recommendations.push({
        id: generateRecommendationId(),
        type: "workload_change",
        priority: 4,
        title: data.workloadAdjustment.direction === "increase" ? "학습량 증가 가능" : "학습량 감소 권장",
        description: data.workloadAdjustment.reason,
        actionItems: [
          data.workloadAdjustment.direction === "increase"
            ? `${data.workloadAdjustment.percentage}% 학습량 증가 시도`
            : `${data.workloadAdjustment.percentage}% 학습량 감소 검토`,
        ],
        autoApplicable: true,
        expectedImpact: "학습 효율 및 만족도 향상",
        sourceServices: ["realtimeFeedbackService"],
      });
    }

    // 점수 계산
    let score = 80;
    if (data.shouldRest) score = 60;
    if (data.workloadAdjustment?.direction === "decrease") score -= 10;

    return { analysis, insights, recommendations, score };
  } catch {
    return null;
  }
}

// ============================================
// 헬퍼 함수
// ============================================

function calculateOverallHealthScore(scoreComponents: Record<string, number>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [component, score] of Object.entries(scoreComponents)) {
    const weight = HEALTH_SCORE_WEIGHTS[component as keyof typeof HEALTH_SCORE_WEIGHTS] || 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 50;
  return Math.round(weightedSum / totalWeight);
}

function determineHealthStatus(
  score: number
): "excellent" | "good" | "fair" | "poor" | "critical" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 55) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

function calculatePredictions(
  componentAnalysis: ComponentAnalysis,
  scoreComponents: Record<string, number>
): PredictionMetrics {
  // 간단한 휴리스틱 기반 예측
  const avgScore =
    Object.values(scoreComponents).length > 0
      ? Object.values(scoreComponents).reduce((a, b) => a + b, 0) / Object.values(scoreComponents).length
      : 50;

  const expectedCompletionRate7Days = Math.min(100, Math.max(0, avgScore + 10));
  const fatigueTrajectory: "improving" | "stable" | "worsening" =
    componentAnalysis.fatigue?.level === "overload"
      ? "worsening"
      : componentAnalysis.fatigue?.level === "low"
        ? "improving"
        : "stable";
  const recommendedWeeklyMinutes =
    componentAnalysis.fatigue?.level === "high" || componentAnalysis.fatigue?.level === "overload"
      ? 600 // 10시간
      : 900; // 15시간
  const riskScore = Math.max(0, 100 - avgScore);

  return {
    expectedCompletionRate7Days,
    fatigueTrajectory,
    recommendedWeeklyMinutes,
    riskScore,
  };
}

function generateAnalysisId(): string {
  return `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateRecommendationId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
