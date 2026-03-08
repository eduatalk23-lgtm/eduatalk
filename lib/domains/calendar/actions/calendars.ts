"use server";

/**
 * Calendar CRUD Actions (Calendar-First 모델)
 *
 * Calendar를 독립 1급 엔티티로 관리하는 서버 액션.
 * GCal의 Calendar + CalendarList 패턴 기반.
 *
 * @module lib/domains/calendar/actions/calendars
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type {
  Calendar,
  CalendarList,
  CalendarListWithCalendar,
  CalendarOwnerType,
} from "../types";
import { CALENDAR_COLOR_KEYS, pickNextCalendarColor } from "@/lib/constants/calendarColors";

// ============================================
// Calendar CRUD
// ============================================

export interface CreateCalendarInput {
  studentId: string;
  tenantId: string;
  summary: string;
  color?: string;
  description?: string;
}

async function _createCalendar(
  input: CreateCalendarInput
): Promise<{ calendarId: string; calendar: Calendar }> {
  const supabase = await createSupabaseServerClient();

  // 색상 미지정 시 기존 캘린더와 겹치지 않는 색상 자동 할당
  let resolvedColor = input.color ?? null;
  if (!resolvedColor) {
    const { data: existing } = await supabase
      .from("calendars")
      .select("default_color")
      .eq("owner_id", input.studentId)
      .is("deleted_at", null);
    resolvedColor = pickNextCalendarColor(
      (existing ?? []).map((c) => c.default_color as string | null)
    );
  }

  const { data: calendar, error } = await supabase
    .from("calendars")
    .insert({
      tenant_id: input.tenantId,
      owner_id: input.studentId,
      owner_type: "student" as CalendarOwnerType,
      summary: input.summary,
      description: input.description ?? null,
      default_color: resolvedColor,
      is_primary: false,
      is_student_primary: false,
      source_type: "local",
    })
    .select()
    .single();

  if (error || !calendar) {
    throw new AppError(
      `캘린더 생성 실패: ${error?.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // calendar_list 엔트리 생성
  await supabase.from("calendar_list").insert({
    user_id: input.studentId,
    calendar_id: calendar.id,
    display_name: input.summary,
    color_override: input.color ?? null,
    is_visible: true,
    access_role: "owner",
    sort_order: 0,
  });

  return { calendarId: calendar.id, calendar: calendar as Calendar };
}

export const createCalendarAction = withErrorHandling(_createCalendar);

async function _getStudentCalendars(
  studentId: string
): Promise<Calendar[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("*")
    .eq("owner_id", studentId)
    .is("deleted_at", null)
    .order("is_student_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(
      `캘린더 목록 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return (data ?? []) as Calendar[];
}

export const getStudentCalendarsAction = withErrorHandling(_getStudentCalendars);

export interface UpdateCalendarInput {
  summary?: string;
  description?: string;
  defaultColor?: string | null;
}

async function _updateCalendar(
  calendarId: string,
  updates: UpdateCalendarInput
): Promise<Calendar> {
  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, unknown> = {};
  if (updates.summary !== undefined) updateData.summary = updates.summary;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.defaultColor !== undefined) updateData.default_color = updates.defaultColor;
  const { data, error } = await supabase
    .from("calendars")
    .update(updateData)
    .eq("id", calendarId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error || !data) {
    throw new AppError(
      `캘린더 수정 실패: ${error?.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data as Calendar;
}

export const updateCalendarAction = withErrorHandling(_updateCalendar);

async function _deleteCalendar(calendarId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Primary 캘린더 삭제 방지
  const { data: cal } = await supabase
    .from("calendars")
    .select("is_student_primary")
    .eq("id", calendarId)
    .single();

  if (cal?.is_student_primary) {
    throw new AppError(
      "기본 캘린더는 삭제할 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const { error } = await supabase
    .from("calendars")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", calendarId)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(
      `캘린더 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const deleteCalendarAction = withErrorHandling(_deleteCalendar);

// ============================================
// CalendarList CRUD
// ============================================

async function _getCalendarList(
  userId: string
): Promise<CalendarListWithCalendar[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendar_list")
    .select("*, calendars(*)")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new AppError(
      `캘린더 목록 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return (data ?? []) as CalendarListWithCalendar[];
}

export const getCalendarListAction = withErrorHandling(_getCalendarList);

async function _updateCalendarListEntry(
  entryId: string,
  updates: {
    displayName?: string | null;
    colorOverride?: string | null;
    isVisible?: boolean;
    sortOrder?: number;
  }
): Promise<CalendarList> {
  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, unknown> = {};
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
  if (updates.colorOverride !== undefined) updateData.color_override = updates.colorOverride;
  if (updates.isVisible !== undefined) updateData.is_visible = updates.isVisible;
  if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

  const { data, error } = await supabase
    .from("calendar_list")
    .update(updateData)
    .eq("id", entryId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError(
      `캘린더 설정 수정 실패: ${error?.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data as CalendarList;
}

export const updateCalendarListEntryAction = withErrorHandling(_updateCalendarListEntry);

// ============================================
// CalendarSettings CRUD (Planner 대체)
// ============================================

import type {
  CalendarSettings,
  CreateCalendarSettingsInput,
  UpdateCalendarSettingsInput,
  NonStudyTimeBlock,
  CalendarAcademyScheduleInput,
  CalendarExclusionInput,
} from "@/lib/domains/admin-plan/types";
import type { TimeRange } from "@/lib/scheduler/utils/scheduleCalculator";
import { mapCalendarSettingsFromDB } from "../mapCalendarSettings";
import type { PlanExclusion } from "@/lib/types/plan/domain";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  mergeLunchTimeIntoNonStudyBlocks,
  extractLunchTimeFromBlocks,
} from "@/lib/domains/admin-plan/utils/calendarConfigInheritance";
import {
  generateNonStudyRecordsForDateRange,
  generateExclusionRecordsForDates,
  type AcademyScheduleInput,
} from "@/lib/domains/admin-plan/utils/nonStudyTimeGenerator";
import { ensureStudentPrimaryCalendar, mapExclusionType } from "../helpers";
import { extractTimeHHMM, extractDateYMD } from "../adapters";
import { logActionError, logActionWarn } from "@/lib/utils/serverActionLogger";

/**
 * 권한 체크 (Admin/Consultant, 해당 학생 본인, 또는 연결된 학부모)
 */
