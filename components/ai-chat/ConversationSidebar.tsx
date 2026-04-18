"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Plus,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Archive,
  Trash2,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  renameConversation,
  togglePinConversation,
  toggleArchiveConversation,
  deleteConversation,
} from "@/lib/domains/ai-chat/actions";

export type ConversationListItem = {
  id: string;
  title: string | null;
  persona: string;
  lastActivityAt: string;
  pinnedAt: string | null;
  archivedAt: string | null;
  tags: string[];
};

type Props = {
  conversations: ConversationListItem[];
  activeId: string;
  /** 모바일 드로어 오픈 여부. md+ 에서는 무시되고 항상 표시. */
  mobileOpen?: boolean;
  /** 모바일 드로어 닫기 콜백 (백드롭 클릭 / 링크 클릭 시). */
  onMobileClose?: () => void;
};

const PERSONA_LABELS: Record<string, string> = {
  student: "학생",
  parent: "학부모",
  consultant: "컨설턴트",
  admin: "관리자",
  superadmin: "슈퍼관리자",
};

type GroupKey = "pinned" | "today" | "yesterday" | "week" | "month" | "older";
const GROUP_LABELS: Record<GroupKey, string> = {
  pinned: "고정됨",
  today: "오늘",
  yesterday: "어제",
  week: "지난 7일",
  month: "이번 달",
  older: "이전",
};
const GROUP_ORDER: GroupKey[] = [
  "pinned",
  "today",
  "yesterday",
  "week",
  "month",
  "older",
];

