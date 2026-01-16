"use client";

/**
 * AdminChatListPage - 관리자 채팅 목록 페이지
 */

import { ChatListPageWrapper } from "@/components/chat/pages";
import { AdminCreateChatModal } from "./AdminCreateChatModal";

interface AdminChatListPageProps {
  userId: string;
  basePath: string;
}

export function AdminChatListPage({ userId, basePath }: AdminChatListPageProps) {
  return (
    <ChatListPageWrapper
      userId={userId}
      userType="admin"
      basePath={basePath}
      CreateChatModal={AdminCreateChatModal}
    />
  );
}
