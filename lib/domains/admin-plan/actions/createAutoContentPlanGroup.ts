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
import { withErrorHandling } from "@/lib/errors";
import { logActionSuccess, logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { format } from "date-fns";
import {
  inheritCalendarConfigFromRaw,
  type CalendarConfigRaw,
} from "../utils/calendarConfigInheritance";
import { extractTimeHHMM, extractDateYMD } from "@/lib/domains/calendar/adapters";

// ============================================
// 타입 정의
// ============================================

/**
 * 자동 플랜그룹 생성 입력
 */
export interface CreateAutoContentPlanGroupInput {
  tenantId: string;
  studentId: string;
  /** 캘린더 ID */
  calendarId?: string;
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

  // 1. 캘린더 정보 조회 (Calendar-First)
  const calendarId: string | null = input.calendarId ?? null;
  let inheritedConfig: ReturnType<typeof inheritCalendarConfigFromRaw>;

  if (!calendarId) {
    return {
      success: false,
      error: "캘린더 ID가 필요합니다.",
    };
  }

  {
    const { data: calendar, error: calendarError } = await supabase
      .from("calendars")
      .select("*")
      .eq("id", calendarId)
      .is("deleted_at", null)
      .single();

    if (calendarError || !calendar) {
      logActionError(
        { domain: "admin-plan", action: "createAutoContentPlanGroup" },
        calendarError || "캘린더를 찾을 수 없습니다.",
        { calendarId }
      );
      return {
        success: false,
        error: "캘린더를 찾을 수 없습니다. 먼저 캘린더를 선택해주세요.",
      };
    }

    inheritedConfig = inheritCalendarConfigFromRaw(calendar as CalendarConfigRaw);
  }

  // 1-1. 플래너 제외일 조회 (targetDate 이후만, calendar_events)
  let calendarExclusions: Array<{ plan_date: string; exclusion_type: string | null; label: string | null }> | null = null;
  if (calendarId) {
    const { data: exclusionEvents } = await supabase
      .from("calendar_events")
      .select("start_date, event_subtype, title")
      .eq("calendar_id", calendarId)
      .eq("event_type", "exclusion")
      .eq("is_all_day", true)
      .is("deleted_at", null)
      .gte("start_date", input.targetDate);

    calendarExclusions = (exclusionEvents || []).map((e) => ({
      plan_date: e.start_date!,
      exclusion_type: e.event_subtype,
      label: e.title,
    }));
  }

  // 1-2. 플래너 학원일정 조회 (calendar_events, start_at에서 요일 추출)
  const academyMap = new Map<string, { day_of_week: number; start_time: string | null; end_time: string | null; label: string | null }>();
  if (calendarId) {
    const { data: academyEvents } = await supabase
      .from("calendar_events")
      .select("start_at, end_at, start_date, title")
      .eq("calendar_id", calendarId)
      .eq("event_type", "academy")
      .filter("event_subtype", "eq", "학원")
      .is("deleted_at", null);

    for (const row of academyEvents || []) {
      const planDate = row.start_date || extractDateYMD(row.start_at ?? null) || "";
      const dayOfWeek = new Date(planDate + "T00:00:00").getDay();
      const startTime = extractTimeHHMM(row.start_at);
      const endTime = extractTimeHHMM(row.end_at);
      const key = `${dayOfWeek}-${startTime}-${endTime}`;
      if (!academyMap.has(key)) {
        academyMap.set(key, { day_of_week: dayOfWeek, start_time: startTime ? startTime + ":00" : null, end_time: endTime ? endTime + ":00" : null, label: row.title });
      }
    }
  }
  const plannerSchedules = Array.from(academyMap.values());

  // 2. 플랜그룹 이름 생성
  const dateStr = format(new Date(input.targetDate), "yyyy-MM-dd");
  const truncatedTitle = input.contentTitle.length > 20
    ? input.contentTitle.substring(0, 20) + "..."
    : input.contentTitle;

  const groupName = input.planPurpose === "adhoc"
    ? `임시 그룹 (${dateStr})`
    : `${truncatedTitle} (${dateStr})`;

  // 3. 플랜그룹 데이터 준비 (캘린더에서 설정 상속 - 일관된 기본값 사용)
  const planGroupData = {
    name: groupName,
    plan_purpose: null,
    // 캘린더에서 상속된 설정 (일관된 기본값 보장)
    ...inheritedConfig,
    period_start: input.targetDate,
    period_end: input.targetDate, // 단일 날짜 그룹
    target_date: null,
    calendar_id: null,
    status: "active", // 자동 생성 그룹은 바로 활성화
    subject_constraints: null,
    additional_period_reallocation: null,
    daily_schedule: null,
    plan_type: "individual",
    camp_template_id: null,
    camp_invitation_id: null,
    use_slot_mode: false,
    content_slots: null,
    // Phase 3.3: 단일 콘텐츠 모드 기본값
    is_single_content: true,
  };

  // 4. RPC를 통한 원자적 플랜그룹 생성
  // 플래너의 제외일/학원일정을 플랜 그룹에 상속
  const inheritedExclusions = (calendarExclusions || []).map((e) => ({
    exclusion_date: e.plan_date,
    exclusion_type: e.exclusion_type,
    reason: e.label,
    source: "inherited",
    is_locked: false,
  }));

  const inheritedSchedules = (plannerSchedules || []).map((s) => ({
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    academy_name: s.label,
    subject: null,
    travel_time: 0,
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
      { calendarId, studentId: input.studentId }
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
      { calendarId, studentId: input.studentId }
    );
    return {
      success: false,
      error: result.error || "플랜 그룹 생성에 실패했습니다.",
    };
  }

  // 5. creation_mode + calendar_id 업데이트 (RPC에서 지원하지 않는 필드)
  await supabase
    .from("plan_groups")
    .update({
      creation_mode: "content_based",
      plan_mode: "content_based",
      ...(calendarId ? { calendar_id: calendarId } : {}),
    })
    .eq("id", result.group_id);

  logActionSuccess(
    { domain: "admin-plan", action: "createAutoContentPlanGroup" },
    {
      groupId: result.group_id,
      calendarId,
      studentId: input.studentId,
      groupName,
      inheritedExclusionsCount: inheritedExclusions.length,
      inheritedSchedulesCount: inheritedSchedules.length,
    }
  );

  logActionDebug(
    { domain: "admin-plan", action: "createAutoContentPlanGroup" },
    `자동 플랜그룹 생성 완료: ${groupName} (제외일 ${inheritedExclusions.length}개, 학원일정 ${inheritedSchedules.length}개 상속)`,
    { groupId: result.group_id, calendarId }
  );

  return {
    success: true,
    groupId: result.group_id,
  };
}

export const createAutoContentPlanGroupAction = withErrorHandling(_createAutoContentPlanGroup);
