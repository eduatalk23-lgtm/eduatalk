"use client";

/**
 * ChatList - 채팅방 목록
 *
 * 사용자의 채팅방 목록을 표시합니다.
 * 아바타 클릭 시 프로필 팝업 (1:1) / 멤버 프리뷰 팝업 (그룹)을 표시합니다.
 */

import { memo, useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";
import { ChatRoomCard } from "../molecules/ChatRoomCard";
import { SwipeableChatRoomCard } from "../molecules/SwipeableChatRoomCard";
import { ProfileCardPopup } from "../molecules/ProfileCardPopup";
import type { ProfileCardData } from "../molecules/ProfileCardPopup";
import { GroupMemberPopup } from "../molecules/GroupMemberPopup";
import { MessageSquarePlus, Loader2, Search, X, SearchX, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { addNetworkStatusListener, isOnline } from "@/lib/offline/networkStatus";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import type { ChatRoomListItem, ChatUserType } from "@/lib/domains/chat/types";

interface ChatListProps {
  /** 현재 선택된 채팅방 ID */
  selectedRoomId?: string;
  /** 채팅방 클릭 핸들러 */
  onRoomClick?: (roomId: string) => void;
  /** 새 채팅 버튼 클릭 핸들러 */
  onNewChat?: () => void;
  /** 라우트 기본 경로 (예: /chat 또는 /admin/chat) */
  basePath?: string;
  /** 헤더 숨기기 (Popover 등 외부에서 자체 헤더를 제공할 때) */
  hideHeader?: boolean;
  /** 현재 사용자 ID (프로필 팝업용) */
  currentUserId?: string;
  /** 현재 사용자 유형 (프로필 팝업 액션 버튼 결정용) */
  viewerType?: ChatUserType;
}

function ChatListComponent({
  selectedRoomId,
  onRoomClick,
  onNewChat,
  basePath = "/chat",
  hideHeader = false,
  currentUserId,
  viewerType,
}: ChatListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useMediaQuery("(max-width: 768px)");

  // 프로필 팝업 상태 (1:1)
  const [profilePopup, setProfilePopup] = useState<{
    data: ProfileCardData;
    position: { x: number; y: number } | null;
  } | null>(null);

  // 그룹 멤버 팝업 상태
  const [groupPopup, setGroupPopup] = useState<{
    room: ChatRoomListItem;
    position: { x: number; y: number } | null;
  } | null>(null);

  // 네트워크 상태 감지 (오프라인 배너용)
  const networkSubscribe = useCallback((cb: () => void) => addNetworkStatusListener(() => cb()), []);
  const online = useSyncExternalStore(networkSubscribe, isOnline, () => true);

  // 채팅방 목록 조회 (SSR 프리패칭과 동일한 쿼리 옵션 사용)
  const { data, isLoading, error } = useQuery(chatRoomsQueryOptions());

  const handleRoomClick = (roomId: string) => {
    if (onRoomClick) {
      onRoomClick(roomId);
    } else {
      router.push(`${basePath}/${roomId}`);
    }
  };

  const handleLeave = useCallback(
    async (roomId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("leave_chat_room", { p_room_id: roomId });
      if (!error) {
        queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      }
    },
    [queryClient]
  );

  const handleToggleMute = useCallback(
    async (roomId: string, muted: boolean) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("toggle_mute_chat_room", { p_room_id: roomId, p_muted: muted });
      if (!error) {
        queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      }
    },
    [queryClient]
  );

  // 아바타 클릭 핸들러
  const handleAvatarClick = useCallback(
    (room: ChatRoomListItem, position: { x: number; y: number }) => {
      if (room.type === "direct" && room.otherUser) {
        setProfilePopup({
          data: {
            userId: room.otherUser.id,
            userType: room.otherUser.type,
            name: room.otherUser.name,
            profileImageUrl: room.otherUser.profileImageUrl,
            schoolName: room.otherUser.schoolName,
            gradeDisplay: room.otherUser.gradeDisplay,
          },
          position: isMobile ? null : position,
        });
      } else if (room.type === "group") {
        setGroupPopup({
          room,
          position: isMobile ? null : position,
        });
      }
    },
    [isMobile]
  );

  // 검색 필터링 (Hook은 조건부 반환 전에 호출)
  const filteredRooms = useMemo(() => {
    const rooms = data ?? [];
    if (!searchQuery.trim()) return rooms;
    const query = searchQuery.toLowerCase();

    return rooms.filter((room) => {
      const nameToCheck =
        room.type === "direct" ? room.otherUser?.name : room.name;
      return nameToCheck?.toLowerCase().includes(query);
    });
  }, [data, searchQuery]);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center px-4 gap-1">
        <p className="text-text-secondary text-sm">
          채팅 목록을 불러오지 못했습니다
        </p>
        <p className="text-text-tertiary text-xs">
          {error instanceof Error ? error.message : "알 수 없는 오류"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-lg text-text-primary">채팅</h2>
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
              title="새 채팅"
            >
              <MessageSquarePlus className="w-5 h-5 text-text-secondary" />
            </button>
          )}
        </div>
      )}

      {/* 오프라인 배너 */}
      {!online && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warning/20 text-warning text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>네트워크에 연결할 수 없습니다</span>
        </div>
      )}

      {/* 검색창 */}
      <div className="px-4 py-2">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            "bg-bg-secondary rounded-xl"
          )}
        >
          <Search className="w-5 h-5 text-text-tertiary flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="채팅방 검색..."
            className={cn(
              "flex-1 bg-transparent text-sm text-text-primary",
              "placeholder:text-text-tertiary",
              "focus:outline-none"
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="p-1 text-text-tertiary hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 채팅방 목록 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filteredRooms.length === 0 && searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-2">
            <SearchX className="w-8 h-8 text-text-tertiary" />
            <p className="text-text-secondary text-sm">검색 결과가 없습니다</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
            <p className="text-text-secondary text-sm">아직 채팅이 없습니다</p>
            {onNewChat && (
              <button
                type="button"
                onClick={onNewChat}
                className="text-primary text-sm font-medium hover:underline"
              >
                새 채팅 시작하기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredRooms.map((room) =>
              isMobile ? (
                <SwipeableChatRoomCard
                  key={room.id}
                  room={room}
                  onClick={() => handleRoomClick(room.id)}
                  isSelected={room.id === selectedRoomId}
                  isMuted={room.isMuted}
                  onLeave={handleLeave}
                  onToggleMute={handleToggleMute}
                  onAvatarClick={handleAvatarClick}
                />
              ) : (
                <ChatRoomCard
                  key={room.id}
                  room={room}
                  onClick={() => handleRoomClick(room.id)}
                  isSelected={room.id === selectedRoomId}
                  onAvatarClick={handleAvatarClick}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* 1:1 프로필 팝업 */}
      <ProfileCardPopup
        isOpen={!!profilePopup}
        onClose={() => setProfilePopup(null)}
        profile={profilePopup?.data ?? null}
        position={profilePopup?.position}
        currentUserId={currentUserId}
        viewerType={viewerType}
        basePath={basePath}
      />

      {/* 그룹 멤버 프리뷰 팝업 */}
      <GroupMemberPopup
        isOpen={!!groupPopup}
        onClose={() => setGroupPopup(null)}
        room={groupPopup?.room ?? null}
        position={groupPopup?.position}
        onEnterRoom={handleRoomClick}
      />
    </div>
  );
}

export const ChatList = memo(ChatListComponent);
