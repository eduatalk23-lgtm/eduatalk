"use client";

/**
 * Phase B-2: Cmd+K Command Palette
 *
 * cmdk 기반 전역 팔레트. /ai-chat 에서 첫 진입.
 * - 최근 대화 (pinned 우선, 최대 8)
 * - 페이지 이동 (role-aware)
 * - 액션 (새 대화 / 다크 모드 토글)
 * - ⌘K / Ctrl+K 열기, Esc 닫기, Enter 실행
 */

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BarChart3,
  Calendar,
  GraduationCap,
  Home,
  LayoutDashboard,
  MessageSquarePlus,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  Pin,
  ArchiveRestore,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";
import type { ConversationListItem } from "@/components/ai-chat/ConversationSidebar";

type Role = "student" | "parent" | "consultant" | "admin" | "superadmin";

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
};

const STUDENT_NAV: NavItem[] = [
  { path: "/dashboard", label: "대시보드", icon: Home },
  { path: "/plan", label: "학습 플랜", icon: Calendar },
  { path: "/scores", label: "성적", icon: BarChart3 },
  { path: "/analysis", label: "생기부 분석", icon: Sparkles },
  { path: "/guides", label: "탐구 가이드", icon: GraduationCap },
  { path: "/settings", label: "설정", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { path: "/admin/dashboard", label: "관리자 대시보드", icon: LayoutDashboard },
  { path: "/admin/students", label: "학생 목록", icon: Users },
  { path: "/admin/guides", label: "가이드 관리", icon: GraduationCap },
  { path: "/admin/settings", label: "관리자 설정", icon: Settings },
];

const PARENT_NAV: NavItem[] = [
  { path: "/parent/dashboard", label: "학부모 대시보드", icon: Home },
  { path: "/parent/record", label: "자녀 생기부", icon: Sparkles },
  { path: "/parent/scores", label: "자녀 성적", icon: BarChart3 },
  { path: "/parent/settings", label: "학부모 설정", icon: Settings },
];

function getNavForRole(role: Role): NavItem[] {
  if (role === "student") return STUDENT_NAV;
  if (role === "parent") return PARENT_NAV;
  // consultant / admin / superadmin
  return ADMIN_NAV;
}

type Props = {
  open: boolean;
  onClose: () => void;
  role: Role;
  activeConversationId: string;
  conversations: ConversationListItem[];
};

export function CommandPalette({
  open,
  onClose,
  role,
  activeConversationId,
  conversations,
}: Props) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const navItems = useMemo(() => getNavForRole(role), [role]);

  const recentConversations = useMemo(() => {
    return conversations
      .filter((c) => c.id !== activeConversationId && !c.archivedAt)
      .slice(0, 8);
  }, [conversations, activeConversationId]);

  const goto = (path: string) => {
    router.push(path);
    onClose();
  };

  const openConversation = (id: string) => {
    router.push(`/ai-chat?id=${encodeURIComponent(id)}`);
    onClose();
  };

  if (!open) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="명령 팔레트"
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="명령 팔레트"
          className="flex flex-col"
          loop
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Search size={16} className="text-zinc-400 dark:text-zinc-500" />
            <Command.Input
              autoFocus
              placeholder="이동할 페이지·대화·액션을 검색…"
              className="flex-1 border-0 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <kbd className="hidden rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline dark:bg-zinc-800 dark:text-zinc-400">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              일치하는 항목이 없어요.
            </Command.Empty>

            <Command.Group
              heading="액션"
              className="mb-1 text-xs text-zinc-500 dark:text-zinc-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
            >
              <PaletteItem
                icon={<MessageSquarePlus size={14} />}
                label="새 대화 시작"
                hint="/ai-chat"
                onSelect={() => goto("/ai-chat")}
              />
              <PaletteItem
                icon={isDark ? <Sun size={14} /> : <Moon size={14} />}
                label={isDark ? "라이트 모드" : "다크 모드"}
                hint="테마 전환"
                onSelect={() => {
                  setTheme(isDark ? "light" : "dark");
                  onClose();
                }}
              />
            </Command.Group>

            <Command.Group
              heading="페이지 이동"
              className="mb-1 text-xs text-zinc-500 dark:text-zinc-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <PaletteItem
                    key={item.path}
                    icon={<Icon size={14} />}
                    label={item.label}
                    hint={item.path}
                    onSelect={() => goto(item.path)}
                  />
                );
              })}
            </Command.Group>

            {recentConversations.length > 0 && (
              <Command.Group
                heading="최근 대화"
                className="text-xs text-zinc-500 dark:text-zinc-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {recentConversations.map((c) => {
                  const title =
                    c.title && c.title.length > 0 ? c.title : "(제목 없음)";
                  return (
                    <PaletteItem
                      key={c.id}
                      icon={
                        c.pinnedAt ? (
                          <Pin size={14} />
                        ) : (
                          <ArchiveRestore size={14} />
                        )
                      }
                      label={title}
                      hint={relativeLabel(c.lastActivityAt)}
                      onSelect={() => openConversation(c.id)}
                    />
                  );
                })}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <div className="flex items-center gap-3">
              <ShortcutHint label="이동" keys={["↵"]} />
              <ShortcutHint label="선택" keys={["↑", "↓"]} />
            </div>
            <ShortcutHint label="닫기" keys={["Esc"]} />
          </div>
        </Command>
      </div>
    </div>
  );
}

function PaletteItem({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={`${label} ${hint ?? ""}`}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-zinc-800 transition-colors dark:text-zinc-200",
        "data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800",
      )}
    >
      <span className="text-zinc-500 dark:text-zinc-400">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="ml-auto truncate text-[11px] text-zinc-400 dark:text-zinc-500">
          {hint}
        </span>
      )}
    </Command.Item>
  );
}

function ShortcutHint({ label, keys }: { label: string; keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-300"
        >
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}

function relativeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return "방금";
  if (diffHours < 24) return `${Math.floor(diffHours)}시간 전`;
  const diffDays = diffHours / 24;
  if (diffDays < 7) return `${Math.floor(diffDays)}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
