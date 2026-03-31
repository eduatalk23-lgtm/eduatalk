"use client";

/**
 * ChatPanelApp - 사이드 패널 내 채팅 앱
 *
 * ChatPopover의 고정 위치/애니메이션 없이, ChatList + ChatRoom을
 * 사이드 패널(360px)에 맞게 렌더합니다.
 *
 * recordTopic이 전달되면 토픽별 필터링 + 배너를 표시합니다.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ChatList } from "@/components/chat/organisms/ChatList";
import { ChatRoom } from "@/components/chat/organisms/ChatRoom";
import { MemberList } from "@/components/chat/organisms/MemberList";
import { ChatSidebarTabs } from "@/components/chat/atoms/ChatSidebarTabs";
import type { ChatSidebarTab } from "@/components/chat/atoms/ChatSidebarTabs";
import { chatRoomDetailQueryOptions } from "@/lib/query-options/chatRoom";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";
import type { ChatUserType, ChatRoomListItem } from "@/lib/domains/chat/types";
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

interface ChatPanelAppProps {
  recordTopic?: string | null;
  /** true면 토픽 방 1개 시 자동 진입, 0개 시 1클릭 생성 UI */
  autoEnter?: boolean;
  /** autoEnter 모드에서 표시할 과목명 */
  subjectName?: string | null;
  /** 채팅방 진입 시 roomId를 외부에 알림 (가이드 추천 패널 연동용) */
  onRoomEnter?: (roomId: string) => void;
}

export function ChatPanelApp({ recordTopic, autoEnter = false, subjectName, onRoomEnter }: ChatPanelAppProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<PanelView>("list");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<ChatSidebarTab>("chat");
  const autoEnterDone = useRef(false);

  // autoEnter: 토픽 방 자동 감지 + 진입
  const { data: allRooms } = useQuery({
    ...chatRoomsQueryOptions(user?.userId),
    enabled: autoEnter && !!recordTopic && !!user?.userId,
  });

  useEffect(() => {
    if (!autoEnter || !recordTopic || !allRooms || autoEnterDone.current) return;
    const topicRooms = allRooms.filter((r: ChatRoomListItem) => r.topic === recordTopic);
    if (topicRooms.length === 1) {
      // 방 1개 → 바로 진입
      autoEnterDone.current = true;
      setSelectedRoomId(topicRooms[0].id);
      setView("room");
      onRoomEnter?.(topicRooms[0].id);
    }
    // 0개 또는 2개+는 기본 동작 (목록 또는 빈 상태)
  }, [autoEnter, recordTopic, allRooms]);

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
      onRoomEnter?.(roomId);
    },
    [queryClient, onRoomEnter]
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

  // autoEnter 모드: 토픽 방 0개일 때 빈 상태 감지
  const topicRoomCount = autoEnter && recordTopic && allRooms
    ? allRooms.filter((r: ChatRoomListItem) => r.topic === recordTopic).length
    : null;

  return (
    <div className="flex flex-col h-full">
      {view === "list" ? (
        <>
          {/* autoEnter + 토픽 방 0개: 1클릭 생성 UI */}
          {autoEnter && topicRoomCount === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30">
                <MessageSquarePlus className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {subjectName ? `"${subjectName}"` : "이 과목"}에 대한 논의가 없습니다
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  논의를 시작하면 다른 컨설턴트와 함께 방향을 정할 수 있습니다
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <MessageSquarePlus className="h-4 w-4" />
                논의 시작하기
              </button>
            </div>
          ) : (
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
                {subjectName ?? topicLabel(recordTopic)}
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
          )}
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
