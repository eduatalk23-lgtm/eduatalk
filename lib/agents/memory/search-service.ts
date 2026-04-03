// ============================================
// 케이스 메모리 벡터 검색 서비스
// 가이드 vector/search-service.ts 패턴 재사용
// ============================================

import "server-only";

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { CaseSearchResult, SearchCasesOptions } from "./types";

const LOG_CTX = { domain: "agent", action: "case-search" };
const EMBEDDING_MODEL = "gemini-embedding-2-preview";

// ── 임베딩 캐시 (동일 쿼리 중복 API 호출 방지) ──
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분
const embeddingCache = new Map<string, { embedding: number[]; expiresAt: number }>();

function getCachedEmbedding(key: string): number[] | null {
  const entry = embeddingCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    embeddingCache.delete(key);
    return null;
  }
  return entry.embedding;
}

function setCachedEmbedding(key: string, embedding: number[]): void {
  // 캐시 크기 제한 (100건 초과 시 가장 오래된 것 정리)
  if (embeddingCache.size > 100) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(key, { embedding, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * 자연어 쿼리로 유사 케이스 벡터 검색.
 * 쿼리 임베딩 → search_similar_cases RPC → 유사도 + 메타데이터 필터
 */
export async function searchSimilarCases(
  options: SearchCasesOptions,
): Promise<CaseSearchResult[]> {
  const {
    query,
    tenantId,
    gradeFilter,
    majorFilter,
    matchCount = 5,
    similarityThreshold = 0.5,
  } = options;

  // 테넌트 격리 가드: tenantId 없이 검색 불가
  if (!tenantId) {
    logActionError(LOG_CTX, "tenantId 누락 — 테넌트 격리 위반 방지를 위해 검색 차단");
    return [];
  }

  logActionDebug(LOG_CTX, `searchSimilarCases: query="${query.slice(0, 50)}"`);

  // 1. 쿼리 임베딩 생성 (캐시 우선)
  const cacheKey = `${query}:${gradeFilter ?? ""}:${majorFilter ?? ""}`;
  let queryEmbedding = getCachedEmbedding(cacheKey);

  if (!queryEmbedding) {
    const result = await geminiRateLimiter.execute(async () => {
      return embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: query,
        providerOptions: { google: { outputDimensionality: 768 } },
      });
    });
    geminiQuotaTracker.recordRequest();
    queryEmbedding = result.embedding as number[];
    setCachedEmbedding(cacheKey, queryEmbedding);
    logActionDebug(LOG_CTX, "임베딩 생성 (캐시 miss)");
  } else {
    logActionDebug(LOG_CTX, "임베딩 캐시 hit");
  }

  // 2. search_similar_cases RPC 호출
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_similar_cases", {
    query_embedding: JSON.stringify(queryEmbedding),
    tenant_filter: tenantId,
    grade_filter: gradeFilter ?? null,
    major_filter: majorFilter ?? null,
    match_count: matchCount,
    similarity_threshold: similarityThreshold,
  });

  if (error) {
    logActionError(LOG_CTX, error.message);
    return []; // graceful — 검색 실패 시 빈 배열 반환
  }

  return (data ?? []) as CaseSearchResult[];
}
