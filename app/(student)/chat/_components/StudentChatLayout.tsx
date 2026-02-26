"use client";

/**
 * StudentChatLayout - 학생 채팅 split-pane 레이아웃 클라이언트 래퍼
 */

import { ChatSplitLayout } from "@/components/chat/layouts";
import { CreateChatModal } from "./CreateChatModal";

interface StudentChatLayoutProps {
  userId: string;
  basePath: string;
  children: React.ReactNode;
}

export function StudentChatLayout({
  userId,
  basePath,
  children,
}: StudentChatLayoutProps) {
  return (
    <ChatSplitLayout
      userId={userId}
      userType="student"
      basePath={basePath}
      CreateChatModal={CreateChatModal}
    >
      {children}
    </ChatSplitLayout>
  );
}
