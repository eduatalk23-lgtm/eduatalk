"use server";

/**
 * 플랜 최적화 AI 서버 액션
 *
 * 학생의 플랜 실행 데이터를 분석하여 효율성 점수와 개선 제안을 제공합니다.
 * 관리자가 학생의 학습 패턴을 파악하고 플랜을 최적화할 때 사용됩니다.
 *
 * @module optimizePlan
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

import { createMessage, extractJSON, estimateCost } from "../client";
import {
  PLAN_OPTIMIZATION_SYSTEM_PROMPT,
  buildPlanOptimizationPrompt,
  estimatePlanOptimizationTokens,
  type PlanOptimizationRequest,
  type PlanOptimizationResponse,
  type StudentBasicInfo,
  type PlanExecutionStats,
  type TimeSlotPerformance,
  type DayOfWeekPerformance,
  type SubjectPerformance,
  type LearningPatternData,
  type IncompletePattern,
} from "../prompts/planOptimization";

import type { ModelTier } from "../types";

// ============================================
// 타입 정의
// ============================================

export interface OptimizePlanInput {
  /** 학생 ID */
  studentId: string;
  /** 분석 기간 (일) - 기본값: 30 */
  analysisDays?: number;
  /** 플랜 그룹 ID (특정 그룹만 분석할 경우) */
  planGroupId?: string;
  /** 추가 지시사항 */
  additionalInstructions?: string;
  /** 모델 티어 (기본값: fast) */
  modelTier?: ModelTier;
}

export interface OptimizePlanResult {
  success: boolean;
  data?: {
    analysis: PlanOptimizationResponse;
    inputData: {
      executionStats: PlanExecutionStats;
      analysisPeriod: string;
    };
    cost: {
      inputTokens: number;
      outputTokens: number;
      estimatedUSD: number;
    };
  };
  error?: string;
}

// ============================================
// 데이터 수집 함수
// ============================================

async function loadStudentBasicInfo(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<StudentBasicInfo | null> {
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, target_university, target_major")
    .eq("id", studentId)
    .single();

  if (!student) return null;

  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    targetUniversity: student.target_university ?? undefined,
    targetMajor: student.target_major ?? undefined,
  };
}

async function loadPlanExecutionData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  startDate: Date,
  planGroupId?: string
) {
  let query = supabase
    .from("student_plan")
    .select(`
      id,
      plan_date,
      start_time,
      end_time,
      subject,
      subject_category,
      status,
      progress,
      estimated_minutes,
      actual_minutes
    `)
    .eq("student_id", studentId)
    .gte("plan_date", startDate.toISOString().split("T")[0])
    .order("plan_date", { ascending: true });

  if (planGroupId) {
    query = query.eq("plan_group_id", planGroupId);
  }

  const { data: plans } = await query;
  return plans || [];
}

function calculateExecutionStats(
  plans: Array<{
    status: string | null;
    progress: number | null;
  }>
): PlanExecutionStats {
  const totalPlans = plans.length;
  const completedPlans = plans.filter((p) => p.status === "completed").length;
  const skippedPlans = plans.filter((p) => p.status === "skipped").length;
  const incompletePlans = totalPlans - completedPlans - skippedPlans;

  const overallCompletionRate =
    totalPlans > 0 ? (completedPlans / totalPlans) * 100 : 0;
  const averageProgress =
    totalPlans > 0
      ? plans.reduce((sum, p) => sum + (p.progress || 0), 0) / totalPlans
      : 0;

  return {
    totalPlans,
    completedPlans,
    incompletePlans,
    skippedPlans,
    overallCompletionRate,
    averageProgress,
  };
}

