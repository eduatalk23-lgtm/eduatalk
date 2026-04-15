// ============================================
// 메인 탐구 링크 Repository — Phase α G4
// main_exploration_links (4×4 통합 다형 참조) CRUD + 전량교체
//
// 설계 방향:
//   tier_plan JSONB 가 "현재 완전 상태"를 기술하므로 동기화도 전량교체가 의미 일치.
//   replaceLinksForExploration = DELETE all → INSERT rows (Step 2.6 동기화 인프라).
//   단일 링크 조작은 컨설턴트 수동용 — addLinks / removeLink / removeLinksByLinked.
//
// 범위 (Step 2.4):
//   - 조회: listLinks / listLinksForTarget
//   - 쓰기: replaceLinksForExploration (전량교체)
//           addLinks (보존형 upsert)
//           removeLink / removeLinksByLinked / removeAllLinksForExploration
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

import type {
  MainExplorationLink,
  MainExplorationLinkInsert,
} from "../types/db-models";
import type { MainExplorationTier } from "./main-exploration-repository";

// ============================================
// 1. 타입
// ============================================

export type MainExplorationLinkedType =
  | "storyline"
  | "roadmap_item"
  | "narrative_arc"
  | "hyperedge"
  | "setek_guide"
  | "changche_guide"
  | "haengteuk_guide"
  | "topic_trajectory";

export type MainExplorationLinkDirection = "main_to_child" | "child_to_main";
export type MainExplorationLinkSource = "ai" | "consultant" | "hybrid";

export interface MainExplorationLinkEntry {
  linkedType: MainExplorationLinkedType;
  linkedId: string;
  linkedTier?: MainExplorationTier | null;
  strength?: number | null; // 0~1
  direction?: MainExplorationLinkDirection;
  source?: MainExplorationLinkSource;
}

type Client = SupabaseClient<Database>;

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

function toRow(
  mainExplorationId: string,
  tenantId: string,
  entry: MainExplorationLinkEntry,
): MainExplorationLinkInsert {
  if (entry.strength != null && (entry.strength < 0 || entry.strength > 1)) {
    throw new Error(`strength must be 0..1 (got ${entry.strength})`);
  }
  return {
    main_exploration_id: mainExplorationId,
    tenant_id: tenantId,
    linked_type: entry.linkedType,
    linked_id: entry.linkedId,
    linked_tier: entry.linkedTier ?? null,
    strength: entry.strength ?? null,
    direction: entry.direction ?? "main_to_child",
    source: entry.source ?? "ai",
  };
}

// ============================================
// 2. 조회
// ============================================

/** 탐구 1건의 링크 전체 조회 (필터 지원). */
export async function listLinksForExploration(
  mainExplorationId: string,
  options?: {
    linkedType?: MainExplorationLinkedType;
    linkedTier?: MainExplorationTier;
    direction?: MainExplorationLinkDirection;
  },
  client?: Client,
): Promise<MainExplorationLink[]> {
  const supabase = await resolveClient(client);
  let query = supabase
    .from("main_exploration_links")
    .select("*")
    .eq("main_exploration_id", mainExplorationId);
  if (options?.linkedType) query = query.eq("linked_type", options.linkedType);
  if (options?.linkedTier) query = query.eq("linked_tier", options.linkedTier);
  if (options?.direction) query = query.eq("direction", options.direction);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MainExplorationLink[];
}

/** 역방향 — linked target 기준 조회 (예: 이 storyline 을 참조하는 모든 메인 탐구 링크). */
export async function listLinksForTarget(
  linkedType: MainExplorationLinkedType,
  linkedId: string,
  client?: Client,
): Promise<MainExplorationLink[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("main_exploration_links")
    .select("*")
    .eq("linked_type", linkedType)
    .eq("linked_id", linkedId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MainExplorationLink[];
}

// ============================================
// 3. 전량교체 (tier_plan ↔ links 동기화 — Step 2.6 기반)
// ============================================

/**
 * 특정 메인 탐구의 모든 링크를 주어진 entries 로 완전 대체.
 *   DELETE all where main_exploration_id = X → INSERT rows.
 *
 * 원자성 주의: JS 순차. DELETE 성공 + INSERT 실패 시 링크가 비워진 상태로 남을 수 있음.
 *   호출측이 재시도 가능. 성능·원자성 이슈 생기면 Phase β 에서 RPC 승격.
 *
 * UNIQUE(main_exploration_id, linked_type, linked_id, direction) 보장 — entries 내부 중복은
 *   DB 제약에서 fail. 호출측에서 dedupe 후 전달 권장.
 */
export async function replaceLinksForExploration(
  mainExplorationId: string,
  tenantId: string,
  entries: MainExplorationLinkEntry[],
  client?: Client,
): Promise<number> {
  const supabase = await resolveClient(client);

  const { error: delErr } = await supabase
    .from("main_exploration_links")
    .delete()
    .eq("main_exploration_id", mainExplorationId);
  if (delErr) throw delErr;

  if (entries.length === 0) return 0;

  const rows = entries.map((e) => toRow(mainExplorationId, tenantId, e));
  const { data, error } = await supabase
    .from("main_exploration_links")
    .insert(rows)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

// ============================================
// 4. 보존형 추가 / 단일 삭제
// ============================================

/**
 * 기존 링크를 유지한 채 entries 만 추가. 중복(ON CONFLICT)은 DO NOTHING 동작 필요 —
 * Supabase JS 의 `upsert({ onConflict })` + `ignoreDuplicates: true` 로 처리.
 */
export async function addLinks(
  mainExplorationId: string,
  tenantId: string,
  entries: MainExplorationLinkEntry[],
  client?: Client,
): Promise<number> {
  if (entries.length === 0) return 0;
  const supabase = await resolveClient(client);
  const rows = entries.map((e) => toRow(mainExplorationId, tenantId, e));

  const { data, error } = await supabase
    .from("main_exploration_links")
    .upsert(rows, {
      onConflict: "main_exploration_id,linked_type,linked_id,direction",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** 단일 링크 id 삭제. */
export async function removeLink(
  id: string,
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("main_exploration_links")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * 특정 탐구에서 (linkedType, linkedId) 매칭 링크 삭제.
 *   direction 까지 특정하면 양방향 중 한쪽만 삭제 가능.
 */
export async function removeLinksByLinked(
  mainExplorationId: string,
  linkedType: MainExplorationLinkedType,
  linkedId: string,
  options?: { direction?: MainExplorationLinkDirection },
  client?: Client,
): Promise<number> {
  const supabase = await resolveClient(client);
  let query = supabase
    .from("main_exploration_links")
    .delete()
    .eq("main_exploration_id", mainExplorationId)
    .eq("linked_type", linkedType)
    .eq("linked_id", linkedId);
  if (options?.direction) query = query.eq("direction", options.direction);

  const { data, error } = await query.select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** 특정 탐구의 모든 링크 삭제 (전체 리셋). */
export async function removeAllLinksForExploration(
  mainExplorationId: string,
  client?: Client,
): Promise<number> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("main_exploration_links")
    .delete()
    .eq("main_exploration_id", mainExplorationId)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
