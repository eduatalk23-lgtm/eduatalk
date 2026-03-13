"use client";

/**
 * ChatRoomPageWrapper - 공유 채팅방 페이지 래퍼 컴포넌트
 *
 * 학생과 관리자 채팅방 페이지에서 공통으로 사용됩니다.
 *
 * 높이 전략:
 * - 모바일: VisualViewport API 기반 높이 - TopBar(64px)
 *   iOS PWA standalone에서 dvh가 키보드를 반영하지 않는 문제 해결
 * - 데스크톱 split-pane: h-full — 부모 fixed 컨테이너가 높이를 제한
 */

import { useRouter } from "next/navigation";
import { ChatRoom } from "@/components/chat";
import { useChatLayout } from "@/components/chat/layouts/ChatLayoutContext";
import { useVisualViewport } from "@/lib/hooks/useVisualViewport";

const TOP_BAR_HEIGHT = 64; // 4rem
const DEFAULT_MOBILE_STYLE = { height: "calc(100dvh - 4rem)" } as const;

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
  const { isSplitPane } = useChatLayout();
  const { height: viewportHeight, isKeyboardOpen } = useVisualViewport();

  // 키보드가 열렸을 때만 VisualViewport 높이 사용, 아니면 dvh 기반
  const mobileStyle = isKeyboardOpen && viewportHeight > 0
    ? { height: `${viewportHeight - TOP_BAR_HEIGHT}px` }
    : undefined;

  return (
    <div
      className={isSplitPane ? "h-full overflow-hidden" : "overflow-hidden"}
      style={isSplitPane ? undefined : (mobileStyle ?? DEFAULT_MOBILE_STYLE)}
    >
      <ChatRoom
        roomId={roomId}
        userId={userId}
        onBack={() => router.push(basePath)}
        basePath={basePath}
      />
    </div>
  );
}
