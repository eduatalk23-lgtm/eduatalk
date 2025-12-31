"use server";

/**
 * 타임존 관련 Server Actions
 *
 * 2단계 플랜 생성 시스템의 1단계 - 타임존(스케줄 프레임) 관리
 */

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceContext } from "./core";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type {
  Timezone,
  TimezoneWithContents,
  CreateTimezoneInput,
  TimezoneFilters,
  TimezoneCalendarData,
  AvailableDate,
  PlanContentWithScheduler,
  StudentPlanSummary,
  ContentSchedulerOptions,
} from "@/lib/types/plan/timezone";
import type { DayType } from "@/lib/types/plan/domain";
import { calculateAvailableDates } from "../utils/availableDates";

// =====================================================
// 결과 타입
// =====================================================

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// =====================================================
// 타임존 CRUD
// =====================================================

/**
 * 타임존 생성 (Step 1)
 */
export async function createTimezone(
  input: CreateTimezoneInput
): Promise<ActionResult<{ timezone_id: string }>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    // plan_groups에 타임존으로 저장
    const { data, error } = await supabase
      .from("plan_groups")
      .insert({
        student_id: ctx.studentId,
        tenant_id: ctx.tenantId,
        name: input.name,
        period_start: input.period_start,
        period_end: input.period_end,
        block_set_id: input.block_set_id,
        target_date: input.target_date,
        plan_purpose: input.plan_purpose,
        is_timezone_only: true,
        timezone_status: "draft",
        default_scheduler_options: input.default_scheduler_options,
      })
      .select("id")
      .single();

    if (error) throw error;

    // 제외일 저장
    if (input.exclusions && input.exclusions.length > 0) {
      const exclusionRows = input.exclusions.map((e) => ({
        plan_group_id: data.id,
        exclusion_date: e.date,
        type: e.type,
        reason: e.reason,
      }));

      const { error: exclusionError } = await supabase
        .from("plan_exclusions")
        .insert(exclusionRows);

      if (exclusionError) throw exclusionError;
    }

    // 학원 일정 저장
    if (input.academy_schedules && input.academy_schedules.length > 0) {
      const academyRows = input.academy_schedules.map((a) => ({
        plan_group_id: data.id,
        student_id: ctx.studentId,
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
        academy_name: a.academy_name,
        subject: a.subject,
        travel_time: a.travel_time || 0,
      }));

      const { error: academyError } = await supabase
        .from("academy_schedules")
        .insert(academyRows);

      if (academyError) throw academyError;
    }

    revalidatePath("/plan");
    revalidatePath("/plan/timezone");

    return { success: true, data: { timezone_id: data.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "타임존 생성 중 오류가 발생했습니다",
    };
  }
}

/**
 * 타임존 목록 조회
 */
export async function getTimezones(
  filters?: TimezoneFilters
): Promise<ActionResult<TimezoneWithContents[]>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("plan_groups")
      .select(
        `
        *,
        plan_contents(
          id,
          content_type,
          content_id,
          master_content_id,
          start_range,
          end_range,
          display_order,
          scheduler_mode,
          content_scheduler_options,
          generation_status
        )
      `
      )
      .eq("student_id", ctx.studentId)
      .eq("is_timezone_only", true);

    // 필터 적용
    if (filters?.status) {
      query = query.eq("timezone_status", filters.status);
    }
    if (filters?.period_start_after) {
      query = query.gte("period_start", filters.period_start_after);
    }
    if (filters?.period_end_before) {
      query = query.lte("period_end", filters.period_end_before);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    // 타입 변환 및 추가 정보 계산
    const timezones: TimezoneWithContents[] = (data || []).map((row) => {
      const contents =
        (row.plan_contents as PlanContentWithScheduler[]) || [];
      const planCount = contents.filter(
        (c) => c.generation_status === "generated"
      ).length;

      return {
        ...row,
        is_timezone_only: row.is_timezone_only ?? true,
        timezone_status: (row.timezone_status ?? "draft") as
          | "draft"
          | "ready"
          | "active",
        default_scheduler_options: row.default_scheduler_options as
          | ContentSchedulerOptions
          | undefined,
        contents: contents as PlanContentWithScheduler[],
        content_count: contents.length,
        plan_count: planCount,
        completion_rate: contents.length > 0 ? planCount / contents.length : 0,
      };
    });

    return { success: true, data: timezones };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "타임존 목록 조회 중 오류가 발생했습니다",
    };
  }
}

