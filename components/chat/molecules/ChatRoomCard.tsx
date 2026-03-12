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
import { Users, Image, Paperclip, BellOff } from "lucide-react";
import { chatMessagesQueryOptions } from "@/lib/query-options/chatMessages";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
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
    const existingData = queryClient.getQueryData(chatKeys.messages(room.id));

    // 이미 캐시에 데이터가 있으면 스킵
    if (existingData) return;

    // 백그라운드에서 프리패칭 (에러 무시)
    void queryClient.prefetchInfiniteQuery(chatMessagesQueryOptions(room.id));
  }, [queryClient, room.id]);

  // 클릭 시 stale 캐시 무효화 후 방 진입
  const handleClick = useCallback(() => {
    // hover prefetch로 생긴 캐시가 stale일 수 있으므로 무효화
    // (useChatRealtime의 syncMessagesSince가 최신 메시지를 가져오도록)
    void queryClient.invalidateQueries({
      queryKey: chatKeys.messages(room.id),
      refetchType: "none", // 즉시 refetch하지 않음 (채팅방 진입 후 realtime이 처리)
    });
    onClick();
  }, [queryClient, room.id, onClick]);

  // 표시할 이름 결정
  const displayName =
    room.type === "direct"
      ? room.otherUser?.name ?? "알 수 없음"
      : room.name ?? `그룹 (${room.memberCount}명)`;

  // 주제 표시 (topic이 있을 경우)
  const topicDisplay = room.topic ?? null;

  // 학생 정보 (1:1 채팅에서 상대방이 학생인 경우)
  const studentInfo =
    room.type === "direct" && room.otherUser?.type === "student"
      ? [room.otherUser.schoolName, room.otherUser.gradeDisplay]
          .filter(Boolean)
          .join(" · ")
      : null;

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
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl",
        "transition-colors text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/30 border-l-2 border-primary"
          : "hover:bg-secondary-100 active:bg-secondary-200"
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-text-primary truncate">
              {displayName}
            </span>
            {room.category === "consulting" && topicDisplay && (
              <span className="text-xs text-primary/80 truncate max-w-[80px] sm:max-w-[120px] hidden sm:inline">
                {topicDisplay}
              </span>
            )}
            {studentInfo && (
              <span className="text-xs text-text-tertiary truncate hidden sm:inline">
                {studentInfo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {room.isMuted && (
              <BellOff className="w-3.5 h-3.5 text-text-tertiary" aria-label="알림 꺼짐" />
            )}
            {timeDisplay && (
              <span className="text-xs text-text-tertiary">
                {timeDisplay}
              </span>
            )}
          </div>
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
                {(room.lastMessage.messageType === "image" || room.lastMessage.messageType === "file") && (
                  <span className="inline-flex items-center gap-0.5 align-middle">
                    {room.lastMessage.messageType === "image" ? (
                      <Image className="w-3.5 h-3.5 text-text-tertiary inline" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5 text-text-tertiary inline" />
                    )}{" "}
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
