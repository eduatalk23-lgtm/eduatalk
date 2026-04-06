/**
 * Calendar 도메인 공유 인증/인가 유틸리티 (DAL 패턴)
 *
 * Next.js 공식 권고: 모든 Server Action은 자체 인증 가드 필수.
 * calendars.ts, events.ts 등에서 공통 사용.
 *
 * @module lib/domains/calendar/actions/calendarAuth
 */

import { getCurrentUser, type CurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode } from "@/lib/errors";

export type CalendarAccessResult = {
  user: CurrentUser;
  tenantId: string;
  isAdmin: boolean;
};

/**
 * 권한 체크 (Admin/Consultant, 해당 학생 본인, 또는 연결된 학부모)
 *
 * @throws UNAUTHORIZED — 미인증
 * @throws VALIDATION_ERROR — tenantId 누락
 * @throws FORBIDDEN — 접근 권한 없음
 */
export async function checkCalendarAccess(
  targetStudentId: string
): Promise<CalendarAccessResult> {
  const user = await getCurrentUser();
  if (!user)
    throw new AppError(
      "인증이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  if (!user.tenantId)
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );

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
  throw new AppError(
    "접근 권한이 없습니다.",
    ErrorCode.FORBIDDEN,
    403,
    true
  );
}

/**
 * calendarId로 소유자를 조회한 뒤 접근 권한 확인
 */
export async function checkCalendarAccessByCalendarId(
  calendarId: string
): Promise<CalendarAccessResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendars")
    .select("owner_id")
    .eq("id", calendarId)
    .is("deleted_at", null)
    .single();

  if (error || !data?.owner_id) {
    throw new AppError(
      "캘린더를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return checkCalendarAccess(data.owner_id);
}

/**
 * eventId로 캘린더 → 소유자를 조회한 뒤 접근 권한 확인
 */
export async function checkCalendarAccessByEventId(
  eventId: string
): Promise<CalendarAccessResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("calendar_id")
    .eq("id", eventId)
    .is("deleted_at", null)
    .single();

  if (error || !data?.calendar_id) {
    throw new AppError(
      "이벤트를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return checkCalendarAccessByCalendarId(data.calendar_id);
}

/**
 * planGroupId로 학생을 조회한 뒤 접근 권한 확인
 */
export async function checkCalendarAccessByPlanGroupId(
  planGroupId: string
): Promise<CalendarAccessResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_groups")
    .select("student_id")
    .eq("id", planGroupId)
    .is("deleted_at", null)
    .single();

  if (error || !data?.student_id) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return checkCalendarAccess(data.student_id);
}