async function checkCalendarAccess(targetStudentId: string) {
  const user = await getCurrentUser();
  if (!user) throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  if (!user.tenantId) throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.VALIDATION_ERROR, 400, true);

  if (user.role === "admin" || user.role === "consultant") {
    return { user, tenantId: user.tenantId, isAdmin: true };
  }
  if (user.role === "student" && user.userId === targetStudentId) {
    return { user, tenantId: user.tenantId, isAdmin: false };
  }
  // 학부모: parent_student_links를 통한 연결 확인
  if (user.role === "parent") {
    const supabase = await createSupabaseServerClient();
    const { data: link } = await supabase
      .from("parent_student_links")
      .select("id")
      .eq("parent_id", user.userId)
      .eq("student_id", targetStudentId)
      .maybeSingle();
    if (link) {
      return { user, tenantId: user.tenantId, isAdmin: false };
    }
  }
  throw new AppError("접근 권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
}

// mapCalendarSettingsFromDB → imported from ../mapCalendarSettings

/**
 * 캘린더 + 설정 + 비학습시간 이벤트 일괄 생성
 *
 * 기존 createPlannerAction 대체.
 */
async function _createCalendarWithSettings(
  input: CreateCalendarSettingsInput
): Promise<CalendarSettings> {
  const { user, tenantId } = await checkCalendarAccess(input.studentId);
  const supabase = await createSupabaseServerClient();

  // lunch_time을 non_study_time_blocks에 통합
  const mergedNonStudyBlocks = mergeLunchTimeIntoNonStudyBlocks(
    input.lunchTime || { start: "12:00", end: "13:00" },
    input.nonStudyTimeBlocks
  );

  // 색상 미지정 시 기존 캘린더와 겹치지 않는 색상 자동 할당
  let resolvedColor = input.color ?? null;
  if (!resolvedColor) {
    const { data: existing } = await supabase
      .from("calendars")
      .select("default_color")
      .eq("owner_id", input.studentId)
      .is("deleted_at", null);
    resolvedColor = pickNextCalendarColor(
      (existing ?? []).map((c) => c.default_color as string | null)
    );
  }

  const { data, error } = await supabase
    .from("calendars")
    .insert({
      tenant_id: tenantId,
      owner_id: input.studentId,
      owner_type: "student" as CalendarOwnerType,
      summary: input.name,
      description: input.description ?? null,
      default_color: resolvedColor,
      is_primary: false,
      is_student_primary: false,
      source_type: "local",
      status: "active",
      period_start: input.periodStart,
      period_end: input.periodEnd,
      target_date: input.targetDate ?? null,
      study_hours: input.studyHours ?? { start: "10:00", end: "19:00" },
      self_study_hours: input.selfStudyHours ?? { start: "19:00", end: "22:00" },
      non_study_time_blocks: mergedNonStudyBlocks,
      block_set_id: input.blockSetId ?? null,
      default_scheduler_type: input.defaultSchedulerType ?? "1730_timetable",
      default_scheduler_options: input.defaultSchedulerOptions ?? { study_days: 6, review_days: 1 },
      admin_memo: input.adminMemo ?? null,
      default_estimated_minutes: input.defaultEstimatedMinutes ?? null,
      default_reminder_minutes: input.defaultReminderMinutes ?? null,
      week_starts_on: input.weekStartsOn ?? 0,
      created_by: user.userId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError(`캘린더 생성 실패: ${error?.message}`, ErrorCode.DATABASE_ERROR, 500, true);
  }

  const calendarId = data.id as string;

  // calendar_list 엔트리 생성
  await supabase.from("calendar_list").insert({
    user_id: input.studentId,
    calendar_id: calendarId,
    display_name: input.name,
    color_override: input.color ?? null,
    is_visible: true,
    access_role: "owner",
    sort_order: 0,
  });

  // 비학습시간/학원/제외일 calendar_events 생성
  if (input.periodStart && input.periodEnd) {
    const academyInputs: AcademyScheduleInput[] = (input.academySchedules ?? []).map((s) => ({
      id: undefined,
      academyId: undefined,
      academyName: s.academyName,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject,
      travelTime: s.travelTime,
    }));

    const records = generateNonStudyRecordsForDateRange(
      calendarId,
      input.studentId,
      tenantId,
      input.periodStart,
      input.periodEnd,
      mergedNonStudyBlocks,
      {
        academySchedules: academyInputs,
        excludedDates: input.exclusionInputs?.map((e) => e.exclusionDate),
      }
    );

    if (input.exclusionInputs?.length) {
      const exclusionRecords = generateExclusionRecordsForDates(
        calendarId,
        input.studentId,
        tenantId,
        input.exclusionInputs.map((e) => ({
          date: e.exclusionDate,
          exclusionType: e.exclusionType,
          reason: e.reason,
        })),
        "imported"
      );
      records.push(...exclusionRecords);
    }

    // 배치 삽입
    const BATCH_SIZE = 500;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error: batchErr } = await supabase.from("calendar_events").insert(batch);
      if (batchErr) {
        logActionError("calendars._createCalendarWithSettings", `이벤트 배치 저장 실패: ${batchErr.message}`);
      }
    }
  }

  return mapCalendarSettingsFromDB(data);
}

