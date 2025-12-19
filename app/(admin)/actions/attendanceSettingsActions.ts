"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { revalidatePath } from "next/cache";
import {
  AppError,
  ErrorCode,
  normalizeError,
  getUserFacingMessage,
  logError,
} from "@/lib/errors";
import { DATABASE_ERROR_CODES } from "@/lib/constants/databaseErrorCodes";
import type { AttendanceSMSSettings } from "@/lib/types/attendance";

export type LocationSettingsInput = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

/**
 * 위치 설정 업데이트
 */
export async function updateLocationSettings(
  input: LocationSettingsInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "테넌트 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 좌표 유효성 검증
    if (
      typeof input.latitude !== "number" ||
      typeof input.longitude !== "number" ||
      isNaN(input.latitude) ||
      isNaN(input.longitude)
    ) {
      throw new AppError(
        "유효하지 않은 좌표입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (
      input.latitude < -90 ||
      input.latitude > 90 ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      throw new AppError(
        "좌표가 범위를 벗어났습니다. (위도: -90~90, 경도: -180~180)",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (
      typeof input.radiusMeters !== "number" ||
      isNaN(input.radiusMeters) ||
      input.radiusMeters <= 0
    ) {
      throw new AppError(
        "반경은 0보다 큰 숫자여야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 위치 정보 업데이트
    const { error } = await supabase
      .from("tenants")
      .update({
        location_latitude: input.latitude,
        location_longitude: input.longitude,
        location_radius_meters: input.radiusMeters,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantContext.tenantId);

    if (error) {
      console.error("[attendanceSettings] 위치 설정 업데이트 실패:", error);
      throw new AppError(
        error.message || "위치 설정 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    revalidatePath("/admin/attendance/settings");
    return { success: true };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    logError(normalizedError, { function: "updateLocationSettings" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * 현재 위치 설정 조회
 */
export async function getLocationSettings(): Promise<{
  success: boolean;
  data?: {
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number | null;
  } | null;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "테넌트 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("location_latitude, location_longitude, location_radius_meters")
      .eq("id", tenantContext.tenantId)
      .single();

    if (error) {
      console.error("[attendanceSettings] 위치 설정 조회 실패:", error);
      throw new AppError(
        error.message || "위치 설정 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    if (!tenant) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        latitude: tenant.location_latitude,
        longitude: tenant.location_longitude,
        radiusMeters: tenant.location_radius_meters,
      },
    };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    logError(normalizedError, { function: "getLocationSettings" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * 출석 SMS 설정 조회
 */
export async function getAttendanceSMSSettings(): Promise<{
  success: boolean;
  data?: AttendanceSMSSettings | null;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "테넌트 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select(
        "attendance_sms_check_in_enabled, attendance_sms_check_out_enabled, attendance_sms_absent_enabled, attendance_sms_late_enabled, attendance_sms_student_checkin_enabled, attendance_sms_recipient, attendance_sms_show_failure_to_user"
      )
      .eq("id", tenantContext.tenantId)
      .single();

    if (error) {
      console.error("[attendanceSettings] SMS 설정 조회 실패:", error);
      throw new AppError(
        error.message || "SMS 설정 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    if (!tenant) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        attendance_sms_check_in_enabled:
          tenant.attendance_sms_check_in_enabled ?? true,
        attendance_sms_check_out_enabled:
          tenant.attendance_sms_check_out_enabled ?? true,
        attendance_sms_absent_enabled:
          tenant.attendance_sms_absent_enabled ?? true,
        attendance_sms_late_enabled: tenant.attendance_sms_late_enabled ?? true,
        attendance_sms_student_checkin_enabled:
          tenant.attendance_sms_student_checkin_enabled ?? false,
        attendance_sms_recipient:
          (tenant.attendance_sms_recipient as 'mother' | 'father' | 'both' | 'auto') ?? 'auto',
        attendance_sms_show_failure_to_user:
          tenant.attendance_sms_show_failure_to_user ?? false,
      },
    };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    logError(normalizedError, { function: "getAttendanceSMSSettings" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * 출석 SMS 설정 업데이트
 */
export async function updateAttendanceSMSSettings(
  input: AttendanceSMSSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "테넌트 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 입력 데이터 검증
    const validRecipientValues = ['mother', 'father', 'both', 'auto'] as const;
    if (!validRecipientValues.includes(input.attendance_sms_recipient)) {
      throw new AppError(
        `SMS 수신자 선택 값이 올바르지 않습니다. 허용된 값: ${validRecipientValues.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // boolean 값 검증
    if (
      typeof input.attendance_sms_check_in_enabled !== 'boolean' ||
      typeof input.attendance_sms_check_out_enabled !== 'boolean' ||
      typeof input.attendance_sms_absent_enabled !== 'boolean' ||
      typeof input.attendance_sms_late_enabled !== 'boolean' ||
      typeof input.attendance_sms_student_checkin_enabled !== 'boolean'
    ) {
      throw new AppError(
        'SMS 설정 값이 올바르지 않습니다. 모든 설정은 boolean 값이어야 합니다.',
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // Admin 클라이언트 사용 (RLS 정책 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "서버 설정 오류가 발생했습니다. 관리자에게 문의하세요.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 업데이트할 데이터 준비
    const updateData = {
      attendance_sms_check_in_enabled: input.attendance_sms_check_in_enabled,
      attendance_sms_check_out_enabled:
        input.attendance_sms_check_out_enabled,
      attendance_sms_absent_enabled: input.attendance_sms_absent_enabled,
      attendance_sms_late_enabled: input.attendance_sms_late_enabled,
      attendance_sms_student_checkin_enabled:
        input.attendance_sms_student_checkin_enabled,
      attendance_sms_recipient: input.attendance_sms_recipient,
      attendance_sms_show_failure_to_user:
        input.attendance_sms_show_failure_to_user ?? false,
      updated_at: new Date().toISOString(),
    };

    console.log("[attendanceSettings] SMS 설정 업데이트 시작:", {
      tenantId: tenantContext.tenantId,
      inputData: input,
      updateData,
      usingAdminClient: true,
    });

    // SMS 설정 업데이트
    const { error, data } = await supabase
      .from("tenants")
      .update(updateData)
      .eq("id", tenantContext.tenantId)
      .select(
        "attendance_sms_check_in_enabled, attendance_sms_check_out_enabled, attendance_sms_absent_enabled, attendance_sms_late_enabled, attendance_sms_student_checkin_enabled, attendance_sms_recipient, attendance_sms_show_failure_to_user"
      );

    // 에러 처리
    if (error) {
      console.error("[attendanceSettings] SMS 설정 업데이트 실패:", {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        tenantId: tenantContext.tenantId,
        updateData,
        isRLSPolicyViolation: error.code === DATABASE_ERROR_CODES.RLS_POLICY_VIOLATION,
      });

      // RLS 정책 위반 에러 명시적 처리
      if (error.code === DATABASE_ERROR_CODES.RLS_POLICY_VIOLATION) {
        throw new AppError(
          "권한이 없습니다. 관리자 권한으로 다시 시도해주세요.",
          ErrorCode.FORBIDDEN,
          403,
          true
        );
      }

      throw new AppError(
        error.message || "SMS 설정 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // update().select() 결과 확인
    if (!data || data.length === 0) {
      const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
      const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : undefined;
      console.error("[attendanceSettings] 업데이트된 행이 없습니다:", {
        tenantId: tenantContext.tenantId,
        updateData,
        errorCode,
        errorMessage,
      });
      throw new AppError(
        "SMS 설정 업데이트에 실패했습니다. 업데이트된 행이 없습니다. RLS 정책 문제일 수 있습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    const updatedRow = data[0];
    console.log("[attendanceSettings] 업데이트 직후 결과 확인:", {
      tenantId: tenantContext.tenantId,
      updatedRow,
      requested: updateData,
      immediateMatch: {
        checkIn: updatedRow.attendance_sms_check_in_enabled === input.attendance_sms_check_in_enabled,
        checkOut: updatedRow.attendance_sms_check_out_enabled === input.attendance_sms_check_out_enabled,
        absent: updatedRow.attendance_sms_absent_enabled === input.attendance_sms_absent_enabled,
        late: updatedRow.attendance_sms_late_enabled === input.attendance_sms_late_enabled,
        studentCheckIn: updatedRow.attendance_sms_student_checkin_enabled === input.attendance_sms_student_checkin_enabled,
        recipient: updatedRow.attendance_sms_recipient === input.attendance_sms_recipient,
        showFailure: updatedRow.attendance_sms_show_failure_to_user === (input.attendance_sms_show_failure_to_user ?? false),
      },
    });

    // 업데이트 직후 값 불일치 확인
    const mismatches: string[] = [];
    if (updatedRow.attendance_sms_check_in_enabled !== input.attendance_sms_check_in_enabled) {
      mismatches.push(`입실 알림: 요청=${input.attendance_sms_check_in_enabled}, 저장=${updatedRow.attendance_sms_check_in_enabled}`);
    }
    if (updatedRow.attendance_sms_check_out_enabled !== input.attendance_sms_check_out_enabled) {
      mismatches.push(`퇴실 알림: 요청=${input.attendance_sms_check_out_enabled}, 저장=${updatedRow.attendance_sms_check_out_enabled}`);
    }
    if (updatedRow.attendance_sms_absent_enabled !== input.attendance_sms_absent_enabled) {
      mismatches.push(`결석 알림: 요청=${input.attendance_sms_absent_enabled}, 저장=${updatedRow.attendance_sms_absent_enabled}`);
    }
    if (updatedRow.attendance_sms_late_enabled !== input.attendance_sms_late_enabled) {
      mismatches.push(`지각 알림: 요청=${input.attendance_sms_late_enabled}, 저장=${updatedRow.attendance_sms_late_enabled}`);
    }
    if (updatedRow.attendance_sms_student_checkin_enabled !== input.attendance_sms_student_checkin_enabled) {
      mismatches.push(`학생 직접 체크인: 요청=${input.attendance_sms_student_checkin_enabled}, 저장=${updatedRow.attendance_sms_student_checkin_enabled}`);
    }
    if (updatedRow.attendance_sms_recipient !== input.attendance_sms_recipient) {
      mismatches.push(`SMS 수신자: 요청=${input.attendance_sms_recipient}, 저장=${updatedRow.attendance_sms_recipient}`);
    }
    if (updatedRow.attendance_sms_show_failure_to_user !== (input.attendance_sms_show_failure_to_user ?? false)) {
      mismatches.push(`SMS 발송 실패 알림: 요청=${input.attendance_sms_show_failure_to_user ?? false}, 저장=${updatedRow.attendance_sms_show_failure_to_user}`);
    }

    if (mismatches.length > 0) {
      console.error("[attendanceSettings] 업데이트 직후 값 불일치 감지:", {
        tenantId: tenantContext.tenantId,
        mismatches,
        updatedRow,
        requested: updateData,
      });
      throw new AppError(
        `SMS 설정 저장 중 오류가 발생했습니다. 일부 설정이 올바르게 저장되지 않았습니다: ${mismatches.join(", ")}`,
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 추가 검증: 재조회하여 최종 확인 (이중 검증)
    const { data: verifyData, error: verifyError } = await supabase
      .from("tenants")
      .select(
        "attendance_sms_check_in_enabled, attendance_sms_check_out_enabled, attendance_sms_absent_enabled, attendance_sms_late_enabled, attendance_sms_student_checkin_enabled, attendance_sms_recipient, attendance_sms_show_failure_to_user"
      )
      .eq("id", tenantContext.tenantId)
      .single();

    if (verifyError) {
      console.error("[attendanceSettings] SMS 설정 재검증 실패:", {
        error: verifyError,
        errorCode: verifyError.code,
        errorMessage: verifyError.message,
        tenantId: tenantContext.tenantId,
      });
      // 재검증 실패는 경고만 로깅 (이미 업데이트는 성공했을 수 있음)
    } else if (verifyData) {
      // 최종 검증: 재조회한 값과 요청한 값 비교
      const finalMismatches: string[] = [];
      if (verifyData.attendance_sms_recipient !== input.attendance_sms_recipient) {
        finalMismatches.push(`SMS 수신자: 요청=${input.attendance_sms_recipient}, 저장=${verifyData.attendance_sms_recipient}`);
      }
      if (verifyData.attendance_sms_student_checkin_enabled !== input.attendance_sms_student_checkin_enabled) {
        finalMismatches.push(`학생 직접 체크인: 요청=${input.attendance_sms_student_checkin_enabled}, 저장=${verifyData.attendance_sms_student_checkin_enabled}`);
      }
      if (verifyData.attendance_sms_check_in_enabled !== input.attendance_sms_check_in_enabled) {
        finalMismatches.push(`입실 알림: 요청=${input.attendance_sms_check_in_enabled}, 저장=${verifyData.attendance_sms_check_in_enabled}`);
      }
      if (verifyData.attendance_sms_check_out_enabled !== input.attendance_sms_check_out_enabled) {
        finalMismatches.push(`퇴실 알림: 요청=${input.attendance_sms_check_out_enabled}, 저장=${verifyData.attendance_sms_check_out_enabled}`);
      }
      if (verifyData.attendance_sms_absent_enabled !== input.attendance_sms_absent_enabled) {
        finalMismatches.push(`결석 알림: 요청=${input.attendance_sms_absent_enabled}, 저장=${verifyData.attendance_sms_absent_enabled}`);
      }
      if (verifyData.attendance_sms_late_enabled !== input.attendance_sms_late_enabled) {
        finalMismatches.push(`지각 알림: 요청=${input.attendance_sms_late_enabled}, 저장=${verifyData.attendance_sms_late_enabled}`);
      }
      if (verifyData.attendance_sms_show_failure_to_user !== (input.attendance_sms_show_failure_to_user ?? false)) {
        finalMismatches.push(`SMS 발송 실패 알림: 요청=${input.attendance_sms_show_failure_to_user ?? false}, 저장=${verifyData.attendance_sms_show_failure_to_user}`);
      }

      if (finalMismatches.length > 0) {
        console.error("[attendanceSettings] 재검증 시 값 불일치 감지:", {
          tenantId: tenantContext.tenantId,
          mismatches: finalMismatches,
          verifyData,
          requested: input,
        });
        throw new AppError(
          `SMS 설정 저장 후 검증 중 오류가 발생했습니다. 일부 설정이 올바르게 저장되지 않았습니다: ${finalMismatches.join(", ")}`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      console.log("[attendanceSettings] SMS 설정 업데이트 성공 및 검증 완료:", {
        tenantId: tenantContext.tenantId,
        savedData: verifyData,
        allFieldsMatch: true,
      });
    }

    revalidatePath("/admin/attendance/settings");
    return { success: true };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    logError(normalizedError, { function: "updateAttendanceSMSSettings" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * 학생별 출석 알림 설정 업데이트
 */
export async function updateStudentAttendanceSettings(
  studentId: string,
  settings: {
    attendance_check_in_enabled?: boolean | null;
    attendance_check_out_enabled?: boolean | null;
    attendance_absent_enabled?: boolean | null;
    attendance_late_enabled?: boolean | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "테넌트 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 학생이 해당 테넌트에 속하는지 확인
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("tenant_id", tenantContext.tenantId)
      .single();

    if (studentError || !student) {
      throw new AppError(
        "학생을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 기존 설정 확인
    const { data: existing } = await supabase
      .from("student_notification_preferences")
      .select("id")
      .eq("student_id", studentId)
      .single();

    const updateData = {
      attendance_check_in_enabled: settings.attendance_check_in_enabled ?? null,
      attendance_check_out_enabled: settings.attendance_check_out_enabled ?? null,
      attendance_absent_enabled: settings.attendance_absent_enabled ?? null,
      attendance_late_enabled: settings.attendance_late_enabled ?? null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // 업데이트
      const { error } = await supabase
        .from("student_notification_preferences")
        .update(updateData)
        .eq("student_id", studentId);

      if (error) {
        console.error("[attendanceSettings] 학생 알림 설정 업데이트 실패:", error);
        throw new AppError(
          error.message || "학생 알림 설정 업데이트에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    } else {
      // 생성
      const { error } = await supabase
        .from("student_notification_preferences")
        .insert({
          student_id: studentId,
          ...updateData,
        });

      if (error) {
        console.error("[attendanceSettings] 학생 알림 설정 생성 실패:", error);
        throw new AppError(
          error.message || "학생 알림 설정 생성에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }

    revalidatePath(`/admin/students/${studentId}/attendance-settings`);
    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    logError(normalizedError, { function: "updateStudentAttendanceSettings" });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}
