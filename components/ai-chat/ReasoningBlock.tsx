"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Markdown } from "@/components/ai-chat/Markdown";

type Props = {
  text: string;
  /**
   * AI SDK v6 reasoning part state.
   * - "streaming": 추론 진행 중, 자동 펼침 + 펄스
   * - "done" or undefined: 완료, 기본 접힘
   */
  state?: "streaming" | "done";
};

export function ReasoningBlock({ text, state }: Props) {
  const streaming = state === "streaming";
  const [open, setOpen] = useState(streaming);

  useEffect(() => {
    if (streaming) setOpen(true);
  }, [streaming]);

  const trimmed = text.trim();
  if (!trimmed && !streaming) return null;

  return (
    <div className="my-1 rounded-lg border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-100/60 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
        aria-expanded={open}
      >
        <Sparkles
          size={12}
          className={cn(
            "shrink-0",
            streaming
              ? "animate-pulse text-zinc-700 dark:text-zinc-200"
              : "text-zinc-400 dark:text-zinc-500",
          )}
        />
        <span className="font-medium">
          {streaming ? "생각 중" : "생각 과정"}
        </span>
        <ChevronRight
          size={12}
          className={cn(
            "ml-auto shrink-0 text-zinc-400 transition-transform dark:text-zinc-500",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (trimmed || streaming) && (
        <div className="border-t border-zinc-200/80 px-3 py-2 text-[13px] leading-6 text-zinc-600 dark:border-zinc-800/80 dark:text-zinc-400">
          {trimmed ? (
            <Markdown text={trimmed} className="text-[13px] leading-6" />
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">추론 중…</span>
          )}
        </div>
      )}
    </div>
  );
}
