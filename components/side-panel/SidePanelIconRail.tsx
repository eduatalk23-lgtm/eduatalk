"use client";

import { StickyNote, MessageSquare, BarChart2, Bot, Network, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSidePanel } from "./SidePanelContext";
import { SIDE_PANEL_APPS } from "./types";
import { useTotalUnreadCount } from "@/lib/domains/chat/hooks/useTotalUnreadCount";

const ICON_MAP: Record<string, LucideIcon> = {
  StickyNote,
  MessageSquare,
  BarChart2,
  Bot,
  Network,
};

const RAIL_WIDTH = 48;

export function SidePanelIconRail() {
  const { activeApp, isMobile, toggleApp } = useSidePanel();
  const unreadCount = useTotalUnreadCount();

  if (isMobile) return null;

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center bg-[rgb(var(--color-secondary-100))] py-2 gap-1"
      style={{ width: RAIL_WIDTH }}
    >
      {SIDE_PANEL_APPS.map((app) => {
        const Icon = ICON_MAP[app.icon];
        if (!Icon) return null;
        const badge = app.id === "chat" && unreadCount > 0 ? unreadCount : 0;
        return (
          <RailButton
            key={app.id}
            icon={Icon}
            label={app.label}
            isActive={activeApp === app.id}
            onClick={() => toggleApp(app.id)}
            badge={badge}
          />
        );
      })}
    </div>
  );
}

/** 모바일 TopBar용 아이콘 버튼 (외부에서 사용) */
export function SidePanelMobileButton() {
  const { toggleApp, isMobile } = useSidePanel();

  if (!isMobile) return null;

  return (
    <button
      type="button"
      onClick={() => toggleApp("memo")}
      title="메모"
      aria-label="메모"
      className="p-1.5 shrink-0 rounded-full transition-colors hover:bg-[rgb(var(--color-secondary-200))]"
    >
      <StickyNote className="w-4 h-4 text-[var(--text-secondary)]" />
    </button>
  );
}

function RailButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge = 0,
}: {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "relative w-9 h-9 flex items-center justify-center rounded-full transition-colors",
        isActive
          ? "bg-[rgb(var(--color-primary-100))] text-[rgb(var(--color-primary-700))]"
          : "text-[var(--color-text-tertiary)] hover:bg-[rgb(var(--color-secondary-200))] hover:text-[var(--color-text-primary)]"
      )}
    >
      {isActive && (
        <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-[rgb(var(--color-primary-600))]" />
      )}
      <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
      {badge > 0 && !isActive && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-medium px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export { RAIL_WIDTH };
