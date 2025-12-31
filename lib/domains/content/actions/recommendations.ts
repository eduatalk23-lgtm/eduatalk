"use server";

/**
 * Content Recommendations Actions
 *
 * 추천 마스터 콘텐츠 조회
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRecommendedMasterContents, RecommendedMasterContent } from "@/lib/recommendations/masterContentRecommendation";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";

/**
 * 추천 마스터 콘텐츠 조회 액션
 *
 * 학생 ID와 과목별 개수를 기반으로 추천 콘텐츠를 반환합니다.
 * RecommendedMasterContent를 그대로 반환합니다 (contentType 포함).
 */
export async function getRecommendedMasterContentsAction(
  studentId: string | undefined,
  subjects: string[],
  counts: Record<string, number>
): Promise<{ success: boolean; data?: { recommendations: RecommendedMasterContent[] }; error?: string }> {
  try {
    // studentId가 없으면 현재 사용자 ID 사용
    let targetStudentId = studentId;
    if (!targetStudentId || targetStudentId === "undefined") {
      const user = await getCurrentUser();
      if (!user) {
        return {
          success: false,
          error: "로그인이 필요합니다.",
        };
      }
      targetStudentId = user.userId;
    }

    logActionDebug(
      { domain: "content", action: "getRecommendedMasterContentsAction" },
      "호출",
      { studentId, targetStudentId, subjects, counts }
    );

    // Supabase 클라이언트 생성
    const supabase = await createSupabaseServerClient();

    // 학생 정보 조회 (tenant_id 필요)
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", targetStudentId)
      .maybeSingle();

    if (studentError) {
      logActionError(
        { domain: "content", action: "getRecommendedMasterContentsAction" },
        studentError,
        { message: "학생 조회 실패", targetStudentId }
      );
      return {
        success: false,
        error: "학생 정보를 조회할 수 없습니다.",
      };
    }

    if (!student) {
      return {
        success: false,
        error: "학생을 찾을 수 없습니다.",
      };
    }

    // 교과별 추천 개수를 Map으로 변환
    const subjectCounts = new Map<string, number>();
    subjects.forEach((subject) => {
      const count = counts[subject] || 1;
      subjectCounts.set(subject, count);
    });

    // 추천 콘텐츠 조회
    const recommendations = await getRecommendedMasterContents(
      supabase,
      targetStudentId,
      student.tenant_id || null,
      subjectCounts.size > 0 ? subjectCounts : undefined
    );

    logActionDebug(
      { domain: "content", action: "getRecommendedMasterContentsAction" },
      "성공",
      {
        recommendationsCount: recommendations.length,
        firstItem: recommendations[0] ? {
          id: recommendations[0].id,
          title: recommendations[0].title,
          contentType: recommendations[0].contentType,
          hasContentType: !!recommendations[0].contentType,
        } : null,
      }
    );

    // RecommendedMasterContent를 그대로 반환 (contentType 포함)
    // Step3ContentSelection에서 RecommendedContent로 변환
    return {
      success: true,
      data: {
        recommendations: recommendations,
      },
    };
  } catch (error) {
    logActionError(
      { domain: "content", action: "getRecommendedMasterContentsAction" },
      error,
      { message: "예외 발생" }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천 콘텐츠를 불러오는 데 실패했습니다.",
    };
  }
}

// ============================================
// 스마트 추천 시스템
// ============================================

/**
 * 스마트 추천 결과 타입
 */
export type SmartRecommendation = {
  type: "content" | "review" | "weakness" | "popular";
  priority: number; // 1-10 (높을수록 중요)
  title: string;
  description: string;
  content?: {
    id: string;
    name: string;
    type: "book" | "lecture" | "custom";
    subject?: string;
  };
  action?: {
    type: "create_plan" | "start_review" | "view_content";
    params: Record<string, string>;
  };
};

/**
 * 학습 인사이트 타입
 */
export type LearningInsight = {
  type: "streak" | "achievement" | "warning" | "suggestion";
  title: string;
  description: string;
  metric?: {
    current: number;
    target?: number;
    unit: string;
  };
  trend?: "up" | "down" | "stable";
};

/**
 * 스마트 추천 조회
 *
 * 학습 패턴을 분석하여 개인화된 추천을 제공합니다.
 */
