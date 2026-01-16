"use client";

/**
 * ChatRoomCard - 채팅방 목록 카드
 *
 * 채팅방 목록에서 각 방을 표시합니다.
 * hover 시 메시지 프리패칭으로 진입 속도 향상
 */

import { memo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Avatar } from "@/components/atoms/Avatar";
import { UnreadBadge } from "../atoms/UnreadBadge";
import { Users } from "lucide-react";
import { chatMessagesQueryOptions } from "@/lib/query-options/chatMessages";
import type { ChatRoomListItem } from "@/lib/domains/chat/types";

interface ChatRoomCardProps {
  /** 채팅방 정보 */
  room: ChatRoomListItem;
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 선택 상태 */
  isSelected?: boolean;
}

function ChatRoomCardComponent({
  room,
  onClick,
  isSelected = false,
}: ChatRoomCardProps) {
  const queryClient = useQueryClient();

  // Hover 시 메시지 프리패칭 (캐시에 없을 때만)
  const handleMouseEnter = useCallback(() => {
    const queryKey = ["chat-messages", room.id];
    const existingData = queryClient.getQueryData(queryKey);

    // 이미 캐시에 데이터가 있으면 스킵
    if (existingData) return;

    // 백그라운드에서 프리패칭 (에러 무시)
    void queryClient.prefetchInfiniteQuery(chatMessagesQueryOptions(room.id));
  }, [queryClient, room.id]);

  // 표시할 이름 결정
  const displayName =
    room.type === "direct"
      ? room.otherUser?.name ?? "알 수 없음"
      : room.name ?? `그룹 (${room.memberCount}명)`;

  // 시간 포맷
  const timeDisplay = room.lastMessage
    ? formatDistanceToNow(new Date(room.lastMessage.createdAt), {
        addSuffix: true,
        locale: ko,
      })
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl",
        "transition-colors text-left",
        isSelected ? "bg-primary/10" : "hover:bg-bg-secondary"
      )}
    >
      {/* 아바타 */}
      <div className="relative flex-shrink-0">
        {room.type === "direct" && room.otherUser ? (
          <Avatar
            name={room.otherUser.name}
            src={room.otherUser.profileImageUrl}
            size="md"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-bg-tertiary flex items-center justify-center">
            <Users className="w-5 h-5 text-text-secondary" />
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-text-primary truncate">
            {displayName}
          </span>
          {timeDisplay && (
            <span className="text-xs text-text-tertiary flex-shrink-0">
              {timeDisplay}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-text-secondary truncate">
            {room.lastMessage ? (
              <>
                {room.type === "group" && (
                  <span className="text-text-tertiary">
                    {room.lastMessage.senderName}:{" "}
                  </span>
                )}
                {room.lastMessage.content}
              </>
            ) : (
              <span className="text-text-tertiary">메시지가 없습니다</span>
            )}
          </span>

          {room.unreadCount > 0 && (
            <UnreadBadge count={room.unreadCount} size="sm" />
          )}
        </div>
      </div>
    </button>
  );
}

export const ChatRoomCard = memo(ChatRoomCardComponent);
