"use client";

/**
 * Phase B-3 이월: @mention 플로팅 메뉴
 *
 * ChatShell 이 fetch + 선택 관리를 담당하고 이 컴포넌트는 순수 렌더.
 */

import { User } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MentionCandidate } from "@/lib/domains/ai-chat/actions/mentions";

type Props = {
  candidates: MentionCandidate[];
  activeIndex: number;
  loading?: boolean;
  onHover: (index: number) => void;
  onSelect: (candidate: MentionCandidate) => void;
};

export function MentionMenu({
  candidates,
  activeIndex,
  loading,
  onHover,
  onSelect,
}: Props) {
  if (loading && candidates.length === 0) {
    return (
      <div
        role="status"
        aria-label="학생 검색 중"
        className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
      >
        학생 검색 중…
      </div>
    );
  }
  if (candidates.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="학생 mention"
        className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
      >
        일치하는 학생이 없어요.
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="학생 mention"
      className="mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      {candidates.map((c, i) => {
        const isActive = i === activeIndex;
        const meta = [
          c.grade ? `${c.grade}학년` : null,
          c.school,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(c)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
              isActive
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-700 dark:text-zinc-300",
            )}
          >
            <span className="text-zinc-500 dark:text-zinc-400">
              <User size={14} />
            </span>
            <span className="font-medium">@{c.name}</span>
            {meta && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {meta}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
