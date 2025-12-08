"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { canAccessStudent } from "../_utils";
import { revalidatePath } from "next/cache";

type StudentAttendanceNotificationSettings = {
  attendance_check_in_enabled: boolean | null;
  attendance_check_out_enabled: boolean | null;
  attendance_absent_enabled: boolean | null;
  attendance_late_enabled: boolean | null;
};

/**
 * 학생별 출석 알림 설정 조회
 */
export async function getStudentAttendanceNotificationSettings(
  studentId: string
): Promise<{
  success: boolean;
  data?: StudentAttendanceNotificationSettings | null;
  error?: string;
}> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || role !== "parent") {
      return {
        success: false,
        error: "학부모 권한이 필요합니다.",
      };
    }

    const supabase = await createSupabaseServerClient();

    // 학부모가 해당 학생에 접근 권한이 있는지 확인
    const hasAccess = await canAccessStudent(supabase, userId, studentId);
    if (!hasAccess) {
      return {
        success: false,
        error: "해당 학생에 대한 접근 권한이 없습니다.",
      };
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
      console.error(
        "[parentSettings] 출석 알림 설정 조회 실패:",
        error
      );
      return {
        success: false,
        error: "설정 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: settings
        ? {
            attendance_check_in_enabled:
              settings.attendance_check_in_enabled ?? null,
            attendance_check_out_enabled:
              settings.attendance_check_out_enabled ?? null,
            attendance_absent_enabled:
              settings.attendance_absent_enabled ?? null,
            attendance_late_enabled: settings.attendance_late_enabled ?? null,
          }
        : null,
    };
  } catch (error: any) {
    console.error("[parentSettings] 오류:", error);
    return {
      success: false,
      error: error.message || "설정 조회 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학생별 출석 알림 설정 업데이트
 */
export async function updateStudentAttendanceNotificationSettings(
  studentId: string,
  settings: StudentAttendanceNotificationSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || role !== "parent") {
      return {
        success: false,
        error: "학부모 권한이 필요합니다.",
      };
    }

    const supabase = await createSupabaseServerClient();

    // 학부모가 해당 학생에 접근 권한이 있는지 확인
    const hasAccess = await canAccessStudent(supabase, userId, studentId);
    if (!hasAccess) {
      return {
        success: false,
        error: "해당 학생에 대한 접근 권한이 없습니다.",
      };
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
        console.error(
          "[parentSettings] 출석 알림 설정 업데이트 실패:",
          error
        );
        return {
          success: false,
          error: "설정 저장에 실패했습니다.",
        };
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
        console.error(
          "[parentSettings] 출석 알림 설정 생성 실패:",
          error
        );
        return {
          success: false,
          error: "설정 저장에 실패했습니다.",
        };
      }
    }

    revalidatePath("/parent/settings");
    return { success: true };
  } catch (error: any) {
    console.error("[parentSettings] 오류:", error);
    return {
      success: false,
      error: error.message || "설정 저장 중 오류가 발생했습니다.",
    };
  }
}

