"use client";

/**
 * AdminChatListPage - 관리자 채팅 목록 페이지
 */

import { useState } from "react";
import { ChatList } from "@/components/chat";
import { useChatRoomListRealtime } from "@/lib/realtime";
import { AdminCreateChatModal } from "./AdminCreateChatModal";

interface AdminChatListPageProps {
  userId: string;
}

export function AdminChatListPage({ userId }: AdminChatListPageProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 채팅방 목록 실시간 구독
  useChatRoomListRealtime({
    userId,
    userType: "admin",
  });

  return (
    <div className="h-full">
      <ChatList
        basePath="/admin/chat"
        onNewChat={() => setIsCreateModalOpen(true)}
      />

      <AdminCreateChatModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
