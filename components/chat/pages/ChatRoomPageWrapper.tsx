"use client";

/**
 * ChatRoomPageWrapper - 공유 채팅방 페이지 래퍼 컴포넌트
 *
 * 학생과 관리자 채팅방 페이지에서 공통으로 사용됩니다.
 *
 * 높이 전략 (순수 CSS — JS 리렌더 0):
 * - 모바일: `100svh - TopBar - --keyboard-height` (CSS 변수)
 *   ChatRoom 내부의 ChatKeyboardManager가 document.documentElement에
 *   --keyboard-height CSS 변수를 설정하므로, 여기서는 CSS만으로 높이 계산.
 *   useVisualViewport를 제거하여 주소창 show/hide 시 불필요한 리렌더 방지.
 * - 데스크톱 split-pane: h-full — 부모 fixed 컨테이너가 높이를 제한
 * - PWA standalone: safe-area-inset 추가 반영
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChatRoom } from "@/components/chat";
import { useChatLayout } from "@/components/chat/layouts/ChatLayoutContext";

function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }, []);
  return isStandalone;
}

// 순수 CSS 높이 (JS 리렌더 없음)
// --keyboard-height: ChatKeyboardManager가 document.documentElement에 설정
const MOBILE_STYLE = {
  height: "calc(100svh - 4rem - var(--keyboard-height, 0px))",
} as const;

const MOBILE_STANDALONE_STYLE = {
  height: "calc(100svh - 4rem - var(--keyboard-height, 0px) - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
} as const;

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
  const isStandalone = useIsStandalone();

  // onBack을 useCallback으로 안정화 → 불필요한 ChatRoom 리렌더 방지
  const handleBack = useCallback(() => {
    router.push(basePath);
  }, [router, basePath]);

  const mobileStyle = isStandalone ? MOBILE_STANDALONE_STYLE : MOBILE_STYLE;

  return (
    <div
      className={isSplitPane ? "h-full overflow-hidden" : "overflow-hidden"}
      style={isSplitPane ? undefined : mobileStyle}
    >
      <ChatRoom
        roomId={roomId}
        userId={userId}
        onBack={handleBack}
        basePath={basePath}
      />
    </div>
  );
}
