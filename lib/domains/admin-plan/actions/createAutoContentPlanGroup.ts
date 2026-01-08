"use server";

/**
 * Auto Content Plan Group Creation
 *
 * 콘텐츠/단발성 플랜 추가 시 자동으로 플랜 그룹을 생성하는 액션
 *
 * @module lib/domains/admin-plan/actions/createAutoContentPlanGroup
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { logActionSuccess, logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { format } from "date-fns";

// ============================================
// 타입 정의
// ============================================

/**
 * 자동 플랜그룹 생성 입력
 */
export interface CreateAutoContentPlanGroupInput {
  tenantId: string;
  studentId: string;
  plannerId: string;
  contentTitle: string;
  targetDate: string;
  planPurpose?: "content" | "adhoc";
}

/**
 * 자동 플랜그룹 생성 결과
 */
export interface CreateAutoContentPlanGroupResult {
  success: boolean;
  groupId?: string;
  error?: string;
}

/**
 * TimeRange 타입
 */
interface TimeRange {
  start: string;
  end: string;
}

// ============================================
// 플랜그룹 자동 생성
// ============================================

/**
 * 콘텐츠/단발성 플랜 추가 시 자동으로 플랜 그룹 생성
 *
 * 플래너에서 시간 설정을 상속받아 플랜 그룹을 생성합니다.
 *
 * @param input 생성 입력
 * @returns 생성 결과 (groupId 포함)
 */
async function _createAutoContentPlanGroup(
  input: CreateAutoContentPlanGroupInput
): Promise<CreateAutoContentPlanGroupResult> {
  await requireAdminOrConsultant();
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  // 1. 플래너 정보 조회
  const { data: planner, error: plannerError } = await supabase
    .from("planners")
    .select("*")
    .eq("id", input.plannerId)
    .eq("tenant_id", input.tenantId)
    .is("deleted_at", null)
    .single();

  if (plannerError || !planner) {
    logActionError(
      { domain: "admin-plan", action: "createAutoContentPlanGroup" },
      plannerError || "플래너를 찾을 수 없습니다.",
      { plannerId: input.plannerId }
    );
    return {
      success: false,
      error: "플래너를 찾을 수 없습니다. 먼저 플래너를 선택해주세요.",
    };
  }

  // 1-1. 플래너 제외일 조회 (targetDate 이후만)
  const { data: plannerExclusions } = await supabase
    .from("planner_exclusions")
    .select("*")
    .eq("planner_id", input.plannerId)
    .gte("exclusion_date", input.targetDate);

  // 1-2. 플래너 학원일정 조회
  const { data: plannerSchedules } = await supabase
    .from("planner_academy_schedules")
    .select("*")
    .eq("planner_id", input.plannerId);

  // 2. 플랜그룹 이름 생성
  const dateStr = format(new Date(input.targetDate), "yyyy-MM-dd");
  const truncatedTitle = input.contentTitle.length > 20
    ? input.contentTitle.substring(0, 20) + "..."
    : input.contentTitle;

  const groupName = input.planPurpose === "adhoc"
    ? `임시 그룹 (${dateStr})`
    : `${truncatedTitle} (${dateStr})`;

  // 3. 플랜그룹 데이터 준비 (플래너에서 설정 상속)
  const planGroupData = {
    name: groupName,
    plan_purpose: null,
    scheduler_type: planner.default_scheduler_type || "1730_timetable",
    scheduler_options: planner.default_scheduler_options || { study_days: 6, review_days: 1 },
    period_start: input.targetDate,
    period_end: input.targetDate, // 단일 날짜 그룹
    target_date: null,
    block_set_id: planner.block_set_id || null,
    planner_id: input.plannerId,
    status: "active", // 자동 생성 그룹은 바로 활성화
    subject_constraints: null,
    additional_period_reallocation: null,
    non_study_time_blocks: planner.non_study_time_blocks || null,
    daily_schedule: null,
    plan_type: "individual",
    camp_template_id: null,
    camp_invitation_id: null,
    use_slot_mode: false,
    content_slots: null,
    // 플래너에서 시간 설정 상속
    study_hours: (planner.study_hours as TimeRange) || { start: "10:00", end: "19:00" },
    self_study_hours: (planner.self_study_hours as TimeRange) || { start: "19:00", end: "22:00" },
    lunch_time: (planner.lunch_time as TimeRange) || { start: "12:00", end: "13:00" },
  };

  // 4. RPC를 통한 원자적 플랜그룹 생성
  // 플래너의 제외일/학원일정을 플랜 그룹에 상속
  const inheritedExclusions = (plannerExclusions || []).map((e) => ({
    exclusion_date: e.exclusion_date,
    exclusion_type: e.exclusion_type,
    reason: e.reason,
    source: "inherited",
    is_locked: false,
  }));

  const inheritedSchedules = (plannerSchedules || []).map((s) => ({
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    academy_name: s.academy_name,
    academy_id: s.academy_id,
    subject: s.subject,
    travel_time: s.travel_time,
    source: "inherited",
    is_locked: false,
  }));

  const { data, error } = await supabase.rpc("create_plan_group_atomic", {
    p_tenant_id: tenantContext.tenantId,
    p_student_id: input.studentId,
    p_plan_group: planGroupData,
    p_contents: [],
    p_exclusions: inheritedExclusions,
    p_schedules: inheritedSchedules,
  });

  if (error) {
    logActionError(
      { domain: "admin-plan", action: "createAutoContentPlanGroup" },
      error,
      { plannerId: input.plannerId, studentId: input.studentId }
    );
    return {
      success: false,
      error: `플랜 그룹 생성 실패: ${error.message}`,
    };
  }

  const result = data as { success: boolean; group_id?: string; error?: string };

  if (!result.success || !result.group_id) {
    logActionError(
      { domain: "admin-plan", action: "createAutoContentPlanGroup" },
      result.error || "플랜 그룹 생성 실패",
      { plannerId: input.plannerId, studentId: input.studentId }
    );
    return {
      success: false,
      error: result.error || "플랜 그룹 생성에 실패했습니다.",
    };
  }

  // 5. creation_mode 업데이트 (RPC에서 지원하지 않는 필드)
  await supabase
    .from("plan_groups")
    .update({
      creation_mode: "content_based",
      plan_mode: "content_based",
    })
    .eq("id", result.group_id);

  logActionSuccess(
    { domain: "admin-plan", action: "createAutoContentPlanGroup" },
    {
      groupId: result.group_id,
      plannerId: input.plannerId,
      studentId: input.studentId,
      groupName,
      inheritedExclusionsCount: inheritedExclusions.length,
      inheritedSchedulesCount: inheritedSchedules.length,
    }
  );

  logActionDebug(
    { domain: "admin-plan", action: "createAutoContentPlanGroup" },
    `자동 플랜그룹 생성 완료: ${groupName} (제외일 ${inheritedExclusions.length}개, 학원일정 ${inheritedSchedules.length}개 상속)`,
    { groupId: result.group_id }
  );

  return {
    success: true,
    groupId: result.group_id,
  };
}

export const createAutoContentPlanGroupAction = withErrorHandling(_createAutoContentPlanGroup);