export const createCalendarWithSettingsAction = withErrorHandling(_createCalendarWithSettings);

/**
 * 캘린더 설정 조회
 *
 * 기존 getPlannerAction 대체.
 */
async function _getCalendarSettings(
  calendarId: string,
  includeRelations = false
): Promise<CalendarSettings | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("*")
    .eq("id", calendarId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new AppError(`캘린더 조회 실패: ${error.message}`, ErrorCode.DATABASE_ERROR, 500, true);
  }

  await checkCalendarAccess(data.owner_id as string);
  const settings = mapCalendarSettingsFromDB(data);

  if (includeRelations) {
    // 제외일 조회
    const { data: exclusions } = await supabase
      .from("calendar_events")
      .select("id, calendar_id, start_date, event_subtype, title, source, created_at")
      .eq("calendar_id", calendarId)
      .eq("is_exclusion", true)
      .eq("is_all_day", true)
      .is("deleted_at", null)
      .order("start_date", { ascending: true });

    settings.exclusions = (exclusions ?? []).map((row) => ({
      id: row.id,
      tenant_id: "",
      student_id: "",
      plan_group_id: null,
      exclusion_date: row.start_date!,
      exclusion_type: row.event_subtype ?? "기타",
      reason: row.title,
      source: row.source ?? "template",
      is_locked: false,
      created_at: row.created_at ?? "",
    }));

    // 플랜그룹 수 조회
    const { count } = await supabase
      .from("plan_groups")
      .select("*", { count: "exact", head: true })
      .eq("calendar_id", calendarId)
      .is("deleted_at", null);

    settings.planGroupCount = count ?? 0;
  }

  return settings;
}

export const getCalendarSettingsAction = withErrorHandling(_getCalendarSettings);

