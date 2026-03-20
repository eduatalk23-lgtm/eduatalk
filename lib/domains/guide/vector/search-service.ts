// ============================================
// 탐구 가이드 벡터 검색 서비스
// Phase C: pgvector 하이브리드 검색 (벡터 + 메타데이터 필터)
// ============================================

import "server-only";

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/utils/serverActionLogger";

const LOG_TAG = "guide.vector-search";
const EMBEDDING_MODEL = "gemini-embedding-001";

export interface GuideSearchResult {
  guide_id: string;
  title: string;
  guide_type: string;
  book_title: string | null;
  book_author: string | null;
  motivation: string | null;
  score: number;
}

export interface SearchGuidesOptions {
  query: string;
  careerFieldId?: number;
  subjectId?: string;
  guideType?: string;
  matchCount?: number;
  similarityThreshold?: number;
}

/**
 * 자연어 쿼리로 가이드 벡터 검색
 * 쿼리 임베딩 → search_guides RPC → 유사도 + 메타데이터 필터
 */
export async function searchGuidesByVector(
  options: SearchGuidesOptions,
): Promise<GuideSearchResult[]> {
  const {
    query,
    careerFieldId,
    subjectId,
    guideType,
    matchCount = 10,
    similarityThreshold = 0.3,
  } = options;

  logActionDebug(LOG_TAG, `searchGuidesByVector: query="${query.slice(0, 50)}"`);

  // 1. 쿼리 임베딩 생성
  const { embedding: queryEmbedding } = await geminiRateLimiter.execute(
    async () => {
      return embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: query,
        providerOptions: { google: { outputDimensionality: 768 } },
      });
    },
  );
  geminiQuotaTracker.recordRequest();

  // 2. search_guides RPC 호출
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_guides", {
    query_embedding: JSON.stringify(queryEmbedding),
    career_filter: careerFieldId ?? null,
    subject_filter: subjectId ?? null,
    guide_type_filter: guideType ?? null,
    match_count: matchCount,
    similarity_threshold: similarityThreshold,
  });

  if (error) {
    logActionError(LOG_TAG, error instanceof Error ? error.message : String(error));
    throw new Error(`가이드 검색 RPC 실패: ${error.message}`);
  }

  return (data ?? []) as GuideSearchResult[];
}