/**
 * 타임존 상세 조회
 */
export async function getTimezone(
  timezoneId: string
): Promise<ActionResult<Timezone>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("plan_groups")
      .select("*")
      .eq("id", timezoneId)
      .eq("student_id", ctx.studentId)
      .eq("is_timezone_only", true)
      .single();

    if (error) throw error;

    const timezone: Timezone = {
      ...data,
      is_timezone_only: data.is_timezone_only ?? true,
      timezone_status: (data.timezone_status ?? "draft") as
        | "draft"
        | "ready"
        | "active",
      default_scheduler_options: data.default_scheduler_options as
        | ContentSchedulerOptions
        | undefined,
    };

    return { success: true, data: timezone };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "타임존 조회 중 오류가 발생했습니다",
    };
  }
}

/**
 * 타임존 달력 데이터 조회
 */
export async function getTimezoneCalendarData(
  timezoneId: string
): Promise<ActionResult<TimezoneCalendarData>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    logActionDebug(
      { domain: "plan", action: "getTimezoneCalendarData" },
      "Fetching timezone calendar data",
      { timezoneId, studentId: ctx.studentId }
    );

    // 타임존 + 콘텐츠 + 플랜 조회
    const { data: timezoneData, error: tzError } = await supabase
      .from("plan_groups")
      .select(
        `
        *,
        plan_contents(
          id,
          content_type,
          content_id,
          master_content_id,
          start_range,
          end_range,
          display_order,
          scheduler_mode,
          content_scheduler_options,
          generation_status
        ),
        plan_exclusions(
          exclusion_date,
          exclusion_type,
          reason
        ),
        academy_schedules(
          day_of_week,
          start_time,
          end_time,
          academy_name,
          subject
        )
      `
      )
      .eq("id", timezoneId)
      .eq("student_id", ctx.studentId)
      .single();

    if (tzError) {
      logActionError(
        { domain: "plan", action: "getTimezoneCalendarData" },
        tzError,
        { timezoneId }
      );
      throw tzError;
    }
    logActionDebug(
      { domain: "plan", action: "getTimezoneCalendarData" },
      "Timezone data fetched successfully",
      { timezoneId: timezoneData?.id }
    );

    // 플랜 조회
    const { data: plansData, error: planError } = await supabase
      .from("student_plan")
      .select("*")
      .eq("plan_group_id", timezoneId);

    if (planError) throw planError;

    // 타임존 객체 생성
    const timezone: Timezone = {
      ...timezoneData,
      is_timezone_only: timezoneData.is_timezone_only ?? true,
      timezone_status: (timezoneData.timezone_status ?? "draft") as
        | "draft"
        | "ready"
        | "active",
      default_scheduler_options: timezoneData.default_scheduler_options as
        | ContentSchedulerOptions
        | undefined,
    };

    // 콘텐츠 배열
    const contents = (timezoneData.plan_contents ||
      []) as PlanContentWithScheduler[];

    // 플랜 요약
    const plans: StudentPlanSummary[] = (plansData || []).map((p) => ({
      id: p.id,
      plan_date: p.plan_date,
      content_id: p.content_id,
      content_title: "", // TODO: 콘텐츠 제목 조인
      day_type: (p.day_type || "study") as DayType,
      range_start: p.range_start ?? 0,
      range_end: p.range_end ?? 0,
      status: p.status as "pending" | "in_progress" | "completed" | "canceled",
      review_group_id: p.review_group_id,
    }));

    // 가용 날짜 계산
    const availableDates = calculateAvailableDates(
      timezoneData.period_start,
      timezoneData.period_end,
      timezoneData.plan_exclusions || [],
      timezoneData.academy_schedules || [],
      timezoneData.default_scheduler_options
    );

    // 요약 정보 계산
    const studyDays = availableDates.filter(
      (d) => d.day_type === "study"
    ).length;
    const reviewDays = availableDates.filter(
      (d) => d.day_type === "review"
    ).length;
    const exclusionDays = availableDates.filter((d) => d.is_exclusion).length;

    return {
      success: true,
      data: {
        timezone,
        contents,
        plans,
        available_dates: availableDates,
        summary: {
          total_days: availableDates.length,
          study_days: studyDays,
          review_days: reviewDays,
          exclusion_days: exclusionDays,
          total_study_hours: studyDays * 8, // TODO: 블록셋 기반 계산
        },
      },
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "getTimezoneCalendarData" },
      error,
      { timezoneId }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "타임존 달력 데이터 조회 중 오류가 발생했습니다",
    };
  }
}

