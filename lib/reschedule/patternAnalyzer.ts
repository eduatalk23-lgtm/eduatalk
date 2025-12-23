/**
 * 재조정 패턴 분석기
 * 
 * 재조정 이력을 분석하여 패턴을 파악하고 개선 제안을 생성합니다.
 * 
 * @module lib/reschedule/patternAnalyzer
 */

import type { RescheduleLogItem } from "@/lib/domains/plan";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeDelay } from "./delayDetector";
import type { Plan } from "@/lib/data/studentPlans";

// ============================================
// 상수 정의 (Magic Numbers)
// ============================================

const TREND_THRESHOLDS = {
  INCREASING: 1.2,
  DECREASING: 0.8,
};

const TOP_CONTENT_LIMIT = 5;

const DATE_RANGE_BUCKETS = {
  WEEK: 7,
  TWO_WEEKS: 14,
  MONTH: 30,
};

const SUGGESTION_THRESHOLDS = {
  HIGH_FREQUENCY: 2, // 월 2회 이상
  CONTENT_RESCHEDULE: 3, // 3회 이상 재조정된 콘텐츠
};

const EFFECTIVENESS_THRESHOLDS = {
  SUCCESS_HIGH: 90,
  SUCCESS_MEDIUM: 70,
  ROLLBACK_LOW: 5,
  ROLLBACK_MEDIUM: 15,
};

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 추천
 */
export interface RescheduleRecommendation {
  /** 플랜 그룹 ID */
  groupId: string;
  /** 플랜 그룹 이름 */
  groupName?: string;
  /** 재조정이 필요한 이유 */
  reason: string;
  /** 우선순위 */
  priority: "high" | "medium" | "low";
  /** 예상 영향 */
  estimatedImpact: {
    /** 영향받는 플랜 수 */
    plansAffected: number;
  };
}

/**
 * 재조정 패턴 분석 결과
 */
export interface ReschedulePatternAnalysis {
  /** 재조정 빈도 */
  frequency: {
    total: number;
    perMonth: number;
    perWeek: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  /** 자주 재조정되는 콘텐츠 */
  frequentlyRescheduledContents: Array<{
    content_id: string;
    rescheduleCount: number;
    lastRescheduledAt: string;
  }>;
  /** 재조정 패턴 */
  patterns: {
    mostCommonType: "range" | "replace" | "full_regeneration";
    averagePlansChanged: number;
    averageAffectedDates: number;
    commonDateRanges: Array<{
      range: string; // 예: "1-7일", "8-14일"
      count: number;
    }>;
  };
  /** 개선 제안 */
  suggestions: Array<{
    type: "reduce_frequency" | "optimize_content" | "adjust_schedule";
    priority: number; // 1-5
    title: string;
    description: string;
    reason: string;
  }>;
}

/**
 * 재조정 효과 분석 결과
 */
export interface RescheduleEffectAnalysis {
  /** 재조정 전후 비교 */
  beforeAfter: {
    averagePlansBefore: number;
    averagePlansAfter: number;
    averageChange: number;
  };
  /** 성공률 */
  successRate: number;
  /** 롤백률 */
  rollbackRate: number;
  /** 평균 재조정 간격 (일) */
  averageIntervalDays: number;
  /** 재조정 효과 평가 */
  effectiveness: "high" | "medium" | "low";
  /** 효과 설명 */
  effectivenessDescription: string;
}

// ============================================
// 패턴 분석
// ============================================

/**
 * 재조정 빈도 분석
 */
function analyzeFrequency(logs: RescheduleLogItem[]): {
  total: number;
  perMonth: number;
  perWeek: number;
  trend: "increasing" | "decreasing" | "stable";
} {
  if (logs.length === 0) {
    return {
      total: 0,
      perMonth: 0,
      perWeek: 0,
      trend: "stable",
    };
  }

  // 날짜 범위 계산
  const dates = logs
    .map((log) => new Date(log.created_at))
    .sort((a, b) => a.getTime() - b.getTime());

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const daysDiff =
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

  const perMonth = daysDiff > 0 ? (logs.length / daysDiff) * 30 : 0;
  const perWeek = daysDiff > 0 ? (logs.length / daysDiff) * 7 : 0;

  // 트렌드 분석 (최근 3개월 vs 이전 3개월)
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);

