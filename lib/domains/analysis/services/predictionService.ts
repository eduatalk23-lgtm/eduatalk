/**
 * Performance Prediction Service
 *
 * Phase 4.1: 성과 예측 모델
 * 학생의 학습 패턴을 분석하여 주간 성과를 예측하고 조기 개입을 가능하게 함
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  analyzeLearningPatterns,
  type LearningPatternResult,
} from "./learningPatternService";

// ============================================================================
// Types
// ============================================================================

export type PredictionType =
  | "weekly_completion" // 주간 완수율 예측
  | "subject_struggle" // 과목별 어려움 예측
  | "burnout_risk" // 번아웃 위험도
  | "exam_readiness"; // 시험 준비도

export type TrendDirection = "improving" | "stable" | "declining";

export interface ContributingFactor {
  factor: string;
  impact: number; // -30 to +30
  description: string;
}

export interface RecommendedIntervention {
  type: string;
  priority: 1 | 2 | 3; // 1 = 높음
  description: string;
}

export interface PredictionFeatures {
  // 최근 완수율
  avgCompletionRate7d: number;
  avgCompletionRate30d: number;
  completionTrend: TrendDirection;

  // 다가오는 플랜 정보
  upcomingPlanCount: number;
  avgWeeklyPlans: number;
  upcomingDifficultyAvg: number;
  handledDifficultyAvg: number;

  // 스트릭 정보
  currentStreakDays: number;
  recentSkippedPlans: number;

  // 시간 패턴
  peakProductivityHours: number[];
  studyTimeConsistency: number; // 0-1

  // 과목 분포
  weakSubjectLoad: number; // 약점 과목 비율
  subjectBalance: number; // 0-1 (높을수록 균형)
}

export interface PredictionResult {
  predictionType: PredictionType;
  score: number; // 0-100
  confidence: number; // 0-1
  targetPeriodStart: string;
  targetPeriodEnd: string;
  contributingFactors: ContributingFactor[];
  recommendedInterventions: RecommendedIntervention[];
  features: Partial<PredictionFeatures>;
}

export interface WeeklyPerformancePrediction extends PredictionResult {
  predictionType: "weekly_completion";
  expectedCompletionRate: number;
  riskLevel: "low" | "medium" | "high";
}

export interface SubjectStrugglePrediction extends PredictionResult {
  predictionType: "subject_struggle";
  strugglingSubjects: string[];
}

export interface BurnoutRiskPrediction extends PredictionResult {
  predictionType: "burnout_risk";
  riskIndicators: string[];
  daysUntilBurnout: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const FACTOR_WEIGHTS = {
  COMPLETION_TREND_DECLINING: -15,
  COMPLETION_TREND_IMPROVING: 5,
  OVERLOAD_WARNING: -15,
  DIFFICULTY_SPIKE: -10,
  WEAK_SUBJECT_HEAVY: -10,
  STREAK_RISK: -8,
  CONSISTENT_STUDY_TIME: 5,
  BALANCED_SUBJECTS: 5,
  LOW_RECENT_COMPLETION: -20,
} as const;

const INTERVENTION_TYPES = {
  REDUCE_LOAD: "reduce_load",
  REDISTRIBUTE_SUBJECTS: "redistribute_subjects",
  ADJUST_SCHEDULE: "adjust_schedule",
  CONTACT_STUDENT: "contact_student",
  ADD_BREAKS: "add_breaks",
  FOCUS_WEAK_SUBJECTS: "focus_weak_subjects",
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

function calculateTrend(recent: number, historical: number): TrendDirection {
  const diff = recent - historical;
  if (diff > 0.05) return "improving";
  if (diff < -0.05) return "declining";
  return "stable";
}

function calculateConfidence(dataPoints: number): number {
  // 데이터 포인트가 많을수록 확신도 증가
  if (dataPoints < 5) return 0.3;
  if (dataPoints < 10) return 0.5;
  if (dataPoints < 20) return 0.7;
  if (dataPoints < 50) return 0.85;
  return 0.95;
}

function getNextWeekDates(): { start: string; end: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);

  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  return {
    start: nextMonday.toISOString().split("T")[0],
    end: nextSunday.toISOString().split("T")[0],
  };
}

// ============================================================================
// Main Prediction Service
// ============================================================================

export class PredictionService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * 특성 추출
   * 학생의 학습 데이터에서 예측에 필요한 특성을 추출
   */
  async extractFeatures(studentId: string): Promise<PredictionFeatures> {
    const supabase = await createSupabaseServerClient();

    // 최근 7일/30일 데이터 조회
    const now = new Date();
    const date7dAgo = new Date(now);
    date7dAgo.setDate(now.getDate() - 7);
    const date30dAgo = new Date(now);
    date30dAgo.setDate(now.getDate() - 30);

    // 최근 플랜 조회
    const { data: recentPlans } = await supabase
      .from("student_plan")
      .select("id, plan_date, status, progress, content_type, content_id")
      .eq("student_id", studentId)
      .gte("plan_date", date30dAgo.toISOString().split("T")[0])
      .lte("plan_date", now.toISOString().split("T")[0])
      .order("plan_date", { ascending: false });

    // 다가오는 플랜 조회
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    const { data: upcomingPlans } = await supabase
      .from("student_plan")
      .select("id, plan_date, content_type, content_id")
      .eq("student_id", studentId)
      .gt("plan_date", now.toISOString().split("T")[0])
      .lte("plan_date", nextWeek.toISOString().split("T")[0]);

    // 학습 패턴 조회
    const { data: patterns } = await supabase
      .from("student_learning_patterns")
      .select("*")
      .eq("student_id", studentId)
      .single();

    // 완수율 계산
    const plans7d =
      recentPlans?.filter(
        (p) => new Date(p.plan_date) >= date7dAgo
      ) ?? [];
    const completed7d = plans7d.filter(
      (p) => p.status === "completed" || (p.progress ?? 0) >= 80
    ).length;
    const avgCompletionRate7d =
      plans7d.length > 0 ? completed7d / plans7d.length : 0;

    const completed30d =
      recentPlans?.filter(
        (p) => p.status === "completed" || (p.progress ?? 0) >= 80
      ).length ?? 0;
    const avgCompletionRate30d =
      recentPlans && recentPlans.length > 0
        ? completed30d / recentPlans.length
        : 0;

    // 트렌드 계산
    const completionTrend = calculateTrend(
      avgCompletionRate7d,
      avgCompletionRate30d
    );

    // 스트릭 계산
    let currentStreakDays = 0;
    if (recentPlans && recentPlans.length > 0) {
      const sortedPlans = [...recentPlans].sort(
        (a, b) =>
          new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime()
      );

      for (const plan of sortedPlans) {
        if (plan.status === "completed" || (plan.progress ?? 0) >= 80) {
          currentStreakDays++;
        } else {
          break;
        }
      }
    }

    // 최근 스킵된 플랜 수
    const recentSkippedPlans =
      plans7d.filter(
        (p) => p.status === "skipped" || p.status === "cancelled"
      ).length;

    // 약점 과목 비율 계산 (간단 버전)
    const weakSubjects = patterns?.frequently_incomplete_subjects ?? [];
    const weakSubjectLoad = weakSubjects.length > 0 ? 0.3 : 0;

    return {
      avgCompletionRate7d,
      avgCompletionRate30d,
      completionTrend,
      upcomingPlanCount: upcomingPlans?.length ?? 0,
      avgWeeklyPlans: (recentPlans?.length ?? 0) / 4, // 30일 / 4주
      upcomingDifficultyAvg: 3, // 기본값 (실제 구현 시 콘텐츠 난이도 조회 필요)
      handledDifficultyAvg: 3,
      currentStreakDays,
      recentSkippedPlans,
      peakProductivityHours: patterns?.peak_productivity_hours ?? [],
      studyTimeConsistency: 0.7, // 기본값
      weakSubjectLoad,
      subjectBalance: 0.7, // 기본값
    };
  }

  /**
   * 주간 성과 예측
   */
  async predictWeeklyPerformance(
    studentId: string
  ): Promise<WeeklyPerformancePrediction> {
    try {
      const features = await this.extractFeatures(studentId);
      const { start, end } = getNextWeekDates();

      // 기본 점수 계산 (최근 7일 완수율 기준)
      let baseScore = features.avgCompletionRate7d * 100;
      const contributingFactors: ContributingFactor[] = [];

      // 트렌드 조정
      if (features.completionTrend === "declining") {
        baseScore += FACTOR_WEIGHTS.COMPLETION_TREND_DECLINING;
        contributingFactors.push({
          factor: "declining_trend",
          impact: FACTOR_WEIGHTS.COMPLETION_TREND_DECLINING,
          description: "최근 완수율이 감소 추세입니다",
        });
      } else if (features.completionTrend === "improving") {
        baseScore += FACTOR_WEIGHTS.COMPLETION_TREND_IMPROVING;
        contributingFactors.push({
          factor: "improving_trend",
          impact: FACTOR_WEIGHTS.COMPLETION_TREND_IMPROVING,
          description: "최근 완수율이 상승 추세입니다",
        });
      }

      // 과부하 조정
      if (features.upcomingPlanCount > features.avgWeeklyPlans * 1.3) {
        baseScore += FACTOR_WEIGHTS.OVERLOAD_WARNING;
        contributingFactors.push({
          factor: "overload_warning",
          impact: FACTOR_WEIGHTS.OVERLOAD_WARNING,
          description: `다음 주 플랜이 평균보다 ${Math.round(
            ((features.upcomingPlanCount / features.avgWeeklyPlans) - 1) * 100
          )}% 많습니다`,
        });
      }

      // 난이도 조정
      if (
        features.upcomingDifficultyAvg >
        features.handledDifficultyAvg + 0.5
      ) {
        baseScore += FACTOR_WEIGHTS.DIFFICULTY_SPIKE;
        contributingFactors.push({
          factor: "difficulty_spike",
          impact: FACTOR_WEIGHTS.DIFFICULTY_SPIKE,
          description: "다가오는 플랜의 난이도가 평소보다 높습니다",
        });
      }

      // 약점 과목 부하
      if (features.weakSubjectLoad > 0.3) {
        baseScore += FACTOR_WEIGHTS.WEAK_SUBJECT_HEAVY;
        contributingFactors.push({
          factor: "weak_subject_heavy",
          impact: FACTOR_WEIGHTS.WEAK_SUBJECT_HEAVY,
          description: "약점 과목 비율이 높습니다",
        });
      }

      // 스트릭 위험
      if (features.currentStreakDays >= 3 && features.recentSkippedPlans > 0) {
        baseScore += FACTOR_WEIGHTS.STREAK_RISK;
        contributingFactors.push({
          factor: "streak_at_risk",
          impact: FACTOR_WEIGHTS.STREAK_RISK,
          description: "연속 학습 기록이 위험합니다",
        });
      }

      // 점수 범위 제한
      baseScore = Math.max(0, Math.min(100, baseScore));

      // 확신도 계산
      const confidence = calculateConfidence(
        features.avgWeeklyPlans * 4 // 약 30일 데이터
      );

      // 위험 수준 결정
      let riskLevel: "low" | "medium" | "high" = "low";
      if (baseScore < 40) riskLevel = "high";
      else if (baseScore < 60) riskLevel = "medium";

      // 권장 조치 생성
      const recommendedInterventions =
        this.generateInterventions(contributingFactors);

      return {
        predictionType: "weekly_completion",
        score: Math.round(baseScore),
        expectedCompletionRate: Math.round(baseScore) / 100,
        confidence,
        riskLevel,
        targetPeriodStart: start,
        targetPeriodEnd: end,
        contributingFactors,
        recommendedInterventions,
        features,
      };
    } catch (error) {
      logActionError(
        { domain: "analysis", action: "predictWeeklyPerformance" },
        error,
        { studentId }
      );
      throw error;
    }
  }

  /**
   * 번아웃 위험도 예측
   */
  async predictBurnoutRisk(studentId: string): Promise<BurnoutRiskPrediction> {
    try {
      const features = await this.extractFeatures(studentId);
      const { start, end } = getNextWeekDates();

      const riskIndicators: string[] = [];
      let riskScore = 0;

      // 연속 학습 기간 체크
      if (features.currentStreakDays >= 14) {
        riskScore += 25;
        riskIndicators.push("14일 이상 연속 학습 중");
      } else if (features.currentStreakDays >= 7) {
        riskScore += 10;
        riskIndicators.push("7일 이상 연속 학습 중");
      }

      // 완수율 급락
      if (
        features.completionTrend === "declining" &&
        features.avgCompletionRate7d < 0.5
      ) {
        riskScore += 30;
        riskIndicators.push("완수율 급락");
      }

      // 과부하
      if (features.upcomingPlanCount > features.avgWeeklyPlans * 1.5) {
        riskScore += 20;
        riskIndicators.push("학습량 과부하");
      }

      // 스킵 증가
      if (features.recentSkippedPlans >= 3) {
        riskScore += 15;
        riskIndicators.push("최근 스킵 증가");
      }

      // 점수 범위 제한
      riskScore = Math.max(0, Math.min(100, riskScore));

      // 예상 번아웃 시점
      let daysUntilBurnout: number | null = null;
      if (riskScore >= 70) {
        daysUntilBurnout = 3;
      } else if (riskScore >= 50) {
        daysUntilBurnout = 7;
      } else if (riskScore >= 30) {
        daysUntilBurnout = 14;
      }

      const contributingFactors: ContributingFactor[] = riskIndicators.map(
        (indicator) => ({
          factor: indicator,
          impact: Math.round(riskScore / riskIndicators.length),
          description: indicator,
        })
      );

      const recommendedInterventions: RecommendedIntervention[] = [];

      if (riskScore >= 50) {
        recommendedInterventions.push({
          type: INTERVENTION_TYPES.ADD_BREAKS,
          priority: 1,
          description: "휴식일 추가를 권장합니다",
        });
        recommendedInterventions.push({
          type: INTERVENTION_TYPES.REDUCE_LOAD,
          priority: 1,
          description: "학습량을 20-30% 줄이는 것을 권장합니다",
        });
      }

      if (riskScore >= 70) {
        recommendedInterventions.push({
          type: INTERVENTION_TYPES.CONTACT_STUDENT,
          priority: 1,
          description: "학생과의 상담이 필요합니다",
        });
      }

      return {
        predictionType: "burnout_risk",
        score: riskScore,
        confidence: calculateConfidence(features.currentStreakDays + 10),
        targetPeriodStart: start,
        targetPeriodEnd: end,
        contributingFactors,
        recommendedInterventions,
        riskIndicators,
        daysUntilBurnout,
        features,
      };
    } catch (error) {
      logActionError(
        { domain: "analysis", action: "predictBurnoutRisk" },
        error,
        { studentId }
      );
      throw error;
    }
  }

  /**
   * 과목별 어려움 예측
   */
  async predictSubjectStruggle(
    studentId: string
  ): Promise<SubjectStrugglePrediction> {
    try {
      const patterns = await analyzeLearningPatterns(studentId, 30);
      const { start, end } = getNextWeekDates();

      const strugglingSubjects = patterns.frequentlyIncompleteSubjects;
      const subjectAnalysis = patterns.subjectCompletionAnalysis;

      // 점수 계산: 어려움을 겪는 과목이 많을수록 높음
      let score = 0;
      const contributingFactors: ContributingFactor[] = [];

      for (const subject of subjectAnalysis) {
        if (subject.completionRate < 50) {
          score += 25;
          contributingFactors.push({
            factor: `low_completion_${subject.subject}`,
            impact: 25,
            description: `${subject.subject} 완수율 ${subject.completionRate}%`,
          });
        } else if (subject.completionRate < 70) {
          score += 10;
          contributingFactors.push({
            factor: `medium_completion_${subject.subject}`,
            impact: 10,
            description: `${subject.subject} 완수율 ${subject.completionRate}%`,
          });
        }
      }

      score = Math.max(0, Math.min(100, score));

      const recommendedInterventions: RecommendedIntervention[] = [];

      if (strugglingSubjects.length > 0) {
        recommendedInterventions.push({
          type: INTERVENTION_TYPES.FOCUS_WEAK_SUBJECTS,
          priority: 1,
          description: `${strugglingSubjects.join(", ")} 과목 집중 학습 권장`,
        });
        recommendedInterventions.push({
          type: INTERVENTION_TYPES.REDISTRIBUTE_SUBJECTS,
          priority: 2,
          description: "과목 배분 재조정을 권장합니다",
        });
      }

      return {
        predictionType: "subject_struggle",
        score,
        confidence: calculateConfidence(patterns.totalPlansAnalyzed),
        targetPeriodStart: start,
        targetPeriodEnd: end,
        contributingFactors,
        recommendedInterventions,
        strugglingSubjects,
        features: {
          weakSubjectLoad: strugglingSubjects.length / Math.max(1, subjectAnalysis.length),
        },
      };
    } catch (error) {
      logActionError(
        { domain: "analysis", action: "predictSubjectStruggle" },
        error,
        { studentId }
      );
      throw error;
    }
  }

  /**
   * 권장 조치 생성
   */
  private generateInterventions(
    factors: ContributingFactor[]
  ): RecommendedIntervention[] {
    const interventions: RecommendedIntervention[] = [];

    for (const factor of factors) {
      if (factor.factor === "overload_warning") {
        interventions.push({
          type: INTERVENTION_TYPES.REDUCE_LOAD,
          priority: 1,
          description: "주간 학습량 감소를 권장합니다",
        });
      }

      if (factor.factor === "declining_trend") {
        interventions.push({
          type: INTERVENTION_TYPES.CONTACT_STUDENT,
          priority: 2,
          description: "학생 상태 확인이 필요합니다",
        });
      }

      if (factor.factor === "weak_subject_heavy") {
        interventions.push({
          type: INTERVENTION_TYPES.REDISTRIBUTE_SUBJECTS,
          priority: 2,
          description: "과목 균형 조정을 권장합니다",
        });
      }

      if (factor.factor === "streak_at_risk") {
        interventions.push({
          type: INTERVENTION_TYPES.ADJUST_SCHEDULE,
          priority: 3,
          description: "일정 재조정을 통해 연속 학습 유지를 권장합니다",
        });
      }
    }

    // 중복 제거 및 우선순위 정렬
    const unique = interventions.filter(
      (v, i, a) => a.findIndex((t) => t.type === v.type) === i
    );
    return unique.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 예측 결과 저장
   */
  async savePrediction(
    studentId: string,
    prediction: PredictionResult
  ): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();

      // 기존 예측 업데이트 또는 새로 생성
      const today = new Date().toISOString().split("T")[0];

      await supabase.from("student_predictions").upsert(
        {
          student_id: studentId,
          tenant_id: this.tenantId,
          prediction_type: prediction.predictionType,
          prediction_date: today,
          target_period_start: prediction.targetPeriodStart,
          target_period_end: prediction.targetPeriodEnd,
          prediction_score: prediction.score,
          confidence: prediction.confidence,
          contributing_factors: prediction.contributingFactors,
          recommended_interventions: prediction.recommendedInterventions,
        },
        {
          onConflict: "student_id,prediction_type,prediction_date",
        }
      );
    } catch (error) {
      logActionError(
        { domain: "analysis", action: "savePrediction" },
        error,
        { studentId, predictionType: prediction.predictionType }
      );
    }
  }

  /**
   * 모든 예측 실행
   */
  async runAllPredictions(studentId: string): Promise<{
    weeklyPerformance: WeeklyPerformancePrediction;
    burnoutRisk: BurnoutRiskPrediction;
    subjectStruggle: SubjectStrugglePrediction;
  }> {
    const [weeklyPerformance, burnoutRisk, subjectStruggle] = await Promise.all(
      [
        this.predictWeeklyPerformance(studentId),
        this.predictBurnoutRisk(studentId),
        this.predictSubjectStruggle(studentId),
      ]
    );

    // 저장
    await Promise.all([
      this.savePrediction(studentId, weeklyPerformance),
      this.savePrediction(studentId, burnoutRisk),
      this.savePrediction(studentId, subjectStruggle),
    ]);

    return { weeklyPerformance, burnoutRisk, subjectStruggle };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function predictWeeklyPerformance(
  tenantId: string,
  studentId: string
): Promise<WeeklyPerformancePrediction> {
  const service = new PredictionService(tenantId);
  return service.predictWeeklyPerformance(studentId);
}

export async function predictBurnoutRisk(
  tenantId: string,
  studentId: string
): Promise<BurnoutRiskPrediction> {
  const service = new PredictionService(tenantId);
  return service.predictBurnoutRisk(studentId);
}

export async function predictSubjectStruggle(
  tenantId: string,
  studentId: string
): Promise<SubjectStrugglePrediction> {
  const service = new PredictionService(tenantId);
  return service.predictSubjectStruggle(studentId);
}

export async function runAllPredictions(
  tenantId: string,
  studentId: string
): Promise<{
  weeklyPerformance: WeeklyPerformancePrediction;
  burnoutRisk: BurnoutRiskPrediction;
  subjectStruggle: SubjectStrugglePrediction;
}> {
  const service = new PredictionService(tenantId);
  return service.runAllPredictions(studentId);
}
