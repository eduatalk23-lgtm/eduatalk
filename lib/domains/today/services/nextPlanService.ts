"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { ContainerPlan } from "../actions/containerPlans";

/**
 * 다음 플랜 추천 타입
 */
export type NextPlanSuggestionType =
  | "same_subject" // 같은 과목의 다음 플랜
  | "next_priority" // 우선순위 순 다음 플랜
  | "break_recommended" // 휴식 권장 (장시간 학습 후)
  | "daily_complete"; // 오늘 플랜 모두 완료

/**
 * 다음 플랜 추천 결과
 */
export interface NextPlanSuggestion {
  type: NextPlanSuggestionType;
  plan?: ContainerPlan;
  message: string;
  subMessage?: string;
  suggestedBreakMinutes?: number;
}

/**
 * 일일 진행률 정보
 */
export interface DailyProgress {
  completedCount: number;
  totalCount: number;
  completionRate: number;
  remainingPlans: ContainerPlan[];
}

/**
 * 완료 시점의 학습 데이터
 */
interface CompletionContext {
  studentId: string;
  completedPlanId: string;
  studyDurationMinutes: number;
  completedPlanSubject?: string;
  completedPlanContentType?: string;
}

// 장시간 학습 기준 (분)
const LONG_STUDY_THRESHOLD_MINUTES = 60;
// 휴식 권장 시간 (분)
const SUGGESTED_BREAK_MINUTES = 10;

/**
 * 오늘 남은 플랜 조회
 */
export async function getRemainingPlansForToday(
  studentId: string,
  date?: string
): Promise<ContainerPlan[]> {
  const supabase = await createSupabaseServerClient();
  const targetDate = date || formatDateString(new Date());

  const { data: plans, error } = await supabase
    .from("student_plan")
    .select(
      `
      id,
      plan_date,
      plan_number,
      sequence,
      container_type,
      content_type,
      content_id,
      status,
      planned_start_page_or_time,
      planned_end_page_or_time,
      actual_start_time,
      actual_end_time,
      total_duration_seconds,
      plan_group_id,
      is_locked,
      carryover_count,
      carryover_from_date,
      custom_title,
      custom_range_display,
      student_content:student_content_master!left (
        id,
        subject,
        content_title:student_content_detail!left (
          id,
          detail_subject
        )
      )
    `
    )
    .eq("student_id", studentId)
    .eq("plan_date", targetDate)
    .eq("container_type", "daily")
    .is("actual_end_time", null)
    .order("sequence", { ascending: true });

  if (error || !plans) {
    return [];
  }

  // ContainerPlan 타입으로 매핑
  return plans.map((plan) => {
    const studentContent = plan.student_content as unknown as
      | {
          id: string;
          subject: string | null;
          content_title: Array<{ id: string; detail_subject: string | null }> | null;
        }
      | null;

    return {
      id: plan.id,
      plan_date: plan.plan_date,
      plan_number: plan.plan_number,
      sequence: plan.sequence,
      container_type: plan.container_type as "daily" | "weekly" | "unfinished",
      content_type: plan.content_type,
      content_id: plan.content_id,
      status: plan.status as "pending" | "in_progress" | "completed" | "skipped",
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      actual_start_time: plan.actual_start_time,
      actual_end_time: plan.actual_end_time,
      total_duration_seconds: plan.total_duration_seconds,
      plan_group_id: plan.plan_group_id,
      is_locked: plan.is_locked,
      carryover_count: plan.carryover_count,
      carryover_from_date: plan.carryover_from_date,
      custom_title: plan.custom_title,
      custom_range_display: plan.custom_range_display,
      content_title: studentContent?.content_title?.[0]?.detail_subject || null,
      content_subject: studentContent?.subject || null,
      subject_type: null,
    };
  });
}

/**
 * 오늘의 플랜 일일 진행률 조회
 * @param includeRemainingPlans true면 남은 플랜 목록 포함 (추가 쿼리 발생), 기본값 false
 */
