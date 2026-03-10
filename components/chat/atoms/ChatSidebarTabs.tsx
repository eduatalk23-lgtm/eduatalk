"use client";

/**
 * ChatSidebarTabs - 채팅/멤버 탭 전환 컴포넌트
 *
 * ChatSplitLayout(데스크톱)과 ChatListPageWrapper(모바일)에서 공유합니다.
 */

import { memo } from "react";
import { cn } from "@/lib/cn";
import { MessageSquare, MessageSquarePlus, Users } from "lucide-react";

export type ChatSidebarTab = "chat" | "member";

interface ChatSidebarTabsProps {
  activeTab: ChatSidebarTab;
  onChange: (tab: ChatSidebarTab) => void;
  /** 새 채팅 버튼 클릭 (채팅 탭 활성 시 표시) */
  onNewChat?: () => void;
}

function ChatSidebarTabsComponent({ activeTab, onChange, onNewChat }: ChatSidebarTabsProps) {
  return (
    <div className="flex items-center border-b border-border bg-bg-primary">
      <button
        type="button"
        onClick={() => onChange("chat")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2",
          activeTab === "chat"
            ? "border-primary-500 text-primary-500"
            : "border-transparent text-text-tertiary hover:text-text-secondary"
        )}
      >
        <MessageSquare className="w-4 h-4" />
        <span>채팅</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("member")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2",
          activeTab === "member"
            ? "border-primary-500 text-primary-500"
            : "border-transparent text-text-tertiary hover:text-text-secondary"
        )}
      >
        <Users className="w-4 h-4" />
        <span>멤버</span>
      </button>

      {/* 새 채팅 버튼 (채팅 탭일 때만) */}
      {onNewChat && activeTab === "chat" && (
        <button
          type="button"
          onClick={onNewChat}
          className="p-2 mr-2 rounded-lg hover:bg-bg-secondary transition-colors flex-shrink-0"
          title="새 채팅"
        >
          <MessageSquarePlus className="w-5 h-5 text-text-secondary" />
        </button>
      )}
    </div>
  );
}

export const ChatSidebarTabs = memo(ChatSidebarTabsComponent);
