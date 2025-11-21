import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlansForStudent } from "@/lib/data/studentPlans";
import { getBooks, getLectures, getCustomContents } from "@/lib/data/studentContents";
import { getSessionsInRange } from "@/lib/data/studentSessions";
import { getGoalsForStudent } from "@/lib/data/studentGoals";
import { getWeeklyStudyTimeSummary, getWeeklyPlanSummary } from "@/lib/reports/weekly";
import { getMonthlyReportData } from "@/lib/reports/monthly";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 관리자용: 학생의 플랜 목록 조회
 */
export async function getStudentPlansForAdmin(
  studentId: string,
  dateRange?: { start: string; end: string }
) {
  try {
    const filters: Parameters<typeof getPlansForStudent>[0] = {
      studentId,
      tenantId: null,
    };

    if (dateRange) {
      filters.dateRange = dateRange;
    }

    return await getPlansForStudent(filters);
  } catch (error) {
    console.error("[admin/studentData] 플랜 조회 실패", error);
    return [];
  }
}

/**
 * 관리자용: 학생의 학습시간 조회
 */
export async function getStudentStudyTimeForAdmin(
  studentId: string,
  dateRange: { start: Date; end: Date }
) {
  try {
    const supabase = await createSupabaseServerClient();
    return await getWeeklyStudyTimeSummary(supabase, studentId, dateRange.start, dateRange.end);
  } catch (error) {
    console.error("[admin/studentData] 학습시간 조회 실패", error);
    return {
      totalSeconds: 0,
      totalMinutes: 0,
      totalHours: 0,
      byDay: [],
      bySubject: [],
      byContentType: [],
    };
  }
}

/**
 * 관리자용: 학생의 콘텐츠 사용 현황 조회
 */
export async function getStudentContentUsageForAdmin(studentId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const [books, lectures, customContents] = await Promise.allSettled([
      getBooks(studentId, null),
      getLectures(studentId, null),
      getCustomContents(studentId, null),
    ]);

    // 진행률 조회
    const { data: progressData, error: progressError } = await supabase
      .from("student_content_progress")
      .select("content_type,content_id,progress,completed_amount")
      .eq("student_id", studentId);

    const progressMap = new Map<string, { progress: number; completedAmount: number }>();
    if (!progressError && progressData) {
      progressData.forEach((p) => {
        if (p.content_type && p.content_id) {
          const key = `${p.content_type}:${p.content_id}`;
          progressMap.set(key, {
            progress: p.progress ?? 0,
            completedAmount: p.completed_amount ?? 0,
          });
        }
      });
    }

    return {
      books: books.status === "fulfilled" ? books.value : [],
      lectures: lectures.status === "fulfilled" ? lectures.value : [],
      customContents: customContents.status === "fulfilled" ? customContents.value : [],
      progressMap,
    };
  } catch (error) {
    console.error("[admin/studentData] 콘텐츠 사용 현황 조회 실패", error);
    return {
      books: [],
      lectures: [],
      customContents: [],
      progressMap: new Map(),
    };
  }
}

/**
 * 관리자용: 학생의 성적 변화 조회
 */
export async function getStudentScoreTrendForAdmin(studentId: string) {
  try {
    const supabase = await createSupabaseServerClient();

    // 내신 성적 조회
    const { data: schoolScores, error: schoolError } = await supabase
      .from("student_school_scores")
      .select("id,grade,semester,subject_name,grade_score,test_date")
      .eq("student_id", studentId)
      .order("test_date", { ascending: true });

    // 모의고사 성적 조회
    const { data: mockScores, error: mockError } = await supabase
      .from("student_mock_scores")
      .select("id,grade,subject_name,grade_score,test_date,exam_type")
      .eq("student_id", studentId)
      .order("test_date", { ascending: true });

    return {
      schoolScores: schoolError ? [] : (schoolScores ?? []),
      mockScores: mockError ? [] : (mockScores ?? []),
    };
  } catch (error) {
    console.error("[admin/studentData] 성적 변화 조회 실패", error);
    return {
      schoolScores: [],
      mockScores: [],
    };
  }
}

/**
 * 관리자용: 학생의 분석 리포트 조회
 */
export async function getStudentAnalysisForAdmin(studentId: string) {
  try {
    const supabase = await createSupabaseServerClient();

    // 이번 주 날짜 범위
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // 이번 달 날짜 범위
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const [weeklyStudyTime, weeklyPlanSummary, monthlyReport] = await Promise.allSettled([
      getWeeklyStudyTimeSummary(supabase, studentId, weekStart, weekEnd),
      getWeeklyPlanSummary(supabase, studentId, weekStart, weekEnd),
      getMonthlyReportData(supabase, studentId, today),
    ]);

    // 위험 분석 조회
    const { data: riskAnalysis, error: riskError } = await supabase
      .from("student_analysis")
      .select("subject,risk_score,recent_grade_trend,consistency_score,mastery_estimate")
      .eq("student_id", studentId)
      .order("risk_score", { ascending: false });

    return {
      weeklyStudyTime:
        weeklyStudyTime.status === "fulfilled" ? weeklyStudyTime.value : null,
      weeklyPlanSummary:
        weeklyPlanSummary.status === "fulfilled" ? weeklyPlanSummary.value : null,
      monthlyReport: monthlyReport.status === "fulfilled" ? monthlyReport.value : null,
      riskAnalysis: riskError ? [] : (riskAnalysis ?? []),
    };
  } catch (error) {
    console.error("[admin/studentData] 분석 리포트 조회 실패", error);
    return {
      weeklyStudyTime: null,
      weeklyPlanSummary: null,
      monthlyReport: null,
      riskAnalysis: [],
    };
  }
}

