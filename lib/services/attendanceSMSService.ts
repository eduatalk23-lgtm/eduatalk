/**
 * 출석 SMS 발송 서비스
 * 학원 설정 및 학생별 설정을 확인하여 SMS 발송 여부를 결정하고 발송합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { sendAttendanceSMS } from "@/app/actions/smsActions";
import type { AttendanceSMSSettings } from "@/lib/types/attendance";

/**
 * 출석 SMS 발송 여부 확인
 * 우선순위: 학생별 설정 > 학원 기본 설정
 */
export async function shouldSendAttendanceSMS(
  studentId: string,
  smsType: "check_in" | "check_out" | "absent" | "late",
  isStudentCheckIn: boolean = false
): Promise<boolean> {
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return false;
  }

  const supabase = await createSupabaseServerClient();

  // 1. 학원 기본 설정 조회
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "attendance_sms_check_in_enabled, attendance_sms_check_out_enabled, attendance_sms_absent_enabled, attendance_sms_late_enabled, attendance_sms_student_checkin_enabled"
    )
    .eq("id", tenantContext.tenantId)
    .single();

  if (!tenant) {
    return false;
  }

  // 학생 직접 체크인인 경우 별도 설정 확인
  if (isStudentCheckIn) {
    if (!tenant.attendance_sms_student_checkin_enabled) {
      return false;
    }
  }

  // 2. 학생별 설정 조회
  const { data: studentSettings } = await supabase
    .from("student_notification_preferences")
    .select(
      "attendance_check_in_enabled, attendance_check_out_enabled, attendance_absent_enabled, attendance_late_enabled"
    )
    .eq("student_id", studentId)
    .maybeSingle();

  // 3. SMS 타입별 설정 확인
  let studentSetting: boolean | null = null;
  let tenantSetting: boolean = true;

  switch (smsType) {
    case "check_in":
      studentSetting = studentSettings?.attendance_check_in_enabled ?? null;
      tenantSetting = tenant.attendance_sms_check_in_enabled ?? true;
      break;
    case "check_out":
      studentSetting = studentSettings?.attendance_check_out_enabled ?? null;
      tenantSetting = tenant.attendance_sms_check_out_enabled ?? true;
      break;
    case "absent":
      studentSetting = studentSettings?.attendance_absent_enabled ?? null;
      tenantSetting = tenant.attendance_sms_absent_enabled ?? true;
      break;
    case "late":
      studentSetting = studentSettings?.attendance_late_enabled ?? null;
      tenantSetting = tenant.attendance_sms_late_enabled ?? true;
      break;
  }

  // 학생별 설정이 있으면 학생별 설정 사용, 없으면 학원 기본 설정 사용
  return studentSetting !== null ? studentSetting : tenantSetting;
}

/**
 * 설정 확인 후 출석 SMS 발송
 */
export async function sendAttendanceSMSIfEnabled(
  studentId: string,
  smsType: "attendance_check_in" | "attendance_check_out" | "attendance_absent" | "attendance_late",
  variables: Record<string, string>,
  isStudentCheckIn: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // SMS 타입 매핑
    const smsTypeMap: Record<
      typeof smsType,
      "check_in" | "check_out" | "absent" | "late"
    > = {
      attendance_check_in: "check_in",
      attendance_check_out: "check_out",
      attendance_absent: "absent",
      attendance_late: "late",
    };

    const mappedType = smsTypeMap[smsType];

    // SMS 발송 여부 확인
    const shouldSend = await shouldSendAttendanceSMS(
      studentId,
      mappedType,
      isStudentCheckIn
    );

    if (!shouldSend) {
      // 설정에 의해 발송하지 않음 (에러 아님)
      return { success: true };
    }

    // SMS 발송
    const result = await sendAttendanceSMS(studentId, smsType, variables);

    if (!result.success) {
      console.error(
        `[AttendanceSMS] ${smsType} 발송 실패:`,
        result.error
      );
      // SMS 발송 실패는 로그만 남기고 출석 기록 저장은 정상 처리
      return { success: true }; // 출석 기록 저장은 성공으로 처리
    }

    return { success: true };
  } catch (error: any) {
    console.error(`[AttendanceSMS] ${smsType} 발송 중 오류:`, error);
    // SMS 발송 실패는 로그만 남기고 출석 기록 저장은 정상 처리
    return { success: true }; // 출석 기록 저장은 성공으로 처리
  }
}

