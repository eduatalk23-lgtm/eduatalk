// ============================================
// tier_plan ↔ main_exploration_links 동기화 — Phase α Step 2.6
//
// tier_plan JSONB 가 "현재 완전 상태"를 기술하므로 links 는 derive.
// 양방향:
//   tierPlanToLinkEntries   — tier_plan → flat link entries
//   syncLinksFromTierPlan   — 동기화 진입점 (replace)
//   deriveTierPlanFromLinks — links → tier_plan skeleton (theme 등 자유필드는 복원 불가)
//
// zod schema 는 이 파일이 SSOT. repo 의 MainExplorationTierPlan 은 shape 힌트.
// ============================================

import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

import {
  listLinksForExploration,
  replaceLinksForExploration,
  type MainExplorationLinkEntry,
  type MainExplorationLinkedType,
} from "../repository/main-exploration-link-repository";
import type { MainExplorationTier } from "../repository/main-exploration-repository";

// ============================================
// 1. zod 스키마
// ============================================

const uuid = z.string().uuid();

const tierEntrySchema = z.object({
  theme: z.string().optional(),
  key_questions: z.array(z.string()).optional(),
  suggested_activities: z.array(z.string()).optional(),
  linked_storyline_ids: z.array(uuid).optional(),
  linked_roadmap_item_ids: z.array(uuid).optional(),
  linked_narrative_arc_ids: z.array(uuid).optional(),
  linked_hyperedge_ids: z.array(uuid).optional(),
  linked_setek_guide_ids: z.array(uuid).optional(),
  linked_changche_guide_ids: z.array(uuid).optional(),
  linked_haengteuk_guide_ids: z.array(uuid).optional(),
  linked_topic_trajectory_ids: z.array(uuid).optional(),
});

export const tierPlanSchema = z.object({
  foundational: tierEntrySchema.optional(),
  development: tierEntrySchema.optional(),
  advanced: tierEntrySchema.optional(),
});

export type TierPlanEntry = z.infer<typeof tierEntrySchema>;
export type TierPlan = z.infer<typeof tierPlanSchema>;

// ============================================
// 2. linked_*_ids 필드 ↔ linkedType 매핑 (SSOT)
// ============================================

const LINKED_FIELD_MAP: Array<{
  field: keyof TierPlanEntry;
  type: MainExplorationLinkedType;
}> = [
  { field: "linked_storyline_ids", type: "storyline" },
  { field: "linked_roadmap_item_ids", type: "roadmap_item" },
  { field: "linked_narrative_arc_ids", type: "narrative_arc" },
  { field: "linked_hyperedge_ids", type: "hyperedge" },
  { field: "linked_setek_guide_ids", type: "setek_guide" },
  { field: "linked_changche_guide_ids", type: "changche_guide" },
  { field: "linked_haengteuk_guide_ids", type: "haengteuk_guide" },
  { field: "linked_topic_trajectory_ids", type: "topic_trajectory" },
];

const TIERS: MainExplorationTier[] = ["foundational", "development", "advanced"];

// ============================================
// 3. flatten — tier_plan → link entries
// ============================================

/**
 * tier_plan 의 각 tier × 각 linked_*_ids 배열을 flat entries 로 펼침.
 * 동일 (linked_type, linked_id) 이 여러 tier 에 속하면 caller 책임으로 dedupe 필요.
 *   DB UNIQUE(main_exploration_id, linked_type, linked_id, direction) 로 중복 시 에러.
 */
export function tierPlanToLinkEntries(
  tierPlan: TierPlan,
): MainExplorationLinkEntry[] {
  const entries: MainExplorationLinkEntry[] = [];
  for (const tier of TIERS) {
    const tierEntry = tierPlan[tier];
    if (!tierEntry) continue;
    for (const { field, type: linkedType } of LINKED_FIELD_MAP) {
      const ids = tierEntry[field] as string[] | undefined;
      if (!ids || ids.length === 0) continue;
      for (const id of ids) {
        entries.push({ linkedType, linkedId: id, linkedTier: tier });
      }
    }
  }
  return entries;
}

// ============================================
// 4. 역방향 — links → tier_plan skeleton
// ============================================

type Client = SupabaseClient<Database>;

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

/**
 * 탐구 links 에서 tier_plan 기본 구조만 복원.
 *   linked_*_ids 만 채움. theme/key_questions/suggested_activities 같은 자유 필드는 복원 불가.
 *   linked_tier 가 NULL 인 링크는 제외.
 */
export async function deriveTierPlanFromLinks(
  mainExplorationId: string,
  client?: Client,
): Promise<TierPlan> {
  const supabase = await resolveClient(client);
  const links = await listLinksForExploration(
    mainExplorationId,
    undefined,
    supabase,
  );

  const plan: TierPlan = {};
  const typeToField = new Map(
    LINKED_FIELD_MAP.map(({ field, type }) => [type, field] as const),
  );

  for (const link of links) {
    const tier = (link.linked_tier ?? null) as MainExplorationTier | null;
    if (!tier) continue;
    if (!plan[tier]) plan[tier] = {};
    const tierEntry = plan[tier] as Record<string, unknown>;
    const field = typeToField.get(link.linked_type as MainExplorationLinkedType);
    if (!field) continue;
    const existing = (tierEntry[field] as string[] | undefined) ?? [];
    tierEntry[field] = [...existing, link.linked_id];
  }
  return plan;
}

// ============================================
// 5. 동기화 진입점
// ============================================

/**
 * tier_plan → main_exploration_links 전량교체.
 * zod 검증 실패 시 ZodError throw. replaceLinks 원자성 주의(2.4 참조).
 */
export async function syncLinksFromTierPlan(
  mainExplorationId: string,
  tenantId: string,
  tierPlan: TierPlan,
  client?: Client,
): Promise<number> {
  const parsed = tierPlanSchema.parse(tierPlan);
  const entries = tierPlanToLinkEntries(parsed);
  return replaceLinksForExploration(
    mainExplorationId,
    tenantId,
    entries,
    client,
  );
}

// ============================================
// 6. updater — tier_plan 저장 + 자동 동기화
// ============================================

/**
 * 메인 탐구의 tier_plan 을 교체하고 links 자동 동기화.
 *   syncLinks=false 면 tier_plan 만 업데이트 (links 는 기존 유지 — 드문 케이스).
 */
export async function updateMainExplorationTierPlan(
  id: string,
  tenantId: string,
  tierPlan: TierPlan,
  options?: { syncLinks?: boolean },
  client?: Client,
): Promise<{ linkCount: number }> {
  const parsed = tierPlanSchema.parse(tierPlan);
  const supabase = await resolveClient(client);

  const { error } = await supabase
    .from("student_main_explorations")
    .update({
      tier_plan: parsed as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  let linkCount = 0;
  if (options?.syncLinks !== false) {
    linkCount = await syncLinksFromTierPlan(id, tenantId, parsed, supabase);
  }
  return { linkCount };
}
