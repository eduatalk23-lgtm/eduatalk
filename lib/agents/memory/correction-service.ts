// ============================================
// 교정 피드백 검색 + 임베딩 서비스
// ============================================

import "server-only";

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { CorrectionSearchResult, SearchCorrectionsOptions } from "./types";

const LOG_CTX = { domain: "agent", action: "correction" };
const EMBEDDING_MODEL = "gemini-embedding-2-preview";

// ── 임베딩 캐시 (동일 쿼리 중복 호출 방지) ──
const CACHE_TTL_MS = 5 * 60 * 1000;
const correctionEmbeddingCache = new Map<string, { embedding: number[]; expiresAt: number }>();

/**
 * 유사 교정 피드백 벡터 검색.
 * 현재 상황과 비슷한 과거 교정을 찾아 에이전트가 같은 실수를 피하도록 함.
 */
export async function searchSimilarCorrections(
  options: SearchCorrectionsOptions,
): Promise<CorrectionSearchResult[]> {
  const {
    query,
    tenantId,
    correctionTypeFilter,
    matchCount = 5,
    similarityThreshold = 0.5,
  } = options;

  // 테넌트 격리 가드: tenantId 없이 검색 불가
  if (!tenantId) {
    logActionError(LOG_CTX, "tenantId 누락 — 테넌트 격리 위반 방지를 위해 검색 차단");
    return [];
  }

  logActionDebug(LOG_CTX, `searchCorrections: query="${query.slice(0, 50)}"`);

  // 캐시 확인
  const cacheKey = `corr:${query}:${correctionTypeFilter ?? ""}`;
  const cached = correctionEmbeddingCache.get(cacheKey);
  let queryEmbedding: number[];

  if (cached && Date.now() <= cached.expiresAt) {
    queryEmbedding = cached.embedding;
  } else {
    const result = await geminiRateLimiter.execute(async () => {
      return embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: query,
        providerOptions: { google: { outputDimensionality: 768 } },
      });
    });
    geminiQuotaTracker.recordRequest();
    queryEmbedding = result.embedding as number[];

    if (correctionEmbeddingCache.size > 50) {
      const firstKey = correctionEmbeddingCache.keys().next().value;
      if (firstKey) correctionEmbeddingCache.delete(firstKey);
    }
    correctionEmbeddingCache.set(cacheKey, { embedding: queryEmbedding, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_similar_corrections", {
    query_embedding: JSON.stringify(queryEmbedding),
    tenant_filter: tenantId,
    correction_type_filter: correctionTypeFilter ?? null,
    match_count: matchCount,
    similarity_threshold: similarityThreshold,
  });

  if (error) {
    logActionError(LOG_CTX, error.message);
    return [];
  }

  return (data ?? []) as CorrectionSearchResult[];
}

// embedPendingCorrections는 embedding-service.ts에 위치 (스크립트 호환성 — server-only 미사용)