export async function getSmartRecommendations(): Promise<{
  success: boolean;
  data?: {
    recommendations: SmartRecommendation[];
    insights: LearningInsight[];
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();
    const recommendations: SmartRecommendation[] = [];
    const insights: LearningInsight[] = [];

    // 1. 최근 학습 기록 분석
    const { data: recentPlans } = await supabase
      .from("student_plan")
      .select("*")
      .eq("student_id", user.userId)
      .order("plan_date", { ascending: false })
      .limit(100);

    if (!recentPlans || recentPlans.length === 0) {
      // 첫 사용자 - 시작 추천
      recommendations.push({
        type: "content",
        priority: 10,
        title: "첫 플랜을 시작해보세요!",
        description: "콘텐츠를 선택하고 학습 계획을 세워보세요.",
        action: {
          type: "create_plan",
          params: {},
        },
      });

      return { success: true, data: { recommendations, insights } };
    }

    // 2. 학습 연속성 분석 (스트릭)
    const today = new Date().toISOString().split("T")[0];
    const completedToday = recentPlans.filter(
      (p) => p.plan_date === today && p.status === "completed"
    );
    const completedYesterday = recentPlans.filter((p) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return (
        p.plan_date === yesterday.toISOString().split("T")[0] &&
        p.status === "completed"
      );
    });

    let streak = 0;
    const dateSet = new Set<string>();
    for (const plan of recentPlans) {
      if (plan.status === "completed") {
        dateSet.add(plan.plan_date);
      }
    }

    const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split("T")[0];
      if (sortedDates[i] === expectedStr) {
        streak++;
      } else {
        break;
      }
    }

    if (streak >= 3) {
      insights.push({
        type: "streak",
        title: `${streak}일 연속 학습 중! 🔥`,
        description: "꾸준히 학습하고 있어요. 계속 이어가세요!",
        metric: {
          current: streak,
          target: 7,
          unit: "일",
        },
        trend: "up",
      });
    }

    // 3. 복습 필요 콘텐츠 분석
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const needsReview = recentPlans.filter(
      (p) =>
        p.status === "completed" &&
        p.plan_date <= weekAgoStr &&
        p.plan_date > new Date(Date.now() - 14 * 86400000)
          .toISOString()
          .split("T")[0]
    );

    if (needsReview.length > 0) {
      const uniqueContents = new Map<
        string,
        { id: string; title: string; subject: string | null; type: string }
      >();
      for (const plan of needsReview) {
        if (plan.content_id && !uniqueContents.has(plan.content_id)) {
          uniqueContents.set(plan.content_id, {
            id: plan.content_id,
            title: plan.content_title || "콘텐츠",
            subject: plan.content_subject,
            type: plan.content_type || "book",
          });
        }
      }

      for (const content of Array.from(uniqueContents.values()).slice(0, 3)) {
        recommendations.push({
          type: "review",
          priority: 8,
          title: `"${content.title}" 복습 추천`,
          description: "일주일 전에 학습한 내용입니다. 복습하면 기억에 오래 남아요!",
          content: {
            id: content.id,
            name: content.title,
            type: content.type as "book" | "lecture" | "custom",
            subject: content.subject ?? undefined,
          },
          action: {
            type: "start_review",
            params: { contentId: content.id },
          },
        });
      }
    }

    // 4. 취약 과목 분석
    const subjectStats = new Map<
      string,
      { total: number; completed: number; avgDuration: number }
    >();

    for (const plan of recentPlans) {
      const subject = plan.content_subject || "기타";
      const stats = subjectStats.get(subject) || {
        total: 0,
        completed: 0,
        avgDuration: 0,
      };
      stats.total++;
      if (plan.status === "completed") {
        stats.completed++;
        stats.avgDuration += plan.actual_duration || 0;
      }
      subjectStats.set(subject, stats);
    }

    const weakSubjects: string[] = [];
    for (const [subject, stats] of subjectStats.entries()) {
      const completionRate = stats.completed / stats.total;
      if (completionRate < 0.7 && stats.total >= 5) {
        weakSubjects.push(subject);
      }
    }

    if (weakSubjects.length > 0) {
      insights.push({
        type: "warning",
        title: `${weakSubjects[0]} 과목에 더 집중해보세요`,
        description: `완료율이 낮은 과목입니다. 일정 조절이 필요할 수 있어요.`,
        trend: "down",
      });
    }

    // 5. 오늘 할 일 추천
    const todayPlans = recentPlans.filter((p) => p.plan_date === today);
    const pendingToday = todayPlans.filter((p) => p.status === "pending");

    if (pendingToday.length > 0) {
      insights.push({
        type: "suggestion",
        title: `오늘 ${pendingToday.length}개 플랜이 남아있어요`,
        description: completedToday.length > 0
          ? `${completedToday.length}개 완료! 조금만 더 힘내세요!`
          : "지금 시작해볼까요?",
        metric: {
          current: completedToday.length,
          target: todayPlans.length,
          unit: "개",
        },
      });
    }

    // 6. 성과 인사이트
    const thisWeekCompleted = recentPlans.filter((p) => {
      const planDate = new Date(p.plan_date);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return p.status === "completed" && planDate >= weekStart;
    }).length;

    if (thisWeekCompleted >= 10) {
      insights.push({
        type: "achievement",
        title: `이번 주 ${thisWeekCompleted}개 플랜 완료! 👏`,
        description: "훌륭한 한 주를 보내고 있어요!",
        metric: {
          current: thisWeekCompleted,
          unit: "개",
        },
        trend: "up",
      });
    }

    // 정렬: priority 높은 순
    recommendations.sort((a, b) => b.priority - a.priority);

    return {
      success: true,
      data: {
        recommendations: recommendations.slice(0, 5), // 최대 5개
        insights: insights.slice(0, 4), // 최대 4개
      },
    };
  } catch (error) {
    logActionError(
      { domain: "content", action: "getSmartRecommendations" },
      error,
      { message: "예외" }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천을 불러오는 데 실패했습니다.",
    };
  }
}

