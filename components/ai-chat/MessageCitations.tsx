"use client";

/**
 * Phase C-4 (2026-04-21): assistant 메시지 말미 근거 pill.
 *
 * extractCitations 결과를 가벼운 pill 로 렌더. 클릭 시 ArtifactPanel 을 해당
 * (type, subjectKey) 로 열도록 상위(MessageRow)가 resolve·openArtifact 수행.
 * Panel 이 이미 해당 artifact 를 열고 있으면 강조(active) 만 표시.
 */

import { BarChart3, CalendarClock, FileSearch } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MessageCitation } from "@/lib/domains/ai-chat/citation-extractor";
import type { ArtifactType } from "@/lib/domains/ai-chat/artifact-repository";

const TYPE_ICON: Record<ArtifactType, typeof BarChart3 | null> = {
  scores: BarChart3,
  analysis: FileSearch,
  plan: CalendarClock,
  blueprint: null,
  generic: null,
};

type Props = {
  citations: MessageCitation[];
  onPillClick: (citation: MessageCitation) => void;
  /**
   * 현재 패널에 열린 citation 키 (`${type}::${subjectKey}`). 매칭되는 pill 은
   * active 스타일. ArtifactPanel 의 opaque id(toolCallId 기반) 와는 무관하게
   * 근거 키로 비교 — 같은 학생 내신이면 tool call 이 여러 번이어도 동일 pill.
   */
  activeKey?: string | null;
};

export function MessageCitations({
  citations,
  onPillClick,
  activeKey,
}: Props) {
  if (citations.length === 0) return null;

  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-1.5 text-xs"
      aria-label="이 답변의 근거"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        근거
      </span>
      {citations.map((c) => {
        const Icon = TYPE_ICON[c.type];
        const key = `${c.type}::${c.subjectKey}`;
        const isActive = activeKey === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPillClick(c)}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
              isActive
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
            )}
            aria-pressed={isActive}
            title={c.detail ? `${c.label} · ${c.detail}` : c.label}
          >
            {Icon && <Icon size={12} className="shrink-0" />}
            <span className="truncate">{c.label}</span>
            {c.detail && (
              <span
                className={cn(
                  "shrink-0 text-[11px]",
                  isActive
                    ? "text-white/70 dark:text-zinc-900/70"
                    : "text-zinc-500 dark:text-zinc-400",
                )}
              >
                · {c.detail}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
