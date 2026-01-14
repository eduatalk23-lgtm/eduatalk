/**
 * LLM Response Cache Service
 * Phase 2.1: LLM API 호출 결과를 캐싱하여 비용 절감 및 응답 속도 향상
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import type { Database } from "@/lib/supabase/database.types";
import { logActionDebug, logActionWarn, logActionError } from "@/lib/utils/serverActionLogger";

type LLMCacheInsert = Database["public"]["Tables"]["llm_response_cache"]["Insert"];

// ============================================
// Types
// ============================================

export type OperationType =
  | "plan_generation"
  | "plan_optimization"
  | "content_recommendation"
  | "framework_generation"
  | "content_analysis";

export interface TokenUsage {
  input: number;
  output: number;
}

export interface CacheEntry<T = unknown> {
  id: string;
  tenantId: string | null;
  cacheKey: string;
  operationType: OperationType;
  requestHash: string;
  responseData: T;
  modelId: string | null;
  tokenUsage: TokenUsage | null;
  costUsd: number | null;
  createdAt: string;
  expiresAt: string;
  hitCount: number;
  lastHitAt: string | null;
}

export interface CacheSetOptions {
  modelId?: string;
  tokenUsage?: TokenUsage;
  costUsd?: number;
}

export interface CacheStats {
  tenantId: string | null;
  operationType: OperationType;
  totalEntries: number;
  totalHits: number;
  activeEntries: number;
  totalCostSaved: number;
  avgInputTokens: number | null;
  avgOutputTokens: number | null;
  lastCacheAt: string | null;
}

export interface CleanupResult {
  deleted: number;
}

// ============================================
// TTL Configuration (in hours)
// ============================================

const TTL_HOURS: Record<OperationType, number> = {
  plan_generation: 24, // 24시간 - 동일 입력 → 동일 결과 기대
  plan_optimization: 24, // 24시간 - 실행 데이터 변경 시 무효화
  content_recommendation: 1, // 1시간 - 콘텐츠 변경 빈도 고려
  framework_generation: 24, // 24시간 - 동일 입력 → 동일 결과 기대
  content_analysis: 168, // 7일 (168시간) - 콘텐츠 자체는 변경 없음
};

// ============================================
// LLM Cache Service
// ============================================

export class LLMCacheService {
  private tenantId: string | null;

  constructor(tenantId: string | null = null) {
    this.tenantId = tenantId;
  }

  // ============================================
  // Static Utility Methods
  // ============================================

  /**
   * 캐시 키 생성: operation:identifier 형식
   * @example LLMCacheService.buildKey('plan_generation', 'student_123')
   */
  static buildKey(operation: OperationType, identifier: string): string {
    return `${operation}:${identifier}`;
  }

  /**
   * 요청 해시 생성: 정규화된 요청의 SHA256
   * 요청 객체를 정규화(키 정렬)하여 동일한 내용이면 동일한 해시 생성
   */
  static hashRequest(request: unknown): string {
    const normalized = this.normalizeRequest(request);
    const jsonString = JSON.stringify(normalized);
    return createHash("sha256").update(jsonString).digest("hex");
  }

  /**
   * 요청 객체 정규화: 키를 알파벳 순으로 정렬
   */
  private static normalizeRequest(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeRequest(item));
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();

    for (const key of keys) {
      sorted[key] = this.normalizeRequest(
        (obj as Record<string, unknown>)[key]
      );
    }

    return sorted;
  }

  // ============================================
  // Instance Methods
  // ============================================

  /**
   * 캐시 조회 (TTL 자동 검사)
   * @returns 캐시된 데이터 또는 null (캐시 미스 또는 만료)
   */
  async get<T>(key: string, requestHash: string): Promise<T | null> {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      logActionWarn("LLMCacheService.get", "Admin client unavailable, cache miss");
      return null;
    }

    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("llm_response_cache")
        .select("*")
        .eq("cache_key", key)
        .eq("request_hash", requestHash)
        .gt("expires_at", now)
        .maybeSingle();

      if (error) {
        logActionError("LLMCacheService.get", `Cache lookup error: ${error.message}`);
        return null;
      }

      if (!data) {
        return null;
      }

      // tenant_id 필터링 (null은 글로벌 캐시)
      if (this.tenantId && data.tenant_id && data.tenant_id !== this.tenantId) {
        return null;
      }

      // 히트 카운트 증가 (비동기, 실패해도 무시)
      this.incrementHitCount(data.id).catch(() => {
        // 히트 카운트 증가 실패는 무시
      });

      return data.response_data as T;
    } catch (err) {
      logActionError("LLMCacheService.get", `Unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    }
  }

  /**
   * 캐시 저장 (TTL 자동 설정)
   */
  async set<T>(
    key: string,
    requestHash: string,
    data: T,
    operation: OperationType,
    options: CacheSetOptions = {}
  ): Promise<void> {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      logActionWarn("LLMCacheService.set", "Admin client unavailable, cache skipped");
      return;
    }

    try {
      const now = new Date();
      const ttlHours = TTL_HOURS[operation];
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

      const insertData: LLMCacheInsert = {
        tenant_id: this.tenantId,
        cache_key: key,
        operation_type: operation,
        request_hash: requestHash,
        response_data: data as Database["public"]["Tables"]["llm_response_cache"]["Row"]["response_data"],
        model_id: options.modelId ?? null,
        token_usage: options.tokenUsage as unknown as Database["public"]["Tables"]["llm_response_cache"]["Row"]["token_usage"],
        cost_usd: options.costUsd ?? null,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        hit_count: 0,
        last_hit_at: null,
      };

      const { error } = await supabase.from("llm_response_cache").upsert(
        insertData,
        {
          onConflict: "tenant_id,cache_key,request_hash",
        }
      );

      if (error) {
        logActionError("LLMCacheService.set", `Cache set error: ${error.message}`);
      }
    } catch (err) {
      logActionError("LLMCacheService.set", `Unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  /**
   * 특정 키 패턴 무효화 (학생 데이터 변경 시 등)
   * @param keyPattern SQL LIKE 패턴 (예: 'plan_generation:student_%')
   */
  async invalidate(keyPattern: string): Promise<number> {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      logActionWarn("LLMCacheService.invalidate", "Admin client unavailable, invalidation skipped");
      return 0;
    }

    try {
      let query = supabase
        .from("llm_response_cache")
        .delete()
        .like("cache_key", keyPattern);

      if (this.tenantId) {
        query = query.eq("tenant_id", this.tenantId);
      }

      const { data, error } = await query.select("id");

      if (error) {
        logActionError("LLMCacheService.invalidate", `Cache invalidation error: ${error.message}`);
        return 0;
      }

      return data?.length ?? 0;
    } catch (err) {
      logActionError("LLMCacheService.invalidate", `Unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
      return 0;
    }
  }

  /**
   * 만료된 캐시 정리 (일일 Cron 또는 수동 실행)
   */
  async cleanup(): Promise<CleanupResult> {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      logActionWarn("LLMCacheService.cleanup", "Admin client unavailable, cleanup skipped");
      return { deleted: 0 };
    }

    try {
      // DB 함수 호출 방식
      const { data, error } = await supabase.rpc("cleanup_expired_llm_cache");

      if (error) {
        logActionError("LLMCacheService.cleanup", `Cleanup error: ${error.message}`);
        return { deleted: 0 };
      }

      return { deleted: data ?? 0 };
    } catch (err) {
      logActionError("LLMCacheService.cleanup", `Unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
      return { deleted: 0 };
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(operation?: OperationType): Promise<CacheStats[]> {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      logActionWarn("LLMCacheService.getStats", "Admin client unavailable");
      return [];
    }

    try {
      let query = supabase.from("llm_cache_stats").select("*");

      if (this.tenantId) {
        query = query.eq("tenant_id", this.tenantId);
      }

      if (operation) {
        query = query.eq("operation_type", operation);
      }

      const { data, error } = await query;

      if (error) {
        logActionError("LLMCacheService.getStats", `Stats query error: ${error.message}`);
        return [];
      }

      return (data ?? []).map((row) => ({
        tenantId: row.tenant_id,
        operationType: row.operation_type as OperationType,
        totalEntries: row.total_entries ?? 0,
        totalHits: row.total_hits ?? 0,
        activeEntries: row.active_entries ?? 0,
        totalCostSaved: Number(row.total_cost_saved) || 0,
        avgInputTokens: Number(row.avg_input_tokens) || 0,
        avgOutputTokens: Number(row.avg_output_tokens) || 0,
        lastCacheAt: row.last_cache_at,
      }));
    } catch (err) {
      logActionError("LLMCacheService.getStats", `Unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
      return [];
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * 히트 카운트 증가 (비동기)
   */
  private async incrementHitCount(id: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return;

    // SQL로 직접 히트 카운트 증가
    const { error } = await supabase.rpc("increment_cache_hit_count", {
      cache_id: id,
    });

    if (error) {
      // 함수가 없거나 에러 발생 시 단순 업데이트로 폴백
      const { data: current } = await supabase
        .from("llm_response_cache")
        .select("hit_count")
        .eq("id", id)
        .single();

      if (current) {
        await supabase
          .from("llm_response_cache")
          .update({
            hit_count: (current.hit_count ?? 0) + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq("id", id);
      }
    }
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 캐시 래퍼: LLM 호출을 자동으로 캐싱
 */
export async function withLLMCache<T>(
  tenantId: string | null,
  operation: OperationType,
  identifier: string,
  request: unknown,
  fetchFn: () => Promise<{
    data: T;
    modelId?: string;
    tokenUsage?: TokenUsage;
    costUsd?: number;
  }>
): Promise<{ data: T; fromCache: boolean }> {
  const cache = new LLMCacheService(tenantId);
  const cacheKey = LLMCacheService.buildKey(operation, identifier);
  const requestHash = LLMCacheService.hashRequest(request);

  // 캐시 조회
  const cached = await cache.get<T>(cacheKey, requestHash);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  // LLM 호출
  const result = await fetchFn();

  // 캐시 저장
  await cache.set(cacheKey, requestHash, result.data, operation, {
    modelId: result.modelId,
    tokenUsage: result.tokenUsage,
    costUsd: result.costUsd,
  });

  return { data: result.data, fromCache: false };
}