/**
 * 학생 캘린더 목록 조회 (설정 포함)
 *
 * 기존 getStudentPlannersAction 대체.
 */
async function _getStudentCalendarSettings(
  studentId: string,
  options?: {
    status?: string | string[];
    includeArchived?: boolean;
    limit?: number;
  }
): Promise<{ data: CalendarSettings[]; total: number }> {
  const { tenantId } = await checkCalendarAccess(studentId);
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("calendars")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("owner_id", studentId)
    .is("deleted_at", null);

  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.in("status", options.status);
    } else {
      query = query.eq("status", options.status);
    }
  }

  if (!options?.includeArchived) {
    query = query.neq("status", "archived");
  }

  query = query
    .order("is_student_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new AppError(`캘린더 목록 조회 실패: ${error.message}`, ErrorCode.DATABASE_ERROR, 500, true);
  }

  const calendars = (data ?? []).map((row) => mapCalendarSettingsFromDB(row));

  // 플랜그룹 수 조회
  if (calendars.length > 0) {
    const calendarIds = calendars.map((c) => c.id);
    const { data: groupCounts } = await supabase
      .from("plan_groups")
      .select("calendar_id, id")
      .in("calendar_id", calendarIds)
      .is("deleted_at", null);

    const countMap = new Map<string, number>();
    for (const row of groupCounts ?? []) {
      const cid = row.calendar_id as string;
      countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
    }

    calendars.forEach((cal) => {
      cal.planGroupCount = countMap.get(cal.id) ?? 0;
    });
  }

  return { data: calendars, total: count ?? 0 };
}

export const getStudentCalendarSettingsAction = withErrorHandling(_getStudentCalendarSettings);

/**
 * 캘린더 설정 업데이트
 *
 * 기존 updatePlannerAction 대체.
 */
