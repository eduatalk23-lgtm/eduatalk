"use client";

/**
 * ParentChatRoomPage - 학부모 채팅방 페이지 클라이언트 컴포넌트
 */

import { ChatRoomPageWrapper } from "@/components/chat/pages";

interface ParentChatRoomPageProps {
  roomId: string;
  userId: string;
  basePath: string;
}

export function ParentChatRoomPage({ roomId, userId, basePath }: ParentChatRoomPageProps) {
  return <ChatRoomPageWrapper roomId={roomId} userId={userId} basePath={basePath} />;
}
