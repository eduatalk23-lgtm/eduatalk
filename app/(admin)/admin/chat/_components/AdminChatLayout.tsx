"use client";

/**
 * AdminChatLayout - 관리자 채팅 split-pane 레이아웃 클라이언트 래퍼
 */

import { ChatSplitLayout } from "@/components/chat/layouts";
import { AdminCreateChatModal } from "./AdminCreateChatModal";

interface AdminChatLayoutProps {
  userId: string;
  basePath: string;
  children: React.ReactNode;
}

export function AdminChatLayout({
  userId,
  basePath,
  children,
}: AdminChatLayoutProps) {
  return (
    <ChatSplitLayout
      userId={userId}
      userType="admin"
      basePath={basePath}
      CreateChatModal={AdminCreateChatModal}
    >
      {children}
    </ChatSplitLayout>
  );
}
