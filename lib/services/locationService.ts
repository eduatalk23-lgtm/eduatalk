/**
 * 위치 검증 서비스
 * GPS 기반 출석 체크인 검증
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export type LocationVerificationResult = {
  valid: boolean;
  distance?: number; // 미터 단위
  error?: string;
};

/**
 * 두 좌표 간 거리 계산 (Haversine 공식)
 * @param lat1 - 첫 번째 위치의 위도
 * @param lon1 - 첫 번째 위치의 경도
 * @param lat2 - 두 번째 위치의 위도
 * @param lon2 - 두 번째 위치의 경도
 * @returns 거리 (미터 단위)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 지구 반경 (미터)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 위치 기반 출석 체크인 검증
 * @param studentLatitude - 학생의 현재 위도
 * @param studentLongitude - 학생의 현재 경도
 * @returns 검증 결과 (거리 포함)
 */
export async function verifyLocationCheckIn(
  studentLatitude: number,
  studentLongitude: number
): Promise<LocationVerificationResult> {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    return {
      valid: false,
      error: "테넌트 정보를 찾을 수 없습니다.",
    };
  }

  // 좌표 유효성 검증
  if (
    typeof studentLatitude !== "number" ||
    typeof studentLongitude !== "number" ||
    isNaN(studentLatitude) ||
    isNaN(studentLongitude)
  ) {
    return {
      valid: false,
      error: "유효하지 않은 위치 좌표입니다.",
    };
  }

  if (
    studentLatitude < -90 ||
    studentLatitude > 90 ||
    studentLongitude < -180 ||
    studentLongitude > 180
  ) {
    return {
      valid: false,
      error: "위치 좌표가 범위를 벗어났습니다.",
    };
  }

  const supabase = await createSupabaseServerClient();

  // 학원 위치 정보 조회
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("location_latitude, location_longitude, location_radius_meters")
    .eq("id", tenantContext.tenantId)
    .single();

  if (error) {
    console.error("[locationService] 학원 위치 정보 조회 실패:", error);
    return {
      valid: false,
      error: "학원 위치 정보를 조회할 수 없습니다.",
    };
  }

  if (!tenant) {
    return {
      valid: false,
      error: "학원 정보를 찾을 수 없습니다.",
    };
  }

  // 위치 설정 여부 확인
  if (
    tenant.location_latitude === null ||
    tenant.location_longitude === null
  ) {
    return {
      valid: false,
      error: "학원 위치가 설정되지 않았습니다. 관리자에게 문의하세요.",
    };
  }

  // 거리 계산
  const distance = calculateDistance(
    tenant.location_latitude,
    tenant.location_longitude,
    studentLatitude,
    studentLongitude
  );

  const radius = tenant.location_radius_meters || 100; // 기본 반경 100m

  // 반경 내 확인
  if (distance > radius) {
    return {
      valid: false,
      distance: Math.round(distance),
      error: `학원에서 ${Math.round(distance)}m 떨어져 있습니다. (허용 반경: ${radius}m)`,
    };
  }

  return {
    valid: true,
    distance: Math.round(distance),
  };
}

