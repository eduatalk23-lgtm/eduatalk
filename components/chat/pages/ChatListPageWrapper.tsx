"use client";

/**
 * ChatListPageWrapper - 공유 채팅 목록 페이지 래퍼 컴포넌트
 *
 * 학생과 관리자 채팅 목록 페이지에서 공통으로 사용됩니다.
 */

import { useState } from "react";
import { ChatList } from "@/components/chat";
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

  // 채팅방 목록 실시간 구독
  useChatRoomListRealtime({ userId, userType });

  return (
    <div className="h-full">
      <ChatList basePath={basePath} onNewChat={() => setIsCreateModalOpen(true)} />

      <CreateChatModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        basePath={basePath}
      />
    </div>
  );
}
