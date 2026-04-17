import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UIMessage } from "ai";
import type {
  AIConversationOrigin,
  AIConversationPersona,
  AIConversationRow,
  AIMessageRow,
} from "./types";

type SaveConversationArgs = {
  conversationId: string;
  ownerUserId: string;
  tenantId: string | null;
  persona: AIConversationPersona;
  subjectStudentId?: string | null;
  title?: string | null;
};

/**
 * 대화 스레드 upsert + 메시지 저장.
 * onConflict('id') 로 idempotent. 메시지 id는 AI SDK 생성 stable id 재사용.
 *
 * ⚠️ RLS 우회 admin client 사용 이유:
 * toUIMessageStreamResponse({onFinish}) 콜백은 응답 스트림이 완료된 뒤 실행되어
 * Next.js request scope 가 종료됨 → cookies() 접근 불가 → Supabase 세션 anon →
 * auth.uid() NULL → RLS 차단. owner_user_id 가 인자로 명시되어 정당성 유지됨.
 * 대화 내 메시지 저장은 onFinish 에서만 호출되므로 항상 admin 경로 사용.
 */
export async function saveChatTurn(
  args: SaveConversationArgs,
  messages: UIMessage[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "admin client unavailable" };
  }

  const nowIso = new Date().toISOString();
  const { error: convErr } = await supabase
    .from("ai_conversations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(
      {
        id: args.conversationId,
        owner_user_id: args.ownerUserId,
        tenant_id: args.tenantId,
        persona: args.persona,
        subject_student_id: args.subjectStudentId ?? null,
        title: args.title ?? null,
        last_activity_at: nowIso,
      } as unknown as never,
      { onConflict: "id" },
    );

  if (convErr) {
    return { ok: false, error: `conversation upsert: ${convErr.message}` };
  }

  if (messages.length === 0) return { ok: true };

  const rows = messages.map((m) => ({
    id: m.id,
    conversation_id: args.conversationId,
    role: m.role,
    parts: m.parts as unknown as Record<string, unknown>,
  }));

  const { error: msgErr } = await supabase
    .from("ai_messages")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(rows as unknown as never, { onConflict: "id" });

  if (msgErr) {
    return { ok: false, error: `message upsert: ${msgErr.message}` };
  }

  return { ok: true };
}

/**
 * 특정 대화의 메시지 전체 조회. UI 재개용.
 */
export async function loadConversationMessages(
  conversationId: string,
): Promise<UIMessage[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, parts, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as AIMessageRow[]).map(
    (row) =>
      ({
        id: row.id,
        role: row.role,
        parts: row.parts,
      }) as UIMessage,
  );
}

/**
 * 현재 사용자의 대화 목록.
 * - 기본: 활성(archived_at IS NULL) 50개. 고정 먼저, 그다음 최근 활동순.
 * - archived=true: 아카이브된 목록만 반환.
 */
export async function listConversations(
  ownerUserId: string,
  options?: { archived?: boolean },
): Promise<
  Array<{
    id: string;
    title: string | null;
    persona: AIConversationPersona;
    lastActivityAt: string;
    pinnedAt: string | null;
    archivedAt: string | null;
  }>
> {
  const supabase = await createSupabaseServerClient();
  const archived = options?.archived ?? false;

  const query = supabase
    .from("ai_conversations")
    .select(
      "id, title, persona, last_activity_at, pinned_at, archived_at",
    )
    .eq("owner_user_id", ownerUserId);

  const filtered = archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  const { data, error } = await filtered
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("last_activity_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as unknown as AIConversationRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    persona: r.persona,
    lastActivityAt: r.last_activity_at,
    pinnedAt: r.pinned_at,
    archivedAt: r.archived_at,
  }));
}

/**
 * 단일 대화의 origin 조회 (ChatShell 배너 렌더용).
 * RLS 로 owner 만 접근 가능.
 */
export async function getConversationOrigin(
  conversationId: string,
): Promise<AIConversationOrigin | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("origin")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) return null;
  const origin = (data as unknown as { origin: AIConversationOrigin | null })
    .origin;
  return origin ?? null;
}

/**
 * Phase T-4: handoff 진입 시 대화 + 선공 assistant 메시지를 한번에 영속화.
 * - ai_conversations UPSERT (origin 포함, 신규 진입일 때만)
 * - ai_messages UPSERT (선공 메시지 1개)
 *
 * 이미 대화가 존재하면 origin 은 유지 (1회 진입 시점이 authoritative).
 */
type SaveOpenerArgs = {
  conversationId: string;
  ownerUserId: string;
  tenantId: string | null;
  persona: AIConversationPersona;
  subjectStudentId?: string | null;
  title?: string | null;
  origin: AIConversationOrigin;
  assistantMessage: UIMessage;
};

export async function saveOpener(
  args: SaveOpenerArgs,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 이미 origin 이 기록된 경우 재기록하지 않음
  const { data: existing } = await supabase
    .from("ai_conversations")
    .select("id, origin")
    .eq("id", args.conversationId)
    .maybeSingle();

  const existingOrigin = (existing as unknown as
    | { origin: AIConversationOrigin | null }
    | null)?.origin;

  const nowIso = new Date().toISOString();
  const upsertPayload: Record<string, unknown> = {
    id: args.conversationId,
    owner_user_id: args.ownerUserId,
    tenant_id: args.tenantId,
    persona: args.persona,
    subject_student_id: args.subjectStudentId ?? null,
    title: args.title ?? null,
    last_activity_at: nowIso,
  };
  if (!existingOrigin) {
    upsertPayload.origin = args.origin;
  }

  const { error: convErr } = await supabase
    .from("ai_conversations")
    .upsert(upsertPayload as never, { onConflict: "id" });
  if (convErr) {
    return { ok: false, error: `conversation upsert: ${convErr.message}` };
  }

  const messageRow = {
    id: args.assistantMessage.id,
    conversation_id: args.conversationId,
    role: args.assistantMessage.role,
    parts: args.assistantMessage.parts as unknown as Record<string, unknown>,
  };
  const { error: msgErr } = await supabase
    .from("ai_messages")
    .upsert(messageRow as never, { onConflict: "id" });
  if (msgErr) {
    return { ok: false, error: `opener upsert: ${msgErr.message}` };
  }

  return { ok: true };
}
