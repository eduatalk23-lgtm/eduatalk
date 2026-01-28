"use client";

/**
 * ChatList - 채팅방 목록
 *
 * 사용자의 채팅방 목록을 표시합니다.
 */

import { memo, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";
import { ChatRoomCard } from "../molecules/ChatRoomCard";
import { MessageSquarePlus, Loader2, Search, X, SearchX } from "lucide-react";
import { cn } from "@/lib/cn";

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
}

function ChatListComponent({
  selectedRoomId,
  onRoomClick,
  onNewChat,
  basePath = "/chat",
  hideHeader = false,
}: ChatListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // 채팅방 목록 조회 (SSR 프리패칭과 동일한 쿼리 옵션 사용)
  const { data, isLoading, error } = useQuery(chatRoomsQueryOptions());

  const handleRoomClick = (roomId: string) => {
    if (onRoomClick) {
      onRoomClick(roomId);
    } else {
      router.push(`${basePath}/${roomId}`);
    }
  };

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
            {filteredRooms.map((room) => (
              <ChatRoomCard
                key={room.id}
                room={room}
                onClick={() => handleRoomClick(room.id)}
                isSelected={room.id === selectedRoomId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const ChatList = memo(ChatListComponent);
