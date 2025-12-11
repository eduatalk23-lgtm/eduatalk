"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { revalidatePath } from "next/cache";
import {
  AppError,
  ErrorCode,
  normalizeError,
  getUserFacingMessage,
  logError,
} from "@/lib/errors";
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

    const supabase = await createSupabaseServerClient();

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
      updateData,
    });

    // SMS 설정 업데이트
    const { error, data } = await supabase
      .from("tenants")
      .update(updateData)
      .eq("id", tenantContext.tenantId)
      .select();

    if (error) {
      console.error("[attendanceSettings] SMS 설정 업데이트 실패:", {
        error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        tenantId: tenantContext.tenantId,
        updateData,
      });
      throw new AppError(
        error.message || "SMS 설정 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 저장 성공 여부 확인 (재조회하여 검증)
    const { data: verifyData, error: verifyError } = await supabase
      .from("tenants")
      .select(
        "attendance_sms_check_in_enabled, attendance_sms_check_out_enabled, attendance_sms_absent_enabled, attendance_sms_late_enabled, attendance_sms_student_checkin_enabled, attendance_sms_recipient, attendance_sms_show_failure_to_user"
      )
      .eq("id", tenantContext.tenantId)
      .single();

    if (verifyError) {
      console.error("[attendanceSettings] SMS 설정 검증 실패:", verifyError);
      // 검증 실패해도 업데이트는 성공했을 수 있으므로 경고만 로깅
    } else if (verifyData) {
      console.log("[attendanceSettings] SMS 설정 업데이트 성공 및 검증 완료:", {
        tenantId: tenantContext.tenantId,
        savedData: verifyData,
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
