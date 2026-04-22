/**
 * Phase D-3 Sprint 2 — Memory Panel (편집 가능).
 *
 * 목적: 현재 로그인 사용자의 AI 대화 장기 기억을 최신순으로 조회·편집.
 *  - turn / summary / explicit 3 kind 필터 + kind 별 총 count 뱃지
 *  - 학생 문맥 필터 (전체 / 미지정 / 특정 학생)
 *  - Pin 토글 · 삭제 · explicit 편집 (MemoryList 내부)
 *
 * 데이터 경로:
 *  1. 병렬 3 쿼리:
 *     - listMemoriesForOwner (kind + student 필터 적용) — 최근 50 건
 *     - countMemoriesByKind — 전체 owner 기준 kind 별 총 개수 (필터 무관)
 *     - 학생 옵션 목록용: subject_student_id 가 있는 기억 전체 (name 매핑용 up to 500)
 *  2. 집합된 conversationId 배치 조회 → 제목 맵 enrich
 *  3. 학생 프로필 조회 (카드 enrich + 드롭다운 옵션) — 합집합 1 쿼리
 *  4. 클라이언트 컴포넌트(MemoryList) 에 직렬화된 뷰 모델 전달
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listMemoriesForOwner,
  countMemoriesByKind,
} from "@/lib/domains/ai-chat/memory/repository";
import {
  MEMORY_KINDS,
  type MemoryKind,
} from "@/lib/domains/ai-chat/memory/types";
import { MemoryList, type MemoryListItem } from "@/components/ai-chat/MemoryList";

type SearchParams = {
  kind?: string;
  student?: string;
};

function parseKind(raw: string | undefined): MemoryKind | undefined {
  if (!raw) return undefined;
  return (MEMORY_KINDS as readonly string[]).includes(raw)
    ? (raw as MemoryKind)
    : undefined;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 학생 필터 3 상태:
 *  - `undefined`: 필터 없음 (전체 학생 + 미지정 모두)
 *  - `null`: 학생 미지정 기억만
 *  - uuid 문자열: 특정 학생 문맥만
 */
function parseStudentFilter(raw: string | undefined): string | null | undefined {
  if (!raw) return undefined;
  if (raw === "none") return null;
  if (UUID_RE.test(raw)) return raw;
  return undefined;
}

export default async function AiChatMemoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { kind: kindRaw, student: studentRaw } = await searchParams;
  const kind = parseKind(kindRaw);
  const studentFilter = parseStudentFilter(studentRaw);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/ai-chat/memory");
  }

  const supabase = await createSupabaseServerClient();

  // 필터 적용 리스트 + 전체 kind count + 학생 옵션용 id 셋을 병렬로.
  const [memRes, countsRes, studentIdsRes] = await Promise.all([
    listMemoriesForOwner(supabase, {
      ownerUserId: user.userId,
      kind,
      subjectStudentId: studentFilter,
      limit: 50,
    }),
    countMemoriesByKind(supabase, { ownerUserId: user.userId }),
    supabase
      .from("ai_conversation_memories")
      .select("subject_student_id")
      .eq("owner_user_id", user.userId)
      .not("subject_student_id", "is", null)
      .limit(500),
  ]);

  const memories = memRes.ok ? memRes.memories : [];
  const loadError = !memRes.ok ? memRes.error : null;

  const counts = countsRes.ok
    ? {
        total: countsRes.counts.total,
        turn: countsRes.counts.turn,
        summary: countsRes.counts.summary,
        explicit: countsRes.counts.explicit,
      }
    : { total: 0, turn: 0, summary: 0, explicit: 0 };

  const availableStudentIds = Array.from(
    new Set(
      ((studentIdsRes.data as Array<{ subject_student_id: string | null }> | null) ??
        [])
        .map((r) => r.subject_student_id)
        .filter((v): v is string => Boolean(v)),
    ),
  );

  // enrichment 용 id 합집합 (드롭다운 + 카드)
  const studentIdsForLookup = Array.from(
    new Set([
      ...availableStudentIds,
      ...memories
        .map((m) => m.subjectStudentId)
        .filter((v): v is string => Boolean(v)),
    ]),
  );
  const conversationIds = Array.from(
    new Set(
      memories
        .map((m) => m.conversationId)
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const studentNameById = new Map<string, string>();
  if (studentIdsForLookup.length > 0) {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, name")
      .in("id", studentIdsForLookup);
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

  const studentOptions = availableStudentIds
    .map((id) => ({ id, name: studentNameById.get(id) ?? "학생" }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

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
              AI 가 학습한 내용을 조회·편집합니다.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <MemoryList
          items={items}
          activeKind={kind ?? null}
          activeStudentFilter={studentFilter}
          loadError={loadError}
          counts={counts}
          studentOptions={studentOptions}
        />
      </main>
    </div>
  );
}
