"use client";

/**
 * ChatSplitLayout - 데스크톱 split-pane 채팅 레이아웃
 *
 * - Desktop (md+): 좌측 채팅 목록 사이드바 + 우측 채팅방
 * - Mobile (<md): children만 렌더 (기존 단일 컬럼 유지)
 *
 * 부모 구조 (RoleBasedLayout):
 *   div.flex.flex-col.min-h-screen
 *     TopBar (fixed h-16)
 *     div.flex.flex-1.pt-16
 *       main.flex-1.flex.flex-col
 *         div.flex-1 ← children (이 컴포넌트)
 *
 * 높이: 부모 체인이 flex-1로 연결되지만 명시적 height가 없으므로
 *       calc(100dvh - 4rem)으로 TopBar 제외한 전체 영역 확보
 */

import { useState, useCallback, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChatList } from "@/components/chat/organisms/ChatList";
import { MemberList } from "@/components/chat/organisms/MemberList";
import { ChatLayoutProvider } from "./ChatLayoutContext";
import { ChatSidebarTabs } from "../atoms/ChatSidebarTabs";
import type { ChatSidebarTab } from "../atoms/ChatSidebarTabs";
import { MessageSquare } from "lucide-react";
import type { ChatUserType } from "@/lib/domains/chat/types";

// ============================================
// 데스크톱 감지 (md breakpoint = 768px)
// ============================================

const MD_QUERY = "(min-width: 768px)";

function subscribeMediaQuery(callback: () => void) {
  const mql = window.matchMedia(MD_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getIsDesktop() {
  return window.matchMedia(MD_QUERY).matches;
}

/** SSR에서는 false (모바일 우선), hydration 후 실제 값 반영 */
function useIsDesktop() {
  return useSyncExternalStore(subscribeMediaQuery, getIsDesktop, () => false);
}

// ============================================
// ChatSplitLayout
// ============================================

interface ChatSplitLayoutProps {
  userId: string;
  userType: ChatUserType;
  basePath: string;
  children: React.ReactNode;
  CreateChatModal: React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
    basePath: string;
  }>;
}

export function ChatSplitLayout({
  userId,
  userType,
  basePath,
  children,
  CreateChatModal,
}: ChatSplitLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<ChatSidebarTab>("chat");

  // Realtime 구독은 FloatingChatWidget에서 전역으로 처리 (중복 채널 방지)

  // 채팅방 페이지인지 판별
  const isRoomPage =
    pathname !== basePath && pathname.startsWith(basePath + "/");

  // URL에서 현재 선택된 roomId 추출
  const selectedRoomId = useMemo(() => {
    if (!isRoomPage) return undefined;
    const segments = pathname.split("/");
    return segments[segments.length - 1];
  }, [pathname, isRoomPage]);

  const handleRoomClick = useCallback(
    (roomId: string) => {
      router.push(`${basePath}/${roomId}`);
    },
    [router, basePath]
  );

  const handleNewChat = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  // 모바일: children만 렌더 (기존 동작 유지)
  if (!isDesktop) {
    return (
      <ChatLayoutProvider isSplitPane={false}>
        {children}
      </ChatLayoutProvider>
    );
  }

  // 데스크톱: split-pane
  return (
    <ChatLayoutProvider isSplitPane={true}>
      {/*
        absolute + inset-0: 부모 flex-1 영역을 기준으로 전체를 차지
        부모 div.flex-1 에 relative를 추가해야 하지만,
        RoleBasedLayout을 수정하지 않기 위해 fixed + top offset 사용
      */}
      <div
        className="fixed inset-0 top-16 flex"
        style={{ zIndex: 1 }}
      >
        {/* 좌측 사이드바 - 채팅/멤버 탭 */}
        <aside className="w-72 lg:w-80 xl:w-[360px] flex-shrink-0 border-r border-border overflow-hidden flex flex-col bg-bg-primary shadow-[2px_0_8px_rgba(0,0,0,0.06)] z-10">
          {/* 사이드바 탭 */}
          <ChatSidebarTabs activeTab={sidebarTab} onChange={setSidebarTab} onNewChat={handleNewChat} />

          {/* 탭 콘텐츠 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {sidebarTab === "chat" ? (
              <ChatList
                basePath={basePath}
                selectedRoomId={selectedRoomId}
                onRoomClick={handleRoomClick}
                onNewChat={handleNewChat}
                hideHeader
                currentUserId={userId}
                viewerType={userType}
              />
            ) : (
              <MemberList
                currentUserId={userId}
                userType={userType}
                basePath={basePath}
                hideHeader
              />
            )}
          </div>
        </aside>

        {/* 우측 - 채팅방 또는 빈 상태 */}
        <div className="flex-1 overflow-hidden bg-bg-tertiary">
          {isRoomPage ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-text-tertiary" />
              </div>
              <div>
                <p className="text-text-secondary text-sm font-medium">
                  채팅방을 선택하세요
                </p>
                <p className="text-text-tertiary text-xs mt-1">
                  좌측 목록에서 채팅방을 선택하거나 새 채팅을 시작하세요
                </p>
              </div>
            </div>
          )}
        </div>

        <CreateChatModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          basePath={basePath}
        />
      </div>
    </ChatLayoutProvider>
  );
}
