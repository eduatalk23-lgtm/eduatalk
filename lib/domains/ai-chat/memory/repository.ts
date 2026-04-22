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

/**
 * Phase D-3 Sprint 1: Memory Panel 전용 필터 조회.
 * listRecentMemoriesForOwner 보다 UI 필터링(kind · subject · pinned) 이
 * 자유로운 버전. 모든 필터는 optional — 무필터 시 최근 N건 최신순.
 */
export async function listMemoriesForOwner(
  client: Client,
  args: {
    ownerUserId: string;
    /** 특정 kind 만 조회. 생략 시 전체. */
    kind?: ConversationMemoryRow["kind"];
    /** 특정 학생 문맥만 조회. 생략 시 전체. null 은 "학생 미지정" 기억만. */
    subjectStudentId?: string | null;
    /** pinned=true 만 조회. 생략 시 무시. */
    pinnedOnly?: boolean;
    limit?: number;
  },
): Promise<
  | { ok: true; memories: ConversationMemoryRow[] }
  | { ok: false; error: string }
> {
  let query = client
    .from("ai_conversation_memories")
    .select("*")
    .eq("owner_user_id", args.ownerUserId)
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 50);

  if (args.kind) {
    query = query.eq("kind", args.kind);
  }
  if (args.subjectStudentId === null) {
    query = query.is("subject_student_id", null);
  } else if (args.subjectStudentId !== undefined) {
    query = query.eq("subject_student_id", args.subjectStudentId);
  }
  if (args.pinnedOnly) {
    query = query.eq("pinned", true);
  }

  const { data, error } = await query;
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

/**
 * Phase D-3 Sprint 2: 기억 본문 + embedding 갱신. RLS 로 owner 외 차단.
 * 호출자는 새 embedding 을 별도 단계에서 생성해 인자로 넘긴다 (repository 는 순수 DB 레이어).
 */
export async function updateMemoryContent(
  client: Client,
  args: { id: string; content: string; embedding: number[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from("ai_conversation_memories")
    .update({
      content: args.content,
      embedding: JSON.stringify(args.embedding),
    } as unknown as never)
    .eq("id", args.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Phase D-3 Sprint 2: pin 토글. RLS 로 owner 외 차단. */
export async function togglePinMemoryById(
  client: Client,
  args: { id: string; pinned: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from("ai_conversation_memories")
    .update({ pinned: args.pinned } as unknown as never)
    .eq("id", args.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Phase D-3 Sprint 2: owner 본인 기억의 kind 별 개수 + 총 개수 + pinned 개수.
 *
 * Supabase JS 는 GROUP BY 집계를 직접 지원하지 않으므로, HEAD count 요청
 * 5건(총/turn/summary/explicit/pinned)을 병렬로 날린다. RLS 인덱스
 * `idx_ai_memories_owner_created` 로 각 쿼리는 상수 시간.
 */
export async function countMemoriesByKind(
  client: Client,
  args: { ownerUserId: string },
): Promise<
  | {
      ok: true;
      counts: {
        total: number;
        turn: number;
        summary: number;
        explicit: number;
        pinned: number;
      };
    }
  | { ok: false; error: string }
> {
  const base = () =>
    client
      .from("ai_conversation_memories")
      .select("*", { count: "exact", head: true })
      .eq("owner_user_id", args.ownerUserId);

  const [total, turn, summary, explicit, pinned] = await Promise.all([
    base(),
    base().eq("kind", "turn"),
    base().eq("kind", "summary"),
    base().eq("kind", "explicit"),
    base().eq("pinned", true),
  ]);

  for (const r of [total, turn, summary, explicit, pinned]) {
    if (r.error) return { ok: false, error: r.error.message };
  }

  return {
    ok: true,
    counts: {
      total: total.count ?? 0,
      turn: turn.count ?? 0,
      summary: summary.count ?? 0,
      explicit: explicit.count ?? 0,
      pinned: pinned.count ?? 0,
    },
  };
}

/**
 * Phase D-4 Sprint 3: 대화 요약 트리거용 쿼리.
 *
 * 다음 3 함수는 onFinish 훅(admin client) 경로에서 호출되므로 RLS 경로와 별개.
 * owner_user_id·conversation_id 필터를 항상 함께 걸어 cross-owner 누출을 방지.
 */

/**
 * 해당 대화에서 가장 최근에 생성된 kind='summary' 기억 1건.
 * 없으면 null. 다음 요약의 "시작점" 을 결정한다.
 */
export async function findLatestSummary(
  client: Client,
  args: { conversationId: string; ownerUserId: string },
): Promise<
  | { ok: true; summary: ConversationMemoryRow | null }
  | { ok: false; error: string }
> {
  const { data, error } = await client
    .from("ai_conversation_memories")
    .select("*")
    .eq("conversation_id", args.conversationId)
    .eq("owner_user_id", args.ownerUserId)
    .eq("kind", "summary")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return { ok: false, error: error.message };
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return {
    ok: true,
    summary: rows.length > 0 ? mapRow(rows[0]) : null,
  };
}

/**
 * 해당 대화의 kind='turn' 기억 개수.
 * 요약 트리거 임계값 비교용.
 */
export async function countTurnMemoriesInConversation(
  client: Client,
  args: { conversationId: string; ownerUserId: string },
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { count, error } = await client
    .from("ai_conversation_memories")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", args.conversationId)
    .eq("owner_user_id", args.ownerUserId)
    .eq("kind", "turn");

  if (error) return { ok: false, error: error.message };
  return { ok: true, count: count ?? 0 };
}

/**
 * sinceIso 보다 엄격히 뒤에 생성된 kind='turn' 기억 목록(오래된 순).
 * sinceIso=null 이면 대화의 모든 turn. 요약 입력으로 직접 사용.
 */
export async function listTurnMemoriesSince(
  client: Client,
  args: {
    conversationId: string;
    ownerUserId: string;
    sinceIso: string | null;
    limit?: number;
  },
): Promise<
  | { ok: true; turns: ConversationMemoryRow[] }
  | { ok: false; error: string }
> {
  let query = client
    .from("ai_conversation_memories")
    .select("*")
    .eq("conversation_id", args.conversationId)
    .eq("owner_user_id", args.ownerUserId)
    .eq("kind", "turn")
    .order("created_at", { ascending: true })
    .limit(args.limit ?? 50);

  if (args.sinceIso) {
    query = query.gt("created_at", args.sinceIso);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return { ok: true, turns: rows.map(mapRow) };
}
