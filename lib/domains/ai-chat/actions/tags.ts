"use server";

/**
 * Phase B-3 이월: #tags CRUD
 *
 * 대화 메시지 안의 `#태그` 를 자동 수확 → ai_conversations.tags 에 union 저장.
 * RLS 는 owner_user_id 규칙으로 커버. 여기서는 관리 목적 admin client 대신
 * 일반 server client 사용 (본인 대화만 갱신).
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";

export type TagUpdateResult =
  | { ok: true; tags: string[] }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

/**
 * 기존 태그 목록에 신규 태그를 합치고 반환. (client-side 가 setConversationTags 로
 * 전송하지 않고 addTags 로 부분 업데이트만 할 수 있도록.)
 */
export async function addTagsToConversation(
  conversationId: string,
  incoming: string[],
): Promise<TagUpdateResult> {
  if (incoming.length === 0) return { ok: true, tags: [] };
  const user = await getCachedAuthUser();
  if (!user) return { ok: false, reason: "unauthorized" };

  const supabase = await createSupabaseServerClient();
  const { data: current, error: readError } = await supabase
    .from("ai_conversations")
    .select("tags, owner_user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (readError) return { ok: false, reason: "failed" };
  if (!current) return { ok: false, reason: "not_found" };
  if ((current as { owner_user_id: string }).owner_user_id !== user.id) {
    return { ok: false, reason: "unauthorized" };
  }

  const existing = Array.isArray((current as { tags?: string[] }).tags)
    ? ((current as { tags: string[] }).tags ?? [])
    : [];
  const merged = Array.from(
    new Set([...existing, ...incoming.map((t) => t.toLowerCase())]),
  );
  if (merged.length === existing.length) {
    return { ok: true, tags: existing };
  }

  const { error: updateError } = await supabase
    .from("ai_conversations")
    .update({ tags: merged })
    .eq("id", conversationId);

  if (updateError) return { ok: false, reason: "failed" };
  return { ok: true, tags: merged };
}

/** 사이드바에서 태그 제거 등 명시 액션용. */
export async function removeTagFromConversation(
  conversationId: string,
  tag: string,
): Promise<TagUpdateResult> {
  const user = await getCachedAuthUser();
  if (!user) return { ok: false, reason: "unauthorized" };

  const supabase = await createSupabaseServerClient();
  const { data: current, error: readError } = await supabase
    .from("ai_conversations")
    .select("tags, owner_user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (readError) return { ok: false, reason: "failed" };
  if (!current) return { ok: false, reason: "not_found" };
  if ((current as { owner_user_id: string }).owner_user_id !== user.id) {
    return { ok: false, reason: "unauthorized" };
  }

  const existing = Array.isArray((current as { tags?: string[] }).tags)
    ? ((current as { tags: string[] }).tags ?? [])
    : [];
  const next = existing.filter((t) => t !== tag.toLowerCase());

  const { error: updateError } = await supabase
    .from("ai_conversations")
    .update({ tags: next })
    .eq("id", conversationId);

  if (updateError) return { ok: false, reason: "failed" };
  return { ok: true, tags: next };
}
