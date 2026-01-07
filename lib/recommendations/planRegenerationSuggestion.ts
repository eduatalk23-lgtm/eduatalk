/**
 * P1 개선: 점수 기반 플랜 재생성 제안 시스템
 *
 * 학생의 점수 패턴을 분석하여 플랜 재생성이 필요한지 판단하고
 * 구체적인 개선 제안을 제공합니다.
 */

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeakSubjects } from "@/lib/metrics/getWeakSubjects";
import { getScoreTrend } from "@/lib/metrics/getScoreTrend";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 플랜 재생성 제안 유형
 */
export type RegenerationSuggestionType =
  | "score_decline" // 점수 하락
  | "weak_subject_neglected" // 취약 과목 학습 부족
  | "low_completion_rate" // 낮은 플랜 실행률
  | "goal_progress_stalled" // 목표 진행 정체
  | "schedule_mismatch"; // 스케줄 불일치

/**
 * 플랜 재생성 제안
 */
export interface RegenerationSuggestion {
  type: RegenerationSuggestionType;
  priority: "high" | "medium" | "low";
  subject?: string;
  message: string;
  actionRecommendation: string;
  metrics?: {
    currentValue?: number;
    targetValue?: number;
    trend?: "up" | "down" | "stable";
  };
}

/**
 * 플랜 재생성 분석 결과
 */
export interface PlanRegenerationAnalysis {
  shouldRegenerate: boolean;
  overallPriority: "high" | "medium" | "low" | "none";
  suggestions: RegenerationSuggestion[];
  summary: string;
  analysisDate: string;
}

/**
 * 점수 기반 플랜 재생성 제안 생성
 */
