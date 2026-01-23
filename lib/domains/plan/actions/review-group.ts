"use server";

/**
 * 복습 그룹 관련 Server Actions
 *
 * 콘텐츠별 주차 복습 플랜 관리
 */

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceContext } from "./core";
import type {
  ReviewGroup,
  ReviewSourcePlan,
  ContentSchedulerOptions,
} from "@/lib/types/plan/timezone";

// =====================================================
// 결과 타입
// =====================================================

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// =====================================================
// 복습 그룹 조회
// =====================================================

/**
 * 타임존의 복습 그룹 목록 조회
 */
export async function getReviewGroups(
  timezoneId: string
): Promise<ActionResult<ReviewGroup[]>> {
  try {
    const supabase = await createSupabaseServerClient();

    // 복습 플랜 조회
    const { data: reviewPlans, error } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        plan_date,
        content_id,
        content_type,
        range_start,
        range_end,
        status,
        review_group_id,
        review_source_content_ids
      `
      )
      .eq("plan_group_id", timezoneId)
      .eq("day_type", "review")
      .not("review_group_id", "is", null)
      .order("plan_date");

    if (error) throw error;

    // 복습 그룹으로 변환
    const groupMap = new Map<string, ReviewGroup>();

    for (const plan of reviewPlans || []) {
      const groupId = plan.review_group_id;
      if (!groupId) continue;

      if (!groupMap.has(groupId)) {
        // 콘텐츠 정보 조회 (첫 번째만)
        const contentTitle = await getContentTitle(
          plan.content_id,
          plan.content_type
        );

        // 주차 번호 계산
        const weekNumber = getWeekNumberFromDate(plan.plan_date);

        groupMap.set(groupId, {
          id: groupId,
          content_id: plan.content_id,
          content_title: contentTitle,
          week_number: weekNumber,
          review_date: plan.plan_date,
          source_plans: [],
          total_range: {
            start: plan.range_start ?? 0,
            end: plan.range_end ?? 0,
          },
          estimated_duration_minutes: 0,
          status: plan.status === "completed" ? "completed" : "pending",
        });
      }

      const group = groupMap.get(groupId)!;

      // 범위 확장
      if (plan.range_start && plan.range_start < group.total_range.start) {
        group.total_range.start = plan.range_start;
      }
      if (plan.range_end && plan.range_end > group.total_range.end) {
        group.total_range.end = plan.range_end;
      }
    }

    // 원본 플랜 정보 추가
    for (const plan of reviewPlans || []) {
      if (!plan.review_group_id || !plan.review_source_content_ids) continue;

      const group = groupMap.get(plan.review_group_id);
      if (!group) continue;

      // 원본 플랜 조회
      const { data: sourcePlans } = await supabase
        .from("student_plan")
        .select("id, plan_date, range_start, range_end")
        .in("id", plan.review_source_content_ids);

      if (sourcePlans) {
        group.source_plans = sourcePlans.map((sp) => ({
          plan_id: sp.id,
          plan_date: sp.plan_date,
          range_start: sp.range_start ?? 0,
          range_end: sp.range_end ?? 0,
        }));
      }

      // 예상 시간 계산 (범위 * 복습 비율 * 페이지당 시간)
      const rangeSize = group.total_range.end - group.total_range.start + 1;
      group.estimated_duration_minutes = Math.round(rangeSize * 0.3 * 3);
    }

    return { success: true, data: Array.from(groupMap.values()) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "복습 그룹 조회 중 오류가 발생했습니다",
    };
  }
}

/**
 * 특정 콘텐츠의 복습 그룹 조회
 */
export async function getReviewGroupsForContent(
  timezoneId: string,
  contentId: string
): Promise<ActionResult<ReviewGroup[]>> {
  try {
    const result = await getReviewGroups(timezoneId);

    if (!result.success) return result;

    const filteredGroups = result.data.filter(
      (g) => g.content_id === contentId
    );

    return { success: true, data: filteredGroups };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "콘텐츠 복습 그룹 조회 중 오류가 발생했습니다",
    };
  }
}

// =====================================================
// 복습 그룹 관리
// =====================================================

/**
 * 복습 그룹 날짜 변경
 */
export async function updateReviewGroupDate(
  groupId: string,
  newDate: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createSupabaseServerClient();

    // 해당 그룹의 모든 복습 플랜 날짜 업데이트
    const { error } = await supabase
      .from("student_plan")
      .update({ plan_date: newDate })
      .eq("review_group_id", groupId);

    if (error) throw error;

    revalidatePath("/plan");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "복습 그룹 날짜 변경 중 오류가 발생했습니다",
    };
  }
}

/**
 * 복습 그룹 삭제
 */
export async function deleteReviewGroup(
  groupId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("student_plan")
      .delete()
      .eq("review_group_id", groupId);

    if (error) throw error;

    revalidatePath("/plan");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "복습 그룹 삭제 중 오류가 발생했습니다",
    };
  }
}

/**
 * 복습 그룹 완료 처리
 */
export async function completeReviewGroup(
  groupId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("student_plan")
      .update({ status: "completed" })
      .eq("review_group_id", groupId);

    if (error) throw error;

    revalidatePath("/plan");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "복습 그룹 완료 처리 중 오류가 발생했습니다",
    };
  }
}

/**
 * 특정 주차 복습 플랜 재생성
 */
export async function regenerateReviewForWeek(
  timezoneId: string,
  contentId: string,
  weekNumber: number
): Promise<ActionResult<{ review_group_id: string }>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    // 해당 주차 학습 플랜 조회
    const { data: studyPlans, error: fetchError } = await supabase
      .from("student_plan")
      .select("*")
      .eq("plan_group_id", timezoneId)
      .eq("plan_content_id", contentId)
      .eq("day_type", "study");

    if (fetchError) throw fetchError;

    // 해당 주차 플랜 필터링
    const weekPlans = (studyPlans || []).filter((plan) => {
      const planWeek = getWeekNumberFromDate(plan.plan_date);
      return planWeek === weekNumber;
    });

    if (weekPlans.length === 0) {
      return { success: false, error: "해당 주차에 학습 플랜이 없습니다" };
    }

    // 기존 복습 그룹 삭제
    const existingGroupIds = weekPlans
      .map((p) => p.id)
      .filter((id): id is string => id !== null);

    if (existingGroupIds.length > 0) {
      await supabase
        .from("student_plan")
        .delete()
        .eq("plan_group_id", timezoneId)
        .eq("plan_content_id", contentId)
        .eq("day_type", "review")
        .containedBy("review_source_content_ids", existingGroupIds);
    }

    // 새 복습 그룹 생성
    const lastPlan = weekPlans[weekPlans.length - 1];
    const lastDate = new Date(lastPlan.plan_date);
    const reviewDate = new Date(lastDate);
    reviewDate.setDate(reviewDate.getDate() + 1);
    const reviewDateStr = reviewDate.toISOString().split("T")[0];

    const weekStart = Math.min(...weekPlans.map((p) => p.range_start ?? 0));
    const weekEnd = Math.max(...weekPlans.map((p) => p.range_end ?? 0));

    const reviewGroupId = crypto.randomUUID();

    const { error: insertError } = await supabase.from("student_plan").insert({
      plan_group_id: timezoneId,
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
      content_id: lastPlan.content_id,
      content_type: lastPlan.content_type,
      plan_date: reviewDateStr,
      day_type: "review",
      range_start: weekStart,
      range_end: weekEnd,
      status: "pending",
      plan_content_id: contentId,
      review_group_id: reviewGroupId,
      review_source_content_ids: weekPlans.map((p) => p.id),
      sequence: 1, // 복습은 별도 날짜에 생성
    });

    if (insertError) throw insertError;

    revalidatePath(`/plan/timezone/${timezoneId}`);

    return { success: true, data: { review_group_id: reviewGroupId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "복습 플랜 재생성 중 오류가 발생했습니다",
    };
  }
}

// =====================================================
// 헬퍼 함수
// =====================================================

/**
 * 콘텐츠 제목 조회
 */
async function getContentTitle(
  contentId: string,
  contentType: string
): Promise<string> {
  const supabase = await createSupabaseServerClient();

  let title = "Unknown";

  if (contentType === "book") {
    const { data } = await supabase
      .from("master_books")
      .select("title")
      .eq("id", contentId)
      .single();
    if (data) title = data.title;
  } else if (contentType === "lecture") {
    const { data } = await supabase
      .from("master_lectures")
      .select("title")
      .eq("id", contentId)
      .single();
    if (data) title = data.title;
  } else if (contentType === "custom") {
    const { data } = await supabase
      .from("student_custom_contents")
      .select("title")
      .eq("id", contentId)
      .single();
    if (data) title = data.title;
  }

  return title;
}

/**
 * 날짜에서 주차 번호 계산
 */
function getWeekNumberFromDate(dateStr: string): number {
  const date = new Date(dateStr);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear =
    (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
