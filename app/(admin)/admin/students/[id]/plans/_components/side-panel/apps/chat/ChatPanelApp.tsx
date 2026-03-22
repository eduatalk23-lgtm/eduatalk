"use client";

/**
 * ChatPanelApp - 사이드 패널 내 채팅 앱
 *
 * ChatPopover의 고정 위치/애니메이션 없이, ChatList + ChatRoom을
 * 사이드 패널(360px)에 맞게 렌더합니다.
 *
 * recordTopic이 전달되면 토픽별 필터링 + 배너를 표시합니다.
 */

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ChatList } from "@/components/chat/organisms/ChatList";
import { ChatRoom } from "@/components/chat/organisms/ChatRoom";
import { MemberList } from "@/components/chat/organisms/MemberList";
import { ChatSidebarTabs } from "@/components/chat/atoms/ChatSidebarTabs";
import type { ChatSidebarTab } from "@/components/chat/atoms/ChatSidebarTabs";
import { chatRoomDetailQueryOptions } from "@/lib/query-options/chatRoom";
import type { ChatUserType } from "@/lib/domains/chat/types";
import { CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";

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

const ParentCreateChatModal = dynamic(
  () =>
    import("@/app/(parent)/parent/chat/_components/ParentCreateChatModal").then(
      (mod) => mod.ParentCreateChatModal
    ),
  { ssr: false }
);

function toChatUserType(role: string): ChatUserType | null {
  if (role === "student") return "student";
  if (role === "admin" || role === "consultant" || role === "superadmin")
    return "admin";
  if (role === "parent") return "parent";
  return null;
}

/** recordTopic → 사람이 읽을 수 있는 라벨 변환 */
function topicLabel(topic: string): string {
  // "changche:autonomy" → "자율·자치활동"
  if (topic.startsWith("changche:")) {
    const type = topic.slice("changche:".length);
    return CHANGCHE_TYPE_LABELS[type] ?? type;
  }
  if (topic === "haengteuk") return "행동특성 및 종합의견";
  if (topic === "reading") return "독서활동";
  // UUID (세특 과목) → 일반 라벨
  return "세특 과목";
}

type PanelView = "list" | "room";

export function ChatPanelApp({ recordTopic }: { recordTopic?: string | null }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<PanelView>("list");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<ChatSidebarTab>("chat");

  const userId = user?.userId ?? "";
  const chatUserType = user?.role ? toChatUserType(user.role) : null;
  const basePath =
    chatUserType === "admin"
      ? "/admin/chat"
      : chatUserType === "parent"
        ? "/parent/chat"
        : "/chat";

  const handleRoomClick = useCallback(
    (roomId: string) => {
      void queryClient.prefetchQuery(chatRoomDetailQueryOptions(roomId));
      setSelectedRoomId(roomId);
      setView("room");
    },
    [queryClient]
  );

  const handleBack = useCallback(() => {
    setView("list");
    setSelectedRoomId(null);
  }, []);

  const handleRoomCreated = useCallback((roomId: string) => {
    setIsCreateModalOpen(false);
    setSelectedRoomId(roomId);
    setView("room");
  }, []);

  if (!user || !chatUserType) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-[var(--color-text-tertiary)]">
        로그인이 필요합니다
      </div>
    );
  }

  const ModalComponent =
    chatUserType === "admin"
      ? AdminCreateChatModal
      : chatUserType === "parent"
        ? ParentCreateChatModal
        : CreateChatModal;

  return (
    <div className="flex flex-col h-full">
      {view === "list" ? (
        <>
          {/* 탭 (채팅 / 멤버) */}
          <ChatSidebarTabs
            activeTab={sidebarTab}
            onChange={setSidebarTab}
            onNewChat={() => setIsCreateModalOpen(true)}
          />

          {/* 토픽 배너 */}
          {recordTopic && (
            <div className="border-b border-[var(--border-secondary)] px-3 py-2 bg-indigo-50 dark:bg-indigo-950/20">
              <span className="text-xs text-indigo-600 dark:text-indigo-400">
                {topicLabel(recordTopic)}
              </span>
            </div>
          )}

          {/* 목록 */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === "chat" ? (
              <ChatList
                onRoomClick={handleRoomClick}
                onNewChat={() => setIsCreateModalOpen(true)}
                hideHeader
                currentUserId={userId}
                viewerType={chatUserType}
                filterTopic={recordTopic}
              />
            ) : (
              <MemberList
                currentUserId={userId}
                userType={chatUserType}
                basePath={basePath}
                hideHeader
                onNavigateToRoom={handleRoomClick}
              />
            )}
          </div>
        </>
      ) : selectedRoomId ? (
        <ChatRoom
          roomId={selectedRoomId}
          userId={userId}
          onBack={handleBack}
          basePath={basePath}
          onLeaveRoom={handleBack}
        />
      ) : null}

      {/* 새 채팅 모달 */}
      <ModalComponent
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        basePath={basePath}
        onRoomCreated={handleRoomCreated}
        defaultTopic={recordTopic}
      />
    </div>
  );
}
