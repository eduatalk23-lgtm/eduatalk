"use server";

/**
 * Phase D-3 Sprint 2: Memory Panel 편집·삭제·pin 서버 액션.
 *
 * 설계:
 *  - 전부 getCurrentUser → createSupabaseServerClient 경로. RLS 가 owner 검증.
 *  - updateExplicitMemory 는 kind='explicit' 만 허용 (SELECT 선 확인).
 *  - 성공 시 `/ai-chat/memory` revalidate.
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createMemoryEmbedding } from "./embedding";
import {
  deleteMemoryById as deleteMemoryRow,
  togglePinMemoryById,
  updateMemoryContent,
} from "./repository";

type ActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const MIN_CONTENT_LEN = 5;
const MAX_CONTENT_LEN = 4000;
const MEMORY_PATH = "/ai-chat/memory";

async function requireContext() {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, error: "로그인이 필요합니다." };
  }
  const supabase = await createSupabaseServerClient();
  return { ok: true as const, supabase, userId: user.userId };
}

export async function updateExplicitMemory(args: {
  id: string;
  content: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireContext();
  if (!ctx.ok) return ctx;

  const trimmed = args.content.trim();
  if (trimmed.length < MIN_CONTENT_LEN) {
    return { ok: false, error: `기억 내용은 최소 ${MIN_CONTENT_LEN}자 이상이어야 합니다.` };
  }
  if (trimmed.length > MAX_CONTENT_LEN) {
    return { ok: false, error: `기억 내용은 최대 ${MAX_CONTENT_LEN}자까지 가능합니다.` };
  }

  // kind 사전 검증: explicit 외에는 편집 금지. owner 는 RLS 가 보증.
  const { data: existing, error: selectErr } = await ctx.supabase
    .from("ai_conversation_memories")
    .select("kind")
    .eq("id", args.id)
    .maybeSingle();

  if (selectErr) return { ok: false, error: selectErr.message };
  if (!existing) {
    return { ok: false, error: "기억을 찾을 수 없거나 접근 권한이 없습니다." };
  }
  if ((existing as { kind: string }).kind !== "explicit") {
    return { ok: false, error: "자동 생성된 기억은 편집할 수 없습니다." };
  }

  const embedding = await createMemoryEmbedding(trimmed);
  if (!embedding) {
    return { ok: false, error: "임베딩 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const updated = await updateMemoryContent(ctx.supabase, {
    id: args.id,
    content: trimmed,
    embedding,
  });
  if (!updated.ok) return { ok: false, error: updated.error };

  revalidatePath(MEMORY_PATH);
  return { ok: true, id: args.id };
}

export async function deleteMemory(args: {
  id: string;
}): Promise<ActionResult> {
  const ctx = await requireContext();
  if (!ctx.ok) return ctx;

  const result = await deleteMemoryRow(ctx.supabase, args.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(MEMORY_PATH);
  return { ok: true };
}

export async function toggleMemoryPin(args: {
  id: string;
  pinned: boolean;
}): Promise<ActionResult<{ id: string; pinned: boolean }>> {
  const ctx = await requireContext();
  if (!ctx.ok) return ctx;

  const result = await togglePinMemoryById(ctx.supabase, {
    id: args.id,
    pinned: args.pinned,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(MEMORY_PATH);
  return { ok: true, id: args.id, pinned: args.pinned };
}
