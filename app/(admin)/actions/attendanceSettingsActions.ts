"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

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
  return withErrorHandling(async () => {
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
  });
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
  return withErrorHandling(async () => {
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
  });
}

