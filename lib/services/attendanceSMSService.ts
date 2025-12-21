/**
 * 출석 SMS 발송 서비스
 * 학원 설정 및 학생별 설정을 확인하여 SMS 발송 여부를 결정하고 발송합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { sendAttendanceSMSInternal } from "@/app/actions/smsActions";
import type { AttendanceSMSSettings } from "@/lib/types/attendance";

/**
 * 출석 SMS 발송 여부 확인 결과
 */
export type ShouldSendAttendanceSMSResult = {
  shouldSend: boolean;
  reason?: string;
  details?: {
    tenantContextExists: boolean;
    tenantSettings?: {
      checkInEnabled?: boolean;
      checkOutEnabled?: boolean;
      absentEnabled?: boolean;
      lateEnabled?: boolean;
      studentCheckInEnabled?: boolean;
    };
    studentSettings?: {
      checkInEnabled?: boolean | null;
      checkOutEnabled?: boolean | null;
      absentEnabled?: boolean | null;
      lateEnabled?: boolean | null;
    };
    finalDecision?: string;
  };
};

/**
 * 출석 SMS 발송 여부 확인
 * 우선순위: 학생별 설정 > 학원 기본 설정
 */
export async function shouldSendAttendanceSMS(
  studentId: string,
  smsType: "check_in" | "check_out" | "absent" | "late",
  isStudentCheckIn: boolean = false
): Promise<ShouldSendAttendanceSMSResult> {
  const tenantContext = await getTenantContext();
  
  // 테넌트 컨텍스트 확인
  if (!tenantContext?.tenantId) {
    return {
      shouldSend: false,
      reason: "테넌트 컨텍스트를 찾을 수 없습니다.",
      details: {
        tenantContextExists: false,
      },
    };
  }

  const supabase = await createSupabaseServerClient();

  // 1. 학원 기본 설정 조회
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select(
      "attendance_sms_check_in_enabled, attendance_sms_check_out_enabled, attendance_sms_absent_enabled, attendance_sms_late_enabled, attendance_sms_student_checkin_enabled"
    )
    .eq("id", tenantContext.tenantId)
    .single();

  if (tenantError || !tenant) {
    return {
      shouldSend: false,
      reason: tenantError
        ? `테넌트 설정 조회 실패: ${tenantError.message}`
        : "테넌트 설정을 찾을 수 없습니다.",
      details: {
        tenantContextExists: true,
      },
    };
  }

  const tenantSettings = {
    checkInEnabled: tenant.attendance_sms_check_in_enabled ?? true,
    checkOutEnabled: tenant.attendance_sms_check_out_enabled ?? true,
    absentEnabled: tenant.attendance_sms_absent_enabled ?? true,
    lateEnabled: tenant.attendance_sms_late_enabled ?? true,
    studentCheckInEnabled: tenant.attendance_sms_student_checkin_enabled ?? false,
  };

  // 학생 직접 체크인인 경우 별도 설정 확인
  if (isStudentCheckIn) {
    if (!tenantSettings.studentCheckInEnabled) {
      return {
        shouldSend: false,
        reason: "학생 직접 체크인 시 SMS 발송 설정이 비활성화되어 있습니다.",
        details: {
          tenantContextExists: true,
          tenantSettings,
          finalDecision: "student_checkin_disabled",
        },
      };
    }
  }

  // 2. 학생별 설정 조회
  const { data: studentSettings, error: studentSettingsError } = await supabase
    .from("student_notification_preferences")
    .select(
      "attendance_check_in_enabled, attendance_check_out_enabled, attendance_absent_enabled, attendance_late_enabled"
    )
    .eq("student_id", studentId)
    .maybeSingle();

  if (studentSettingsError) {
    // 학생별 설정 조회 실패는 로그만 남기고 학원 기본 설정 사용
    console.warn(
      `[AttendanceSMS] 학생별 설정 조회 실패 (studentId: ${studentId}):`,
      studentSettingsError
    );
  }

  const studentSettingsData = studentSettings
    ? {
        checkInEnabled: studentSettings.attendance_check_in_enabled ?? null,
        checkOutEnabled: studentSettings.attendance_check_out_enabled ?? null,
        absentEnabled: studentSettings.attendance_absent_enabled ?? null,
        lateEnabled: studentSettings.attendance_late_enabled ?? null,
      }
    : undefined;

  // 3. SMS 타입별 설정 확인
  let studentSetting: boolean | null = null;
  let tenantSetting: boolean = true;
  let finalDecision: string;

  switch (smsType) {
    case "check_in":
      studentSetting = studentSettingsData?.checkInEnabled ?? null;
      tenantSetting = tenantSettings.checkInEnabled;
      break;
    case "check_out":
      studentSetting = studentSettingsData?.checkOutEnabled ?? null;
      tenantSetting = tenantSettings.checkOutEnabled;
      break;
    case "absent":
      studentSetting = studentSettingsData?.absentEnabled ?? null;
      tenantSetting = tenantSettings.absentEnabled;
      break;
    case "late":
      studentSetting = studentSettingsData?.lateEnabled ?? null;
      tenantSetting = tenantSettings.lateEnabled;
      break;
  }

  // 학생별 설정이 있으면 학생별 설정 사용, 없으면 학원 기본 설정 사용
  const shouldSend = studentSetting !== null ? studentSetting : tenantSetting;
  
  if (studentSetting !== null) {
    finalDecision = shouldSend
      ? "student_setting_enabled"
      : "student_setting_disabled";
  } else {
    finalDecision = shouldSend
      ? "tenant_setting_enabled"
      : "tenant_setting_disabled";
  }

  return {
    shouldSend,
    reason: shouldSend
      ? undefined
      : studentSetting !== null
      ? "학생별 설정에 의해 SMS 발송이 비활성화되어 있습니다."
      : "학원 기본 설정에 의해 SMS 발송이 비활성화되어 있습니다.",
    details: {
      tenantContextExists: true,
      tenantSettings,
      studentSettings: studentSettingsData,
      finalDecision,
    },
  };
}

