"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireOwnerClient(conversationId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };
  const supabase = await createSupabaseServerClient();
  return {
    ok: true as const,
    supabase,
    userId: user.userId,
    conversationId,
  };
}

const MAX_TITLE_LEN = 120;

export async function renameConversation(
  conversationId: string,
  nextTitle: string,
): Promise<ActionResult> {
  const ctx = await requireOwnerClient(conversationId);
  if (!ctx.ok) return ctx;
  const trimmed = nextTitle.trim().slice(0, MAX_TITLE_LEN);
  if (trimmed.length === 0) {
    return { ok: false, error: "제목을 입력하세요." };
  }
  const { error } = await ctx.supabase
    .from("ai_conversations")
    .update({ title: trimmed } as never)
    .eq("id", conversationId)
    .eq("owner_user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ai-chat");
  return { ok: true };
}

export async function togglePinConversation(
  conversationId: string,
  pinned: boolean,
): Promise<ActionResult> {
  const ctx = await requireOwnerClient(conversationId);
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("ai_conversations")
    .update({ pinned_at: pinned ? new Date().toISOString() : null } as never)
    .eq("id", conversationId)
    .eq("owner_user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ai-chat");
  return { ok: true };
}

export async function toggleArchiveConversation(
  conversationId: string,
  archived: boolean,
): Promise<ActionResult> {
  const ctx = await requireOwnerClient(conversationId);
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("ai_conversations")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
    } as never)
    .eq("id", conversationId)
    .eq("owner_user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ai-chat");
  return { ok: true };
}

export async function deleteConversation(
  conversationId: string,
): Promise<ActionResult> {
  const ctx = await requireOwnerClient(conversationId);
  if (!ctx.ok) return ctx;
  // cascade: ai_messages FK ON DELETE CASCADE 로 자동 정리.
  const { error } = await ctx.supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("owner_user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ai-chat");
  return { ok: true };
}
