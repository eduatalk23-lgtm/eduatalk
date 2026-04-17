import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UIMessage } from "ai";
import type {
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
 */
export async function saveChatTurn(
  args: SaveConversationArgs,
  messages: UIMessage[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

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
 * 현재 사용자의 대화 목록 (최근 활동순).
 */
export async function listConversations(ownerUserId: string): Promise<
  Array<{
    id: string;
    title: string | null;
    persona: AIConversationPersona;
    lastActivityAt: string;
  }>
> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, persona, last_activity_at")
    .eq("owner_user_id", ownerUserId)
    .order("last_activity_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as unknown as AIConversationRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    persona: r.persona,
    lastActivityAt: r.last_activity_at,
  }));
}
