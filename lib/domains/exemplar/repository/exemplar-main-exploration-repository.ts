// ============================================
// Exemplar Main Exploration Repository — Phase γ G8
// exemplar_records.main_exploration_pattern 읽기/쓰기 최소 CRUD
//
// 목적: Phase δ 추출기(LLM extractor)가 채워넣을 패턴 데이터의
//       영속화/조회 레이어. 추출 로직은 Phase δ 에서 별도 구현.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { ExemplarMainExplorationPattern } from "../types";

// ============================================
// 1. 내부 타입
// ============================================

type Client = SupabaseClient<Database>;

/** listExemplarsForExtractionPending 반환 형태 */
export interface ExemplarExtractionCandidate {
  id: string;
  anonymous_id: string;
  school_name: string;
}

/** searchExemplarMainInquiries 파라미터 */
export interface ExemplarMainInquirySearchParams {
  careerField?: string;
  themeKeywords?: string[];
  tierFocus?: "foundational" | "development" | "advanced";
  matchCount?: number;
  minJaccard?: number;
}

/** searchExemplarMainInquiries 단일 결과 행 */
export type ExemplarMainInquirySearchRow =
  Database["public"]["Functions"]["search_exemplar_main_inquiries"]["Returns"][number];

// ============================================
// 2. resolveClient 헬퍼
// ============================================

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

// ============================================
// 3. 조회
// ============================================

/**
 * exemplar_records.main_exploration_pattern JSONB 를 그대로 읽어 타입 단언.
 * 저장된 데이터가 없으면 null 반환.
 */
export async function getExemplarMainExplorationPattern(
  exemplarId: string,
  client?: Client,
): Promise<ExemplarMainExplorationPattern | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("exemplar_records")
    .select("main_exploration_pattern")
    .eq("id", exemplarId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.main_exploration_pattern == null) return null;

  return data.main_exploration_pattern as unknown as ExemplarMainExplorationPattern;
}

/**
 * main_exploration_pattern 이 NULL 인 exemplar 목록 반환.
 * Phase δ 배치 추출기가 처리 대상을 결정할 때 사용.
 */
export async function listExemplarsForExtractionPending(
  limit: number,
  client?: Client,
): Promise<ExemplarExtractionCandidate[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("exemplar_records")
    .select("id, anonymous_id, school_name")
    .is("main_exploration_pattern", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ExemplarExtractionCandidate[];
}

/**
 * RPC search_exemplar_main_inquiries 래퍼.
 * career_field / theme_keywords Jaccard 유사도 기반 검색.
 */
export async function searchExemplarMainInquiries(
  params: ExemplarMainInquirySearchParams,
  client?: Client,
): Promise<ExemplarMainInquirySearchRow[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase.rpc("search_exemplar_main_inquiries", {
    p_career_field: params.careerField,
    p_theme_keywords: params.themeKeywords,
    p_tier_focus: params.tierFocus,
    p_match_count: params.matchCount,
    p_min_jaccard: params.minJaccard,
  });

  if (error) throw error;
  return (data ?? []) as ExemplarMainInquirySearchRow[];
}

// ============================================
// 4. 쓰기
// ============================================

/**
 * exemplar_records 의 main_exploration_pattern 을 업서트.
 * - main_exploration_extracted_at = NOW()
 * - extractor_version 기록
 *
 * 호출 전제: exemplarId 행이 이미 존재해야 함 (UPDATE 전용).
 */
export async function upsertExemplarMainExplorationPattern(
  exemplarId: string,
  pattern: ExemplarMainExplorationPattern,
  meta: { extractorVersion: string },
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("exemplar_records")
    .update({
      main_exploration_pattern: pattern as unknown as Database["public"]["Tables"]["exemplar_records"]["Update"]["main_exploration_pattern"],
      main_exploration_extracted_at: new Date().toISOString(),
      extractor_version: meta.extractorVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", exemplarId);

  if (error) throw error;
}
