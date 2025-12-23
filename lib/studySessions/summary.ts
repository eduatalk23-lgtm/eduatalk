import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionsByDateRange } from "./queries";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type TodayStudySummary = {
  totalSeconds: number;
  totalMinutes: number;
  bySubject: Record<string, number>; // subject -> seconds
};

export type WeekStudySummary = {
  totalSeconds: number;
  totalMinutes: number;
  byDay: Record<string, number>; // date -> seconds
  bySubject: Record<string, number>; // subject -> seconds
};

// 오늘 학습시간 요약
export async function getTodayStudySummary(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string
): Promise<TodayStudySummary> {
  try {
    const sessions = await getSessionsByDateRange(supabase, studentId, todayDate, todayDate);

    let totalSeconds = 0;
    const bySubject: Record<string, number> = {};

    // 세션별로 집계
    for (const session of sessions) {
      if (session.duration_seconds) {
        totalSeconds += session.duration_seconds;

        // 과목 정보 조회 (plan_id 또는 content_type/content_id를 통해)
        if (session.plan_id) {
          const subject = await getSubjectFromPlan(supabase, studentId, session.plan_id);
          if (subject) {
            bySubject[subject] = (bySubject[subject] || 0) + session.duration_seconds;
          }
        } else if (session.content_type && session.content_id) {
          const subject = await getSubjectFromContent(
            supabase,
            studentId,
            session.content_type,
            session.content_id
          );
          if (subject) {
            bySubject[subject] = (bySubject[subject] || 0) + session.duration_seconds;
          }
        }
      }
    }

    return {
      totalSeconds,
      totalMinutes: Math.floor(totalSeconds / 60),
      bySubject,
    };
  } catch (error) {
    console.error("[studySessions] 오늘 학습시간 요약 실패", error);
    return {
      totalSeconds: 0,
      totalMinutes: 0,
      bySubject: {},
    };
  }
}

// 이번 주 학습시간 요약
export async function getWeekStudySummary(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeekStudySummary> {
  try {
    const sessions = await getSessionsByDateRange(supabase, studentId, weekStart, weekEnd);

    let totalSeconds = 0;
    const byDay: Record<string, number> = {};
    const bySubject: Record<string, number> = {};

    // 세션별로 집계
    for (const session of sessions) {
      if (session.duration_seconds) {
        totalSeconds += session.duration_seconds;

        // 날짜별 집계
        const sessionDate = new Date(session.started_at).toISOString().slice(0, 10);
        byDay[sessionDate] = (byDay[sessionDate] || 0) + session.duration_seconds;

        // 과목별 집계
        if (session.plan_id) {
          const subject = await getSubjectFromPlan(supabase, studentId, session.plan_id);
          if (subject) {
            bySubject[subject] = (bySubject[subject] || 0) + session.duration_seconds;
          }
        } else if (session.content_type && session.content_id) {
          const subject = await getSubjectFromContent(
            supabase,
            studentId,
            session.content_type,
            session.content_id
          );
          if (subject) {
            bySubject[subject] = (bySubject[subject] || 0) + session.duration_seconds;
          }
        }
      }
    }

    return {
      totalSeconds,
      totalMinutes: Math.floor(totalSeconds / 60),
      byDay,
      bySubject,
    };
  } catch (error) {
    console.error("[studySessions] 주간 학습시간 요약 실패", error);
    return {
      totalSeconds: 0,
      totalMinutes: 0,
      byDay: {},
      bySubject: {},
    };
  }
}

// 플랜에서 과목 정보 가져오기
async function getSubjectFromPlan(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string
): Promise<string | null> {
  try {
    const selectPlan = () =>
      supabase
        .from("student_plan")
        .select("content_type,content_id")
        .eq("id", planId);

    let { data: plan, error } = await selectPlan().eq("student_id", studentId).maybeSingle();

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data: plan, error } = await selectPlan().maybeSingle());
    }

    if (error || !plan || !plan.content_type || !plan.content_id) {
      return null;
    }

    return await getSubjectFromContent(supabase, studentId, plan.content_type, plan.content_id);
  } catch (error) {
    console.error("[studySessions] 플랜 과목 조회 실패", error);
    return null;
  }
}

// 콘텐츠에서 과목 정보 가져오기
export async function getSubjectFromContent(
  supabase: SupabaseServerClient,
  studentId: string,
  contentType: string,
  contentId: string
): Promise<string | null> {
  try {
    const tableName =
      contentType === "book"
        ? "books"
        : contentType === "lecture"
        ? "lectures"
        : "student_custom_contents";

    const selectContent = () =>
      supabase.from(tableName).select("subject").eq("id", contentId);

    let { data, error } = await selectContent().eq("student_id", studentId).maybeSingle();

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data, error } = await selectContent().maybeSingle());
    }

    if (error || !data) {
      return null;
    }

    return (data as { subject: string | null }).subject ?? null;
  } catch (error) {
    console.error("[studySessions] 콘텐츠 과목 조회 실패", error);
    return null;
  }
}

