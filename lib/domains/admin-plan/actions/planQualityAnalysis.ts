"use server";

/**
 * 플랜 품질 분석 액션
 *
 * Phase 4: 플랜 품질 대시보드
 *
 * 생성된 플랜 그룹의 품질을 분석하고 메트릭을 계산합니다.
 *
 * @module lib/domains/admin-plan/actions/planQualityAnalysis
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PlanQualityMetrics,
  PlanQualityDashboardData,
  SubjectDistribution,
  DailyDistribution,
  QualityDimension,
  ConflictDetail,
  QualitySuggestion,
  PlanQualityAnalysisResult,
} from "../types/qualityMetrics";

// ============================================
// 등급 계산 헬퍼
// ============================================

function calculateGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

// ============================================
// 균형 점수 계산
// ============================================

function calculateBalanceScore(
  subjectDistribution: SubjectDistribution[]
): QualityDimension {
  if (subjectDistribution.length === 0) {
    return {
      score: 100,
      label: "균형",
      description: "과목별 학습 시간 분배",
      grade: "A",
      details: "플랜이 없습니다.",
    };
  }

  // 과목별 학습 시간 비율의 표준편차 계산
  const percentages = subjectDistribution.map((s) => s.percentage);
  const mean = percentages.reduce((a, b) => a + b, 0) / percentages.length;
  const variance =
    percentages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) /
    percentages.length;
  const stdDev = Math.sqrt(variance);

  // 표준편차가 낮을수록 균형이 좋음 (0-30 범위를 0-100으로 변환)
  const score = Math.max(0, Math.min(100, 100 - stdDev * 3));

  const grade = calculateGrade(score);
  let details = "";

  if (score >= 80) {
    details = "과목 간 학습 시간이 균형있게 분배되어 있습니다.";
  } else if (score >= 60) {
    const maxSubject = subjectDistribution.reduce((a, b) =>
      a.percentage > b.percentage ? a : b
    );
    details = `${maxSubject.subject} 과목에 학습 시간이 집중되어 있습니다.`;
  } else {
    details = "과목 간 학습 시간 분배가 불균형합니다.";
  }

  return {
    score: Math.round(score),
    label: "균형",
    description: "과목별 학습 시간 분배",
    grade,
    details,
  };
}

// ============================================
// 충돌 점수 계산
// ============================================

function calculateConflictScore(
  plans: Array<{
    id: string;
    scheduled_date: string;
    scheduled_start_time: string | null;
    scheduled_end_time: string | null;
    duration_minutes: number;
  }>
): QualityDimension & { conflictCount: number; conflictDetails?: ConflictDetail[] } {
  const conflicts: ConflictDetail[] = [];

  // 날짜별 플랜 그룹화
  const plansByDate = new Map<string, typeof plans>();
  for (const plan of plans) {
    const date = plan.scheduled_date;
    if (!plansByDate.has(date)) {
      plansByDate.set(date, []);
    }
    plansByDate.get(date)!.push(plan);
  }

  // 각 날짜별로 시간 충돌 체크
  for (const [date, datePlans] of plansByDate) {
    const plansWithTime = datePlans.filter(
      (p) => p.scheduled_start_time && p.scheduled_end_time
    );

    for (let i = 0; i < plansWithTime.length; i++) {
      for (let j = i + 1; j < plansWithTime.length; j++) {
        const plan1 = plansWithTime[i];
        const plan2 = plansWithTime[j];

        const start1 = plan1.scheduled_start_time!;
        const end1 = plan1.scheduled_end_time!;
        const start2 = plan2.scheduled_start_time!;
        const end2 = plan2.scheduled_end_time!;

        // 시간 충돌 체크
        if (start1 < end2 && start2 < end1) {
          conflicts.push({
            type: "time_overlap",
            date,
            description: `${start1}-${end1}과 ${start2}-${end2} 시간이 겹칩니다.`,
            planIds: [plan1.id, plan2.id],
          });
        }
      }
    }

    // 일일 학습량 초과 체크 (8시간 = 480분)
    const totalMinutes = datePlans.reduce(
      (sum, p) => sum + p.duration_minutes,
      0
    );
    if (totalMinutes > 480) {
      conflicts.push({
        type: "daily_limit_exceeded",
        date,
        description: `일일 학습 시간이 ${totalMinutes}분으로 권장 시간(480분)을 초과했습니다.`,
      });
    }
  }

  // 충돌 수에 따른 점수 (0개 = 100점, 1개당 -10점)
  const score = Math.max(0, 100 - conflicts.length * 10);
  const grade = calculateGrade(score);

  let details = "";
  if (conflicts.length === 0) {
    details = "시간 충돌이 없습니다.";
  } else if (conflicts.length <= 3) {
    details = `${conflicts.length}개의 시간 충돌이 있습니다.`;
  } else {
    details = `${conflicts.length}개의 시간 충돌이 있습니다. 일정 조정이 필요합니다.`;
  }

  return {
    score: Math.round(score),
    label: "충돌",
    description: "시간/일정 충돌",
    grade,
    details,
    conflictCount: conflicts.length,
    conflictDetails: conflicts.length > 0 ? conflicts : undefined,
  };
}

// ============================================
// 커버리지 점수 계산
// ============================================

function calculateCoverageScore(
  coveredCount: number,
  totalCount: number
): QualityDimension & { coveredCount: number; totalCount: number } {
  if (totalCount === 0) {
    return {
      score: 100,
      label: "커버리지",
      description: "콘텐츠 포함률",
      grade: "A",
      details: "요청된 콘텐츠가 없습니다.",
      coveredCount: 0,
      totalCount: 0,
    };
  }

  const score = Math.round((coveredCount / totalCount) * 100);
  const grade = calculateGrade(score);

  let details = "";
  if (score >= 90) {
    details = "거의 모든 콘텐츠가 플랜에 포함되었습니다.";
  } else if (score >= 70) {
    details = `${totalCount - coveredCount}개의 콘텐츠가 플랜에 포함되지 않았습니다.`;
  } else {
    details = `많은 콘텐츠(${totalCount - coveredCount}개)가 플랜에 포함되지 않았습니다.`;
  }

  return {
    score,
    label: "커버리지",
    description: "콘텐츠 포함률",
    grade,
    details,
    coveredCount,
    totalCount,
  };
}

// ============================================
// 페이싱 점수 계산
// ============================================

function calculatePacingScore(
  dailyDistribution: DailyDistribution[]
): QualityDimension & {
  dailyMinutes: Record<string, number>;
  averageDaily: number;
  standardDeviation: number;
} {
  if (dailyDistribution.length === 0) {
    return {
      score: 100,
      label: "페이싱",
      description: "일일 학습량 분포",
      grade: "A",
      details: "플랜이 없습니다.",
      dailyMinutes: {},
      averageDaily: 0,
      standardDeviation: 0,
    };
  }

  const dailyMinutes: Record<string, number> = {};
  const minutes: number[] = [];

  for (const day of dailyDistribution) {
    dailyMinutes[day.date] = day.totalMinutes;
    minutes.push(day.totalMinutes);
  }

  const averageDaily = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  const variance =
    minutes.reduce((sum, m) => sum + Math.pow(m - averageDaily, 2), 0) /
    minutes.length;
  const standardDeviation = Math.sqrt(variance);

  // 표준편차가 평균의 30% 이하면 좋은 페이싱
  const coefficientOfVariation =
    averageDaily > 0 ? (standardDeviation / averageDaily) * 100 : 0;
  const score = Math.max(0, Math.min(100, 100 - coefficientOfVariation * 2));
  const grade = calculateGrade(score);

  let details = "";
  if (score >= 80) {
    details = "일별 학습량이 균등하게 분포되어 있습니다.";
  } else if (score >= 60) {
    details = "일별 학습량에 약간의 편차가 있습니다.";
  } else {
    details = "일별 학습량 편차가 큽니다. 조정을 고려하세요.";
  }

  return {
    score: Math.round(score),
    label: "페이싱",
    description: "일일 학습량 분포",
    grade,
    details,
    dailyMinutes,
    averageDaily: Math.round(averageDaily),
    standardDeviation: Math.round(standardDeviation),
  };
}

// ============================================
// 개선 제안 생성
// ============================================

function generateSuggestions(
  metrics: PlanQualityMetrics
): QualitySuggestion[] {
  const suggestions: QualitySuggestion[] = [];

  // 균형 관련 제안
  if (metrics.balance.score < 70) {
    suggestions.push({
      type: "balance",
      severity: metrics.balance.score < 50 ? "high" : "medium",
      message: "과목별 학습 시간 분배가 불균형합니다.",
      action: "특정 과목에 집중된 학습 시간을 다른 과목에 분배하세요.",
    });
  }

  // 충돌 관련 제안
  if (metrics.conflicts.conflictCount > 0) {
    suggestions.push({
      type: "conflict",
      severity: metrics.conflicts.conflictCount > 5 ? "high" : "medium",
      message: `${metrics.conflicts.conflictCount}개의 일정 충돌이 있습니다.`,
      action: "겹치는 시간대의 플랜을 조정하세요.",
    });
  }

  // 커버리지 관련 제안
  if (metrics.coverage.score < 80) {
    const missing = metrics.coverage.totalCount - metrics.coverage.coveredCount;
    suggestions.push({
      type: "coverage",
      severity: metrics.coverage.score < 60 ? "high" : "medium",
      message: `${missing}개의 콘텐츠가 플랜에 포함되지 않았습니다.`,
      action: "누락된 콘텐츠를 플랜에 추가하거나 기간을 연장하세요.",
    });
  }

  // 페이싱 관련 제안
  if (metrics.pacing.score < 70) {
    suggestions.push({
      type: "pacing",
      severity: metrics.pacing.score < 50 ? "high" : "low",
      message: "일별 학습량 편차가 큽니다.",
      action: "학습량이 많은 날의 플랜을 다른 날로 분산하세요.",
    });
  }

  return suggestions;
}

// ============================================
// 메인 분석 함수
// ============================================

/**
 * 플랜 그룹의 품질을 분석합니다.
 *
 * @param planGroupId - 플랜 그룹 ID
 * @returns 품질 분석 결과
 */
