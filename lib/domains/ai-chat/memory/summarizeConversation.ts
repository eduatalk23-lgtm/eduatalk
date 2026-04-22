/**
 * Phase D-4 Sprint 3: 대화 자동 요약 트리거.
 *
 * saveChatTurn 의 per-turn 훅이 완료된 직후 호출된다. best-effort —
 * 실패해도 대화 저장은 성공으로 간주.
 *
 * 트리거 조건(AND):
 *  - 대화의 kind='turn' 기억 수 >= MIN_TURNS_FOR_SUMMARY (기본 10)
 *  - 마지막 summary 이후 신규 turn 수 >= MIN_NEW_TURNS_SINCE_LAST_SUMMARY (기본 5)
 *    (summary 가 없으면 "전체 turn 수" 로 간주)
 *
 * 동작:
 *  1. turns 수집(listTurnMemoriesSince). 마지막 summary 이후만.
 *  2. generateTurnSummary → 요약 문자열.
 *  3. createMemoryEmbedding → 768 dim.
 *  4. insertMemory(kind='summary').
 *
 * 원본 turn 은 보존한다(삭제·변경 0). retrieval 은 turn+summary 를 섞어 top-K.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

import {
  findLatestSummary,
  countTurnMemoriesInConversation,
  listTurnMemoriesSince,
  insertMemory,
} from "./repository";
import { generateTurnSummary } from "./summaryGeneration";
import { createMemoryEmbedding } from "./embedding";

type Client = SupabaseClient<Database>;

/** 총 turn 수 최소 기준. */
export const MIN_TURNS_FOR_SUMMARY = 10;
/** 지난 summary 이후 신규 turn 최소 기준. summary 없으면 전체 turn 이 사용됨. */
export const MIN_NEW_TURNS_SINCE_LAST_SUMMARY = 5;
/** 한 번의 요약에 포함할 turn 최대 개수 (예산 보호). */
export const MAX_TURNS_PER_SUMMARY = 40;

export interface MaybeSummarizeArgs {
  supabase: Client;
  conversationId: string;
  ownerUserId: string;
  tenantId: string | null;
  subjectStudentId: string | null;
}

export type MaybeSummarizeResult =
  | { ok: true; summarized: false; reason: string }
  | { ok: true; summarized: true; memoryId: string; turnCount: number }
  | { ok: false; error: string };

/**
 * 조건 충족 시 요약 1회 생성·저장. 조건 미충족 또는 실패 시 {summarized:false}.
 */
export async function maybeSummarizeConversation(
  args: MaybeSummarizeArgs,
): Promise<MaybeSummarizeResult> {
  // 1. 총 turn 수 확인 — 아직 부족하면 즉시 skip.
  const countRes = await countTurnMemoriesInConversation(args.supabase, {
    conversationId: args.conversationId,
    ownerUserId: args.ownerUserId,
  });
  if (!countRes.ok) return { ok: false, error: countRes.error };
  if (countRes.count < MIN_TURNS_FOR_SUMMARY) {
    return { ok: true, summarized: false, reason: "below-total-turn-threshold" };
  }

  // 2. 마지막 summary 이후의 신규 turn 확인.
  const latestRes = await findLatestSummary(args.supabase, {
    conversationId: args.conversationId,
    ownerUserId: args.ownerUserId,
  });
  if (!latestRes.ok) return { ok: false, error: latestRes.error };
  const sinceIso = latestRes.summary?.createdAt ?? null;

  const turnsRes = await listTurnMemoriesSince(args.supabase, {
    conversationId: args.conversationId,
    ownerUserId: args.ownerUserId,
    sinceIso,
    limit: MAX_TURNS_PER_SUMMARY,
  });
  if (!turnsRes.ok) return { ok: false, error: turnsRes.error };
  if (turnsRes.turns.length < MIN_NEW_TURNS_SINCE_LAST_SUMMARY) {
    return {
      ok: true,
      summarized: false,
      reason: "below-new-turn-threshold",
    };
  }

  // 3. LLM 요약.
  const summaryRes = await generateTurnSummary(turnsRes.turns);
  if (!summaryRes.ok || !summaryRes.summary) {
    return {
      ok: true,
      summarized: false,
      reason: summaryRes.reason ?? "summary-failed",
    };
  }

  // 4. embedding.
  let embedding: number[] | null = null;
  try {
    embedding = await createMemoryEmbedding(summaryRes.summary);
  } catch (err) {
    return {
      ok: false,
      error: `embedding: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!embedding) {
    return { ok: true, summarized: false, reason: "embedding-skipped" };
  }

  // 5. insert.
  const inserted = await insertMemory(args.supabase, {
    ownerUserId: args.ownerUserId,
    tenantId: args.tenantId,
    subjectStudentId: args.subjectStudentId,
    conversationId: args.conversationId,
    sourceMessageId: null,
    content: summaryRes.summary,
    embedding,
    kind: "summary",
  });

  if (!inserted.ok) return { ok: false, error: inserted.error };

  return {
    ok: true,
    summarized: true,
    memoryId: inserted.memory.id,
    turnCount: turnsRes.turns.length,
  };
}