async function _updateCalendarSettings(
  calendarId: string,
  updates: UpdateCalendarSettingsInput
): Promise<CalendarSettings> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("calendars")
    .select("owner_id, created_by")
    .eq("id", calendarId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !existing) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const { isAdmin, user } = await checkCalendarAccess(existing.owner_id as string);
  if (!isAdmin && existing.created_by !== user.userId) {
    throw new AppError("관리자가 생성한 캘린더는 수정할 수 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.summary = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.periodStart !== undefined) updateData.period_start = updates.periodStart;
  if (updates.periodEnd !== undefined) updateData.period_end = updates.periodEnd;
  if (updates.targetDate !== undefined) updateData.target_date = updates.targetDate;
  if (updates.studyHours !== undefined) updateData.study_hours = updates.studyHours;
  if (updates.selfStudyHours !== undefined) updateData.self_study_hours = updates.selfStudyHours;
  if (updates.blockSetId !== undefined) updateData.block_set_id = updates.blockSetId;
  if (updates.defaultSchedulerType !== undefined) updateData.default_scheduler_type = updates.defaultSchedulerType;
  if (updates.defaultSchedulerOptions !== undefined) updateData.default_scheduler_options = updates.defaultSchedulerOptions;
  if (updates.adminMemo !== undefined) updateData.admin_memo = updates.adminMemo;
  if (updates.color !== undefined) updateData.default_color = updates.color;
  if (updates.defaultEstimatedMinutes !== undefined) updateData.default_estimated_minutes = updates.defaultEstimatedMinutes;
  if (updates.defaultReminderMinutes !== undefined) updateData.default_reminder_minutes = updates.defaultReminderMinutes;
  if (updates.weekStartsOn !== undefined) updateData.week_starts_on = updates.weekStartsOn;

  // lunch_time → non_study_time_blocks 통합
  if (updates.lunchTime !== undefined || updates.nonStudyTimeBlocks !== undefined) {
    let currentBlocks = updates.nonStudyTimeBlocks;
    if (updates.lunchTime !== undefined && currentBlocks === undefined) {
      const { data: cal } = await supabase
        .from("calendars")
        .select("non_study_time_blocks")
        .eq("id", calendarId)
        .single();
      currentBlocks = cal?.non_study_time_blocks as NonStudyTimeBlock[] | undefined;
    }
    updateData.non_study_time_blocks = mergeLunchTimeIntoNonStudyBlocks(updates.lunchTime, currentBlocks);
  }

  const { data, error } = await supabase
    .from("calendars")
    .update(updateData)
    .eq("id", calendarId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error || !data) {
    throw new AppError(`캘린더 수정 실패: ${error?.message}`, ErrorCode.DATABASE_ERROR, 500, true);
  }

  // plan_groups 동기화
  if (updates.syncToExistingGroups) {
    const pgUpdate: Record<string, unknown> = {};
    if (updates.studyHours !== undefined) pgUpdate.study_hours = updates.studyHours;
    if (updates.selfStudyHours !== undefined) pgUpdate.self_study_hours = updates.selfStudyHours;
    if (updateData.non_study_time_blocks !== undefined) pgUpdate.non_study_time_blocks = updateData.non_study_time_blocks;
    if (updates.defaultSchedulerType !== undefined) pgUpdate.scheduler_type = updates.defaultSchedulerType;
    if (updates.defaultSchedulerOptions !== undefined) pgUpdate.scheduler_options = updates.defaultSchedulerOptions;
    if (updates.blockSetId !== undefined) pgUpdate.block_set_id = updates.blockSetId;

    // lunch_time backward compat
    const lunchTime = extractLunchTimeFromBlocks(updateData.non_study_time_blocks as unknown[] | undefined);
    if (lunchTime) pgUpdate.lunch_time = lunchTime;

    if (Object.keys(pgUpdate).length > 0) {
      const { error: syncErr } = await supabase
        .from("plan_groups")
        .update(pgUpdate)
        .eq("calendar_id", calendarId)
        .in("status", ["active", "draft"])
        .is("deleted_at", null);

      if (syncErr) {
        logActionWarn("calendars._updateCalendarSettings", `플랜 그룹 동기화 실패: ${syncErr.message}`);
      }
    }
  }

  return mapCalendarSettingsFromDB(data);
}

export const updateCalendarSettingsAction = withErrorHandling(_updateCalendarSettings);

/**
 * 캘린더 Cascade 삭제 (RPC)
 *
 * 기존 deletePlannerAction 대체.
 */
async function _deleteCalendarCascade(calendarId: string): Promise<{
  calendarId: string;
  deletedPlanGroupsCount: number;
  deletedStudentPlansCount: number;
  deletedEventsCount: number;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: cal, error: fetchErr } = await supabase
    .from("calendars")
    .select("owner_id, tenant_id, created_by")
    .eq("id", calendarId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !cal) {
    throw new AppError("캘린더를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const { isAdmin, user } = await checkCalendarAccess(cal.owner_id as string);
  if (!isAdmin && cal.created_by !== user.userId) {
    throw new AppError("관리자가 생성한 캘린더는 삭제할 수 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const { data, error } = await supabase.rpc("delete_calendar_cascade", {
    p_calendar_id: calendarId,
    p_tenant_id: cal.tenant_id as string,
  });

  if (error) {
    throw new AppError(`캘린더 삭제 실패: ${error.message}`, ErrorCode.DATABASE_ERROR, 500, true);
  }

  const result = data as {
    success: boolean;
    calendar_id: string;
    deleted_plan_groups_count: number;
    deleted_student_plans_count: number;
    deleted_events_count: number;
    error?: string;
    error_code?: string;
  };

  if (!result.success) {
    throw new AppError(
      result.error ?? "캘린더 삭제 중 오류가 발생했습니다.",
      result.error_code === "NOT_FOUND" ? ErrorCode.NOT_FOUND : ErrorCode.DATABASE_ERROR,
      result.error_code === "NOT_FOUND" ? 404 : 500,
      true
    );
  }

  return {
    calendarId: result.calendar_id,
    deletedPlanGroupsCount: result.deleted_plan_groups_count,
    deletedStudentPlansCount: result.deleted_student_plans_count,
    deletedEventsCount: result.deleted_events_count,
  };
}

export const deleteCalendarCascadeAction = withErrorHandling(_deleteCalendarCascade);

// ============================================
// Ensure Student Calendar (Planner 대체)
// ============================================

/**
 * 학생의 기본 캘린더를 확보합니다 (없으면 자동 생성).
 *
 * 기존 getOrCreateDefaultPlannerAction 대체.
 */
export async function ensureStudentCalendarAction(
  studentId: string
): Promise<{ calendarId: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenantId) {
      return { calendarId: "", error: "테넌트 ID를 확인할 수 없습니다." };
    }
    const calendarId = await ensureStudentPrimaryCalendar(studentId, user.tenantId);
    return { calendarId };
  } catch (err) {
    return {
      calendarId: "",
      error: err instanceof Error ? err.message : "캘린더 확보 실패",
    };
  }
}
