/**
 * Learning Pattern Analysis Service
 *
 * 학생의 학습 패턴을 분석하여 AI 추천 및 플랜 최적화에 활용
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================================================
// Types
// ============================================================================

export type StudyTimeSlot =
  | "early_morning" // 05:00-08:00
  | "morning" // 08:00-12:00
  | "afternoon" // 12:00-17:00
  | "evening" // 17:00-21:00
  | "night"; // 21:00-24:00

export interface StudyTimeAnalysis {
  slot: StudyTimeSlot;
  sessionCount: number;
  totalMinutes: number;
  completionRate: number; // 0-100
  averageSessionLength: number; // minutes
}

export interface DayAnalysis {
  dayOfWeek: number; // 0=일, 6=토
  planCount: number;
  completedCount: number;
  completionRate: number; // 0-100
  averageProgress: number; // 0-100
}

export interface SubjectCompletionAnalysis {
  subject: string;
  planCount: number;
  completedCount: number;
  incompletedCount: number;
  completionRate: number;
}

export interface LearningPatternResult {
  studentId: string;
  analyzedAt: string;

  // 선호 학습 시간대
  preferredStudyTimes: StudyTimeSlot[];
  studyTimeAnalysis: StudyTimeAnalysis[];

  // 요일별 성과
  strongDays: number[];
  weakDays: number[];
  dayAnalysis: DayAnalysis[];

  // 미완료 과목 패턴
  frequentlyIncompleteSubjects: string[];
  subjectCompletionAnalysis: SubjectCompletionAnalysis[];

  // 종합 메트릭
  overallCompletionRate: number;
  averageDailyStudyMinutes: number;
  totalPlansAnalyzed: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTimeSlot(hour: number): StudyTimeSlot {
  if (hour >= 5 && hour < 8) return "early_morning";
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getTimeSlotLabel(slot: StudyTimeSlot): string {
  const labels: Record<StudyTimeSlot, string> = {
    early_morning: "이른 아침 (05-08시)",
    morning: "오전 (08-12시)",
    afternoon: "오후 (12-17시)",
    evening: "저녁 (17-21시)",
    night: "밤 (21-24시)",
  };
  return labels[slot];
}

function getDayLabel(day: number): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[day] ?? "";
}

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * 선호 학습 시간대 분석
 *
 * 학생의 플랜 완료 시간을 분석하여 가장 효과적인 학습 시간대를 파악
 */
