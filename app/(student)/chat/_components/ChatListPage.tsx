"use client";

/**
 * ChatListPage - 채팅 목록 페이지 클라이언트 컴포넌트
 */

import { useState } from "react";
import { ChatList } from "@/components/chat";
import { useChatRoomListRealtime } from "@/lib/realtime";
import { CreateChatModal } from "./CreateChatModal";

interface ChatListPageProps {
  userId: string;
  basePath: string;
}

export function ChatListPage({ userId, basePath }: ChatListPageProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 채팅방 목록 실시간 구독
  useChatRoomListRealtime({
    userId,
    userType: "student",
  });

  return (
    <div className="h-full">
      <ChatList
        basePath={basePath}
        onNewChat={() => setIsCreateModalOpen(true)}
      />

      <CreateChatModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        basePath={basePath}
      />
    </div>
  );
}