/**
 * 타임존 상태 변경
 */
export async function updateTimezoneStatus(
  timezoneId: string,
  status: "draft" | "ready" | "active"
): Promise<ActionResult<void>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("plan_groups")
      .update({ timezone_status: status })
      .eq("id", timezoneId)
      .eq("student_id", ctx.studentId)
      .eq("is_timezone_only", true);

    if (error) throw error;

    revalidatePath("/plan");
    revalidatePath(`/plan/timezone/${timezoneId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "타임존 상태 변경 중 오류가 발생했습니다",
    };
  }
}

/**
 * 타임존 삭제
 */
export async function deleteTimezone(
  timezoneId: string
): Promise<ActionResult<void>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    // 연관된 플랜이 있는지 확인
    const { count } = await supabase
      .from("student_plan")
      .select("*", { count: "exact", head: true })
      .eq("plan_group_id", timezoneId);

    if (count && count > 0) {
      return {
        success: false,
        error: "생성된 플랜이 있어 삭제할 수 없습니다. 플랜을 먼저 삭제해주세요.",
      };
    }

    const { error } = await supabase
      .from("plan_groups")
      .delete()
      .eq("id", timezoneId)
      .eq("student_id", ctx.studentId)
      .eq("is_timezone_only", true);

    if (error) throw error;

    revalidatePath("/plan");
    revalidatePath("/plan/timezone");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "타임존 삭제 중 오류가 발생했습니다",
    };
  }
}

/**
 * 타임존 활성화 (모든 콘텐츠 플랜 생성 완료 후)
 */
export async function activateTimezone(
  timezoneId: string
): Promise<ActionResult<void>> {
  try {
    const ctx = await getServiceContext();
    const supabase = await createSupabaseServerClient();

    // 콘텐츠가 있고, 모두 generated 상태인지 확인
    const { data: contents, error: contentError } = await supabase
      .from("plan_contents")
      .select("id, generation_status")
      .eq("plan_group_id", timezoneId);

    if (contentError) throw contentError;

    if (!contents || contents.length === 0) {
      return {
        success: false,
        error: "콘텐츠가 없어 활성화할 수 없습니다.",
      };
    }

    const pendingContents = contents.filter(
      (c) => c.generation_status !== "generated"
    );
    if (pendingContents.length > 0) {
      return {
        success: false,
        error: `${pendingContents.length}개의 콘텐츠에 대한 플랜이 아직 생성되지 않았습니다.`,
      };
    }

    // 상태 업데이트
    const { error } = await supabase
      .from("plan_groups")
      .update({
        timezone_status: "active",
        status: "active",
      })
      .eq("id", timezoneId)
      .eq("student_id", ctx.studentId);

    if (error) throw error;

    revalidatePath("/plan");
    revalidatePath(`/plan/timezone/${timezoneId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "타임존 활성화 중 오류가 발생했습니다",
    };
  }
}

