/**
 * Calendar 도메인 헬퍼 함수
 *
 * calendar_events 도메인 공통 유틸리티.
 *
 * @module lib/domains/calendar/helpers
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCachedCalendarId, invalidateCalendarId } from "@/lib/cache/calendarCache";
import type { EventType } from "./types";
import { pickNextCalendarColor } from "@/lib/constants/calendarColors";

// ============================================
// calendar_id resolve
// ============================================

/**
 * student_id → primary calendar_id 해석 (서버용)
 *
 * Calendar-First 모델: calendars.is_student_primary=true 직접 조회.
 * Primary 캘린더가 없으면 null 반환.
 *
 * unstable_cache(VERY_LONG TTL)로 캐싱 — Calendar ID는 불변.
 */
export async function resolveStudentPrimaryCalendarId(
  studentId: string
): Promise<string | null> {
  return getCachedCalendarId("student", studentId);
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

  // 기존 캘린더 색상 조회 → 자동 색상 할당
  const { data: existingCals } = await supabase
    .from("calendars")
    .select("default_color")
    .eq("owner_id", studentId)
    .is("deleted_at", null);
  const autoColor = pickNextCalendarColor(
    (existingCals ?? []).map((c) => c.default_color as string | null)
  );

  // Primary Calendar 생성 (race-safe: 동시 요청 시 unique violation 처리)
  const { data: calendar, error: calError } = await supabase
    .from("calendars")
    .insert({
      tenant_id: tenantId,
      owner_id: studentId,
      owner_type: "student",
      summary: "기본 캘린더",
      default_color: autoColor,
      is_primary: true,
      is_student_primary: true,
      source_type: "local",
    })
    .select("id")
    .single();

  if (calError) {
    // Race condition: 다른 요청이 먼저 생성한 경우 → 기존 캘린더 반환
    // revalidateTag는 렌더 중 호출 불가하므로 캐시 무효화 생략 (TTL 만료 시 자연 갱신)
    if (calError.code === "23505") {
      const { data: existing } = await supabase
        .from("calendars")
        .select("id")
        .eq("owner_id", studentId)
        .eq("is_student_primary", true)
        .is("deleted_at", null)
        .single();
      if (existing) return existing.id;
    }
    throw new Error(`Primary Calendar 생성 실패: ${calError.message}`);
  }

  // calendar_list 엔트리 생성 (필수) + 캐시 무효화 (best-effort, 렌더 중 revalidateTag 불가)
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
  invalidateCalendarId("student", studentId).catch(() => {});

  return calendar.id;
}

// ============================================
// admin calendar_id resolve
// ============================================

/**
 * admin_id → primary calendar_id 해석 (서버용)
 *
 * admin 소유 캘린더 중 is_primary=true 조회.
 * unstable_cache(VERY_LONG TTL)로 캐싱.
 */
export async function resolveAdminPrimaryCalendarId(
  adminId: string
): Promise<string | null> {
  return getCachedCalendarId("admin", adminId);
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

  // Primary Calendar 생성 (race-safe: 동시 요청 시 unique violation 처리)
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

  if (calError) {
    // Race condition: 다른 요청이 먼저 생성한 경우 → 기존 캘린더 반환
    if (calError.code === "23505") {
      const { data: existing } = await supabase
        .from("calendars")
        .select("id")
        .eq("owner_id", adminId)
        .eq("owner_type", "admin")
        .eq("is_primary", true)
        .is("deleted_at", null)
        .single();
      if (existing) return existing.id;
    }
    throw new Error(`Admin Primary Calendar 생성 실패: ${calError.message}`);
  }

  // calendar_list 엔트리 생성 (필수) + 캐시 무효화 (best-effort, 렌더 중 revalidateTag 불가)
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
  invalidateCalendarId("admin", adminId).catch(() => {});

  return calendar.id;
}

// ============================================
// tenant calendar_id resolve
// ============================================

/**
 * tenant_id → primary calendar_id 해석 (서버용)
 *
 * 테넌트(학원) 공유 캘린더 조회.
 * unstable_cache(VERY_LONG TTL)로 캐싱.
 */
export async function resolveTenantPrimaryCalendarId(
  tenantId: string
): Promise<string | null> {
  return getCachedCalendarId("tenant", tenantId);
}

