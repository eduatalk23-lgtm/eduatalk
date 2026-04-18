"use client";

/**
 * Phase B-3: Slash 커맨드 플로팅 메뉴
 *
 * composer 입력이 '/' 로 시작할 때 위쪽에 뜨는 드롭다운.
 * 키보드(↑↓ + Enter/Tab)는 ChatShell composer onKeyDown 이 가로채고,
 * 이 컴포넌트는 순수 렌더만 담당.
 */

import { cn } from "@/lib/cn";
import {
  BarChart3,
  Calendar,
  Sparkles,
  GraduationCap,
  MessageSquarePlus,
  HelpCircle,
} from "lucide-react";

export type SlashCommandAction =
  | { type: "prompt"; text: string }
  | { type: "navigate"; path: string };

export type SlashCommand = {
  name: string;
  label: string;
  description: string;
  action: SlashCommandAction;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
};

export const STUDENT_SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "scores",
    label: "/scores",
    description: "내 성적 조회",
    action: { type: "prompt", text: "내 성적 보여줘" },
    icon: BarChart3,
  },
  {
    name: "plan",
    label: "/plan",
    description: "이번 주 학습 플랜",
    action: { type: "prompt", text: "이번 주 학습 플랜 확인하고 싶어" },
    icon: Calendar,
  },
  {
    name: "analysis",
    label: "/analysis",
    description: "생기부 분석 요약",
    action: { type: "prompt", text: "최근 생기부 분석 결과를 요약해줘" },
    icon: Sparkles,
  },
  {
    name: "guides",
    label: "/guides",
    description: "탐구 가이드 추천",
    action: { type: "prompt", text: "탐구 가이드 추천해줘" },
    icon: GraduationCap,
  },
  {
    name: "help",
    label: "/help",
    description: "도움말",
    action: {
      type: "prompt",
      text: "에듀엣톡에서 무엇을 할 수 있는지 알려줘",
    },
    icon: HelpCircle,
  },
  {
    name: "clear",
    label: "/clear",
    description: "새 대화 시작",
    action: { type: "navigate", path: "/ai-chat" },
    icon: MessageSquarePlus,
  },
];

const ADMIN_SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "students",
    label: "/students",
    description: "학생 목록 열기",
    action: { type: "navigate", path: "/admin/students" },
    icon: GraduationCap,
  },
  {
    name: "guides",
    label: "/guides",
    description: "가이드 관리",
    action: { type: "navigate", path: "/admin/guides" },
    icon: Sparkles,
  },
  {
    name: "help",
    label: "/help",
    description: "도움말",
    action: {
      type: "prompt",
      text: "관리자 모드에서 무엇을 할 수 있는지 알려줘",
    },
    icon: HelpCircle,
  },
  {
    name: "clear",
    label: "/clear",
    description: "새 대화 시작",
    action: { type: "navigate", path: "/ai-chat" },
    icon: MessageSquarePlus,
  },
];

export function getSlashCommandsForRole(
  role: "student" | "parent" | "consultant" | "admin" | "superadmin",
): SlashCommand[] {
  if (role === "admin" || role === "consultant" || role === "superadmin") {
    return ADMIN_SLASH_COMMANDS;
  }
  return STUDENT_SLASH_COMMANDS;
}

export function filterSlashCommands(
  commands: SlashCommand[],
  query: string,
): SlashCommand[] {
  if (!query) return commands;
  const q = query.toLowerCase();
  return commands.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q),
  );
}

type Props = {
  commands: SlashCommand[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (command: SlashCommand) => void;
};

export function SlashMenu({
  commands,
  activeIndex,
  onHover,
  onSelect,
}: Props) {
  if (commands.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="슬래시 커맨드"
        className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
      >
        일치하는 커맨드가 없어요.
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="슬래시 커맨드"
      className="mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      {commands.map((cmd, i) => {
        const Icon = cmd.icon;
        const isActive = i === activeIndex;
        return (
          <button
            key={cmd.name}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(cmd)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
              isActive
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-700 dark:text-zinc-300",
            )}
          >
            <span className="text-zinc-500 dark:text-zinc-400">
              <Icon size={14} />
            </span>
            <span className="font-medium">{cmd.label}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {cmd.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
