/**
 * 학술 출처 축적/검색 서비스
 *
 * - 벡터 유사도로 가이드 resource에 맞는 출처 검색
 * - 미스 시 Claude Web Search 후 DB에 축적
 * - 임베딩: Gemini embedding-2-preview (768d)
 */

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionDebug, logActionWarn, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "guide", action: "academicSources" };
const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIMENSIONS = 768;
const MAX_INPUT_CHARS = 8000;

// ============================================
// 타입
// ============================================

export interface AcademicSource {
  id: string;
  url: string;
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  abstract_snippet: string | null;
  cited_text: string | null;
  source_db: string;
  keywords: string[];
  subject_areas: string[];
  career_fields: string[];
  hit_count: number;
  is_valid: boolean;
}

export interface AcademicSourceSearchResult {
  source_id: string;
  title: string;
  authors: string[];
  year: number | null;
  url: string;
  journal: string | null;
  abstract_snippet: string | null;
  cited_text: string | null;
  source_db: string;
  score: number;
}

export interface AcademicSourceInsert {
  url: string;
  title: string;
  authors?: string[];
  journal?: string;
  year?: number;
  abstract_snippet?: string;
  cited_text?: string;
  source_db: string;
  keywords?: string[];
  subject_areas?: string[];
  career_fields?: string[];
}

// ============================================
// 벡터 검색 (resource description → 유사 출처)
// ============================================

export async function searchAcademicSources(
  query: string,
  options?: {
    subjectAreas?: string[];
    matchCount?: number;
    similarityThreshold?: number;
  },
): Promise<AcademicSourceSearchResult[]> {
  const matchCount = options?.matchCount ?? 3;
  const threshold = options?.similarityThreshold ?? 0.7;

  try {
    // 쿼리 임베딩 생성
    const { embedding: queryEmbedding } = await geminiRateLimiter.execute(async () =>
      embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: query.slice(0, MAX_INPUT_CHARS),
        providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
      }),
    );
    geminiQuotaTracker.recordRequest();

    // RPC 호출
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_academic_sources", {
      query_embedding: JSON.stringify(queryEmbedding),
      subject_filter: options?.subjectAreas ?? null,
      match_count: matchCount,
      similarity_threshold: threshold,
    });

    if (error) {
      logActionError(LOG_CTX, error, { query: query.slice(0, 50) });
      return [];
    }

    // hit_count 증가 (비동기)
    const results = (data ?? []) as AcademicSourceSearchResult[];
    if (results.length > 0) {
      const adminClient = createSupabaseAdminClient();
      for (const r of results) {
        adminClient.rpc("increment_source_hit_count", { source_id: r.source_id }).then().catch(() => {});
      }
    }

    logActionDebug(LOG_CTX, `DB search: "${query.slice(0, 30)}" → ${results.length} hits (threshold: ${threshold})`);
    return results;
  } catch (err) {
    logActionWarn(LOG_CTX, "Academic source search failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ============================================
// 출처 저장 + 임베딩
// ============================================

export async function insertAcademicSource(input: AcademicSourceInsert): Promise<string | null> {
  const adminClient = createSupabaseAdminClient();

  // URL 중복 체크
  const { data: existing } = await adminClient
    .from("academic_sources")
    .select("id")
    .eq("url", input.url)
    .maybeSingle();

  if (existing) {
    logActionDebug(LOG_CTX, `Source already exists: ${input.url.slice(0, 60)}`);
    return existing.id;
  }

  // INSERT
  const { data, error } = await adminClient
    .from("academic_sources")
    .insert({
      url: input.url,
      title: input.title,
      authors: input.authors ?? [],
      journal: input.journal ?? null,
      year: input.year ?? null,
      abstract_snippet: input.abstract_snippet ?? null,
      cited_text: input.cited_text ?? null,
      source_db: input.source_db,
      keywords: input.keywords ?? [],
      subject_areas: input.subject_areas ?? [],
      career_fields: input.career_fields ?? [],
    })
    .select("id")
    .single();

  if (error) {
    logActionError(LOG_CTX, error, { url: input.url });
    return null;
  }

  // 비동기 임베딩
  embedAcademicSource(data.id, input).catch((err) => {
    logActionWarn(LOG_CTX, `Embedding failed for ${data.id}`, {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  logActionDebug(LOG_CTX, `Source inserted: ${data.id} — ${input.title.slice(0, 40)}`);
  return data.id;
}

// ============================================
// 임베딩 생성
// ============================================

async function embedAcademicSource(sourceId: string, input: AcademicSourceInsert): Promise<void> {
  const text = buildEmbeddingInput(input);
  if (text.length < 10) return;

  const { embedding } = await geminiRateLimiter.execute(async () =>
    embed({
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
      value: text,
      providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
    }),
  );
  geminiQuotaTracker.recordRequest();

  const adminClient = createSupabaseAdminClient();
  await adminClient
    .from("academic_sources")
    .update({
      embedding: JSON.stringify(embedding),
      embedding_status: "completed",
    })
    .eq("id", sourceId);
}

function buildEmbeddingInput(input: AcademicSourceInsert): string {
  const parts: string[] = [];
  parts.push(`제목: ${input.title}`);
  if (input.abstract_snippet) parts.push(`초록: ${input.abstract_snippet.slice(0, 2000)}`);
  if (input.cited_text) parts.push(`인용: ${input.cited_text.slice(0, 1500)}`);
  if (input.journal) parts.push(`학술지: ${input.journal}`);
  if (input.keywords?.length) parts.push(`키워드: ${input.keywords.join(", ")}`);
  if (input.subject_areas?.length) parts.push(`과목: ${input.subject_areas.join(", ")}`);
  return parts.join("\n\n").slice(0, MAX_INPUT_CHARS);
}

// ============================================
// URL 유효성 재검증 (배치용)
// ============================================

export async function revalidateSourceUrls(limit = 100): Promise<{ checked: number; invalidated: number }> {
  const adminClient = createSupabaseAdminClient();

  const { data: sources } = await adminClient
    .from("academic_sources")
    .select("id, url")
    .eq("is_valid", true)
    .order("last_validated_at", { ascending: true })
    .limit(limit);

  if (!sources?.length) return { checked: 0, invalidated: 0 };

  let invalidated = 0;

  for (const source of sources) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(source.url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      const isValid = res.ok || res.status === 405; // 405 = HEAD not allowed but URL exists
      await adminClient
        .from("academic_sources")
        .update({
          is_valid: isValid,
          last_validated_at: new Date().toISOString(),
        })
        .eq("id", source.id);

      if (!isValid) invalidated++;
    } catch {
      // 접속 불가 → 무효 처리
      await adminClient
        .from("academic_sources")
        .update({ is_valid: false, last_validated_at: new Date().toISOString() })
        .eq("id", source.id);
      invalidated++;
    }
  }

  return { checked: sources.length, invalidated };
}

// ============================================
// source_db 추출 유틸
// ============================================

export function detectSourceDb(url: string): AcademicSourceInsert["source_db"] {
  if (url.includes("kci.go.kr")) return "kci";
  if (url.includes("dbpia.co.kr")) return "dbpia";
  if (url.includes("riss.kr")) return "riss";
  if (url.includes("scholar.google")) return "scholar";
  if (url.includes("scienceall.com")) return "scienceall";
  if (url.includes("koreascience.kr")) return "koreascience";
  return "other";
}
