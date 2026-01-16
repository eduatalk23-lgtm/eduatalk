"use client";

/**
 * AdminChatRoomPage - 관리자 채팅방 페이지
 */

import { useRouter } from "next/navigation";
import { ChatRoom } from "@/components/chat";

interface AdminChatRoomPageProps {
  roomId: string;
  userId: string;
  basePath: string;
}

export function AdminChatRoomPage({ roomId, userId, basePath }: AdminChatRoomPageProps) {
  const router = useRouter();

  const handleBack = () => {
    router.push(basePath);
  };

  return (
    <div className="h-full">
      <ChatRoom
        roomId={roomId}
        userId={userId}
        onBack={handleBack}
        basePath={basePath}
      />
    </div>
  );
}
