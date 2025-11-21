import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import { getSubjectFromContent } from "@/lib/studySessions/summary";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type WeakSubjectMetrics = {
  weakSubjects: string[]; // 취약 과목 목록
  subjectStudyTime: Map<string, number>; // 과목별 학습시간 (분)
  totalStudyTime: number; // 전체 학습시간 (분)
  weakSubjectStudyTimeRatio: number; // 취약 과목 학습시간 비율 (0-100)
};

/**
 * 취약 과목 메트릭 조회
 */
export async function getWeakSubjects(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeakSubjectMetrics> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    // 이번 주 세션 조회
    const sessions = await getSessionsByDateRange(
      supabase,
      studentId,
      weekStartStr,
      weekEndStr
    );

    // 과목별 학습시간 계산
    const subjectTimeMap = new Map<string, number>();

    for (const session of sessions) {
      if (!session.duration_seconds) continue;

      let subject: string | null = null;
      if (session.plan_id) {
        // 플랜 정보 조회
        const selectPlan = () =>
          supabase
            .from("student_plan")
            .select("content_type,content_id")
            .eq("id", session.plan_id);

        let { data: plan, error } = await selectPlan().eq("student_id", studentId).maybeSingle();

        if (error && error.code === "42703") {
          ({ data: plan, error } = await selectPlan().maybeSingle());
        }

        if (!error && plan && plan.content_type && plan.content_id) {
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

    // 취약 과목 조회 (student_analysis 테이블)
    const selectAnalysis = () =>
      supabase
        .from("student_analysis")
        .select("subject,risk_score")
        .order("risk_score", { ascending: false });

    let { data: analyses, error } = await selectAnalysis().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: analyses, error } = await selectAnalysis());
    }

    const analysisRows = (analyses as Array<{
      subject?: string | null;
      risk_score?: number | null;
    }> | null) ?? [];

    // 위험도가 높은 과목을 취약 과목으로 간주 (risk_score >= 50)
    const weakSubjects = analysisRows
      .filter((a) => a.subject && a.risk_score !== null && a.risk_score !== undefined && a.risk_score >= 50)
      .map((a) => a.subject!);

    // 전체 학습시간 계산
    const totalStudyTime = Array.from(subjectTimeMap.values()).reduce(
      (sum, minutes) => sum + minutes,
      0
    );

    // 취약 과목 학습시간 합계
    const weakSubjectStudyTime = weakSubjects.reduce(
      (sum, subject) => sum + (subjectTimeMap.get(subject) || 0),
      0
    );

    // 취약 과목 학습시간 비율
    const weakSubjectStudyTimeRatio =
      totalStudyTime > 0 ? Math.round((weakSubjectStudyTime / totalStudyTime) * 100) : 0;

    return {
      weakSubjects,
      subjectStudyTime: subjectTimeMap,
      totalStudyTime,
      weakSubjectStudyTimeRatio,
    };
  } catch (error) {
    console.error("[metrics/getWeakSubjects] 취약 과목 조회 실패", error);
    return {
      weakSubjects: [],
      subjectStudyTime: new Map(),
      totalStudyTime: 0,
      weakSubjectStudyTimeRatio: 0,
    };
  }
}

