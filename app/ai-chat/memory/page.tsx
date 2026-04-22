/**
 * Phase D-3 Sprint 1 — Memory Panel (읽기 전용).
 *
 * 목적: 현재 로그인 사용자의 AI 대화 장기 기억을 최신순으로 조회.
 *  - turn / summary / explicit 3 kind 필터
 *  - 학생 문맥 필터 (학생 id 가 있는 기억만 / 특정 학생)
 *  - 편집·삭제·pin 은 Sprint 2 범위
 *
 * 데이터 경로:
 *  1. ownerUserId 기준으로 `ai_conversation_memories` 최근 50 건 (RLS 자동 적용)
 *  2. 집합된 conversationId / subjectStudentId 배치 조회 → 제목·이름 맵 enrich
 *  3. 클라이언트 컴포넌트(MemoryList) 에 직렬화된 뷰 모델 전달
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listMemoriesForOwner } from "@/lib/domains/ai-chat/memory/repository";
import {
  MEMORY_KINDS,
  type MemoryKind,
} from "@/lib/domains/ai-chat/memory/types";
import { MemoryList, type MemoryListItem } from "@/components/ai-chat/MemoryList";

type SearchParams = {
  kind?: string;
};

function parseKind(raw: string | undefined): MemoryKind | undefined {
  if (!raw) return undefined;
  return (MEMORY_KINDS as readonly string[]).includes(raw)
    ? (raw as MemoryKind)
    : undefined;
}

export default async function AiChatMemoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { kind: kindRaw } = await searchParams;
  const kind = parseKind(kindRaw);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/ai-chat/memory");
  }

  const supabase = await createSupabaseServerClient();

  const memRes = await listMemoriesForOwner(supabase, {
    ownerUserId: user.userId,
    kind,
    limit: 50,
  });

  // enrichment: subject_student_id 집합 → user_profiles.name 맵
  //            conversation_id 집합 → ai_conversations.title 맵
  const memories = memRes.ok ? memRes.memories : [];
  const studentIds = Array.from(
    new Set(
      memories
        .map((m) => m.subjectStudentId)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const conversationIds = Array.from(
    new Set(
      memories
        .map((m) => m.conversationId)
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const studentNameById = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, name")
      .in("id", studentIds);
    for (const row of (data as Array<{ id: string; name: string | null }> | null) ??
      []) {
      studentNameById.set(row.id, row.name ?? "학생");
    }
  }

  const conversationTitleById = new Map<string, string | null>();
  if (conversationIds.length > 0) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("id, title")
      .in("id", conversationIds);
    for (const row of (data as Array<{
      id: string;
      title: string | null;
    }> | null) ?? []) {
      conversationTitleById.set(row.id, row.title);
    }
  }

  const items: MemoryListItem[] = memories.map((m) => ({
    id: m.id,
    kind: m.kind,
    content: m.content,
    pinned: m.pinned,
    createdAt: m.createdAt,
    conversationId: m.conversationId,
    conversationTitle: m.conversationId
      ? (conversationTitleById.get(m.conversationId) ?? null)
      : null,
    subjectStudentId: m.subjectStudentId,
    subjectStudentName: m.subjectStudentId
      ? (studentNameById.get(m.subjectStudentId) ?? null)
      : null,
  }));

  const loadError = !memRes.ok ? memRes.error : null;

  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/ai-chat"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="채팅으로 돌아가기"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">기억</h1>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              AI 가 학습한 내용을 조회합니다. 편집·삭제는 준비 중입니다.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <MemoryList
          items={items}
          activeKind={kind ?? null}
          loadError={loadError}
        />
      </main>
    </div>
  );
}