export async function calculatePreferredStudyTimes(
  studentId: string,
  daysBack: number = 30
): Promise<{
  preferredStudyTimes: StudyTimeSlot[];
  studyTimeAnalysis: StudyTimeAnalysis[];
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // 완료된 플랜과 실제 학습 시간 조회
    const { data: plans, error } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        plan_date,
        status,
        progress,
        actual_start_time,
        actual_end_time,
        total_duration_seconds
      `
      )
      .eq("student_id", studentId)
      .gte("plan_date", cutoffDate.toISOString().split("T")[0])
      .not("actual_start_time", "is", null);

    if (error) throw error;

    const timeSlotStats: Record<
      StudyTimeSlot,
      {
        sessionCount: number;
        totalMinutes: number;
        completedCount: number;
      }
    > = {
      early_morning: { sessionCount: 0, totalMinutes: 0, completedCount: 0 },
      morning: { sessionCount: 0, totalMinutes: 0, completedCount: 0 },
      afternoon: { sessionCount: 0, totalMinutes: 0, completedCount: 0 },
      evening: { sessionCount: 0, totalMinutes: 0, completedCount: 0 },
      night: { sessionCount: 0, totalMinutes: 0, completedCount: 0 },
    };

    for (const plan of plans ?? []) {
      if (!plan.actual_start_time) continue;

      const startHour = new Date(plan.actual_start_time).getHours();
      const slot = getTimeSlot(startHour);
      const durationMinutes = (plan.total_duration_seconds ?? 0) / 60;

      timeSlotStats[slot].sessionCount++;
      timeSlotStats[slot].totalMinutes += durationMinutes;

      if (plan.status === "completed" || (plan.progress ?? 0) >= 80) {
        timeSlotStats[slot].completedCount++;
      }
    }

    const studyTimeAnalysis: StudyTimeAnalysis[] = Object.entries(
      timeSlotStats
    ).map(([slot, stats]) => ({
      slot: slot as StudyTimeSlot,
      sessionCount: stats.sessionCount,
      totalMinutes: Math.round(stats.totalMinutes),
      completionRate:
        stats.sessionCount > 0
          ? Math.round((stats.completedCount / stats.sessionCount) * 100)
          : 0,
      averageSessionLength:
        stats.sessionCount > 0
          ? Math.round(stats.totalMinutes / stats.sessionCount)
          : 0,
    }));

    // 완료율과 세션 수를 기준으로 선호 시간대 결정
    const preferredStudyTimes = studyTimeAnalysis
      .filter((s) => s.sessionCount >= 3 && s.completionRate >= 60)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 2)
      .map((s) => s.slot);

    return { preferredStudyTimes, studyTimeAnalysis };
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "calculatePreferredStudyTimes" },
      error,
      { studentId, daysBack }
    );
    return { preferredStudyTimes: [], studyTimeAnalysis: [] };
  }
}

/**
 * 요일별 성과 분석
 *
 * 각 요일별 플랜 완료율을 분석하여 강한/약한 요일 파악
 */
export async function analyzeStrongWeakDays(
  studentId: string,
  daysBack: number = 30
): Promise<{
  strongDays: number[];
  weakDays: number[];
  dayAnalysis: DayAnalysis[];
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const { data: plans, error } = await supabase
      .from("student_plan")
      .select("id, plan_date, status, progress")
      .eq("student_id", studentId)
      .gte("plan_date", cutoffDate.toISOString().split("T")[0]);

    if (error) throw error;

    const dayStats: Record<
      number,
      {
        planCount: number;
        completedCount: number;
        totalProgress: number;
      }
    > = {};

    // 0-6 초기화
    for (let i = 0; i < 7; i++) {
      dayStats[i] = { planCount: 0, completedCount: 0, totalProgress: 0 };
    }

    for (const plan of plans ?? []) {
      if (!plan.plan_date) continue;

      const dayOfWeek = new Date(plan.plan_date).getDay();
      dayStats[dayOfWeek].planCount++;
      dayStats[dayOfWeek].totalProgress += plan.progress ?? 0;

      if (plan.status === "completed" || (plan.progress ?? 0) >= 80) {
        dayStats[dayOfWeek].completedCount++;
      }
    }

    const dayAnalysis: DayAnalysis[] = Object.entries(dayStats).map(
      ([day, stats]) => ({
        dayOfWeek: parseInt(day),
        planCount: stats.planCount,
        completedCount: stats.completedCount,
        completionRate:
          stats.planCount > 0
            ? Math.round((stats.completedCount / stats.planCount) * 100)
            : 0,
        averageProgress:
          stats.planCount > 0
            ? Math.round(stats.totalProgress / stats.planCount)
            : 0,
      })
    );

    // 충분한 데이터가 있는 요일만 분석
    const validDays = dayAnalysis.filter((d) => d.planCount >= 3);

    // 강한 요일: 완료율 70% 이상
    const strongDays = validDays
      .filter((d) => d.completionRate >= 70)
      .sort((a, b) => b.completionRate - a.completionRate)
      .map((d) => d.dayOfWeek);

    // 약한 요일: 완료율 50% 미만
    const weakDays = validDays
      .filter((d) => d.completionRate < 50)
      .sort((a, b) => a.completionRate - b.completionRate)
      .map((d) => d.dayOfWeek);

    return { strongDays, weakDays, dayAnalysis };
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "analyzeStrongWeakDays" },
      error,
      { studentId, daysBack }
    );
    return { strongDays: [], weakDays: [], dayAnalysis: [] };
  }
}

/**
 * 자주 미완료되는 과목 분석
 *
 * 과목별 플랜 완료율을 분석하여 취약 과목 패턴 파악
 */
export async function findFrequentlyIncompleteSubjects(
  studentId: string,
  daysBack: number = 60
): Promise<{
  frequentlyIncompleteSubjects: string[];
  subjectCompletionAnalysis: SubjectCompletionAnalysis[];
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // 플랜과 관련 콘텐츠 정보 조회
    const { data: plans, error } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        plan_date,
        status,
        progress,
        content_type,
        content_id
      `
      )
      .eq("student_id", studentId)
      .gte("plan_date", cutoffDate.toISOString().split("T")[0]);

    if (error) throw error;

    // 콘텐츠 ID별 과목 매핑
    const contentIds = [
      ...new Set((plans ?? []).map((p) => p.content_id).filter(Boolean)),
    ];

    if (contentIds.length === 0) {
      return {
        frequentlyIncompleteSubjects: [],
        subjectCompletionAnalysis: [],
      };
    }

    // 책과 강의의 과목 정보 조회
    const [booksResult, lecturesResult] = await Promise.all([
      supabase.from("books").select("id, subject").in("id", contentIds),
      supabase.from("lectures").select("id, subject").in("id", contentIds),
    ]);

    const contentSubjectMap: Record<string, string> = {};

    for (const book of booksResult.data ?? []) {
      if (book.subject) {
        contentSubjectMap[book.id] = book.subject;
      }
    }

    for (const lecture of lecturesResult.data ?? []) {
      if (lecture.subject) {
        contentSubjectMap[lecture.id] = lecture.subject;
      }
    }

    // 과목별 통계 집계
    const subjectStats: Record<
      string,
      {
        planCount: number;
        completedCount: number;
        incompletedCount: number;
      }
    > = {};

    for (const plan of plans ?? []) {
      const subject = plan.content_id
        ? contentSubjectMap[plan.content_id]
        : null;
      if (!subject) continue;

      if (!subjectStats[subject]) {
        subjectStats[subject] = {
          planCount: 0,
          completedCount: 0,
          incompletedCount: 0,
        };
      }

      subjectStats[subject].planCount++;

      const isCompleted =
        plan.status === "completed" || (plan.progress ?? 0) >= 80;
      if (isCompleted) {
        subjectStats[subject].completedCount++;
      } else if (
        plan.status === "cancelled" ||
        plan.status === "skipped" ||
        (plan.progress ?? 0) < 50
      ) {
        subjectStats[subject].incompletedCount++;
      }
    }

    const subjectCompletionAnalysis: SubjectCompletionAnalysis[] =
      Object.entries(subjectStats).map(([subject, stats]) => ({
        subject,
        planCount: stats.planCount,
        completedCount: stats.completedCount,
        incompletedCount: stats.incompletedCount,
        completionRate:
          stats.planCount > 0
            ? Math.round((stats.completedCount / stats.planCount) * 100)
            : 0,
      }));

    // 자주 미완료되는 과목: 완료율 50% 미만이고 미완료 3개 이상
    const frequentlyIncompleteSubjects = subjectCompletionAnalysis
      .filter((s) => s.completionRate < 50 && s.incompletedCount >= 3)
      .sort((a, b) => a.completionRate - b.completionRate)
      .map((s) => s.subject);

    return { frequentlyIncompleteSubjects, subjectCompletionAnalysis };
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "findFrequentlyIncompleteSubjects" },
      error,
      { studentId, daysBack }
    );
    return { frequentlyIncompleteSubjects: [], subjectCompletionAnalysis: [] };
  }
}