function getTimeSlot(startTime: string | null): TimeSlotPerformance["timeSlot"] {
  if (!startTime) return "morning";

  const hour = parseInt(startTime.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function calculateTimeSlotPerformance(
  plans: Array<{
    start_time: string | null;
    status: string | null;
    progress: number | null;
  }>
): TimeSlotPerformance[] {
  const slots: Record<
    TimeSlotPerformance["timeSlot"],
    { count: number; completed: number; progressSum: number }
  > = {
    morning: { count: 0, completed: 0, progressSum: 0 },
    afternoon: { count: 0, completed: 0, progressSum: 0 },
    evening: { count: 0, completed: 0, progressSum: 0 },
    night: { count: 0, completed: 0, progressSum: 0 },
  };

  plans.forEach((p) => {
    const slot = getTimeSlot(p.start_time);
    slots[slot].count++;
    if (p.status === "completed") slots[slot].completed++;
    slots[slot].progressSum += p.progress || 0;
  });

  return (
    Object.entries(slots) as [TimeSlotPerformance["timeSlot"], typeof slots.morning][]
  )
    .filter(([, data]) => data.count > 0)
    .map(([timeSlot, data]) => ({
      timeSlot,
      planCount: data.count,
      completionRate: (data.completed / data.count) * 100,
      averageProgress: data.progressSum / data.count,
    }));
}

function calculateDayOfWeekPerformance(
  plans: Array<{
    plan_date: string;
    status: string | null;
    progress: number | null;
  }>
): DayOfWeekPerformance[] {
  const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const days: Record<
    number,
    { count: number; completed: number; progressSum: number }
  > = {};

  for (let i = 0; i < 7; i++) {
    days[i] = { count: 0, completed: 0, progressSum: 0 };
  }

  plans.forEach((p) => {
    const dayOfWeek = new Date(p.plan_date).getDay();
    days[dayOfWeek].count++;
    if (p.status === "completed") days[dayOfWeek].completed++;
    days[dayOfWeek].progressSum += p.progress || 0;
  });

  return Object.entries(days)
    .filter(([, data]) => data.count > 0)
    .map(([day, data]) => ({
      dayOfWeek: parseInt(day),
      dayName: dayNames[parseInt(day)],
      planCount: data.count,
      completionRate: (data.completed / data.count) * 100,
      averageProgress: data.progressSum / data.count,
    }));
}

function calculateSubjectPerformance(
  plans: Array<{
    subject: string | null;
    subject_category: string | null;
    status: string | null;
    progress: number | null;
    estimated_minutes: number | null;
  }>
): SubjectPerformance[] {
  const subjects: Record<
    string,
    {
      category: string;
      count: number;
      completed: number;
      progressSum: number;
      totalMinutes: number;
    }
  > = {};

  plans.forEach((p) => {
    const subject = p.subject || "기타";
    const category = p.subject_category || "기타";
    const key = `${category}:${subject}`;

    if (!subjects[key]) {
      subjects[key] = {
        category,
        count: 0,
        completed: 0,
        progressSum: 0,
        totalMinutes: 0,
      };
    }

    subjects[key].count++;
    if (p.status === "completed") subjects[key].completed++;
    subjects[key].progressSum += p.progress || 0;
    subjects[key].totalMinutes += p.estimated_minutes || 0;
  });

  return Object.entries(subjects).map(([key, data]) => {
    const [, subject] = key.split(":");
    return {
      subject,
      subjectCategory: data.category,
      planCount: data.count,
      completionRate: (data.completed / data.count) * 100,
      averageProgress: data.progressSum / data.count,
      totalMinutes: data.totalMinutes,
      avgMinutesPerPlan: data.totalMinutes / data.count,
    };
  });
}

function calculateLearningPattern(
  plans: Array<{
    plan_date: string;
    estimated_minutes: number | null;
    status: string | null;
  }>,
  totalDays: number
): LearningPatternData {
  // 날짜별 학습 시간 집계
  const dailyMinutes: Record<string, number> = {};
  plans.forEach((p) => {
    if (!dailyMinutes[p.plan_date]) {
      dailyMinutes[p.plan_date] = 0;
    }
    if (p.status === "completed" || p.status === "in_progress") {
      dailyMinutes[p.plan_date] += p.estimated_minutes || 0;
    }
  });

  const activeDates = Object.keys(dailyMinutes).sort();
  const activeDays = activeDates.length;

  const minutesArray = Object.values(dailyMinutes);
  const avgDailyMinutes =
    minutesArray.length > 0
      ? Math.round(
          minutesArray.reduce((a, b) => a + b, 0) / minutesArray.length
        )
      : 0;
  const maxDailyMinutes =
    minutesArray.length > 0 ? Math.max(...minutesArray) : 0;

  // 연속 학습 일수 계산
  let maxStreak = 0;
  let currentStreak = 0;

  if (activeDates.length > 0) {
    currentStreak = 1;
    maxStreak = 1;

    for (let i = 1; i < activeDates.length; i++) {
      const prevDate = new Date(activeDates[i - 1]);
      const currDate = new Date(activeDates[i]);
      const diffDays = Math.round(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    // 마지막 날짜가 오늘이 아니면 currentStreak 리셋
    const lastDate = new Date(activeDates[activeDates.length - 1]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);

    const diffFromToday = Math.round(
      (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffFromToday > 1) {
      currentStreak = 0;
    }
  }

  return {
    avgDailyMinutes,
    maxDailyMinutes,
    activeDays,
    totalDays,
    maxStreak,
    currentStreak,
  };
}

function calculateIncompletePattern(
  plans: Array<{
    plan_date: string;
    start_time: string | null;
    subject: string | null;
    status: string | null;
  }>
): IncompletePattern {
  const incompletePlans = plans.filter(
    (p) => p.status !== "completed" && p.status !== "skipped"
  );

  // 과목별 미완료 횟수
  const subjectCount: Record<string, number> = {};
  // 시간대별 미완료 횟수
  const timeSlotCount: Record<string, number> = {};
  // 요일별 미완료 횟수
  const dayCount: Record<string, number> = {};
  const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const timeSlotLabels: Record<string, string> = {
    morning: "오전",
    afternoon: "오후",
    evening: "저녁",
    night: "밤",
  };

  incompletePlans.forEach((p) => {
    const subject = p.subject || "기타";
    subjectCount[subject] = (subjectCount[subject] || 0) + 1;

    const slot = timeSlotLabels[getTimeSlot(p.start_time)];
    timeSlotCount[slot] = (timeSlotCount[slot] || 0) + 1;

    const day = dayNames[new Date(p.plan_date).getDay()];
    dayCount[day] = (dayCount[day] || 0) + 1;
  });

  // 상위 항목 추출
  const getTop = (counts: Record<string, number>, limit: number) =>
    Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .filter(([, count]) => count >= 2)
      .map(([key]) => key);

  // 추정 원인 분석
  const likelyReasons: string[] = [];
  const topSubjects = getTop(subjectCount, 2);
  const topTimeSlots = getTop(timeSlotCount, 2);
  const topDays = getTop(dayCount, 2);

  if (topTimeSlots.includes("밤")) {
    likelyReasons.push("늦은 시간 피로 누적");
  }
  if (topDays.includes("금요일") || topDays.includes("토요일")) {
    likelyReasons.push("주말 전후 집중력 저하");
  }
  if (topSubjects.length > 0) {
    likelyReasons.push(`${topSubjects[0]} 과목 동기 부족 가능성`);
  }

  return {
    frequentlyIncompleteSubjects: getTop(subjectCount, 3),
    frequentlyIncompleteTimeSlots: getTop(timeSlotCount, 2),
    frequentlyIncompleteDays: getTop(dayCount, 2),
    likelyReasons,
  };
}

// ============================================
// 메인 액션
// ============================================

/**
 * AI를 사용하여 학생의 플랜 효율성을 분석하고 개선 제안을 생성합니다
 *
 * @param {OptimizePlanInput} input - 최적화 분석 입력
 * @returns {Promise<OptimizePlanResult>} 분석 결과
 *
 * @example
 * ```typescript
 * const result = await analyzePlanEfficiency({
 *   studentId: 'student-uuid',
 *   analysisDays: 30,
 * });
 *
 * if (result.success) {
 *   console.log(`효율성 점수: ${result.data.analysis.efficiencyScore}`);
 *   result.data.analysis.suggestions.forEach((s) => {
 *     console.log(`[${s.priority}] ${s.title}`);
 *   });
 * }
 * ```
 */
export async function analyzePlanEfficiency(
  input: OptimizePlanInput
): Promise<OptimizePlanResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    // 1. 학생 정보 로드
    const studentInfo = await loadStudentBasicInfo(supabase, input.studentId);
    if (!studentInfo) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    // 2. 분석 기간 설정
    const analysisDays = input.analysisDays || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - analysisDays);

    // 3. 플랜 실행 데이터 로드
    const plans = await loadPlanExecutionData(
      supabase,
      input.studentId,
      startDate,
      input.planGroupId
    );

    if (plans.length === 0) {
      return {
        success: false,
        error: "분석할 플랜 데이터가 없습니다.",
      };
    }

    // 4. 통계 계산
    const executionStats = calculateExecutionStats(plans);
    const timeSlotPerformance = calculateTimeSlotPerformance(plans);
    const dayOfWeekPerformance = calculateDayOfWeekPerformance(plans);
    const subjectPerformance = calculateSubjectPerformance(plans);
    const learningPattern = calculateLearningPattern(plans, analysisDays);
    const incompletePattern = calculateIncompletePattern(plans);

    // 5. LLM 요청 빌드
    const llmRequest: PlanOptimizationRequest = {
      student: studentInfo,
      executionStats,
      timeSlotPerformance,
      dayOfWeekPerformance,
      subjectPerformance,
      learningPattern,
      incompletePattern,
      analysisPeriod: `최근 ${analysisDays}일`,
      additionalInstructions: input.additionalInstructions,
    };

    // 6. 토큰 추정 로깅
    const tokenEstimate = estimatePlanOptimizationTokens(llmRequest);
    console.log(`[Plan Optimization] 예상 토큰: ${tokenEstimate.totalTokens}`);

    // 7. LLM 호출 (기본: fast 모델)
    const modelTier = input.modelTier || "fast";
    const userPrompt = buildPlanOptimizationPrompt(llmRequest);

    const result = await createMessage({
      system: PLAN_OPTIMIZATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
    });

    // 8. 응답 파싱
    const parsed = extractJSON<PlanOptimizationResponse>(result.content);

    if (!parsed || typeof parsed.efficiencyScore !== "number") {
      console.error(
        "[Plan Optimization] 파싱 실패:",
        result.content.substring(0, 500)
      );
      return { success: false, error: "분석 결과 파싱에 실패했습니다." };
    }

    // 9. 비용 계산
    const estimatedCost = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      modelTier
    );

    return {
      success: true,
      data: {
        analysis: parsed,
        inputData: {
          executionStats,
          analysisPeriod: `최근 ${analysisDays}일`,
        },
        cost: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedUSD: estimatedCost,
        },
      },
    };
  } catch (error) {
    console.error("[Plan Optimization] 오류:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 분석 결과 캐싱 (선택적)
// ============================================

/**
 * 캐시된 분석 결과 조회
 * (향후 구현 - 현재는 항상 null 반환)
 */
export async function getCachedOptimization(
  studentId: string,
  analysisDays: number
): Promise<OptimizePlanResult["data"] | null> {
  // TODO: 캐시 구현 (1일 캐싱)
  return null;
}

/**
 * 분석 결과 캐시 저장
 * (향후 구현)
 */
export async function cacheOptimization(
  studentId: string,
  analysisDays: number,
  data: OptimizePlanResult["data"]
): Promise<void> {
  // TODO: 캐시 구현
}
