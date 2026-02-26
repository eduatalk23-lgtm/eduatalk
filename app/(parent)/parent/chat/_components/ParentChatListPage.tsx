"use client";

/**
 * ParentChatListPage - 학부모 채팅 목록 페이지 클라이언트 컴포넌트
 */

import { ChatListPageWrapper } from "@/components/chat/pages";
import { ParentCreateChatModal } from "./ParentCreateChatModal";

interface ParentChatListPageProps {
  userId: string;
  basePath: string;
}

export function ParentChatListPage({ userId, basePath }: ParentChatListPageProps) {
  return (
    <ChatListPageWrapper
      userId={userId}
      userType="parent"
      basePath={basePath}
      CreateChatModal={ParentCreateChatModal}
    />
  );
}
