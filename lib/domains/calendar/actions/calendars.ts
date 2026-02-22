"use server";

/**
 * Calendar CRUD 서버 액션
 *
 * Google Calendar Resource 패턴 기반 캘린더 컨테이너 관리.
 * calendars 테이블 대상 (Phase 1 신규 테이블).
 *
 * @module lib/domains/calendar/actions/calendars
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type {
  Calendar,
  CalendarInsert,
  CalendarUpdate,
  CalendarType,
  CalendarOwnerType,
} from "../types";

// ============================================
// 입력 타입
// ============================================

export interface CreateCalendarInput {
  tenantId: string;
  ownerId: string;
  ownerType: CalendarOwnerType;
  plannerId?: string;
  summary: string;
  description?: string;
  location?: string;
  timezone?: string;
  defaultColor?: string;
  calendarType?: CalendarType;
  isPrimary?: boolean;
}

export interface UpdateCalendarInput {
  summary?: string;
  description?: string;
  location?: string;
  timezone?: string;
  defaultColor?: string;
  calendarType?: CalendarType;
}

// ============================================
// 조회
// ============================================

async function _getCalendarsByPlanner(
  plannerId: string
): Promise<Calendar[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("*")
    .eq("planner_id", plannerId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(
      `캘린더 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data ?? [];
}

export const getCalendarsByPlannerAction = withErrorHandling(
  _getCalendarsByPlanner
);

async function _getCalendarsByOwner(
  ownerId: string
): Promise<Calendar[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("*")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(
      `캘린더 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data ?? [];
}

export const getCalendarsByOwnerAction = withErrorHandling(
  _getCalendarsByOwner
);

// ============================================
// 생성
// ============================================

async function _createCalendar(
  input: CreateCalendarInput
): Promise<Calendar> {
  const supabase = await createSupabaseServerClient();

  const insertData: CalendarInsert = {
    tenant_id: input.tenantId,
    owner_id: input.ownerId,
    owner_type: input.ownerType,
    planner_id: input.plannerId ?? null,
    summary: input.summary,
    description: input.description ?? null,
    location: input.location ?? null,
    timezone: input.timezone ?? "Asia/Seoul",
    default_color: input.defaultColor ?? null,
    calendar_type: input.calendarType ?? "study",
    is_primary: input.isPrimary ?? false,
  };

  const { data, error } = await supabase
    .from("calendars")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `캘린더 생성 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data;
}

export const createCalendarAction = withErrorHandling(_createCalendar);

/** 플래너에 대한 Primary 캘린더 자동 생성 (플래너 생성 시 호출) */
async function _createPrimaryCalendar(
  tenantId: string,
  ownerId: string,
  ownerType: CalendarOwnerType,
  plannerId: string,
  summary: string
): Promise<Calendar> {
  return _createCalendar({
    tenantId,
    ownerId,
    ownerType,
    plannerId,
    summary,
    calendarType: "study",
    isPrimary: true,
  });
}

export const createPrimaryCalendarAction = withErrorHandling(
  _createPrimaryCalendar
);

// ============================================
// 수정
// ============================================

async function _updateCalendar(
  calendarId: string,
  updates: UpdateCalendarInput
): Promise<Calendar> {
  const supabase = await createSupabaseServerClient();

  const updateData: CalendarUpdate = {};
  if (updates.summary !== undefined) updateData.summary = updates.summary;
  if (updates.description !== undefined)
    updateData.description = updates.description;
  if (updates.location !== undefined) updateData.location = updates.location;
  if (updates.timezone !== undefined) updateData.timezone = updates.timezone;
  if (updates.defaultColor !== undefined)
    updateData.default_color = updates.defaultColor;
  if (updates.calendarType !== undefined)
    updateData.calendar_type = updates.calendarType;

  const { data, error } = await supabase
    .from("calendars")
    .update(updateData)
    .eq("id", calendarId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw new AppError(
      `캘린더 수정 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data;
}

export const updateCalendarAction = withErrorHandling(_updateCalendar);

// ============================================
// 삭제 (soft delete)
// ============================================

async function _deleteCalendar(calendarId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

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
