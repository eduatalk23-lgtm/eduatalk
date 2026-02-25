/**
 * Calendar 도메인 헬퍼 함수
 *
 * calendar_events 도메인 공통 유틸리티.
 *
 * @module lib/domains/calendar/helpers
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventType } from "./types";

// ============================================
// calendar_id resolve
// ============================================

/**
 * student_id → primary calendar_id 해석 (서버용)
 *
 * Calendar-First 모델: calendars.is_student_primary=true 직접 조회.
 * Primary 캘린더가 없으면 null 반환.
 *
 * ⚠️ maybeSingle() 대신 limit(1) 사용: UNIQUE INDEX로 보호되지만
 *    방어적 코딩으로 중복 행 시에도 에러 대신 첫 번째 결과 반환.
 */
export async function resolveStudentPrimaryCalendarId(
  studentId: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("id")
    .eq("owner_id", studentId)
    .eq("is_student_primary", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0].id;
}

/**
 * 학생의 Primary Calendar 보장 (없으면 자동 생성)
 *
 * Calendar-First 모델: 학생당 1개 Primary Calendar 필수.
 * calendar_list 엔트리도 함께 생성.
 */
export async function ensureStudentPrimaryCalendar(
  studentId: string,
  tenantId: string
): Promise<string> {
  const existing = await resolveStudentPrimaryCalendarId(studentId);
  if (existing) return existing;

  const supabase = await createSupabaseServerClient();

  // Primary Calendar 생성
  const { data: calendar, error: calError } = await supabase
    .from("calendars")
    .insert({
      tenant_id: tenantId,
      owner_id: studentId,
      owner_type: "student",
      summary: "기본 캘린더",
      is_primary: true,
      is_student_primary: true,
      source_type: "local",
    })
    .select("id")
    .single();

  if (calError || !calendar) {
    throw new Error(`Primary Calendar 생성 실패: ${calError?.message}`);
  }

  // calendar_list 엔트리 생성
  await supabase
    .from("calendar_list")
    .insert({
      user_id: studentId,
      calendar_id: calendar.id,
      display_name: "기본 캘린더",
      is_visible: true,
      access_role: "owner",
      sort_order: 0,
    });

  return calendar.id;
}

// ============================================
// admin calendar_id resolve
// ============================================

/**
 * admin_id → primary calendar_id 해석 (서버용)
 *
 * admin 소유 캘린더 중 is_primary=true 조회.
 * Primary 캘린더가 없으면 null 반환.
 *
 * ⚠️ maybeSingle() 대신 limit(1)을 사용: 중복 행이 있으면 maybeSingle()이
 *    에러를 반환하여 "없음"으로 처리되고 무한 중복 생성이 발생하는 버그 방지.
 */
export async function resolveAdminPrimaryCalendarId(
  adminId: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("id")
    .eq("owner_id", adminId)
    .eq("owner_type", "admin")
    .eq("is_primary", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0].id;
}

/**
 * 관리자의 Primary Calendar 보장 (없으면 자동 생성)
 *
 * 관리자용 개인 캘린더. calendar_list 엔트리도 함께 생성.
 */
export async function ensureAdminPrimaryCalendar(
  adminId: string,
  tenantId: string
): Promise<string> {
  const existing = await resolveAdminPrimaryCalendarId(adminId);
  if (existing) return existing;

  const supabase = await createSupabaseServerClient();

  // Primary Calendar 생성
  const { data: calendar, error: calError } = await supabase
    .from("calendars")
    .insert({
      tenant_id: tenantId,
      owner_id: adminId,
      owner_type: "admin",
      summary: "내 캘린더",
      is_primary: true,
      is_student_primary: false,
      source_type: "local",
    })
    .select("id")
    .single();

  if (calError || !calendar) {
    throw new Error(`Admin Primary Calendar 생성 실패: ${calError?.message}`);
  }

  // calendar_list 엔트리 생성
  await supabase
    .from("calendar_list")
    .insert({
      user_id: adminId,
      calendar_id: calendar.id,
      display_name: "내 캘린더",
      is_visible: true,
      access_role: "owner",
      sort_order: 0,
    });

  return calendar.id;
}

// ============================================
// 시간 변환 유틸리티
// ============================================

/**
 * plan_date + start_time (HH:mm) → TIMESTAMPTZ ISO 문자열
 *
 * @example toTimestamptz("2026-02-22", "09:00") → "2026-02-22T09:00:00+09:00"
 */
export function toTimestamptz(
  date: string,
  time: string,
  tz = "Asia/Seoul"
): string {
  // Asia/Seoul = +09:00
  const offsetMap: Record<string, string> = {
    "Asia/Seoul": "+09:00",
    UTC: "+00:00",
  };
  const offset = offsetMap[tz] ?? "+09:00";

  // HH:mm → HH:mm:ss 보정
  const normalizedTime = time.length === 5 ? `${time}:00` : time;

  return `${date}T${normalizedTime}${offset}`;
}

// ============================================
// type 매핑
// ============================================

/** Korean non-study type → calendar_events event_type + event_subtype */
export function mapNonStudyType(type: string): {
  eventType: EventType;
  eventSubtype: string;
} {
  switch (type) {
    case "학원":
      return { eventType: "academy", eventSubtype: "학원" };
    case "이동시간":
      return { eventType: "academy", eventSubtype: "이동시간" };
    case "아침식사":
      return { eventType: "non_study", eventSubtype: "아침식사" };
    case "점심식사":
      return { eventType: "non_study", eventSubtype: "점심식사" };
    case "저녁식사":
      return { eventType: "non_study", eventSubtype: "저녁식사" };
    case "수면":
      return { eventType: "non_study", eventSubtype: "수면" };
    case "제외일":
      return { eventType: "exclusion", eventSubtype: "기타" };
    default:
      return { eventType: "non_study", eventSubtype: type || "기타" };
  }
}

/** exclusion_type → event_subtype 변환 */
export function mapExclusionType(exclusionType: string): string {
  // exclusion_type 값은 그대로 event_subtype으로 매핑
  return exclusionType || "기타";
}
