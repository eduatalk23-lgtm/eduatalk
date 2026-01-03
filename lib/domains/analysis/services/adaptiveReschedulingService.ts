/**
 * Adaptive Rescheduling Service
 *
 * Phase 4.3: 적응형 리스케줄링
 * 학습 패턴 분석을 기반으로 자동 일정 조정 제안
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  analyzeLearningPatterns,
  type LearningPatternResult,
  type DayAnalysis,
} from "./learningPatternService";

// ============================================================================
// Types
// ============================================================================

export type RescheduleReasonType =
  | "low_day_performance" // 저성과 요일
  | "consecutive_subject" // 동일 과목 연속
  | "overload" // 특정 일 과부하
  | "underload" // 특정 일 학습량 부족
  | "time_preference" // 시간대 선호 불일치
  | "incomplete_pattern"; // 미완료 패턴

export interface RescheduleRecommendation {
  planId: string;
  planDate: string;
  subject: string;
  contentTitle: string;
  reasonType: RescheduleReasonType;
  reason: string;
  suggestedDate: string;
  suggestedTimeSlot?: string;
  confidence: number; // 0-1
  impact: "low" | "medium" | "high";
}

export interface RescheduleAnalysis {
  studentId: string;
  analyzedAt: string;
  recommendations: RescheduleRecommendation[];
  summary: {
    totalRecommendations: number;
    byReason: Record<RescheduleReasonType, number>;
    estimatedImprovementRate: number; // 예상 개선율
  };
}

export interface AutoRescheduleResult {
  planId: string;
  originalDate: string;
  newDate: string;
  reason: string;
  success: boolean;
  error?: string;
}

interface PlanWithContent {
  id: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  content_type: string | null;
  content_id: string | null;
  subject?: string;
  title?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DAY_NAMES: Record<number, string> = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

const DAY_NAMES_EN: Record<number, string> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

// ============================================================================
// Helper Functions
// ============================================================================

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function findNextDayOfWeek(
  fromDate: string,
  targetDayOfWeek: number
): string {
  const date = new Date(fromDate);
  const currentDay = date.getDay();
  const daysUntilTarget =
    targetDayOfWeek >= currentDay
      ? targetDayOfWeek - currentDay
      : 7 - currentDay + targetDayOfWeek;

  date.setDate(date.getDate() + daysUntilTarget + (daysUntilTarget === 0 ? 7 : 0));
  return date.toISOString().split("T")[0];
}

// ============================================================================
// Adaptive Rescheduling Service
// ============================================================================

export class AdaptiveReschedulingService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * 패턴 기반 리스케줄 분석 및 제안
   */
  async analyzeAndRecommend(
    studentId: string,
    planGroupId?: string
  ): Promise<RescheduleAnalysis> {
    try {
      const patterns = await analyzeLearningPatterns(studentId, 30);
      const upcomingPlans = await this.getUpcomingPlans(studentId, planGroupId);

      const recommendations: RescheduleRecommendation[] = [];

      for (const plan of upcomingPlans) {
        const planRecommendations = await this.analyzePlan(
          plan,
          patterns,
          upcomingPlans
        );
        recommendations.push(...planRecommendations);
      }

      // 요약 통계
      const byReason: Record<RescheduleReasonType, number> = {
        low_day_performance: 0,
        consecutive_subject: 0,
        overload: 0,
        underload: 0,
        time_preference: 0,
        incomplete_pattern: 0,
      };

      for (const rec of recommendations) {
        byReason[rec.reasonType]++;
      }

      // 예상 개선율 계산
      const estimatedImprovementRate = this.calculateEstimatedImprovement(
        recommendations,
        patterns
      );

      return {
        studentId,
        analyzedAt: new Date().toISOString(),
        recommendations,
        summary: {
          totalRecommendations: recommendations.length,
          byReason,
          estimatedImprovementRate,
        },
      };
    } catch (error) {
      logActionError(
        { domain: "analysis", action: "analyzeAndRecommend" },
        error,
        { studentId, planGroupId }
      );
      throw error;
    }
  }

  /**
   * 다가오는 플랜 조회
   */
  private async getUpcomingPlans(
    studentId: string,
    planGroupId?: string
  ): Promise<PlanWithContent[]> {
    const supabase = await createSupabaseServerClient();
    const today = new Date().toISOString().split("T")[0];
    const twoWeeksLater = addDays(today, 14);

    let query = supabase
      .from("student_plan")
      .select(
        `
        id,
        plan_date,
        start_time,
        end_time,
        status,
        content_type,
        content_id
      `
      )
      .eq("student_id", studentId)
      .gt("plan_date", today)
      .lte("plan_date", twoWeeksLater)
      .in("status", ["pending", "scheduled"])
      .order("plan_date", { ascending: true });

    if (planGroupId) {
      query = query.eq("plan_group_id", planGroupId);
    }

    const { data: plans, error } = await query;

    if (error) throw error;

    // 콘텐츠 정보 추가
    const contentIds = [
      ...new Set((plans ?? []).map((p) => p.content_id).filter(Boolean)),
    ];

    if (contentIds.length === 0) {
      return (plans ?? []).map((p) => ({ ...p, subject: undefined, title: undefined }));
    }

    const [booksResult, lecturesResult] = await Promise.all([
      supabase.from("books").select("id, subject, title").in("id", contentIds),
      supabase
        .from("lectures")
        .select("id, subject, title")
        .in("id", contentIds),
    ]);

    const contentMap: Record<string, { subject: string; title: string }> = {};

    for (const book of booksResult.data ?? []) {
      contentMap[book.id] = { subject: book.subject, title: book.title };
    }

    for (const lecture of lecturesResult.data ?? []) {
      contentMap[lecture.id] = { subject: lecture.subject, title: lecture.title };
    }

    return (plans ?? []).map((p) => ({
      ...p,
      subject: p.content_id ? contentMap[p.content_id]?.subject : undefined,
      title: p.content_id ? contentMap[p.content_id]?.title : undefined,
    }));
  }

  /**
   * 개별 플랜 분석
   */
  private async analyzePlan(
    plan: PlanWithContent,
    patterns: LearningPatternResult,
    allPlans: PlanWithContent[]
  ): Promise<RescheduleRecommendation[]> {
    const recommendations: RescheduleRecommendation[] = [];
    const dayOfWeek = getDayOfWeek(plan.plan_date);
    const dayAnalysis = patterns.dayAnalysis.find(
      (d) => d.dayOfWeek === dayOfWeek
    );

    // 1. 저성과 요일 체크
    if (dayAnalysis && dayAnalysis.completionRate < 50 && dayAnalysis.planCount >= 3) {
      const betterDays = this.findBetterDays(patterns.dayAnalysis);

      if (betterDays.length > 0) {
        const suggestedDate = findNextDayOfWeek(plan.plan_date, betterDays[0]);

        recommendations.push({
          planId: plan.id,
          planDate: plan.plan_date,
          subject: plan.subject ?? "알 수 없음",
          contentTitle: plan.title ?? "알 수 없음",
          reasonType: "low_day_performance",
          reason: `${DAY_NAMES[dayOfWeek]}요일 역사적 완수율 ${dayAnalysis.completionRate}%`,
          suggestedDate,
          confidence: 0.7,
          impact: "medium",
        });
      }
    }

    // 2. 동일 과목 연속 배치 체크
    if (plan.subject) {
      const consecutiveCount = this.countConsecutiveSameSubject(
        allPlans,
        plan
      );

      if (consecutiveCount > 2) {
        const spreadDate = this.findSpreadDate(allPlans, plan);

        if (spreadDate) {
          recommendations.push({
            planId: plan.id,
            planDate: plan.plan_date,
            subject: plan.subject,
            contentTitle: plan.title ?? "알 수 없음",
            reasonType: "consecutive_subject",
            reason: `${plan.subject} ${consecutiveCount}일 연속 배치 - 과목 피로 방지`,
            suggestedDate: spreadDate,
            confidence: 0.6,
            impact: "low",
          });
        }
      }
    }

    // 3. 특정 일 과부하 체크
    const sameDayPlans = allPlans.filter(
      (p) => p.plan_date === plan.plan_date
    );
    if (sameDayPlans.length > 5) {
      const lessBusyDate = this.findLessBusyDate(allPlans, plan.plan_date);

      if (lessBusyDate) {
        recommendations.push({
          planId: plan.id,
          planDate: plan.plan_date,
          subject: plan.subject ?? "알 수 없음",
          contentTitle: plan.title ?? "알 수 없음",
          reasonType: "overload",
          reason: `해당 날짜에 ${sameDayPlans.length}개 플랜 집중`,
          suggestedDate: lessBusyDate,
          confidence: 0.65,
          impact: "medium",
        });
      }
    }

    // 4. 자주 미완료되는 과목 패턴
    if (
      plan.subject &&
      patterns.frequentlyIncompleteSubjects.includes(plan.subject)
    ) {
      const bestDayForSubject = this.findBestDayForWeakSubject(
        patterns.dayAnalysis
      );

      if (
        bestDayForSubject !== null &&
        getDayOfWeek(plan.plan_date) !== bestDayForSubject
      ) {
        const suggestedDate = findNextDayOfWeek(
          plan.plan_date,
          bestDayForSubject
        );

        recommendations.push({
          planId: plan.id,
          planDate: plan.plan_date,
          subject: plan.subject,
          contentTitle: plan.title ?? "알 수 없음",
          reasonType: "incomplete_pattern",
          reason: `${plan.subject}은 자주 미완료되는 과목입니다. 성과가 좋은 요일로 이동 권장`,
          suggestedDate,
          confidence: 0.55,
          impact: "medium",
        });
      }
    }

    return recommendations;
  }

  /**
   * 더 나은 요일 찾기
   */
  private findBetterDays(dayAnalysis: DayAnalysis[]): number[] {
    return dayAnalysis
      .filter((d) => d.completionRate >= 70 && d.planCount >= 3)
      .sort((a, b) => b.completionRate - a.completionRate)
      .map((d) => d.dayOfWeek);
  }

  /**
   * 연속 동일 과목 수 계산
   */
  private countConsecutiveSameSubject(
    plans: PlanWithContent[],
    targetPlan: PlanWithContent
  ): number {
    if (!targetPlan.subject) return 0;

    const sortedPlans = plans
      .filter((p) => p.subject === targetPlan.subject)
      .sort(
        (a, b) =>
          new Date(a.plan_date).getTime() - new Date(b.plan_date).getTime()
      );

    let maxConsecutive = 1;
    let currentConsecutive = 1;
    let previousDate: Date | null = null;

    for (const plan of sortedPlans) {
      const currentDate = new Date(plan.plan_date);

      if (previousDate) {
        const diffDays =
          (currentDate.getTime() - previousDate.getTime()) /
          (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          currentConsecutive++;
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
          currentConsecutive = 1;
        }
      }

      previousDate = currentDate;
    }

    return maxConsecutive;
  }

  /**
   * 분산 배치 날짜 찾기
   */
  private findSpreadDate(
    plans: PlanWithContent[],
    targetPlan: PlanWithContent
  ): string | null {
    const planDate = new Date(targetPlan.plan_date);

    // 2-3일 후로 이동 시도
    for (let offset = 2; offset <= 4; offset++) {
      const candidateDate = addDays(targetPlan.plan_date, offset);
      const existingPlans = plans.filter(
        (p) =>
          p.plan_date === candidateDate && p.subject === targetPlan.subject
      );

      if (existingPlans.length === 0) {
        return candidateDate;
      }
    }

    return null;
  }

  /**
   * 덜 바쁜 날짜 찾기
   */
  private findLessBusyDate(
    plans: PlanWithContent[],
    currentDate: string
  ): string | null {
    const planCountByDate: Record<string, number> = {};

    for (const plan of plans) {
      planCountByDate[plan.plan_date] =
        (planCountByDate[plan.plan_date] ?? 0) + 1;
    }

    const currentCount = planCountByDate[currentDate] ?? 0;

    // 현재 날짜 근처에서 덜 바쁜 날짜 찾기
    for (let offset = 1; offset <= 7; offset++) {
      for (const direction of [1, -1]) {
        const candidateDate = addDays(currentDate, offset * direction);
        const candidateCount = planCountByDate[candidateDate] ?? 0;

        if (candidateCount < currentCount - 1) {
          return candidateDate;
        }
      }
    }

    return null;
  }

  /**
   * 약점 과목에 적합한 요일 찾기
   */
  private findBestDayForWeakSubject(dayAnalysis: DayAnalysis[]): number | null {
    // 완수율이 가장 높고 데이터가 충분한 요일
    const validDays = dayAnalysis.filter((d) => d.planCount >= 3);

    if (validDays.length === 0) return null;

    const best = validDays.reduce((prev, curr) =>
      curr.completionRate > prev.completionRate ? curr : prev
    );

    return best.completionRate >= 70 ? best.dayOfWeek : null;
  }

  /**
   * 예상 개선율 계산
   */
  private calculateEstimatedImprovement(
    recommendations: RescheduleRecommendation[],
    patterns: LearningPatternResult
  ): number {
    if (recommendations.length === 0) return 0;

    let totalImprovement = 0;

    for (const rec of recommendations) {
      const currentDay = getDayOfWeek(rec.planDate);
      const suggestedDay = getDayOfWeek(rec.suggestedDate);

      const currentDayAnalysis = patterns.dayAnalysis.find(
        (d) => d.dayOfWeek === currentDay
      );
      const suggestedDayAnalysis = patterns.dayAnalysis.find(
        (d) => d.dayOfWeek === suggestedDay
      );

      if (currentDayAnalysis && suggestedDayAnalysis) {
        const improvement =
          suggestedDayAnalysis.completionRate -
          currentDayAnalysis.completionRate;
        totalImprovement += Math.max(0, improvement) * rec.confidence;
      }
    }

    return Math.round(totalImprovement / recommendations.length);
  }

  /**
   * 미완료 플랜 자동 재배치
   */
  async autoRescheduleIncomplete(
    studentId: string,
    incompletePlanIds: string[]
  ): Promise<AutoRescheduleResult[]> {
    const results: AutoRescheduleResult[] = [];
    const patterns = await analyzeLearningPatterns(studentId, 30);
    const supabase = await createSupabaseServerClient();

    for (const planId of incompletePlanIds) {
      try {
        const { data: plan } = await supabase
          .from("student_plan")
          .select("id, plan_date, content_type, content_id")
          .eq("id", planId)
          .single();

        if (!plan) {
          results.push({
            planId,
            originalDate: "",
            newDate: "",
            reason: "플랜을 찾을 수 없음",
            success: false,
            error: "Plan not found",
          });
          continue;
        }

        // 최적 슬롯 찾기
        const optimalDate = await this.findOptimalSlot(
          studentId,
          plan.plan_date,
          patterns
        );

        if (!optimalDate) {
          results.push({
            planId,
            originalDate: plan.plan_date,
            newDate: "",
            reason: "최적 슬롯을 찾을 수 없음",
            success: false,
            error: "No optimal slot found",
          });
          continue;
        }

        // 플랜 업데이트
        const { error: updateError } = await supabase
          .from("student_plan")
          .update({
            plan_date: optimalDate,
            status: "rescheduled",
          })
          .eq("id", planId);

        if (updateError) throw updateError;

        results.push({
          planId,
          originalDate: plan.plan_date,
          newDate: optimalDate,
          reason: "패턴 기반 최적 슬롯으로 재배치",
          success: true,
        });
      } catch (error) {
        results.push({
          planId,
          originalDate: "",
          newDate: "",
          reason: "재배치 실패",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * 최적 슬롯 찾기
   */
  private async findOptimalSlot(
    studentId: string,
    originalDate: string,
    patterns: LearningPatternResult
  ): Promise<string | null> {
    const supabase = await createSupabaseServerClient();
    const betterDays = this.findBetterDays(patterns.dayAnalysis);

    if (betterDays.length === 0) {
      // 기본: 다음 날로 이동
      return addDays(originalDate, 1);
    }

    // 가장 좋은 요일 중에서 가장 가까운 날짜 찾기
    for (const dayOfWeek of betterDays) {
      const candidateDate = findNextDayOfWeek(originalDate, dayOfWeek);

      // 해당 날짜의 플랜 수 확인
      const { data: existingPlans } = await supabase
        .from("student_plan")
        .select("id")
        .eq("student_id", studentId)
        .eq("plan_date", candidateDate);

      // 5개 미만이면 선택
      if ((existingPlans?.length ?? 0) < 5) {
        return candidateDate;
      }
    }

    return null;
  }

  /**
   * 제안 적용
   */
  async applyRecommendation(
    recommendation: RescheduleRecommendation
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createSupabaseServerClient();

      const { error } = await supabase
        .from("student_plan")
        .update({
          plan_date: recommendation.suggestedDate,
          status: "rescheduled",
        })
        .eq("id", recommendation.planId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 여러 제안 일괄 적용
   */
  async applyRecommendations(
    recommendations: RescheduleRecommendation[]
  ): Promise<{ applied: number; failed: number; results: Array<{ planId: string; success: boolean }> }> {
    const results: Array<{ planId: string; success: boolean }> = [];
    let applied = 0;
    let failed = 0;

    for (const rec of recommendations) {
      const result = await this.applyRecommendation(rec);
      results.push({ planId: rec.planId, success: result.success });

      if (result.success) {
        applied++;
      } else {
        failed++;
      }
    }

    return { applied, failed, results };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function analyzeAndRecommendReschedule(
  tenantId: string,
  studentId: string,
  planGroupId?: string
): Promise<RescheduleAnalysis> {
  const service = new AdaptiveReschedulingService(tenantId);
  return service.analyzeAndRecommend(studentId, planGroupId);
}

export async function autoRescheduleIncomplete(
  tenantId: string,
  studentId: string,
  incompletePlanIds: string[]
): Promise<AutoRescheduleResult[]> {
  const service = new AdaptiveReschedulingService(tenantId);
  return service.autoRescheduleIncomplete(studentId, incompletePlanIds);
}

export async function applyRescheduleRecommendation(
  tenantId: string,
  recommendation: RescheduleRecommendation
): Promise<{ success: boolean; error?: string }> {
  const service = new AdaptiveReschedulingService(tenantId);
  return service.applyRecommendation(recommendation);
}

// ============================================================================
// Labels (Korean)
// ============================================================================

export const RESCHEDULE_REASON_LABELS: Record<RescheduleReasonType, string> = {
  low_day_performance: "저성과 요일",
  consecutive_subject: "동일 과목 연속",
  overload: "과부하",
  underload: "학습량 부족",
  time_preference: "시간대 불일치",
  incomplete_pattern: "미완료 패턴",
};

export const IMPACT_LABELS: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

export { DAY_NAMES, DAY_NAMES_EN };
