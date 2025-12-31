"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/guards";
import { canAccessStudent } from "../utils";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import { logActionError } from "@/lib/logging/actionLogger";
import type { StudentAttendanceNotificationSettings } from "../types";

/**
 * 학생별 출석 알림 설정 조회
 */
async function _getStudentAttendanceNotificationSettings(
  studentId: string
): Promise<StudentAttendanceNotificationSettings | null> {
  const { userId } = await requireParent();

  const supabase = await createSupabaseServerClient();

  // 학부모가 해당 학생에 접근 권한이 있는지 확인
  const hasAccess = await canAccessStudent(supabase, userId, studentId);
  if (!hasAccess) {
    throw new AppError(
      "해당 학생에 대한 접근 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // 학생별 출석 알림 설정 조회
  const { data: settings, error } = await supabase
    .from("student_notification_preferences")
    .select(
      "attendance_check_in_enabled, attendance_check_out_enabled, attendance_absent_enabled, attendance_late_enabled"
    )
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    logActionError(
      { domain: "parent", action: "getStudentAttendanceNotificationSettings" },
      error,
      { studentId }
    );
    throw new AppError(
      "설정 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return settings
    ? {
        attendance_check_in_enabled: settings.attendance_check_in_enabled ?? null,
        attendance_check_out_enabled: settings.attendance_check_out_enabled ?? null,
        attendance_absent_enabled: settings.attendance_absent_enabled ?? null,
        attendance_late_enabled: settings.attendance_late_enabled ?? null,
      }
    : null;
}

export const getStudentAttendanceNotificationSettings = withActionResponse(
  _getStudentAttendanceNotificationSettings
);

/**
 * 학생별 출석 알림 설정 업데이트
 */
async function _updateStudentAttendanceNotificationSettings(
  studentId: string,
  settings: StudentAttendanceNotificationSettings
): Promise<void> {
  const { userId } = await requireParent();

  const supabase = await createSupabaseServerClient();

  // 학부모가 해당 학생에 접근 권한이 있는지 확인
  const hasAccess = await canAccessStudent(supabase, userId, studentId);
  if (!hasAccess) {
    throw new AppError(
      "해당 학생에 대한 접근 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // 기존 설정 확인
  const { data: existing } = await supabase
    .from("student_notification_preferences")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing) {
    // 업데이트 (출석 관련 설정만 업데이트)
    const { error } = await supabase
      .from("student_notification_preferences")
      .update({
        attendance_check_in_enabled: settings.attendance_check_in_enabled,
        attendance_check_out_enabled: settings.attendance_check_out_enabled,
        attendance_absent_enabled: settings.attendance_absent_enabled,
        attendance_late_enabled: settings.attendance_late_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId);

    if (error) {
      logActionError(
        { domain: "parent", action: "updateStudentAttendanceNotificationSettings" },
        error,
        { studentId, operation: "update" }
      );
      throw new AppError(
        "설정 저장에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  } else {
    // 생성 (기본값으로 다른 필드도 함께 생성)
    const { error } = await supabase
      .from("student_notification_preferences")
      .insert({
        student_id: studentId,
        plan_start_enabled: true,
        plan_complete_enabled: true,
        daily_goal_achieved_enabled: true,
        weekly_report_enabled: true,
        plan_delay_enabled: true,
        plan_delay_threshold_minutes: 30,
        notification_time_start: "09:00",
        notification_time_end: "22:00",
        quiet_hours_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
        attendance_check_in_enabled: settings.attendance_check_in_enabled,
        attendance_check_out_enabled: settings.attendance_check_out_enabled,
        attendance_absent_enabled: settings.attendance_absent_enabled,
        attendance_late_enabled: settings.attendance_late_enabled,
      });

    if (error) {
      logActionError(
        { domain: "parent", action: "updateStudentAttendanceNotificationSettings" },
        error,
        { studentId, operation: "insert" }
      );
      throw new AppError(
        "설정 저장에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  revalidatePath("/parent/settings");
}

export const updateStudentAttendanceNotificationSettings = withActionResponse(
  _updateStudentAttendanceNotificationSettings
);