export async function analyzePlanRegenerationNeed(
  supabase: SupabaseServerClient,
  studentId: string,
  planGroupId?: string
): Promise<PlanRegenerationAnalysis> {
  const suggestions: RegenerationSuggestion[] = [];
  const analysisDate = new Date().toISOString().slice(0, 10);

  try {
    // 이번 주 범위 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // 데이터 조회
    const [weakSubjectsResult, scoreTrendResult, planStats] = await Promise.all([
      getWeakSubjects(supabase, { studentId, weekStart, weekEnd }),
      getScoreTrend(supabase, { studentId }),
      getPlanCompletionStats(supabase, studentId, planGroupId),
    ]);

    // 취약 과목 결과 처리
    const weakSubjectsData = weakSubjectsResult.success
      ? weakSubjectsResult.data
      : {
          weakSubjects: [],
          subjectStudyTime: new Map<string, number>(),
          totalStudyTime: 0,
          weakSubjectStudyTimeRatio: 0,
        };

    // 성적 추이 결과 처리
    const scoreTrendData = scoreTrendResult.success
      ? scoreTrendResult.data
      : {
          hasDecliningTrend: false,
          decliningSubjects: [],
          lowGradeSubjects: [],
          recentScores: [],
        };

    // Rule 1: 2회 연속 점수 하락 과목 → high priority
    for (const subject of scoreTrendData.decliningSubjects) {
      suggestions.push({
        type: "score_decline",
        priority: "high",
        subject,
        message: `${subject} 과목이 2회 연속 성적이 하락했습니다.`,
        actionRecommendation: `${subject} 학습 비중을 현재보다 20% 이상 늘리는 플랜 재생성을 권장합니다.`,
        metrics: {
          trend: "down",
        },
      });
    }

    // Rule 2: 취약 과목인데 학습시간 비율이 10% 미만 → high priority
    const { weakSubjects, subjectStudyTime, totalStudyTime } = weakSubjectsData;
    for (const subject of weakSubjects) {
      const studyTime = subjectStudyTime.get(subject) || 0;
      const ratio = totalStudyTime > 0 ? (studyTime / totalStudyTime) * 100 : 0;

      if (ratio < 10) {
        suggestions.push({
          type: "weak_subject_neglected",
          priority: "high",
          subject,
          message: `취약 과목 ${subject}의 학습 비중이 ${Math.round(ratio)}%로 매우 낮습니다.`,
          actionRecommendation: `${subject}를 중점 과목으로 설정하여 플랜을 재생성하세요.`,
          metrics: {
            currentValue: Math.round(ratio),
            targetValue: 20,
            trend: "down",
          },
        });
      } else if (ratio < 15) {
        suggestions.push({
          type: "weak_subject_neglected",
          priority: "medium",
          subject,
          message: `취약 과목 ${subject}의 학습 비중이 ${Math.round(ratio)}%입니다.`,
          actionRecommendation: `${subject} 학습 비중을 15% 이상으로 늘리는 것을 권장합니다.`,
          metrics: {
            currentValue: Math.round(ratio),
            targetValue: 15,
            trend: "stable",
          },
        });
      }
    }

    // Rule 3: 플랜 실행률이 30% 미만 → high priority
    if (planStats.totalPlans > 5) {
      const completionRate = planStats.completedPlans / planStats.totalPlans * 100;

      if (completionRate < 30) {
        suggestions.push({
          type: "low_completion_rate",
          priority: "high",
          message: `플랜 실행률이 ${Math.round(completionRate)}%로 매우 낮습니다.`,
          actionRecommendation:
            "학습 분량을 줄이거나 학습 시간을 조정하여 플랜을 재생성하세요.",
          metrics: {
            currentValue: Math.round(completionRate),
            targetValue: 70,
            trend: "down",
          },
        });
      } else if (completionRate < 50) {
        suggestions.push({
          type: "low_completion_rate",
          priority: "medium",
          message: `플랜 실행률이 ${Math.round(completionRate)}%입니다.`,
          actionRecommendation:
            "플랜 일정 또는 학습량 조정을 고려해 보세요.",
          metrics: {
            currentValue: Math.round(completionRate),
            targetValue: 70,
            trend: "stable",
          },
        });
      }
    }

    // Rule 4: 과목별 플랜 실행률 불균형 → medium priority
    for (const [subject, stats] of Object.entries(planStats.subjectStats)) {
      if (stats.total >= 3) {
        const subjectRate = (stats.completed / stats.total) * 100;
        if (subjectRate < 40 && weakSubjects.includes(subject)) {
          suggestions.push({
            type: "schedule_mismatch",
            priority: "medium",
            subject,
            message: `취약 과목 ${subject}의 플랜 실행률이 ${Math.round(subjectRate)}%입니다.`,
            actionRecommendation: `${subject} 학습 시간대 또는 분량을 조정하여 플랜을 재생성하세요.`,
            metrics: {
              currentValue: Math.round(subjectRate),
              targetValue: 70,
            },
          });
        }
      }
    }

    // 전체 우선순위 계산
    const highPriorityCount = suggestions.filter((s) => s.priority === "high").length;
    const mediumPriorityCount = suggestions.filter((s) => s.priority === "medium").length;

    let overallPriority: "high" | "medium" | "low" | "none" = "none";
    if (highPriorityCount >= 2) {
      overallPriority = "high";
    } else if (highPriorityCount === 1 || mediumPriorityCount >= 2) {
      overallPriority = "medium";
    } else if (mediumPriorityCount === 1 || suggestions.length > 0) {
      overallPriority = "low";
    }

    // 요약 메시지 생성
    const summary = generateSummary(suggestions, overallPriority);

    return {
      shouldRegenerate: overallPriority !== "none" && overallPriority !== "low",
      overallPriority,
      suggestions,
      summary,
      analysisDate,
    };
  } catch (error) {
    console.error("[recommendations/planRegeneration] 분석 실패", error);
    return {
      shouldRegenerate: false,
      overallPriority: "none",
      suggestions: [],
      summary: "분석 중 오류가 발생했습니다.",
      analysisDate,
    };
  }
}

/**
 * 플랜 실행 통계 조회
 */
