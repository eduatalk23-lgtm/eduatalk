/**
 * Phase D-4 Sprint 2: 턴 저장 직후 자동 memory insert 훅.
 *
 * `saveChatTurn` 내부에서 onFinish 경로(admin client)로 호출된다.
 * 실패해도 대화 저장은 성공으로 간주 — best-effort.
 *
 * 저장 단위: 마지막 user + 뒤따르는 assistant 합본 1 record (kind='turn').
 * embedding 실패·빈 텍스트는 조용히 skip.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import type { Database } from "@/lib/supabase/database.types";

import { buildTurnMemoryText, createMemoryEmbedding } from "./embedding";
import { insertMemory } from "./repository";
import { extractLastTurn } from "./messageText";

type Client = SupabaseClient<Database>;

export interface SaveTurnMemoryArgs {
  supabase: Client;
  messages: UIMessage[];
  ownerUserId: string;
  tenantId: string | null;
  subjectStudentId: string | null;
  conversationId: string;
}

export type SaveTurnMemoryResult =
  | { ok: true; inserted: boolean; memoryId?: string; reason?: string }
  | { ok: false; error: string };

export async function saveTurnMemory(
  args: SaveTurnMemoryArgs,
): Promise<SaveTurnMemoryResult> {
  const { userText, assistantText, lastAssistantId } = extractLastTurn(
    args.messages,
  );

  // user 텍스트 없으면 "턴" 으로 성립 안 함. assistant 만 있는 경우도 skip.
  if (!userText) return { ok: true, inserted: false, reason: "no-user-text" };

  const content = buildTurnMemoryText({ userText, assistantText });
  if (content.length < 5) {
    return { ok: true, inserted: false, reason: "too-short" };
  }

  let embedding: number[] | null;
  try {
    embedding = await createMemoryEmbedding(content);
  } catch (err) {
    return {
      ok: false,
      error: `embedding: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!embedding) {
    return { ok: true, inserted: false, reason: "embedding-skipped" };
  }

  const result = await insertMemory(args.supabase, {
    ownerUserId: args.ownerUserId,
    tenantId: args.tenantId,
    subjectStudentId: args.subjectStudentId,
    conversationId: args.conversationId,
    sourceMessageId: lastAssistantId,
    content,
    embedding,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, inserted: true, memoryId: result.memory.id };
}
