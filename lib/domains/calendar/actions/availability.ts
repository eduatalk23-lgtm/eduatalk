"use server";

/**
 * Availability Schedule/Window CRUD 서버 액션
 *
 * Cal.com Schedule + Availability 패턴 기반 가용성 관리.
 * availability_schedules + availability_windows 테이블 대상 (Phase 1 신규 테이블).
 *
 * @module lib/domains/calendar/actions/availability
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type {
  AvailabilitySchedule,
  AvailabilityScheduleInsert,
  AvailabilityScheduleWithWindows,
  AvailabilityWindow,
  AvailabilityWindowInsert,
  AvailabilityWindowUpdate,
  WindowType,
} from "../types";

// ============================================
// 입력 타입
// ============================================

export interface CreateScheduleInput {
  tenantId: string;
  plannerId: string;
  name: string;
  timezone?: string;
  isDefault?: boolean;
}

export interface CreateWindowInput {
  scheduleId: string;
  days?: number[];
  startTime: string;
  endTime: string;
  overrideDate?: string;
  windowType: WindowType;
  label?: string;
  academyScheduleId?: string;
  source?: string;
}

export interface UpdateWindowInput {
  days?: number[];
  startTime?: string;
  endTime?: string;
  windowType?: WindowType;
  label?: string;
  isDisabled?: boolean;
}

// ============================================
// Schedule 조회
// ============================================

/** 플래너별 스케줄 목록 (windows 포함) */
async function _getSchedulesByPlanner(
  plannerId: string
): Promise<AvailabilityScheduleWithWindows[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("availability_schedules")
    .select("*, availability_windows(*)")
    .eq("planner_id", plannerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(
      `가용성 스케줄 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return (data ?? []) as AvailabilityScheduleWithWindows[];
}

export const getSchedulesByPlannerAction = withErrorHandling(
  _getSchedulesByPlanner
);

/** 기본 스케줄 조회 */
async function _getDefaultSchedule(
  plannerId: string
): Promise<AvailabilityScheduleWithWindows | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("availability_schedules")
    .select("*, availability_windows(*)")
    .eq("planner_id", plannerId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    throw new AppError(
      `기본 스케줄 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data as AvailabilityScheduleWithWindows | null;
}

export const getDefaultScheduleAction = withErrorHandling(
  _getDefaultSchedule
);

// ============================================
// Schedule 생성
// ============================================

async function _createSchedule(
  input: CreateScheduleInput
): Promise<AvailabilitySchedule> {
  const supabase = await createSupabaseServerClient();

  const insertData: AvailabilityScheduleInsert = {
    tenant_id: input.tenantId,
    planner_id: input.plannerId,
    name: input.name,
    timezone: input.timezone ?? "Asia/Seoul",
    is_default: input.isDefault ?? false,
  };

  const { data, error } = await supabase
    .from("availability_schedules")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `가용성 스케줄 생성 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data;
}

export const createScheduleAction = withErrorHandling(_createSchedule);

/** 기본 스케줄 + 윈도우 한번에 생성 */
async function _createScheduleWithWindows(
  input: CreateScheduleInput,
  windows: Omit<CreateWindowInput, "scheduleId">[]
): Promise<AvailabilityScheduleWithWindows> {
  const schedule = await _createSchedule(input);

  if (windows.length === 0) {
    return { ...schedule, availability_windows: [] };
  }

  const supabase = await createSupabaseServerClient();

  const windowInserts: AvailabilityWindowInsert[] = windows.map((w) => ({
    schedule_id: schedule.id,
    days: w.days ?? null,
    start_time: w.startTime,
    end_time: w.endTime,
    override_date: w.overrideDate ?? null,
    window_type: w.windowType,
    label: w.label ?? null,
    academy_schedule_id: w.academyScheduleId ?? null,
    source: w.source ?? "manual",
  }));

  const { data: windowData, error } = await supabase
    .from("availability_windows")
    .insert(windowInserts)
    .select();

  if (error) {
    throw new AppError(
      `가용성 윈도우 생성 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return {
    ...schedule,
    availability_windows: windowData ?? [],
  };
}

export const createScheduleWithWindowsAction = withErrorHandling(
  _createScheduleWithWindows
);

// ============================================
// Schedule 삭제
// ============================================

async function _deleteSchedule(scheduleId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("availability_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) {
    throw new AppError(
      `가용성 스케줄 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const deleteScheduleAction = withErrorHandling(_deleteSchedule);

// ============================================
// Window CRUD
// ============================================

async function _createWindow(
  input: CreateWindowInput
): Promise<AvailabilityWindow> {
  const supabase = await createSupabaseServerClient();

  const insertData: AvailabilityWindowInsert = {
    schedule_id: input.scheduleId,
    days: input.days ?? null,
    start_time: input.startTime,
    end_time: input.endTime,
    override_date: input.overrideDate ?? null,
    window_type: input.windowType,
    label: input.label ?? null,
    academy_schedule_id: input.academyScheduleId ?? null,
    source: input.source ?? "manual",
  };

  const { data, error } = await supabase
    .from("availability_windows")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `가용성 윈도우 생성 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data;
}

export const createWindowAction = withErrorHandling(_createWindow);

async function _updateWindow(
  windowId: string,
  updates: UpdateWindowInput
): Promise<AvailabilityWindow> {
  const supabase = await createSupabaseServerClient();

  const updateData: AvailabilityWindowUpdate = {};
  if (updates.days !== undefined) updateData.days = updates.days;
  if (updates.startTime !== undefined)
    updateData.start_time = updates.startTime;
  if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
  if (updates.windowType !== undefined)
    updateData.window_type = updates.windowType;
  if (updates.label !== undefined) updateData.label = updates.label;
  if (updates.isDisabled !== undefined)
    updateData.is_disabled = updates.isDisabled;

  const { data, error } = await supabase
    .from("availability_windows")
    .update(updateData)
    .eq("id", windowId)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `가용성 윈도우 수정 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data;
}

export const updateWindowAction = withErrorHandling(_updateWindow);

async function _deleteWindow(windowId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("availability_windows")
    .delete()
    .eq("id", windowId);

  if (error) {
    throw new AppError(
      `가용성 윈도우 삭제 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}

export const deleteWindowAction = withErrorHandling(_deleteWindow);

/** 특정 날짜의 유효 윈도우 조회 (주간 반복 + 오버라이드 병합) */
async function _getEffectiveWindows(
  scheduleId: string,
  date: string,
  dayOfWeek: number
): Promise<AvailabilityWindow[]> {
  const supabase = await createSupabaseServerClient();

  // 해당 날짜의 오버라이드 조회
  const { data: overrides, error: overrideError } = await supabase
    .from("availability_windows")
    .select("*")
    .eq("schedule_id", scheduleId)
    .eq("override_date", date)
    .eq("is_disabled", false);

  if (overrideError) {
    throw new AppError(
      `오버라이드 조회 실패: ${overrideError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 오버라이드가 있으면 해당 날짜는 오버라이드만 사용
  if (overrides && overrides.length > 0) {
    return overrides;
  }

  // 오버라이드 없으면 주간 반복에서 해당 요일 필터
  const { data: weeklyWindows, error: weeklyError } = await supabase
    .from("availability_windows")
    .select("*")
    .eq("schedule_id", scheduleId)
    .is("override_date", null)
    .contains("days", [dayOfWeek])
    .eq("is_disabled", false)
    .order("start_time", { ascending: true });

  if (weeklyError) {
    throw new AppError(
      `주간 윈도우 조회 실패: ${weeklyError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return weeklyWindows ?? [];
}

export const getEffectiveWindowsAction = withErrorHandling(
  _getEffectiveWindows
);