async function getPlanCompletionStats(
  supabase: SupabaseServerClient,
  studentId: string,
  planGroupId?: string
): Promise<{
  totalPlans: number;
  completedPlans: number;
  subjectStats: Record<string, { total: number; completed: number }>;
}> {
  try {
    // 최근 2주 범위
    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    const startStr = twoWeeksAgo.toISOString().slice(0, 10);
    const endStr = today.toISOString().slice(0, 10);

    // 플랜 조회 쿼리
    let query = supabase
      .from("student_plan")
      .select("id, content_type, content_id, completed_amount, plan_date")
      .gte("plan_date", startStr)
      .lte("plan_date", endStr);

    // planGroupId가 있으면 해당 그룹만 조회
    if (planGroupId) {
      query = query.eq("plan_group_id", planGroupId);
    }

    // RLS 우회 시도
    let { data: plans } = await query.eq("student_id", studentId);
    if (!plans) {
      ({ data: plans } = await query);
    }

    const planRows = (plans || []) as Array<{
      id: string;
      content_type: string | null;
      content_id: string | null;
      completed_amount: number | null;
      plan_date: string;
    }>;

    let totalPlans = 0;
    let completedPlans = 0;
    const subjectStats: Record<string, { total: number; completed: number }> = {};

    // 콘텐츠 ID별 과목 조회 (배치)
    const contentIds = new Set<string>();
    planRows.forEach((plan) => {
      if (plan.content_id && plan.content_type === "book") {
        contentIds.add(plan.content_id);
      }
    });

    // 책 정보 조회
    const bookSubjectMap = new Map<string, string>();
    if (contentIds.size > 0) {
      const { data: books } = await supabase
        .from("books")
        .select("id, subject")
        .in("id", Array.from(contentIds));

      (books || []).forEach((book: { id: string; subject: string | null }) => {
        if (book.subject) {
          bookSubjectMap.set(book.id, book.subject);
        }
      });
    }

    // 통계 계산
    for (const plan of planRows) {
      totalPlans++;
      const isCompleted = plan.completed_amount !== null && plan.completed_amount > 0;
      if (isCompleted) {
        completedPlans++;
      }

      // 과목별 통계
      if (plan.content_id && plan.content_type === "book") {
        const subject = bookSubjectMap.get(plan.content_id);
        if (subject) {
          if (!subjectStats[subject]) {
            subjectStats[subject] = { total: 0, completed: 0 };
          }
          subjectStats[subject].total++;
          if (isCompleted) {
            subjectStats[subject].completed++;
          }
        }
      }
    }

    return { totalPlans, completedPlans, subjectStats };
  } catch (error) {
    console.error("[recommendations/planRegeneration] 플랜 통계 조회 실패", error);
    return { totalPlans: 0, completedPlans: 0, subjectStats: {} };
  }
}

/**
 * 요약 메시지 생성
 */
function generateSummary(
  suggestions: RegenerationSuggestion[],
  priority: "high" | "medium" | "low" | "none"
): string {
  if (suggestions.length === 0) {
    return "현재 플랜 재생성이 필요하지 않습니다. 학습을 계속 진행하세요.";
  }

  const highCount = suggestions.filter((s) => s.priority === "high").length;
  const mediumCount = suggestions.filter((s) => s.priority === "medium").length;

  if (priority === "high") {
    const issues = [];
    if (suggestions.some((s) => s.type === "score_decline")) {
      issues.push("성적 하락");
    }
    if (suggestions.some((s) => s.type === "weak_subject_neglected")) {
      issues.push("취약 과목 학습 부족");
    }
    if (suggestions.some((s) => s.type === "low_completion_rate")) {
      issues.push("낮은 실행률");
    }

    return `플랜 재생성을 강력히 권장합니다. 주요 문제: ${issues.join(", ")}. (긴급 ${highCount}건, 주의 ${mediumCount}건)`;
  }

  if (priority === "medium") {
    return `플랜 조정을 고려해 보세요. (주의 ${mediumCount}건)`;
  }

  return `현재 플랜을 유지하되, 일부 개선 사항을 검토해 보세요. (참고 ${suggestions.length}건)`;
}

/**
 * 특정 플랜 그룹에 대한 재생성 필요 여부 간단 확인
 */
export async function shouldRegeneratePlanGroup(
  supabase: SupabaseServerClient,
  studentId: string,
  planGroupId: string
): Promise<{ shouldRegenerate: boolean; reason?: string }> {
  const analysis = await analyzePlanRegenerationNeed(supabase, studentId, planGroupId);

  if (analysis.shouldRegenerate) {
    const highPrioritySuggestion = analysis.suggestions.find(
      (s) => s.priority === "high"
    );
    return {
      shouldRegenerate: true,
      reason: highPrioritySuggestion?.message || analysis.summary,
    };
  }

  return { shouldRegenerate: false };
}