  const recentLogs = logs.filter(
    (log) => new Date(log.created_at) >= threeMonthsAgo
  );
  const olderLogs = logs.filter(
    (log) =>
      new Date(log.created_at) >= sixMonthsAgo &&
      new Date(log.created_at) < threeMonthsAgo
  );

  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (recentLogs.length > olderLogs.length * TREND_THRESHOLDS.INCREASING) {
    trend = "increasing";
  } else if (recentLogs.length < olderLogs.length * TREND_THRESHOLDS.DECREASING) {
    trend = "decreasing";
  }

  return {
    total: logs.length,
    perMonth: Math.round(perMonth * 10) / 10,
    perWeek: Math.round(perWeek * 10) / 10,
    trend,
  };
}

/**
 * 자주 재조정되는 콘텐츠 식별
 */
function identifyFrequentlyRescheduledContents(
  logs: RescheduleLogItem[]
): Array<{
  content_id: string;
  rescheduleCount: number;
  lastRescheduledAt: string;
}> {
  const contentMap = new Map<
    string,
    { count: number; lastDate: string }
  >();

  logs.forEach((log) => {
    if (log.adjusted_contents && log.adjusted_contents.length > 0) {
      log.adjusted_contents.forEach((contentId) => {
        const existing = contentMap.get(contentId);
        if (existing) {
          existing.count++;
          if (log.created_at > existing.lastDate) {
            existing.lastDate = log.created_at;
          }
        } else {
          contentMap.set(contentId, {
            count: 1,
            lastDate: log.created_at,
          });
        }
      });
    }
  });

  return Array.from(contentMap.entries())
    .map(([content_id, data]) => ({
      content_id,
      rescheduleCount: data.count,
      lastRescheduledAt: data.lastDate,
    }))
    .sort((a, b) => b.rescheduleCount - a.rescheduleCount)
    .slice(0, TOP_CONTENT_LIMIT); // 상위 5개만 반환
}

/**
 * 재조정 패턴 분석
 */