export async function analyzePlanQuality(
  planGroupId: string
): Promise<PlanQualityAnalysisResult> {
  try {
    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 정보 조회
    const { data: planGroup, error: planGroupError } = await supabase
      .from("plan_groups")
      .select("id, name, start_date, end_date")
      .eq("id", planGroupId)
      .single();

    if (planGroupError || !planGroup) {
      return {
        success: false,
        error: "플랜 그룹을 찾을 수 없습니다.",
      };
    }

    // 플랜 조회
    const { data: plans, error: plansError } = await supabase
      .from("student_plans")
      .select(`
        id,
        scheduled_date,
        scheduled_start_time,
        scheduled_end_time,
        duration_minutes,
        content_masters (
          id,
          subject
        )
      `)
      .eq("plan_group_id", planGroupId)
      .order("scheduled_date");

    if (plansError) {
      return {
        success: false,
        error: "플랜을 조회할 수 없습니다.",
      };
    }

    const planList = plans || [];
    const totalPlans = planList.length;
    const totalMinutes = planList.reduce(
      (sum, p) => sum + (p.duration_minutes || 0),
      0
    );

    // 과목별 분포 계산
    const subjectMap = new Map<
      string,
      { totalMinutes: number; planCount: number }
    >();
    for (const plan of planList) {
      const subject =
        (plan.content_masters as { subject?: string } | null)?.subject || "기타";
      const current = subjectMap.get(subject) || {
        totalMinutes: 0,
        planCount: 0,
      };
      current.totalMinutes += plan.duration_minutes || 0;
      current.planCount += 1;
      subjectMap.set(subject, current);
    }

    const subjectColors = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
      "#06B6D4",
      "#84CC16",
    ];

    const subjectDistribution: SubjectDistribution[] = Array.from(
      subjectMap.entries()
    ).map(([subject, data], index) => ({
      subject,
      totalMinutes: data.totalMinutes,
      planCount: data.planCount,
      percentage:
        totalMinutes > 0 ? (data.totalMinutes / totalMinutes) * 100 : 0,
      color: subjectColors[index % subjectColors.length],
    }));

    // 일별 분포 계산
    const dailyMap = new Map<
      string,
      { totalMinutes: number; planCount: number; bySubject: Record<string, number> }
    >();
    for (const plan of planList) {
      const date = plan.scheduled_date;
      const subject =
        (plan.content_masters as { subject?: string } | null)?.subject || "기타";
      const current = dailyMap.get(date) || {
        totalMinutes: 0,
        planCount: 0,
        bySubject: {},
      };
      current.totalMinutes += plan.duration_minutes || 0;
      current.planCount += 1;
      current.bySubject[subject] =
        (current.bySubject[subject] || 0) + (plan.duration_minutes || 0);
      dailyMap.set(date, current);
    }

    const dailyDistribution: DailyDistribution[] = Array.from(
      dailyMap.entries()
    )
      .map(([date, data]) => ({
        date,
        dayOfWeek: new Date(date).getDay(),
        totalMinutes: data.totalMinutes,
        planCount: data.planCount,
        bySubject: data.bySubject,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 각 차원별 점수 계산
    const balance = calculateBalanceScore(subjectDistribution);
    const conflicts = calculateConflictScore(
      planList.map((p) => ({
        id: p.id,
        scheduled_date: p.scheduled_date,
        scheduled_start_time: p.scheduled_start_time,
        scheduled_end_time: p.scheduled_end_time,
        duration_minutes: p.duration_minutes || 0,
      }))
    );

    // 커버리지: 현재 플랜에 포함된 고유 콘텐츠 수 / 전체 콘텐츠 수
    const uniqueContentIds = new Set(
      planList
        .map((p) => (p.content_masters as { id?: string } | null)?.id)
        .filter(Boolean)
    );
    const coverage = calculateCoverageScore(
      uniqueContentIds.size,
      uniqueContentIds.size // 현재는 포함된 콘텐츠만 카운트
    );

    const pacing = calculatePacingScore(dailyDistribution);

    // 전체 점수 계산 (가중 평균)
    const overallScore = Math.round(
      balance.score * 0.25 +
        conflicts.score * 0.3 +
        coverage.score * 0.2 +
        pacing.score * 0.25
    );
    const overallGrade = calculateGrade(overallScore);

    const metrics: PlanQualityMetrics = {
      overallScore,
      overallGrade,
      balance,
      conflicts,
      coverage,
      pacing,
    };

    const suggestions = generateSuggestions(metrics);

    const dashboardData: PlanQualityDashboardData = {
      metrics,
      subjectDistribution,
      dailyDistribution,
      planGroupInfo: {
        id: planGroup.id,
        name: planGroup.name,
        startDate: planGroup.start_date,
        endDate: planGroup.end_date,
        totalPlans,
        totalMinutes,
      },
      suggestions,
    };

    return {
      success: true,
      data: dashboardData,
    };
  } catch (error) {
    console.error("Plan quality analysis error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "품질 분석 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학생의 최근 플랜 그룹들의 품질을 분석합니다.
 *
 * @param studentId - 학생 ID
 * @param limit - 조회할 플랜 그룹 수 (기본값: 5)
 * @returns 품질 분석 결과 배열
 */
export async function analyzeStudentPlanQuality(
  studentId: string,
  limit: number = 5
): Promise<{
  success: boolean;
  data?: PlanQualityDashboardData[];
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // 학생의 최근 플랜 그룹 조회
    const { data: planGroups, error: planGroupsError } = await supabase
      .from("plan_groups")
      .select("id")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (planGroupsError) {
      return {
        success: false,
        error: "플랜 그룹을 조회할 수 없습니다.",
      };
    }

    if (!planGroups || planGroups.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // 각 플랜 그룹의 품질 분석
    const results: PlanQualityDashboardData[] = [];
    for (const pg of planGroups) {
      const result = await analyzePlanQuality(pg.id);
      if (result.success && result.data) {
        results.push(result.data);
      }
    }

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error("Student plan quality analysis error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "품질 분석 중 오류가 발생했습니다.",
    };
  }
}