function classifyByDate(iso: string): Exclude<GroupKey, "pinned"> {
  const now = new Date();
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";

  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
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

export function ConversationSidebar({
  conversations,
  activeId,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen, onMobileClose]);

  // 전체 대화에서 나타난 태그 집계 (빈도 내림차순, 최대 20개)
  const allTags = (() => {
    const counts = new Map<string, number>();
    for (const c of conversations) {
      for (const t of c.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
  })();

  // 선택된 태그가 있으면 AND 필터: 모두 포함해야 통과
  const filtered = activeTags.length === 0
    ? conversations
    : conversations.filter((c) =>
        activeTags.every((t) => (c.tags ?? []).includes(t)),
      );

  const grouped = new Map<GroupKey, ConversationListItem[]>();
  for (const c of filtered) {
    const key: GroupKey = c.pinnedAt
      ? "pinned"
      : classifyByDate(c.lastActivityAt);
    const arr = grouped.get(key) ?? [];
    arr.push(c);
    grouped.set(key, arr);
  }

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="사이드바 닫기"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}
    <aside
      className={cn(
        "z-50 h-dvh w-72 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950",
        "md:flex",
        mobileOpen
          ? "fixed inset-y-0 left-0 flex shadow-2xl md:static md:shadow-none"
          : "hidden",
      )}
      aria-label="대화 목록"
    >
      <header className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          대화 기록
        </h2>
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          최근 50개 · 고정 먼저
        </p>
      </header>

      {allTags.length > 0 && (
        <div
          className="flex flex-wrap gap-1 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800"
          role="group"
          aria-label="태그 필터"
        >
          {allTags.map(({ tag, count }) => {
            const isActive = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                )}
              >
                <Hash size={10} />
                <span>{tag}</span>
                <span className="ml-0.5 text-[10px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto" aria-label="대화 목록 네비게이션">
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-400 dark:text-zinc-500">
            아직 대화 기록이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-1 py-2">
            {GROUP_ORDER.filter((k) => grouped.has(k)).map((key) => (
              <div key={key} className="flex flex-col">
                <h3 className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {GROUP_LABELS[key]}
                </h3>
                <ul className="flex flex-col">
                  {grouped.get(key)!.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      group={key}
                      isActive={c.id === activeId}
                      isRenaming={renamingId === c.id}
                      isMenuOpen={menuOpenId === c.id}
                      onRequestMenu={() =>
                        setMenuOpenId((v) => (v === c.id ? null : c.id))
                      }
                      onCloseMenu={() => setMenuOpenId(null)}
                      onStartRename={() => {
                        setMenuOpenId(null);
                        setRenamingId(c.id);
                      }}
                      onFinishRename={() => setRenamingId(null)}
                      onNavigate={onMobileClose}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </nav>

      <footer className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <Link
          href="/ai-chat"
          onClick={onMobileClose}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus size={14} />새 대화 시작
        </Link>
      </footer>
    </aside>
    </>
  );
}

type RowProps = {
  conversation: ConversationListItem;
  group: GroupKey;
  isActive: boolean;
  isRenaming: boolean;
  isMenuOpen: boolean;
  onRequestMenu: () => void;
  onCloseMenu: () => void;
  onStartRename: () => void;
  onFinishRename: () => void;
  onNavigate?: () => void;
};

function ConversationRow({
  conversation: c,
  group,
  isActive,
  isRenaming,
  isMenuOpen,
  onRequestMenu,
  onCloseMenu,
  onStartRename,
  onFinishRename,
  onNavigate,
}: RowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const title = c.title && c.title.length > 0 ? c.title : "(제목 없음)";

  const handlePin = () => {
    startTransition(async () => {
      await togglePinConversation(c.id, !c.pinnedAt);
      onCloseMenu();
      router.refresh();
    });
  };
  const handleArchive = () => {
    startTransition(async () => {
      await toggleArchiveConversation(c.id, true);
      onCloseMenu();
      router.refresh();
    });
  };
  const handleDelete = () => {
    if (!confirm("이 대화를 삭제할까요? 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      await deleteConversation(c.id);
      onCloseMenu();
      if (isActive) router.push("/ai-chat");
      else router.refresh();
    });
  };

  return (
    <li
      className={cn(
        "group relative",
        isPending && "opacity-60",
      )}
    >
      {isRenaming ? (
        <RenameInput
          initial={c.title ?? ""}
          onSave={(next) => {
            startTransition(async () => {
              await renameConversation(c.id, next);
              onFinishRename();
              router.refresh();
            });
          }}
          onCancel={onFinishRename}
        />
      ) : (
        <>
          <Link
            href={`/ai-chat?id=${c.id}`}
            onClick={onNavigate}
            className={cn(
              "flex flex-col gap-1 border-l-2 px-4 py-2.5 pr-10 transition-colors",
              isActive
                ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-900"
                : "border-transparent hover:bg-white dark:hover:bg-zinc-900",
            )}
          >
            <span
              className={cn(
                "line-clamp-2 text-[13px]",
                isActive
                  ? "font-semibold text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-700 dark:text-zinc-300",
              )}
            >
              {c.pinnedAt && (
                <Pin
                  size={10}
                  className="mr-1 inline text-zinc-500 dark:text-zinc-400"
                  aria-label="고정됨"
                />
              )}
              {title}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800 dark:text-zinc-300">
                {PERSONA_LABELS[c.persona] ?? c.persona}
              </span>
              <span>{formatRelative(c.lastActivityAt, group)}</span>
              {(c.tags ?? []).slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-zinc-50 px-1.5 py-0.5 text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700"
                >
                  #{t}
                </span>
              ))}
            </span>
          </Link>
          <button
            type="button"
            onClick={onRequestMenu}
            aria-label="대화 액션 메뉴"
            aria-expanded={isMenuOpen}
            className={cn(
              "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-opacity hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
              isMenuOpen
                ? "opacity-100"
                : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
            )}
          >
            <MoreHorizontal size={14} />
          </button>
          {isMenuOpen && (
            <ActionMenu
              pinned={!!c.pinnedAt}
              onClose={onCloseMenu}
              onPin={handlePin}
              onRename={onStartRename}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}
        </>
      )}
    </li>
  );
}

function RenameInput({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <div className="flex flex-col gap-1 border-l-2 border-zinc-900 bg-white px-4 py-2.5 dark:border-zinc-100 dark:bg-zinc-900">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim() === initial.trim() || value.trim().length === 0) {
            onCancel();
          } else {
            onSave(value);
          }
        }}
        maxLength={120}
        aria-label="대화 이름"
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-[13px] text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400"
      />
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
        Enter 저장 · Esc 취소
      </span>
    </div>
  );
}

function ActionMenu({
  pinned,
  onClose,
  onPin,
  onRename,
  onArchive,
  onDelete,
}: {
  pinned: boolean;
  onClose: () => void;
  onPin: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-2 top-9 z-10 flex w-40 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-[13px] text-zinc-800 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
    >
      <MenuItem
        icon={pinned ? <PinOff size={13} /> : <Pin size={13} />}
        label={pinned ? "고정 해제" : "상단 고정"}
        onClick={onPin}
      />
      <MenuItem
        icon={<Pencil size={13} />}
        label="이름 변경"
        onClick={onRename}
      />
      <MenuItem
        icon={<Archive size={13} />}
        label="아카이브"
        onClick={onArchive}
      />
      <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
      <MenuItem
        icon={<Trash2 size={13} />}
        label="삭제"
        onClick={onDelete}
        danger
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
          : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800",
      )}
    >
      <span className={cn(danger ? "text-red-500 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