function analyzePatterns(logs: RescheduleLogItem[]): {
  mostCommonType: "range" | "replace" | "full_regeneration";
  averagePlansChanged: number;
  averageAffectedDates: number;
  commonDateRanges: Array<{
    range: string;
    count: number;
  }>;
} {
  if (logs.length === 0) {
    return {
      mostCommonType: "range",
      averagePlansChanged: 0,
      averageAffectedDates: 0,
      commonDateRanges: [],
    };
  }

  // 평균 플랜 변화 계산
  const totalPlansChanged = logs.reduce(
    (sum, log) => sum + Math.abs(log.plans_after_count - log.plans_before_count),
    0
  );
  const averagePlansChanged = Math.round((totalPlansChanged / logs.length) * 10) / 10;

  // 평균 영향받는 날짜 수 계산
  const totalAffectedDates = logs.reduce(
    (sum, log) => sum + (log.affected_dates?.length || 0),
    0
  );
  const averageAffectedDates = Math.round((totalAffectedDates / logs.length) * 10) / 10;

  // 날짜 범위 패턴 분석
  const dateRangeMap = new Map<string, number>();
  logs.forEach((log) => {
    if (log.date_range) {
      const from = new Date(log.date_range.from);
      const to = new Date(log.date_range.to);
      const daysDiff = Math.ceil(
        (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
      );

      let range: string;
      if (daysDiff <= DATE_RANGE_BUCKETS.WEEK) {
        range = "1-7일";
      } else if (daysDiff <= DATE_RANGE_BUCKETS.TWO_WEEKS) {
        range = "8-14일";
      } else if (daysDiff <= DATE_RANGE_BUCKETS.MONTH) {
        range = "15-30일";
      } else {
        range = "30일 이상";
      }

      dateRangeMap.set(range, (dateRangeMap.get(range) || 0) + 1);
    }
  });

  const commonDateRanges = Array.from(dateRangeMap.entries())
    .map(([range, count]) => ({ range, count }))
    .sort((a, b) => b.count - a.count);

  return {
    mostCommonType: "range", // NOTE: adjusted_contents에서 content_type 통계 추출 고려
    averagePlansChanged,
    averageAffectedDates,
    commonDateRanges,
  };
}

/**
 * 개선 제안 생성
 */
function generateSuggestions(
  analysis: {
    frequency: ReturnType<typeof analyzeFrequency>;
    frequentlyRescheduledContents: ReturnType<typeof identifyFrequentlyRescheduledContents>;
    patterns: ReturnType<typeof analyzePatterns>;
  }
): Array<{
  type: "reduce_frequency" | "optimize_content" | "adjust_schedule";
  priority: number;
  title: string;
  description: string;
  reason: string;
}> {
  const suggestions: Array<{
    type: "reduce_frequency" | "optimize_content" | "adjust_schedule";
    priority: number;
    title: string;
    description: string;
    reason: string;
  }> = [];

  // 재조정 빈도가 높으면 빈도 감소 제안
  if (analysis.frequency.perMonth > SUGGESTION_THRESHOLDS.HIGH_FREQUENCY) {
    suggestions.push({
      type: "reduce_frequency",
      priority: 5,
      title: "재조정 빈도 감소",
      description: `현재 월 평균 ${analysis.frequency.perMonth}회 재조정하고 있습니다. 초기 플랜 설계를 더 신중하게 하면 재조정 빈도를 줄일 수 있습니다.`,
      reason: `재조정 빈도가 높아 학습 계획의 안정성이 떨어집니다.`,
    });
  }

  // 자주 재조정되는 콘텐츠가 있으면 최적화 제안
  if (analysis.frequentlyRescheduledContents.length > 0) {
    const topContent = analysis.frequentlyRescheduledContents[0];
    if (topContent.rescheduleCount >= SUGGESTION_THRESHOLDS.CONTENT_RESCHEDULE) {
      suggestions.push({
        type: "optimize_content",
        priority: 4,
        title: "콘텐츠 범위 최적화",
        description: `${topContent.content_id} 콘텐츠가 ${topContent.rescheduleCount}회 재조정되었습니다. 초기 범위 설정을 재검토하는 것을 권장합니다.`,
        reason: `특정 콘텐츠가 반복적으로 재조정되고 있습니다.`,
      });
    }
  }

  // 트렌드가 증가하면 일정 조정 제안
  if (analysis.frequency.trend === "increasing") {
    suggestions.push({
      type: "adjust_schedule",
      priority: 3,
      title: "일정 조정 고려",
      description: "재조정 빈도가 증가하고 있습니다. 학습 일정이나 목표를 재검토하는 것을 권장합니다.",
      reason: `재조정 빈도가 증가하는 추세입니다.`,
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

/**
 * 재조정 패턴 분석
 * 
 * @param logs 재조정 로그 목록
 * @returns 패턴 분석 결과
 */
export function analyzeReschedulePatterns(
  logs: RescheduleLogItem[]
): ReschedulePatternAnalysis {
  const frequency = analyzeFrequency(logs);
  const frequentlyRescheduledContents =
    identifyFrequentlyRescheduledContents(logs);
  const patterns = analyzePatterns(logs);
  const suggestions = generateSuggestions({
    frequency,
    frequentlyRescheduledContents,
    patterns,
  });

  return {
    frequency,
    frequentlyRescheduledContents,
    patterns,
    suggestions,
  };
}

/**
 * 재조정이 필요한 플랜 그룹 감지
 * 
 * 학생의 활성 플랜 그룹들을 분석하여 재조정이 필요한 그룹을 찾습니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param studentId 학생 ID
 * @returns 재조정 추천 목록 (우선순위 순)
 */
export async function detectRescheduleNeeds(
  supabase: SupabaseClient,
  studentId: string
): Promise<RescheduleRecommendation[]> {
  try {
    // 1. 학생의 활성 플랜 그룹 조회
    const { data: planGroups, error: groupsError } = await supabase
      .from("plan_groups")
      .select("id, name, period_start, period_end, status")
      .eq("student_id", studentId)
      .in("status", ["active", "saved"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (groupsError) {
      console.error("[detectRescheduleNeeds] 플랜 그룹 조회 실패:", groupsError);
      return [];
    }

    if (!planGroups || planGroups.length === 0) {
      return [];
    }

    // 2. 일괄 조회: 모든 관련 플랜을 한 번에 가져옵니다 (N+1 문제 해결)
    const validGroups = planGroups.filter(g => g.period_start && g.period_end);
    const groupIds = validGroups.map(g => g.id);

    if (groupIds.length === 0) {
      return [];
    }

    const { data: allPlans, error: plansError } = await supabase
      .from("student_plan")
      .select("*")
      .in("plan_group_id", groupIds)
      .eq("student_id", studentId)
      .order("plan_date", { ascending: true });

    if (plansError) {
      console.error("[detectRescheduleNeeds] 플랜 일괄 조회 실패:", plansError);
      return [];
    }

    // 플랜을 그룹별로 분류
    const plansByGroupId = new Map<string, typeof allPlans>();
    
    (allPlans || []).forEach(plan => {
      const gId = plan.plan_group_id;
      if (!plansByGroupId.has(gId)) {
        plansByGroupId.set(gId, []);
      }
      plansByGroupId.get(gId)!.push(plan);
    });

    const recommendations: RescheduleRecommendation[] = [];

    // 3. 각 그룹별로 지연 분석 수행 (메모리 상에서 처리)
    for (const group of validGroups) {
      const groupPlans = plansByGroupId.get(group.id) || [];

      if (groupPlans.length === 0) {
        continue;
      }

      // Plan 타입으로 변환 (delayDetector가 기대하는 형식)
      const planList: Plan[] = groupPlans.map((plan) => ({
        id: plan.id,
        tenant_id: plan.tenant_id,
        student_id: plan.student_id,
        plan_date: plan.plan_date,
        block_index: plan.block_index ?? 0,
        content_type: plan.content_type,
        content_id: plan.content_id,
        chapter: plan.chapter,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        completed_amount: plan.completed_amount,
        progress: plan.progress,
        is_reschedulable: plan.is_reschedulable,
        plan_group_id: plan.plan_group_id,
        start_time: plan.start_time,
        end_time: plan.end_time,
        actual_start_time: plan.actual_start_time,
        actual_end_time: plan.actual_end_time,
        total_duration_seconds: plan.total_duration_seconds,
        paused_duration_seconds: plan.paused_duration_seconds,
        pause_count: plan.pause_count,
        plan_number: plan.plan_number,
        sequence: plan.sequence,
        memo: plan.memo,
        day_type: plan.day_type,
        week: plan.week,
        day: plan.day,
        is_partial: plan.is_partial,
        is_continued: plan.is_continued,
        content_title: plan.content_title,
        content_subject: plan.content_subject,
        content_subject_category: plan.content_subject_category,
        content_category: plan.content_category,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
        status: plan.status as "pending" | "in_progress" | "completed" | "cancelled" | null,
        // 추가 필드
        subject_type: plan.subject_type ?? null,
        origin_plan_item_id: plan.origin_plan_item_id ?? null,
        is_active: plan.is_active ?? null,
        version: plan.version ?? null,
        version_group_id: plan.version_group_id ?? null,
      }));

      // 4. 지연 분석 수행
      const delayAnalysis = analyzeDelay({
        plans: planList,
        startDate: group.period_start,
        endDate: group.period_end,
      });

      // 5. 지연이 있는 그룹만 필터링 (severity가 "none"이 아닌 경우)
      if (delayAnalysis.severity === "none") {
        continue;
      }

      // 6. 우선순위 매핑 (severity → priority)
      let priority: "high" | "medium" | "low";
      if (
        delayAnalysis.severity === "critical" ||
        delayAnalysis.severity === "high"
      ) {
        priority = "high";
      } else if (delayAnalysis.severity === "medium") {
        priority = "medium";
      } else {
        priority = "low";
      }

      // 7. RescheduleRecommendation 생성
      recommendations.push({
        groupId: group.id,
        groupName: group.name || undefined,
        reason: delayAnalysis.description,
        priority,
        estimatedImpact: {
          plansAffected: delayAnalysis.details.missedPlans || delayAnalysis.details.totalPlans,
        },
      });
    }

    // 8. 우선순위별 정렬 (high → medium → low)
    const priorityOrder: Record<"high" | "medium" | "low", number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    recommendations.sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
    );

    return recommendations;
  } catch (error) {
    console.error("[detectRescheduleNeeds] 예상치 못한 오류:", error);
    return [];
  }
}

/**
 * 재조정 효과 분석
 * 
 * @param logs 재조정 로그 목록
 * @returns 효과 분석 결과
 */
export function analyzeRescheduleEffects(
  logs: RescheduleLogItem[]
): RescheduleEffectAnalysis {
  if (logs.length === 0) {
    return {
      beforeAfter: {
        averagePlansBefore: 0,
        averagePlansAfter: 0,
        averageChange: 0,
      },
      successRate: 0,
      rollbackRate: 0,
      averageIntervalDays: 0,
      effectiveness: "low",
      effectivenessDescription: "재조정 이력이 없습니다.",
    };
  }

  // 재조정 전후 비교
  const totalPlansBefore = logs.reduce(
    (sum, log) => sum + log.plans_before_count,
    0
  );
  const totalPlansAfter = logs.reduce(
    (sum, log) => sum + log.plans_after_count,
    0
  );
  const averagePlansBefore = Math.round((totalPlansBefore / logs.length) * 10) / 10;
  const averagePlansAfter = Math.round((totalPlansAfter / logs.length) * 10) / 10;
  const averageChange = averagePlansAfter - averagePlansBefore;

  // 성공률 및 롤백률
  const successfulLogs = logs.filter((log) => log.status === "completed");
  const rolledBackLogs = logs.filter((log) => log.status === "rolled_back");
  const successRate = Math.round((successfulLogs.length / logs.length) * 100);
  const rollbackRate = Math.round((rolledBackLogs.length / logs.length) * 100);

  // 평균 재조정 간격
  const sortedLogs = [...logs].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let totalIntervalDays = 0;
  for (let i = 1; i < sortedLogs.length; i++) {
    const prevDate = new Date(sortedLogs[i - 1].created_at);
    const currDate = new Date(sortedLogs[i].created_at);
    const daysDiff =
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    totalIntervalDays += daysDiff;
  }
  const averageIntervalDays =
    sortedLogs.length > 1
      ? Math.round((totalIntervalDays / (sortedLogs.length - 1)) * 10) / 10
      : 0;

  // 효과 평가
  let effectiveness: "high" | "medium" | "low" = "medium";
  let effectivenessDescription = "";

  if (successRate >= EFFECTIVENESS_THRESHOLDS.SUCCESS_HIGH && rollbackRate <= EFFECTIVENESS_THRESHOLDS.ROLLBACK_LOW) {
    effectiveness = "high";
    effectivenessDescription = "재조정이 효과적으로 이루어지고 있습니다.";
  } else if (successRate >= EFFECTIVENESS_THRESHOLDS.SUCCESS_MEDIUM && rollbackRate <= EFFECTIVENESS_THRESHOLDS.ROLLBACK_MEDIUM) {
    effectiveness = "medium";
    effectivenessDescription = "재조정이 대체로 효과적입니다. 일부 개선 여지가 있습니다.";
  } else {
    effectiveness = "low";
    effectivenessDescription = "재조정 효과가 낮습니다. 재조정 전략을 재검토하는 것을 권장합니다.";
  }

  return {
    beforeAfter: {
      averagePlansBefore,
      averagePlansAfter,
      averageChange,
    },
    successRate,
    rollbackRate,
    averageIntervalDays,
    effectiveness,
    effectivenessDescription,
  };
}
