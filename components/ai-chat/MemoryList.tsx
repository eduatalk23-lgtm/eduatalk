"use client";

/**
 * Phase D-3 Sprint 2 — 편집 가능 Memory 카드 리스트.
 *
 * 입력: 서버에서 enrich 된 `MemoryListItem[]` (학생명·대화 제목 포함).
 * 기능:
 *  - kind 필터 칩 (전체·자동 turn·요약 summary·수동 explicit)
 *    → router.push 로 /ai-chat/memory?kind=... 재진입 (서버 재조회)
 *  - 카드: kind 뱃지 + 내용(300자 초과 시 펼치기) + 학생·대화 라벨 + 상대 시간
 *  - Pin 토글 (useOptimistic) + Delete (confirm) — 전 kind 공통
 *  - Edit 버튼 + 인라인 에디터는 후속 커밋 (explicit 전용, updateExplicitMemory 연결).
 */

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Pin,
  PinOff,
  MessageSquare,
  User as UserIcon,
  BookMarked,
  ScrollText,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { MemoryKind } from "@/lib/domains/ai-chat/memory/types";
import {
  deleteMemory,
  toggleMemoryPin,
} from "@/lib/domains/ai-chat/memory/actions";

export type MemoryListItem = {
  id: string;
  kind: MemoryKind;
  content: string;
  pinned: boolean;
  createdAt: string;
  conversationId: string | null;
  conversationTitle: string | null;
  subjectStudentId: string | null;
  subjectStudentName: string | null;
};

type Props = {
  items: MemoryListItem[];
  /** 현재 URL 에서 선택된 kind. null 이면 '전체'. */
  activeKind: MemoryKind | null;
  /** 서버 조회 실패 시 메시지(UI에 safely 표시). */
  loadError: string | null;
};

type FilterOption = {
  key: MemoryKind | null;
  label: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { key: null, label: "전체" },
  { key: "turn", label: "자동 (대화)" },
  { key: "summary", label: "요약" },
  { key: "explicit", label: "직접 추가" },
];

const KIND_LABEL: Record<MemoryKind, string> = {
  turn: "대화 단위",
  summary: "요약",
  explicit: "직접 추가",
};

const KIND_ICON: Record<MemoryKind, typeof MessageSquare> = {
  turn: MessageSquare,
  summary: ScrollText,
  explicit: BookMarked,
};

/**
 * 한국어 상대 시간. 과한 정확성 대신 채팅 UX 느낌에 맞춤.
 */
function formatRelativeKo(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CONTENT_PREVIEW_LIMIT = 300;

export function MemoryList({ items, activeKind, loadError }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectKind = (kind: MemoryKind | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (kind === null) {
      next.delete("kind");
    } else {
      next.set("kind", kind);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const hasItems = items.length > 0;

  const counts = useMemo(() => {
    // 현재 activeKind 가 아닌 전체 items 는 서버가 이미 필터링했기 때문에
    // 이 리스트의 counts 는 "현재 보여주는 필터 결과 수" 하나만 의미가 있다.
    // kind 별 정확한 총량은 S2 에서 서버 aggregated counts 로 보강.
    return items.length;
  }, [items]);

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 칩 */}
      <div
        role="tablist"
        aria-label="기억 종류 필터"
        className="flex flex-wrap gap-2"
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = (activeKind ?? null) === opt.key;
          return (
            <button
              key={opt.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectKind(opt.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-900/60 dark:bg-error-900/30 dark:text-error-300"
        >
          기억을 불러오지 못했습니다: {loadError}
        </div>
      ) : null}

      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {hasItems ? `${counts}건 표시` : "조건에 맞는 기억이 없습니다."}
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((m) => (
          <MemoryCard key={m.id} item={m} />
        ))}
      </ul>

      {/* S2 예고 안내 — 편집만 남음 */}
      <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        편집 기능은 곧 추가됩니다.
      </p>
    </div>
  );
}

function MemoryCard({ item }: { item: MemoryListItem }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticPinned, setOptimisticPinned] = useOptimistic(item.pinned);

  const Icon = KIND_ICON[item.kind];
  const over = item.content.length > CONTENT_PREVIEW_LIMIT;
  const preview = over
    ? item.content.slice(0, CONTENT_PREVIEW_LIMIT) + "…"
    : item.content;

  const handleTogglePin = () => {
    const next = !optimisticPinned;
    startTransition(async () => {
      setOptimisticPinned(next);
      const result = await toggleMemoryPin({ id: item.id, pinned: next });
      if (!result.ok) {
        // 실패 시 useOptimistic 가 다음 렌더에서 원본 값으로 자동 복구.
        alert(`고정 상태 변경에 실패했습니다: ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("이 기억을 삭제할까요? 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      const result = await deleteMemory({ id: item.id });
      if (!result.ok) {
        alert(`삭제에 실패했습니다: ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <Icon size={12} />
          {KIND_LABEL[item.kind]}
        </span>
        {optimisticPinned ? (
          <span
            className="inline-flex items-center gap-1 text-warning-600 dark:text-warning-400"
            title="고정됨"
          >
            <Pin size={12} />
            고정
          </span>
        ) : null}
        <span className="ml-auto">{formatRelativeKo(item.createdAt)}</span>

        {/* 액션 버튼 묶음 */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleTogglePin}
            disabled={isPending}
            title={optimisticPinned ? "고정 해제" : "고정"}
            aria-label={optimisticPinned ? "고정 해제" : "고정"}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
              "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
              "disabled:cursor-not-allowed disabled:opacity-50",
              optimisticPinned &&
                "text-warning-600 dark:text-warning-400",
            )}
          >
            {optimisticPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            title="삭제"
            aria-label="기억 삭제"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              "text-zinc-500 hover:bg-error-50 hover:text-error-600",
              "dark:text-zinc-400 dark:hover:bg-error-900/30 dark:hover:text-error-400",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <p
        className={cn(
          "mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200",
        )}
      >
        {expanded || !over ? item.content : preview}
      </p>

      {over ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {expanded ? "접기" : "더 보기"}
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {item.subjectStudentName ? (
          <span className="inline-flex items-center gap-1">
            <UserIcon size={12} />
            {item.subjectStudentName}
          </span>
        ) : null}
        {item.conversationId ? (
          <Link
            href={`/ai-chat?id=${item.conversationId}`}
            className="inline-flex items-center gap-1 rounded hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <MessageSquare size={12} />
            {item.conversationTitle?.trim() || "대화 열기"}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
