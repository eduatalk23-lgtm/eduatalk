/**
 * 캠프 플랜 그룹 업데이트 서비스
 * 
 * 플랜 그룹 메타데이터, 제외일, 학원 일정 등의 업데이트 로직을 담당합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/database.types";
import type { PlanGroupSchedulerOptions } from "@/lib/types/schedulerSettings";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import { AppError, ErrorCode, logError } from "@/lib/errors";
import { mergeTimeSettingsSafely } from "@/lib/utils/schedulerOptionsMerge";
import {
  createPlanExclusions,
  createStudentAcademySchedules,
} from "@/lib/data/planGroups";

type PlanGroupUpdatePayload = Partial<{
  updated_at: string;
  name: string | null;
  plan_purpose: string | null;
  scheduler_type: string | null;
  scheduler_options: PlanGroupSchedulerOptions | null;
  period_start: string;
  period_end: string;
  target_date: string | null;
  block_set_id: string | null;
  daily_schedule: DailyScheduleInfo[] | null;
  subject_constraints: unknown | null;
  additional_period_reallocation: unknown | null;
  non_study_time_blocks: unknown | null;
  plan_type: string | null;
  camp_template_id: string | null;
  camp_invitation_id: string | null;
}>;

type CreationData = {
  name?: string;
  plan_purpose?: string | null;
  scheduler_type?: string | null;
  scheduler_options?: PlanGroupSchedulerOptions;
  time_settings?: unknown;
  period_start?: string;
  period_end?: string;
  target_date?: string | null;
  block_set_id?: string | null;
  daily_schedule?: DailyScheduleInfo[] | null;
  subject_constraints?: unknown | null;
  additional_period_reallocation?: unknown | null;
  non_study_time_blocks?: unknown | null;
  plan_type?: string;
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
  exclusions?: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>;
  academy_schedules?: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
  }>;
};

/**
 * plan_purpose 정규화 함수
 */
function normalizePlanPurpose(
  purpose: string | null | undefined
): string | null {
  if (!purpose) return null;
  if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
  return purpose;
}

/**
 * 플랜 그룹 메타데이터 업데이트
 */
export async function updatePlanGroupMetadata(
  supabase: SupabaseClient,
  groupId: string,
  tenantId: string,
  creationData: CreationData
): Promise<void> {
  // time_settings를 scheduler_options에 안전하게 병합
  const mergedSchedulerOptions = mergeTimeSettingsSafely(
    creationData.scheduler_options || {},
    creationData.time_settings
  );

  const updatePayload: PlanGroupUpdatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (creationData.name !== undefined)
    updatePayload.name = creationData.name || null;
  if (creationData.plan_purpose !== undefined)
    updatePayload.plan_purpose = normalizePlanPurpose(creationData.plan_purpose);
  if (creationData.scheduler_type !== undefined)
    updatePayload.scheduler_type = creationData.scheduler_type || null;
  if (Object.keys(mergedSchedulerOptions).length > 0) {
    updatePayload.scheduler_options = mergedSchedulerOptions;
  } else {
    updatePayload.scheduler_options = null;
  }
  if (creationData.period_start !== undefined)
    updatePayload.period_start = creationData.period_start;
  if (creationData.period_end !== undefined)
    updatePayload.period_end = creationData.period_end;
  if (creationData.target_date !== undefined)
    updatePayload.target_date = creationData.target_date || null;
  if (creationData.block_set_id !== undefined)
    updatePayload.block_set_id = creationData.block_set_id || null;
  if (creationData.daily_schedule !== undefined)
    updatePayload.daily_schedule = creationData.daily_schedule || null;
  if (creationData.subject_constraints !== undefined)
    updatePayload.subject_constraints = creationData.subject_constraints || null;
  if (creationData.additional_period_reallocation !== undefined)
    updatePayload.additional_period_reallocation =
      creationData.additional_period_reallocation || null;
  if (creationData.non_study_time_blocks !== undefined)
    updatePayload.non_study_time_blocks =
      creationData.non_study_time_blocks || null;
  if (creationData.plan_type !== undefined)
    updatePayload.plan_type = creationData.plan_type || null;
  if (creationData.camp_template_id !== undefined)
    updatePayload.camp_template_id = creationData.camp_template_id || null;
  if (creationData.camp_invitation_id !== undefined)
    updatePayload.camp_invitation_id = creationData.camp_invitation_id || null;

  const { error: updateError } = await supabase
    .from("plan_groups")
    .update(updatePayload)
    .eq("id", groupId)
    .eq("tenant_id", tenantId);

  if (updateError) {
    throw new AppError(
      `플랜 그룹 업데이트 실패: ${updateError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

/**
 * 제외일 업데이트
 */
export async function updatePlanExclusions(
  supabase: SupabaseClient,
  groupId: string,
  tenantId: string,
  exclusions: CreationData["exclusions"]
): Promise<void> {
  if (exclusions === undefined) return;

  // 기존 제외일 삭제
  const { error: deleteError } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteError) {
    logError(deleteError, {
      function: "updatePlanExclusions",
      groupId,
      action: "deleteExclusions",
    });
  }

  // 새로운 제외일 생성
  if (exclusions.length > 0) {
    const exclusionsResult = await createPlanExclusions(
      groupId,
      tenantId,
      exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type,
        reason: e.reason || null,
      }))
    );

    if (!exclusionsResult.success) {
      throw new AppError(
        exclusionsResult.error || "제외일 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }
}

/**
 * 학원 일정 업데이트
 */
export async function updateAcademySchedules(
  supabase: SupabaseClient,
  studentId: string,
  tenantId: string,
  academySchedules: CreationData["academy_schedules"]
): Promise<void> {
  if (academySchedules === undefined) return;

  // 기존 학원 일정 조회 (중복 체크용)
  const { getStudentAcademySchedules } = await import("@/lib/data/planGroups");
  const existingSchedules = await getStudentAcademySchedules(studentId, tenantId);

  // 기존 학원 일정을 키로 매핑
  const existingKeys = new Set(
    existingSchedules.map(
      (s) =>
        `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`
    )
  );

  // 새로운 학원 일정 중 중복되지 않은 것만 필터링
  const newSchedules = academySchedules.filter((s) => {
    const key = `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`;
    return !existingKeys.has(key);
  });

  console.log("[updateAcademySchedules] 학원 일정 업데이트:", {
    studentId,
    totalSchedules: academySchedules.length,
    existingSchedulesCount: existingSchedules.length,
    newSchedulesCount: newSchedules.length,
    skippedCount: academySchedules.length - newSchedules.length,
  });

  // 중복되지 않은 새로운 학원 일정만 추가 (관리자 모드: Admin 클라이언트 사용)
  if (newSchedules.length > 0) {
    const schedulesResult = await createStudentAcademySchedules(
      studentId,
      tenantId,
      newSchedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        academy_name: s.academy_name || null,
        subject: s.subject || null,
      })),
      true // 관리자 모드: Admin 클라이언트 사용 (RLS 우회)
    );

    if (!schedulesResult.success) {
      throw new AppError(
        schedulesResult.error || "학원 일정 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  } else if (academySchedules.length > 0) {
    // 모든 학원 일정이 이미 존재하는 경우 로그만 출력
    console.log("[updateAcademySchedules] 모든 학원 일정이 이미 존재합니다.");
  }
}

