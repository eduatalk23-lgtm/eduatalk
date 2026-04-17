"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export type ConversationListItem = {
  id: string;
  title: string | null;
  persona: string;
  lastActivityAt: string;
};

type Props = {
  conversations: ConversationListItem[];
  activeId: string;
};

const PERSONA_LABELS: Record<string, string> = {
  student: "학생",
  parent: "학부모",
  consultant: "컨설턴트",
  admin: "관리자",
  superadmin: "슈퍼관리자",
};

type GroupKey = "today" | "yesterday" | "week" | "month" | "older";
const GROUP_LABELS: Record<GroupKey, string> = {
  today: "오늘",
  yesterday: "어제",
  week: "지난 7일",
  month: "이번 달",
  older: "이전",
};
const GROUP_ORDER: GroupKey[] = ["today", "yesterday", "week", "month", "older"];

function classifyByDate(iso: string): GroupKey {
  const now = new Date();
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";

  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return "week";
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth()
  )
    return "month";
  return "older";
}

function formatRelative(iso: string, group: GroupKey): string {
  const d = new Date(iso);
  if (group === "today") {
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (group === "yesterday") return "어제";
  return d.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export function ConversationSidebar({ conversations, activeId }: Props) {
  const grouped = new Map<GroupKey, ConversationListItem[]>();
  for (const c of conversations) {
    const key = classifyByDate(c.lastActivityAt);
    const arr = grouped.get(key) ?? [];
    arr.push(c);
    grouped.set(key, arr);
  }

  return (
    <aside className="hidden h-dvh w-72 flex-col border-r border-zinc-200 bg-zinc-50 md:flex">
      <header className="border-b border-zinc-200 px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">대화 기록</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          최근 50개 · 최근 활동순
        </p>
      </header>

      <nav className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-400">
            아직 대화 기록이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-1 py-2">
            {GROUP_ORDER.filter((k) => grouped.has(k)).map((key) => (
              <div key={key} className="flex flex-col">
                <h3 className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {GROUP_LABELS[key]}
                </h3>
                <ul className="flex flex-col">
                  {grouped.get(key)!.map((c) => {
                    const isActive = c.id === activeId;
                    const title =
                      c.title && c.title.length > 0 ? c.title : "(제목 없음)";
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/ai-chat?id=${c.id}`}
                          className={cn(
                            "flex flex-col gap-1 border-l-2 px-4 py-2.5 transition-colors",
                            isActive
                              ? "border-zinc-900 bg-white"
                              : "border-transparent hover:bg-white",
                          )}
                        >
                          <span
                            className={cn(
                              "line-clamp-2 text-[13px]",
                              isActive
                                ? "font-semibold text-zinc-900"
                                : "text-zinc-700",
                            )}
                          >
                            {title}
                          </span>
                          <span className="flex items-center gap-2 text-[10px] text-zinc-500">
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                              {PERSONA_LABELS[c.persona] ?? c.persona}
                            </span>
                            <span>{formatRelative(c.lastActivityAt, key)}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </nav>

      <footer className="border-t border-zinc-200 p-3">
        <Link
          href="/ai-chat"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={14} />새 대화 시작
        </Link>
      </footer>
    </aside>
  );
}