/**
 * 종합 학습 패턴 분석
 *
 * 모든 분석 함수를 호출하여 종합 결과 반환
 */
export async function analyzeLearningPatterns(
  studentId: string,
  daysBack: number = 30
): Promise<LearningPatternResult> {
  const [timeAnalysis, dayAnalysis, subjectAnalysis] = await Promise.all([
    calculatePreferredStudyTimes(studentId, daysBack),
    analyzeStrongWeakDays(studentId, daysBack),
    findFrequentlyIncompleteSubjects(studentId, daysBack * 2), // 과목은 더 긴 기간 분석
  ]);

  // 종합 메트릭 계산
  const totalPlansAnalyzed = dayAnalysis.dayAnalysis.reduce(
    (sum, d) => sum + d.planCount,
    0
  );
  const totalCompleted = dayAnalysis.dayAnalysis.reduce(
    (sum, d) => sum + d.completedCount,
    0
  );
  const overallCompletionRate =
    totalPlansAnalyzed > 0
      ? Math.round((totalCompleted / totalPlansAnalyzed) * 100)
      : 0;

  const totalStudyMinutes = timeAnalysis.studyTimeAnalysis.reduce(
    (sum, s) => sum + s.totalMinutes,
    0
  );
  const averageDailyStudyMinutes =
    daysBack > 0 ? Math.round(totalStudyMinutes / daysBack) : 0;

  return {
    studentId,
    analyzedAt: new Date().toISOString(),
    preferredStudyTimes: timeAnalysis.preferredStudyTimes,
    studyTimeAnalysis: timeAnalysis.studyTimeAnalysis,
    strongDays: dayAnalysis.strongDays,
    weakDays: dayAnalysis.weakDays,
    dayAnalysis: dayAnalysis.dayAnalysis,
    frequentlyIncompleteSubjects: subjectAnalysis.frequentlyIncompleteSubjects,
    subjectCompletionAnalysis: subjectAnalysis.subjectCompletionAnalysis,
    overallCompletionRate,
    averageDailyStudyMinutes,
    totalPlansAnalyzed,
  };
}

/**
 * 학습 패턴 결과를 DB에 저장
 */
export async function saveLearningPatterns(
  studentId: string,
  patterns: LearningPatternResult
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    // student의 tenant_id 조회
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();

    if (!student?.tenant_id) {
      throw new Error("Student not found or missing tenant_id");
    }

    // 기존 데이터 삭제 (upsert 대신 delete + insert)
    await supabase
      .from("student_learning_patterns")
      .delete()
      .eq("student_id", studentId);

    // 새 데이터 삽입
    const { error } = await supabase
      .from("student_learning_patterns")
      .insert({
        student_id: studentId,
        tenant_id: student.tenant_id,
        preferred_study_times: patterns.preferredStudyTimes,
        strong_days: patterns.strongDays,
        weak_days: patterns.weakDays,
        frequently_incomplete_subjects: patterns.frequentlyIncompleteSubjects,
        overall_completion_rate: patterns.overallCompletionRate,
        average_daily_study_minutes: patterns.averageDailyStudyMinutes,
        total_plans_analyzed: patterns.totalPlansAnalyzed,
        study_time_analysis: patterns.studyTimeAnalysis,
        day_analysis: patterns.dayAnalysis,
        subject_completion_analysis: patterns.subjectCompletionAnalysis,
        calculated_at: patterns.analyzedAt,
      });

    if (error) throw error;
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "saveLearningPatterns" },
      error,
      { studentId }
    );
    // 저장 실패해도 분석 결과는 반환됨
  }
}

// ============================================================================
// Export utilities
// ============================================================================

export { getTimeSlotLabel, getDayLabel };
