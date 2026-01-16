"use client";

/**
 * ChatRoomPage - 학생 채팅방 페이지 클라이언트 컴포넌트
 */

import { ChatRoomPageWrapper } from "@/components/chat/pages";

interface ChatRoomPageProps {
  roomId: string;
  userId: string;
  basePath: string;
}

export function ChatRoomPage({ roomId, userId, basePath }: ChatRoomPageProps) {
  return <ChatRoomPageWrapper roomId={roomId} userId={userId} basePath={basePath} />;
}