/**
 * 비슷한 학습자 추천 콘텐츠 조회
 *
 * 비슷한 학년/과목 조합의 학생들이 많이 학습하는 콘텐츠를 추천합니다.
 */
export async function getPopularContentRecommendations(
  subject?: string
): Promise<{
  success: boolean;
  data?: {
    contents: Array<{
      id: string;
      name: string;
      type: "book" | "lecture" | "custom";
      subject: string;
      learnerCount: number;
      averageRating: number;
    }>;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 최근 30일간 가장 많이 학습된 콘텐츠 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let query = supabase
      .from("student_plan")
      .select("content_id, content_title, content_type, content_subject")
      .eq("tenant_id", user.tenantId)
      .gte("plan_date", thirtyDaysAgo.toISOString().split("T")[0])
      .not("content_id", "is", null);

    if (subject) {
      query = query.eq("content_subject", subject);
    }

    const { data: plans } = await query;

    if (!plans || plans.length === 0) {
      return { success: true, data: { contents: [] } };
    }

    // 콘텐츠별 학습자 수 집계
    const contentStats = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        subject: string;
        learners: Set<string>;
      }
    >();

    for (const plan of plans) {
      if (!plan.content_id) continue;

      const existing = contentStats.get(plan.content_id);
      if (existing) {
        // 학습자 수 증가 (중복 제거는 Set으로)
        existing.learners.add(plan.content_id);
      } else {
        contentStats.set(plan.content_id, {
          id: plan.content_id,
          name: plan.content_title || "콘텐츠",
          type: plan.content_type || "book",
          subject: plan.content_subject || "기타",
          learners: new Set([plan.content_id]),
        });
      }
    }

    // 학습자 수 기준 정렬
    const sortedContents = Array.from(contentStats.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type as "book" | "lecture" | "custom",
        subject: c.subject,
        learnerCount: c.learners.size,
        averageRating: 4.0 + Math.random() * 0.9, // TODO: 실제 평점 시스템 연동
      }))
      .sort((a, b) => b.learnerCount - a.learnerCount)
      .slice(0, 10);

    return { success: true, data: { contents: sortedContents } };
  } catch (error) {
    logActionError(
      { domain: "content", action: "getPopularContentRecommendations" },
      error,
      { message: "예외" }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "인기 콘텐츠를 불러오는 데 실패했습니다.",
    };
  }
}
