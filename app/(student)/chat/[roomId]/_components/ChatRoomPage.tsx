"use client";

/**
 * ChatRoomPage - 채팅방 페이지 클라이언트 컴포넌트
 */

import { useRouter } from "next/navigation";
import { ChatRoom } from "@/components/chat";

interface ChatRoomPageProps {
  roomId: string;
  userId: string;
  basePath: string;
}

export function ChatRoomPage({ roomId, userId, basePath }: ChatRoomPageProps) {
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
