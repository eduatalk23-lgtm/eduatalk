"use client";

/**
 * ChatListPageWrapper - 공유 채팅 목록 페이지 래퍼 컴포넌트
 *
 * 학생과 관리자 채팅 목록 페이지에서 공통으로 사용됩니다.
 * 모바일에서 채팅/멤버 탭 전환을 지원합니다.
 */

import { useState } from "react";
import { ChatList } from "@/components/chat";
import { MemberList } from "@/components/chat/organisms/MemberList";
import { ChatSidebarTabs } from "@/components/chat/atoms/ChatSidebarTabs";
import type { ChatSidebarTab } from "@/components/chat/atoms/ChatSidebarTabs";
import { useChatRoomListRealtime } from "@/lib/realtime";
import type { ChatUserType } from "@/lib/domains/chat/types";

interface ChatListPageWrapperProps {
  userId: string;
  userType: ChatUserType;
  basePath: string;
  CreateChatModal: React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
    basePath: string;
  }>;
}

export function ChatListPageWrapper({
  userId,
  userType,
  basePath,
  CreateChatModal,
}: ChatListPageWrapperProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatSidebarTab>("chat");

  // 채팅방 목록 실시간 구독
  useChatRoomListRealtime({ userId, userType });

  return (
    <div className="h-full flex flex-col">
      {/* 탭 전환 */}
      <ChatSidebarTabs activeTab={activeTab} onChange={setActiveTab} onNewChat={() => setIsCreateModalOpen(true)} />

      {/* 탭 콘텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "chat" ? (
          <ChatList basePath={basePath} onNewChat={() => setIsCreateModalOpen(true)} hideHeader />
        ) : (
          <MemberList
            currentUserId={userId}
            userType={userType}
            basePath={basePath}
            hideHeader
          />
        )}
      </div>

      <CreateChatModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        basePath={basePath}
      />
    </div>
  );
}
