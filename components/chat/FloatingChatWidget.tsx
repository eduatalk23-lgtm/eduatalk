"use client";

/**
 * FloatingChatWidget - 플로팅 채팅 위젯 (루트 오케스트레이터)
 *
 * 화면 우측 하단에 FAB를 표시하고, 클릭 시 채팅 패널을 토글합니다.
 * - 비인증/parent 역할 → 렌더링 안 함
 * - /chat, /admin/chat 페이지 → 렌더링 안 함
 * - 패널 닫힘 상태에서도 실시간 구독으로 배지 업데이트
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useChatRoomListRealtime } from "@/lib/realtime";
import { useTotalUnreadCount } from "@/lib/domains/chat/hooks/useTotalUnreadCount";
import { ChatFAB } from "./atoms/ChatFAB";
import { ChatPopover } from "./organisms/ChatPopover";
import type { ChatUserType } from "@/lib/domains/chat/types";

// 모달 컴포넌트는 패널이 열릴 때만 필요하므로 dynamic import
const CreateChatModal = dynamic(
  () =>
    import("@/app/(student)/chat/_components/CreateChatModal").then(
      (mod) => mod.CreateChatModal
    ),
  { ssr: false }
);

const AdminCreateChatModal = dynamic(
  () =>
    import("@/app/(admin)/admin/chat/_components/AdminCreateChatModal").then(
      (mod) => mod.AdminCreateChatModal
    ),
  { ssr: false }
);

/** 채팅 전용 페이지 경로 (위젯 숨김) */
function isChatPage(pathname: string): boolean {
  return (
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    pathname === "/admin/chat" ||
    pathname.startsWith("/admin/chat/")
  );
}

/** 사용자 역할 → ChatUserType 매핑 */
function toChatUserType(role: string): ChatUserType | null {
  if (role === "student") return "student";
  if (role === "admin" || role === "consultant" || role === "superadmin")
    return "admin";
  return null;
}

export function FloatingChatWidget() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // 역할 기반 설정
  const chatUserType = user?.role ? toChatUserType(user.role) : null;
  const isAuthenticated = !!user && !!chatUserType;

  const basePath = chatUserType === "admin" ? "/admin/chat" : "/chat";

  // 실시간 구독 (패널 닫혀 있어도 배지 업데이트 필요)
  useChatRoomListRealtime({
    userId: user?.userId ?? "",
    userType: chatUserType ?? "student",
    enabled: isAuthenticated,
  });

  // 전체 unread count (인증된 상태에서만 쿼리 실행)
  const unreadCount = useTotalUnreadCount({ enabled: isAuthenticated });

  // 렌더링 조건 체크
  if (isLoading) return null;
  if (!user || !chatUserType) return null;
  if (isChatPage(pathname)) return null;

  const ModalComponent =
    chatUserType === "admin" ? AdminCreateChatModal : CreateChatModal;

  return (
    <>
      <ChatFAB
        isOpen={isOpen}
        unreadCount={unreadCount}
        onClick={() => setIsOpen((prev) => !prev)}
      />

      <AnimatePresence>
        {isOpen && (
          <ChatPopover
            userId={user.userId}
            basePath={basePath}
            onClose={() => setIsOpen(false)}
            CreateChatModal={ModalComponent}
          />
        )}
      </AnimatePresence>
    </>
  );
}
