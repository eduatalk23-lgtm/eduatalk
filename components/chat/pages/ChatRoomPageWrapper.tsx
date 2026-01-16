"use client";

/**
 * ChatRoomPageWrapper - 공유 채팅방 페이지 래퍼 컴포넌트
 *
 * 학생과 관리자 채팅방 페이지에서 공통으로 사용됩니다.
 */

import { useRouter } from "next/navigation";
import { ChatRoom } from "@/components/chat";

interface ChatRoomPageWrapperProps {
  roomId: string;
  userId: string;
  basePath: string;
}

export function ChatRoomPageWrapper({
  roomId,
  userId,
  basePath,
}: ChatRoomPageWrapperProps) {
  const router = useRouter();

  return (
    <div className="h-full">
      <ChatRoom
        roomId={roomId}
        userId={userId}
        onBack={() => router.push(basePath)}
        basePath={basePath}
      />
    </div>
  );
}
