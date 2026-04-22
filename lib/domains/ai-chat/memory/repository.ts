/**
 * Phase D-4 Sprint 1: 대화 기억 repository.
 *
 * DB 레이어 — insert / search 를 감싼 얇은 어댑터. 인증/권한은 RLS 가 담당.
 * 호출 경로:
 *  - saveChatTurn 자동 훅 (Sprint 2+)
 *  - route.ts 전단 주입 레이어 (Sprint 2+)
 *  - Memory Panel CRUD (D-3)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

import type {
  ConversationMemoryRow,
  InsertMemoryArgs,
  MemorySearchHit,
  SearchMemoryArgs,
} from "./types";

type Client = SupabaseClient<Database>;

function mapRow(row: Record<string, unknown>): ConversationMemoryRow {
  return {
    id: row.id as string,
    ownerUserId: row.owner_user_id as string,
    tenantId: (row.tenant_id as string | null) ?? null,
    subjectStudentId: (row.subject_student_id as string | null) ?? null,
    conversationId: (row.conversation_id as string | null) ?? null,
    sourceMessageId: (row.source_message_id as string | null) ?? null,
    content: row.content as string,
    kind: row.kind as ConversationMemoryRow["kind"],
    pinned: Boolean(row.pinned),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function insertMemory(
  client: Client,
  args: InsertMemoryArgs,
): Promise<{ ok: true; memory: ConversationMemoryRow } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("ai_conversation_memories")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      owner_user_id: args.ownerUserId,
      tenant_id: args.tenantId,
      subject_student_id: args.subjectStudentId,
      conversation_id: args.conversationId,
      source_message_id: args.sourceMessageId,
      content: args.content,
      embedding: JSON.stringify(args.embedding),
      kind: args.kind ?? "turn",
      pinned: args.pinned ?? false,
    } as unknown as never)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "insert returned no row" };

  return { ok: true, memory: mapRow(data as Record<string, unknown>) };
}

export async function searchMemoriesByEmbedding(
  client: Client,
  args: SearchMemoryArgs,
): Promise<{ ok: true; hits: MemorySearchHit[] } | { ok: false; error: string }> {
  const { data, error } = await client.rpc(
    "search_conversation_memories",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {
      query_embedding: JSON.stringify(args.queryEmbedding) as unknown as never,
      p_owner_user_id: args.ownerUserId,
      p_subject_student_id: args.subjectStudentId ?? null,
      p_match_count: args.matchCount ?? 5,
      p_similarity_threshold: args.similarityThreshold ?? 0.3,
    } as unknown as never,
  );

  if (error) return { ok: false, error: error.message };

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const hits: MemorySearchHit[] = rows.map((r) => ({
    id: r.id as string,
    content: r.content as string,
    kind: r.kind as MemorySearchHit["kind"],
    conversationId: (r.conversation_id as string | null) ?? null,
    createdAt: r.created_at as string,
    score: Number(r.score ?? 0),
  }));

  return { ok: true, hits };
}

/**
 * 소유자 본인의 기억 중 최근 N개를 최신순으로 조회.
 * Memory Panel(D-3) 의 "기억 목록" 용. 검색과 무관한 조회 경로.
 */
export async function listRecentMemoriesForOwner(
  client: Client,
  args: { ownerUserId: string; limit?: number },
): Promise<{ ok: true; memories: ConversationMemoryRow[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("ai_conversation_memories")
    .select("*")
    .eq("owner_user_id", args.ownerUserId)
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 50);

  if (error) return { ok: false, error: error.message };
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return { ok: true, memories: rows.map(mapRow) };
}

/** 특정 기억 삭제. RLS 로 owner 외에는 차단. */
export async function deleteMemoryById(
  client: Client,
  memoryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from("ai_conversation_memories")
    .delete()
    .eq("id", memoryId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
