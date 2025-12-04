/**
 * 추천 시스템 설정 관리자
 * DB에서 설정을 조회/저장하고, 기본값 폴백 로직을 제공
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseServerClient } from "@/lib/data/core/types";
import {
  RangeRecommendationConfig,
  type RecommendationConfig,
} from "./types";
import {
  defaultRangeRecommendationConfig,
  defaultRecommendationConfig,
} from "./defaultConfig";

/**
 * 설정 타입별 상수
 */
const SETTING_TYPES = {
  RANGE_RECOMMENDATION: "range_recommendation",
} as const;

const SETTING_KEYS = {
  RANGE_RECOMMENDATION_CONFIG: "config",
} as const;

/**
 * 범위 추천 설정 조회
 * 우선순위: 테넌트별 설정 → 전역 설정 → 기본값
 *
 * @param tenantId 테넌트 ID (없으면 전역 설정만 조회)
 * @param supabase Supabase 클라이언트 (선택적, 없으면 새로 생성)
 * @returns 범위 추천 설정
 */
export async function getRangeRecommendationConfig(
  tenantId?: string | null,
  supabase?: SupabaseServerClient
): Promise<RangeRecommendationConfig> {
  const client = supabase ?? (await createSupabaseServerClient());

  try {
    // 1. 테넌트별 설정 조회 (tenantId가 있는 경우)
    if (tenantId) {
      const { data: tenantConfig, error: tenantError } = await client
        .from("recommendation_settings")
        .select("setting_value")
        .eq("tenant_id", tenantId)
        .eq("setting_type", SETTING_TYPES.RANGE_RECOMMENDATION)
        .eq("setting_key", SETTING_KEYS.RANGE_RECOMMENDATION_CONFIG)
        .maybeSingle();

      if (!tenantError && tenantConfig?.setting_value) {
        const config = tenantConfig.setting_value as RangeRecommendationConfig;
        // 유효성 검증
        if (isValidRangeConfig(config)) {
          return config;
        }
        console.warn(
          "[configManager] 테넌트별 설정이 유효하지 않아 기본값 사용:",
          tenantId
        );
      }
    }

    // 2. 전역 설정 조회 (tenant_id가 NULL)
    const { data: globalConfig, error: globalError } = await client
      .from("recommendation_settings")
      .select("setting_value")
      .is("tenant_id", null)
      .eq("setting_type", SETTING_TYPES.RANGE_RECOMMENDATION)
      .eq("setting_key", SETTING_KEYS.RANGE_RECOMMENDATION_CONFIG)
      .maybeSingle();

    if (!globalError && globalConfig?.setting_value) {
      const config = globalConfig.setting_value as RangeRecommendationConfig;
      // 유효성 검증
      if (isValidRangeConfig(config)) {
        return config;
      }
      console.warn(
        "[configManager] 전역 설정이 유효하지 않아 기본값 사용"
      );
    }
  } catch (error) {
    console.error("[configManager] 설정 조회 실패, 기본값 사용:", error);
  }

  // 3. 기본값 반환
  return defaultRangeRecommendationConfig;
}

/**
 * 범위 추천 설정 업데이트
 *
 * @param config 범위 추천 설정
 * @param tenantId 테넌트 ID (없으면 전역 설정으로 저장)
 * @param supabase Supabase 클라이언트 (선택적)
 * @returns 성공 여부
 */
export async function updateRangeRecommendationConfig(
  config: RangeRecommendationConfig,
  tenantId?: string | null,
  supabase?: SupabaseServerClient
): Promise<{ success: boolean; error?: string }> {
  // 유효성 검증
  if (!isValidRangeConfig(config)) {
    return {
      success: false,
      error: "설정 값이 유효하지 않습니다.",
    };
  }

  const client = supabase ?? (await createSupabaseServerClient());

  try {
    const { error } = await client
      .from("recommendation_settings")
      .upsert(
        {
          tenant_id: tenantId || null,
          setting_type: SETTING_TYPES.RANGE_RECOMMENDATION,
          setting_key: SETTING_KEYS.RANGE_RECOMMENDATION_CONFIG,
          setting_value: config,
          version: 1,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "tenant_id,setting_type,setting_key",
        }
      );

    if (error) {
      console.error("[configManager] 설정 업데이트 실패:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[configManager] 설정 업데이트 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 범위 추천 설정을 기본값으로 재설정
 *
 * @param tenantId 테넌트 ID (없으면 전역 설정 재설정)
 * @param supabase Supabase 클라이언트 (선택적)
 * @returns 성공 여부
 */
export async function resetRangeRecommendationConfig(
  tenantId?: string | null,
  supabase?: SupabaseServerClient
): Promise<{ success: boolean; error?: string }> {
  return updateRangeRecommendationConfig(
    defaultRangeRecommendationConfig,
    tenantId,
    supabase
  );
}

/**
 * 범위 추천 설정 유효성 검증
 */
function isValidRangeConfig(
  config: unknown
): config is RangeRecommendationConfig {
  if (!config || typeof config !== "object") {
    return false;
  }

  const c = config as Partial<RangeRecommendationConfig>;

  // pagesPerHour 검증 (양수)
  if (
    typeof c.pagesPerHour !== "number" ||
    c.pagesPerHour <= 0 ||
    !Number.isFinite(c.pagesPerHour)
  ) {
    return false;
  }

  // episodesPerHour 검증 (양수)
  if (
    typeof c.episodesPerHour !== "number" ||
    c.episodesPerHour <= 0 ||
    !Number.isFinite(c.episodesPerHour)
  ) {
    return false;
  }

  return true;
}