/**
 * 테넌트 Primary Calendar 보장 (없으면 자동 생성)
 *
 * 학원 공유 캘린더. 상담/행사/휴원일 등 전체 구성원 공유 이벤트 용도.
 * calendar_list 엔트리는 별도 subscribeTenantCalendar()로 관리.
 */
export async function ensureTenantPrimaryCalendar(
  tenantId: string
): Promise<string> {
  const existing = await resolveTenantPrimaryCalendarId(tenantId);
  if (existing) return existing;

  // tenant calendar의 owner_id는 tenantId (유저가 아님) → RLS 우회 필요
  // 페이지 레벨에서 이미 인증 검증 완료된 후에만 호출
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Admin client 생성 실패");

  // 테넌트명 조회
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  const calendarName = tenant?.name ? `${tenant.name} 캘린더` : "학원 캘린더";

  const { data: calendar, error: calError } = await supabase
    .from("calendars")
    .insert({
      tenant_id: tenantId,
      owner_id: tenantId,
      owner_type: "tenant",
      summary: calendarName,
      is_primary: true,
      is_student_primary: false,
      source_type: "local",
    })
    .select("id")
    .single();

  if (calError) {
    // Race condition: 다른 요청이 먼저 생성한 경우 → 기존 캘린더 반환
    if (calError.code === "23505") {
      const { data: existing } = await supabase
        .from("calendars")
        .select("id")
        .eq("owner_id", tenantId)
        .eq("owner_type", "tenant")
        .eq("is_primary", true)
        .is("deleted_at", null)
        .single();
      if (existing) return existing.id;
    }
    throw new Error(`Tenant Primary Calendar 생성 실패: ${calError.message}`);
  }

  // 캐시 무효화 (best-effort, 렌더 중 revalidateTag 불가)
  invalidateCalendarId("tenant", tenantId).catch(() => {});

  return calendar.id;
}

/**
 * 사용자를 테넌트 캘린더에 구독 등록 (calendar_list에 추가)
 *
 * 이미 구독 중이면 스킵 (SELECT 1 → 0ms).
 * 관리자/컨설턴트 → writer, 학생 → reader.
 */
export async function subscribeTenantCalendar(
  userId: string,
  tenantCalendarId: string,
  accessRole: "writer" | "reader" = "writer"
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // 이미 구독 중인지 빠르게 확인 (count만 조회, 데이터 전송 0)
  const { count } = await supabase
    .from("calendar_list")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("calendar_id", tenantCalendarId);

  if (count && count > 0) return;

  await supabase
    .from("calendar_list")
    .upsert(
      {
        user_id: userId,
        calendar_id: tenantCalendarId,
        display_name: "학원 캘린더",
        is_visible: true,
        access_role: accessRole,
        sort_order: -1, // 학원 캘린더는 최상단
      },
      { onConflict: "user_id,calendar_id" }
    );
}

/**
 * 테넌트 소속 전체 관리자를 테넌트 캘린더에 일괄 구독
 *
 * 테넌트 캘린더 최초 생성 시 또는 동기화 시 호출.
 */
export async function subscribeAllAdminsToTenantCalendar(
  tenantId: string,
  tenantCalendarId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // is_active는 user_profiles에서 관리
  const { data: admins } = await supabase
    .from("admin_users")
    .select("id, user_profiles!inner(is_active)")
    .eq("tenant_id", tenantId)
    .eq("user_profiles.is_active", true);

  if (!admins || admins.length === 0) return;

  const entries = admins.map((admin) => ({
    user_id: admin.id,
    calendar_id: tenantCalendarId,
    display_name: "학원 캘린더",
    is_visible: true,
    access_role: "writer" as const,
    sort_order: -1,
  }));

  await supabase
    .from("calendar_list")
    .upsert(entries, { onConflict: "user_id,calendar_id" });
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

/**
 * @deprecated label 직접 할당으로 대체. Stage 2 DROP 후 삭제 예정.
 * Korean non-study type → calendar_events event_type + event_subtype
 */
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

/**
 * @deprecated label 직접 할당으로 대체. Stage 2 DROP 후 삭제 예정.
 * exclusion_type → event_subtype 변환
 */
export function mapExclusionType(exclusionType: string): string {
  return exclusionType || "기타";
}