/**
 * 설정 확인 후 출석 SMS 발송 결과
 */
export type SendAttendanceSMSResult = {
  success: boolean;
  skipped?: boolean; // 설정에 의해 건너뛴 경우
  error?: string;
  errorType?: "settings_disabled" | "send_failed" | "unknown";
  details?: Record<string, unknown>;
};

/**
 * 설정 확인 후 출석 SMS 발송
 */
export async function sendAttendanceSMSIfEnabled(
  studentId: string,
  smsType: "attendance_check_in" | "attendance_check_out" | "attendance_absent" | "attendance_late",
  variables: Record<string, string>,
  isStudentCheckIn: boolean = false
): Promise<SendAttendanceSMSResult> {
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
    const checkResult = await shouldSendAttendanceSMS(
      studentId,
      mappedType,
      isStudentCheckIn
    );

    if (!checkResult.shouldSend) {
      // 설정에 의해 발송하지 않음 (에러 아님)
      return {
        success: true,
        skipped: true,
        error: checkResult.reason,
        errorType: "settings_disabled",
        details: checkResult.details,
      };
    }

    // SMS 발송 (내부 함수 사용, 권한 체크 없음)
    const result = await sendAttendanceSMSInternal(studentId, smsType, variables);

    if (!result.success) {
      console.error(
        `[AttendanceSMS] ${smsType} 발송 실패:`,
        result.error
      );
      // SMS 발송 실패는 로그만 남기고 출석 기록 저장은 정상 처리
      return {
        success: true, // 출석 기록 저장은 성공으로 처리
        error: result.error,
        errorType: "send_failed",
        details: {
          smsType,
          studentId,
          isStudentCheckIn,
        },
      };
    }

    return {
      success: true,
      details: {
        smsType,
        studentId,
        isStudentCheckIn,
        msgId: result.data?.msgId,
      },
    };
  } catch (error: unknown) {
    console.error(`[AttendanceSMS] ${smsType} 발송 중 오류:`, error);
    // SMS 발송 실패는 로그만 남기고 출석 기록 저장은 정상 처리
    const errorMessage = error instanceof Error 
      ? error.message 
      : "알 수 없는 오류가 발생했습니다.";
    
    return {
      success: true, // 출석 기록 저장은 성공으로 처리
      error: errorMessage,
      errorType: "unknown",
      details: {
        smsType,
        studentId,
        isStudentCheckIn,
      },
    };
  }
}

