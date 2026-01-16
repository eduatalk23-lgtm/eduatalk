"use client";

/**
 * AdminChatRoomPage - 관리자 채팅방 페이지
 */

import { ChatRoomPageWrapper } from "@/components/chat/pages";

interface AdminChatRoomPageProps {
  roomId: string;
  userId: string;
  basePath: string;
}

export function AdminChatRoomPage({ roomId, userId, basePath }: AdminChatRoomPageProps) {
  return <ChatRoomPageWrapper roomId={roomId} userId={userId} basePath={basePath} />;
}