export async function getDailyProgress(
  studentId: string,
  date?: string,
  includeRemainingPlans: boolean = false
): Promise<DailyProgress> {
  const supabase = await createSupabaseServerClient();
  const targetDate = date || formatDateString(new Date());

  // 오늘의 모든 daily 플랜 조회
  const { data: allPlans, error } = await supabase
    .from("student_plan")
    .select("id, actual_end_time, sequence")
    .eq("student_id", studentId)
    .eq("plan_date", targetDate)
    .eq("container_type", "daily");

  if (error || !allPlans) {
    return {
      completedCount: 0,
      totalCount: 0,
      completionRate: 0,
      remainingPlans: [],
    };
  }

  const totalCount = allPlans.length;
  const completedCount = allPlans.filter((p) => p.actual_end_time !== null).length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 남은 플랜 조회 (필요한 경우에만 - 추가 쿼리 방지)
  const remainingPlans = includeRemainingPlans
    ? await getRemainingPlansForToday(studentId, targetDate)
    : [];

  return {
    completedCount,
    totalCount,
    completionRate,
    remainingPlans,
  };
}

/**
 * 다음 플랜 추천 계산
 */
export async function getNextPlanSuggestion(
  context: CompletionContext
): Promise<NextPlanSuggestion> {
  const { studentId, completedPlanId, studyDurationMinutes, completedPlanSubject } = context;

  // 남은 플랜 조회
  const remainingPlans = await getRemainingPlansForToday(studentId);

  // 모든 플랜 완료
  if (remainingPlans.length === 0) {
    return {
      type: "daily_complete",
      message: "오늘 학습을 모두 완료했어요!",
      subMessage: "정말 대단해요! 충분한 휴식을 취하세요.",
    };
  }

  // 장시간 학습 후 휴식 권장
  if (studyDurationMinutes >= LONG_STUDY_THRESHOLD_MINUTES) {
    const nextPlan = remainingPlans[0];
    return {
      type: "break_recommended",
      plan: nextPlan,
      message: `${studyDurationMinutes}분 동안 집중하셨네요!`,
      subMessage: "잠시 휴식 후 다음 학습을 시작해보세요.",
      suggestedBreakMinutes: SUGGESTED_BREAK_MINUTES,
    };
  }

  // 같은 과목 플랜 찾기
  if (completedPlanSubject) {
    const sameSubjectPlan = remainingPlans.find(
      (p) => p.content_subject === completedPlanSubject
    );

    if (sameSubjectPlan) {
      return {
        type: "same_subject",
        plan: sameSubjectPlan,
        message: "같은 과목을 계속 학습할까요?",
        subMessage: `${sameSubjectPlan.content_title || sameSubjectPlan.custom_title || "다음 플랜"}`,
      };
    }
  }

  // 우선순위 순 다음 플랜
  const nextPlan = remainingPlans[0];
  return {
    type: "next_priority",
    plan: nextPlan,
    message: "다음 학습을 시작할까요?",
    subMessage: `${nextPlan.content_title || nextPlan.custom_title || "다음 플랜"}`,
  };
}

/**
 * 완료된 플랜의 콘텐츠 정보 조회
 */
export async function getCompletedPlanInfo(
  planId: string,
  studentId: string
): Promise<{ subject: string | null; contentType: string | null; title: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data: plan, error } = await supabase
    .from("student_plan")
    .select(
      `
      content_type,
      custom_title,
      student_content:student_content_master!left (
        subject,
        content_title:student_content_detail!left (
          detail_subject
        )
      )
    `
    )
    .eq("id", planId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error || !plan) {
    return { subject: null, contentType: null, title: null };
  }

  const studentContent = plan.student_content as unknown as
    | {
        subject: string | null;
        content_title: Array<{ detail_subject: string | null }> | null;
      }
    | null;

  return {
    subject: studentContent?.subject || null,
    contentType: plan.content_type,
    title: studentContent?.content_title?.[0]?.detail_subject || plan.custom_title || null,
  };
}
