"use client";

/**
 * ParentChatLayout - 학부모 채팅 split-pane 레이아웃 클라이언트 래퍼
 */

import { ChatSplitLayout } from "@/components/chat/layouts";
import { ParentCreateChatModal } from "./ParentCreateChatModal";

interface ParentChatLayoutProps {
  userId: string;
  basePath: string;
  children: React.ReactNode;
}

export function ParentChatLayout({
  userId,
  basePath,
  children,
}: ParentChatLayoutProps) {
  return (
    <ChatSplitLayout
      userId={userId}
      userType="parent"
      basePath={basePath}
      CreateChatModal={ParentCreateChatModal}
    >
      {children}
    </ChatSplitLayout>
  );
}
