import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeakSubjects } from "@/lib/metrics/getWeakSubjects";
import { getScoreTrend } from "@/lib/metrics/getScoreTrend";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import { getSubjectFromContent } from "@/lib/studySessions/summary";
import { getActiveGoals } from "@/lib/goals/queries";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 과목별 집중 추천 생성
 * - 취약 과목 학습시간 비중 부족
 * - 성적 하락 과목
 * - 목표가 없는 취약 과목
 */
export async function getSubjectRecommendations(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<string[]> {
  const recommendations: string[] = [];

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

    // 최근 4주 범위 계산
    const fourWeeksAgo = new Date(weekStart);
    fourWeeksAgo.setDate(weekStart.getDate() - 21);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    // 데이터 조회
    const [weakSubjectsResult, scoreTrendResult, sessions, activeGoals] = await Promise.all([
      getWeakSubjects(supabase, { studentId, weekStart, weekEnd }),
      getScoreTrend(supabase, { studentId }),
      getSessionsByDateRange(supabase, studentId, fourWeeksAgoStr, weekEndStr),
      getActiveGoals(supabase, studentId, today.toISOString().slice(0, 10)),
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

    // 취약 과목별 학습시간 계산 (최근 4주)
    const subjectTimeMap = new Map<string, number>();
    const totalTime = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

    for (const session of sessions) {
      if (!session.duration_seconds) continue;

      let subject: string | null = null;
      if (session.plan_id) {
        const selectPlan = () =>
          supabase
            .from("student_plan")
            .select("content_type,content_id")
            .eq("id", session.plan_id);

        let { data: plan } = await selectPlan().eq("student_id", studentId).maybeSingle();
        if (!plan) {
          ({ data: plan } = await selectPlan().maybeSingle());
        }

        if (plan && plan.content_type && plan.content_id) {
          subject = await getSubjectFromContent(
            supabase,
            studentId,
            plan.content_type,
            plan.content_id
          );
        }
      } else if (session.content_type && session.content_id) {
        subject = await getSubjectFromContent(
          supabase,
          studentId,
          session.content_type,
          session.content_id
        );
      }

      if (subject) {
        const current = subjectTimeMap.get(subject) || 0;
        subjectTimeMap.set(subject, current + Math.floor(session.duration_seconds / 60));
      }
    }

    // Rule 1: 취약 과목인데 학습시간 비중 < 15%
    for (const subject of weakSubjectsData.weakSubjects) {
      const subjectTime = subjectTimeMap.get(subject) || 0;
      const subjectRatio = totalTime > 0 ? (subjectTime / (totalTime / 60)) * 100 : 0;

      if (subjectRatio < 15) {
        recommendations.push(
          `최근 4주 동안 ${subject} 학습시간이 전체의 ${Math.round(subjectRatio)}%에 불과합니다. ${subject} 학습 비중을 늘리길 권장합니다.`
        );
      }
    }

    // Rule 2: 성적 2회 연속 하락 → 추천
    for (const subject of scoreTrendData.decliningSubjects) {
      if (!weakSubjectsData.weakSubjects.includes(subject)) {
        recommendations.push(
          `${subject}는 최근 2회 연속 등급이 하락했습니다. ${subject}에 집중 학습이 필요합니다.`
        );
      }
    }

    // Rule 3: 취약 과목인데 목표가 없음
    const goalsBySubject = new Set(
      activeGoals
        .map((g) => g.subject)
        .filter((s): s is string => s !== null)
    );

    for (const subject of weakSubjectsData.weakSubjects) {
      if (!goalsBySubject.has(subject)) {
        recommendations.push(
          `${subject}는 취약 과목인데 목표가 설정되어 있지 않습니다. 단기 목표 설정을 권장합니다.`
        );
      }
    }

    // Rule 4: 플랜 실행률이 낮은 취약 과목
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("id,content_type,content_id,completed_amount")
        .gte("plan_date", weekStartStr)
        .lte("plan_date", weekEndStr);

    let { data: plans } = await selectPlans().eq("student_id", studentId);
    if (!plans) {
      ({ data: plans } = await selectPlans());
    }

    const planRows = (plans || []) as Array<{
      id: string;
      content_type: string | null;
      content_id: string | null;
      completed_amount: number | null;
    }>;

    // 과목별 플랜 실행률 계산
    const subjectPlanMap = new Map<string, { total: number; completed: number }>();

    for (const plan of planRows) {
      if (!plan.content_type || !plan.content_id) continue;

      const subject = await getSubjectFromContent(
        supabase,
        studentId,
        plan.content_type,
        plan.content_id
      );

      if (subject && weakSubjectsData.weakSubjects.includes(subject)) {
        const current = subjectPlanMap.get(subject) || { total: 0, completed: 0 };
        current.total += 1;
        if (plan.completed_amount !== null && plan.completed_amount > 0) {
          current.completed += 1;
        }
        subjectPlanMap.set(subject, current);
      }
    }

    for (const [subject, stats] of subjectPlanMap.entries()) {
      const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
      if (completionRate < 40) {
        recommendations.push(
          `${subject}의 이번주 플랜 실행률이 ${Math.round(completionRate)}%로 매우 낮습니다. ${subject} 학습 계획을 재검토하세요.`
        );
      }
    }

    return recommendations;
  } catch (error) {
    console.error("[recommendations/subject] 과목 추천 생성 실패", error);
    return [];
  }
}

