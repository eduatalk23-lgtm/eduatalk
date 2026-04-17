"use client";

/**
 * Phase T-1 + T-3 공용 핸드오프 런처
 *
 * 드롭다운 2선택:
 *  1. "이 화면에서 대화" (split)  — SplitChatPanel 오픈
 *  2. "대화방에서 보기" (full)     — /ai-chat?from=... 이동 (기본 링크)
 *
 * 서버 컴포넌트에서도 삽입 가능하도록 클라이언트 컴포넌트로만 제공.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquareText,
  PanelRight,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useSplitChatStore } from "@/lib/stores/splitChatStore";

export type HandoffLauncherProps = {
  from: string;
  studentId?: string;
  grade?: number;
  semester?: number;
  subject?: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
  /** v0: split 모드 비노출 (기존 스니펫 호환). 기본 true. */
  offerSplit?: boolean;
};

const SIZE_CLASS: Record<NonNullable<HandoffLauncherProps["size"]>, string> = {
  sm: "h-8 text-xs gap-1.5",
  md: "h-9 text-sm gap-2",
};

function buildFullUrl(p: HandoffLauncherProps): string {
  const params = new URLSearchParams();
  params.set("from", p.from);
  if (p.studentId) params.set("studentId", p.studentId);
  if (p.grade != null) params.set("grade", String(p.grade));
  if (p.semester != null) params.set("semester", String(p.semester));
  if (p.subject) params.set("subject", p.subject);
  return `/ai-chat?${params.toString()}`;
}

export function HandoffLauncher({
  from,
  studentId,
  grade,
  semester,
  subject,
  label = "AI와 대화",
  size = "md",
  className,
  offerSplit = true,
}: HandoffLauncherProps) {
  const openSplit = useSplitChatStore((s) => s.openSplit);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fullUrl = buildFullUrl({ from, studentId, grade, semester, subject });

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [menuOpen]);

  const handleSplit = () => {
    setMenuOpen(false);
    openSplit({
      conversationId: crypto.randomUUID(),
      input: {
        from,
        studentId,
        grade,
        semester,
        subject,
      },
    });
  };

  // split 비제공 시 기존 단일 버튼 동작 유지 (하위 호환)
  if (!offerSplit) {
    return (
      <Link
        href={fullUrl}
        className={cn(
          "inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3.5 font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
          SIZE_CLASS[size],
          className,
        )}
        aria-label={label}
      >
        <MessageSquareText size={size === "sm" ? 13 : 15} />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <div ref={menuRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn(
          "inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3.5 font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
          SIZE_CLASS[size],
        )}
      >
        <MessageSquareText size={size === "sm" ? 13 : 15} />
        <span>{label}</span>
        <ChevronDown size={size === "sm" ? 12 : 14} className="ml-0.5" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 flex w-56 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleSplit}
            className="flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <PanelRight size={14} className="mt-0.5 text-zinc-500" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                이 화면에서 대화
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                현재 화면 + 우측 패널
              </span>
            </div>
          </button>
          <Link
            href={fullUrl}
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="flex items-start gap-2.5 border-t border-zinc-100 px-3 py-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            <ExternalLink size={14} className="mt-0.5 text-zinc-500" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                대화방에서 보기
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                전체 화면 전환 (/ai-chat)
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
