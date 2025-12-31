/**
 * 테넌트 검증 유틸리티
 * P2 개선: 테넌트 ID 격리 강화
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantValidationResult } from "@/lib/types/tenantUser";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";

// ============================================
// P2 개선: 테넌트 격리 유틸리티
// ============================================

/**
 * tenant_id가 필수인 경우 검증
 * 누락된 경우 에러를 throw
 */
export function assertTenantId(
  tenantId: string | undefined | null,
  context: string
): asserts tenantId is string {
  if (!tenantId) {
    logActionDebug(
      { domain: "utils", action: "assertTenantId" },
      `tenant_id 누락 - ${context}. 테넌트 격리가 적용되지 않습니다.`,
      { context }
    );
    throw new Error(`tenant_id is required for ${context}`);
  }
}

/**
 * tenant_id가 선택적이지만 강력히 권장되는 경우
 * 누락 시 경고만 로깅
 */
export function warnIfMissingTenantId(
  tenantId: string | undefined | null,
  context: string
): void {
  if (!tenantId) {
    logActionDebug(
      { domain: "utils", action: "warnIfMissingTenantId" },
      `tenant_id 미제공 - ${context}. 보안을 위해 tenant_id 필터를 적용하는 것이 권장됩니다.`,
      { context }
    );
  }
}

/**
 * 테넌트 격리 검증 컨텍스트
 * 비즈니스 중요도에 따라 분류
 */
export const TenantIsolationContext = {
  // Critical - 반드시 tenant_id 필요
  STUDENT_DATA_ACCESS: "학생 데이터 접근",
  PLAN_GROUP_ACCESS: "플랜 그룹 접근",
  SCORE_DATA_ACCESS: "성적 데이터 접근",
  ATTENDANCE_RECORD: "출석 기록",
  PARENT_STUDENT_LINK: "부모-학생 연결",

  // High - 강력히 권장
  BLOCK_SET_ACCESS: "블록 세트 접근",
  ACADEMY_SCHEDULE: "학원 일정",
  EXCLUSION_DATES: "제외일 관리",

  // Medium - 권장
  CONTENT_QUERY: "콘텐츠 조회",
  SESSION_TRACKING: "세션 추적",
} as const;

export type TenantIsolationContextType =
  (typeof TenantIsolationContext)[keyof typeof TenantIsolationContext];

// ============================================
// 기존 테넌트 존재 확인 함수
// ============================================

/**
 * 테넌트 존재 여부 확인
 */
export async function validateTenantExists(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantValidationResult> {
  try {
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (error) {
      logActionError(
        { domain: "utils", action: "validateTenantExists" },
        error,
        { tenantId }
      );
      return {
        exists: false,
        error: error.message || "테넌트 조회에 실패했습니다.",
      };
    }

    if (!tenant) {
      return {
        exists: false,
        error: "해당 기관을 찾을 수 없습니다.",
      };
    }

    return { exists: true };
  } catch (error) {
    logActionError(
      { domain: "utils", action: "validateTenantExists" },
      error,
      { tenantId }
    );
    return {
      exists: false,
      error:
        error instanceof Error
          ? error.message
          : "테넌트 확인 중 오류가 발생했습니다.",
    };
  }
}

