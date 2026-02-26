"use client";

/**
 * ChatLayoutContext - 채팅 레이아웃 상태 공유
 *
 * 데스크톱 split-pane 레이아웃에서 ChatRoom 등 하위 컴포넌트가
 * 레이아웃 모드를 인식할 수 있도록 합니다.
 */

import { createContext, useContext } from "react";

interface ChatLayoutContextValue {
  /** 데스크톱 split-pane 모드 여부 */
  isSplitPane: boolean;
}

const ChatLayoutContext = createContext<ChatLayoutContextValue>({
  isSplitPane: false,
});

export function ChatLayoutProvider({
  isSplitPane,
  children,
}: {
  isSplitPane: boolean;
  children: React.ReactNode;
}) {
  return (
    <ChatLayoutContext.Provider value={{ isSplitPane }}>
      {children}
    </ChatLayoutContext.Provider>
  );
}

export function useChatLayout() {
  return useContext(ChatLayoutContext);
}
