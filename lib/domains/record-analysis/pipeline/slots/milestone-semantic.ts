// ============================================
// pipeline/slots/milestone-semantic.ts
//
// D-Phase2 (#milestone semantic, 2026-04-29): blueprint milestone ↔ guide
// 임베딩 cosine similarity 매칭.
//
// 배경: slot.intent.unfulfilledMilestones 의 activityText 는 학생/blueprint 별
// 동적 자유 문장이라 카탈로그(가이드) 사전 매칭 불가. 다른 4 보너스(tierFit/
// subjectFit/focusFit/weaknessFix) 는 정적 메타로 매칭 가능했지만 milestone 만
// 본질적으로 텍스트 의미 매칭이 필요.
//
// 전략:
//   1. slot milestone 별로 (activityText + narrativeGoal) 결합 텍스트 임베딩 1회.
//   2. 가이드 임베딩은 exploration_guide_content.embedding 에서 batch fetch.
//   3. (slot_milestone × guide) 페어별 cosine. threshold 통과 → match.
//   4. matched / unfulfilled.length → milestoneFill rawValue.
//
// 비용:
//   - 슬롯 milestone 임베딩: 학년별 dedup (보통 학년당 ~3건 = 9 embed/run).
//   - 가이드 임베딩: DB 캐시 (생성 안 함, 미보유 가이드는 score=0 fallback).
// ============================================

import { google } from "@ai-sdk/google";
import { embedMany } from "ai";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import type { PipelineContext } from "../pipeline-types";
import type { UnfulfilledMilestone } from "./types";

const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBED_PROVIDER_OPTIONS = { google: { outputDimensionality: 768 } };

/** Cosine similarity (벡터 정규화 가정 안 함). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * milestone 의 임베딩 입력 텍스트.
 * activityText 가 짧을 때(예: "의학 윤리 독서") narrativeGoal 보강으로 의미 안정화.
 */
export function buildMilestoneEmbeddingInput(m: UnfulfilledMilestone): string {
  const parts = [m.activityText.trim()];
  if (m.narrativeGoal) parts.push(`(맥락: ${m.narrativeGoal.trim()})`);
  return parts.filter(Boolean).join(" ");
}

/**
 * milestone 텍스트 셋 → embedding 셋 (dedup + batch).
 * 빈 입력은 zero vector 로 채움 (cosine=0 fallback).
 */
export async function embedMilestones(
  milestones: UnfulfilledMilestone[],
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  const inputs: Array<{ key: string; text: string }> = [];
  const seen = new Set<string>();
  for (const m of milestones) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const text = buildMilestoneEmbeddingInput(m);
    if (text.length < 5) continue;
    inputs.push({ key: m.id, text });
  }
  if (inputs.length === 0) return out;

  const { embeddings } = await geminiRateLimiter.execute(async () => {
    return embedMany({
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
      values: inputs.map((i) => i.text),
      providerOptions: EMBED_PROVIDER_OPTIONS,
    });
  });
  geminiQuotaTracker.recordRequest();

  for (let i = 0; i < inputs.length; i++) {
    out.set(inputs[i].key, embeddings[i] as number[]);
  }
  return out;
}

/**
 * 가이드 embedding batch fetch (exploration_guide_content.embedding).
 * pgvector 컬럼은 string("[…]") 형태로 반환되므로 parse.
 */
export async function fetchGuideEmbeddings(
  supabase: PipelineContext["supabase"],
  guideIds: string[],
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (guideIds.length === 0) return out;
  const { data } = await supabase
    .from("exploration_guide_content")
    .select("guide_id, embedding")
    .in("guide_id", guideIds)
    .not("embedding", "is", null);
  for (const row of (data ?? []) as Array<{
    guide_id: string;
    embedding: unknown;
  }>) {
    const v = row.embedding;
    let parsed: number[] | null = null;
    if (typeof v === "string") {
      try {
        parsed = JSON.parse(v) as number[];
      } catch {
        parsed = null;
      }
    } else if (Array.isArray(v)) {
      parsed = v as number[];
    }
    if (parsed && parsed.length > 0) out.set(row.guide_id, parsed);
  }
  return out;
}

/** Threshold default — 측정 후 튜닝. */
export const MILESTONE_COSINE_THRESHOLD = 0.55;

/**
 * 슬롯 - 가이드 페어의 semantic milestone fill.
 * matched milestone 수 / 전체 unfulfilled 수.
 */
export function computeMilestoneFillRawSemantic(args: {
  slotMilestones: UnfulfilledMilestone[];
  milestoneEmbeddings: Map<string, number[]>;
  guideEmbedding: number[] | undefined;
  threshold?: number;
}): { raw: number; matchedIds: string[] } {
  const { slotMilestones, milestoneEmbeddings, guideEmbedding } = args;
  const threshold = args.threshold ?? MILESTONE_COSINE_THRESHOLD;
  if (slotMilestones.length === 0 || !guideEmbedding) {
    return { raw: 0, matchedIds: [] };
  }
  const matchedIds: string[] = [];
  for (const m of slotMilestones) {
    const me = milestoneEmbeddings.get(m.id);
    if (!me) continue;
    const sim = cosineSimilarity(me, guideEmbedding);
    if (sim >= threshold) matchedIds.push(m.id);
  }
  return {
    raw: matchedIds.length / slotMilestones.length,
    matchedIds,
  };
}
