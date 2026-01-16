"use client";

/**
 * ChatListPage - 학생 채팅 목록 페이지 클라이언트 컴포넌트
 */

import { ChatListPageWrapper } from "@/components/chat/pages";
import { CreateChatModal } from "./CreateChatModal";

interface ChatListPageProps {
  userId: string;
  basePath: string;
}

export function ChatListPage({ userId, basePath }: ChatListPageProps) {
  return (
    <ChatListPageWrapper
      userId={userId}
      userType="student"
      basePath={basePath}
      CreateChatModal={CreateChatModal}
    />
  );
}
