"use client";

/**
 * SwipeableChatRoomCard - 스와이프 액션이 있는 채팅방 카드
 *
 * 모바일에서 좌측 스와이프 시 나가기/알림끄기 버튼을 노출합니다.
 * 데스크톱에서는 일반 ChatRoomCard로 동작합니다.
 */

import { memo, useCallback, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { LogOut, BellOff, Bell } from "lucide-react";
import { useSwipeAction } from "@/lib/hooks/useSwipeAction";
import { ChatRoomCard } from "./ChatRoomCard";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { ChatRoomListItem } from "@/lib/domains/chat/types";

interface SwipeableChatRoomCardProps {
  room: ChatRoomListItem;
  onClick: () => void;
  isSelected?: boolean;
  isMuted?: boolean;
  onLeave: (roomId: string) => void;
  onToggleMute: (roomId: string, muted: boolean) => void;
}

function SwipeableChatRoomCardComponent({
  room,
  onClick,
  isSelected = false,
  isMuted = false,
  onLeave,
  onToggleMute,
}: SwipeableChatRoomCardProps) {
  const { handlers, offsetX, isOpen, close } = useSwipeAction();
  const [isPending, startTransition] = useTransition();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const handleLeaveClick = useCallback(() => {
    close();
    setShowLeaveConfirm(true);
  }, [close]);

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveConfirm(false);
    startTransition(() => {
      onLeave(room.id);
    });
  }, [onLeave, room.id]);

  const handleToggleMute = useCallback(() => {
    close();
    startTransition(() => {
      onToggleMute(room.id, !isMuted);
    });
  }, [close, onToggleMute, room.id, isMuted]);

  const handleClick = useCallback(() => {
    if (isOpen) {
      close();
      return;
    }
    onClick();
  }, [isOpen, close, onClick]);

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        {/* 액션 버튼 (배경 레이어) */}
        <div className="absolute inset-y-0 right-0 flex items-stretch">
          <button
            type="button"
            onClick={handleToggleMute}
            disabled={isPending}
            className={cn(
              "w-20 flex flex-col items-center justify-center gap-1 text-white text-xs font-medium transition-colors",
              isMuted
                ? "bg-primary-500 hover:bg-primary-500/90"
                : "bg-amber-500 hover:bg-amber-600",
              isPending && "opacity-50 cursor-not-allowed"
            )}
            aria-label={isMuted ? "알림 켜기" : "알림 끄기"}
          >
            {isMuted ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            {isMuted ? "알림 켜기" : "알림 끄기"}
          </button>
          <button
            type="button"
            onClick={handleLeaveClick}
            disabled={isPending}
            className={cn(
              "w-20 flex flex-col items-center justify-center gap-1 bg-error hover:bg-error/90 text-white text-xs font-medium transition-colors",
              isPending && "opacity-50 cursor-not-allowed"
            )}
            aria-label="나가기"
          >
            <LogOut className="w-5 h-5" />
            나가기
          </button>
        </div>

        {/* 카드 (전경 레이어, 스와이프 이동) */}
        <div
          {...handlers}
          className="relative bg-bg-primary transition-transform duration-200 ease-out touch-pan-y"
          style={{
            transform: `translateX(${offsetX}px)`,
            transitionDuration: offsetX === 0 || Math.abs(offsetX) === 160 ? "200ms" : "0ms",
          }}
        >
          <ChatRoomCard
            room={room}
            onClick={handleClick}
            isSelected={isSelected}
          />
        </div>
      </div>

      <ConfirmDialog
        open={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        onConfirm={handleLeaveConfirm}
        title="채팅방 나가기"
        description="채팅방을 나가면 대화 내용을 더 이상 볼 수 없습니다. 나가시겠습니까?"
        confirmLabel="나가기"
        variant="destructive"
      />
    </>
  );
}

export const SwipeableChatRoomCard = memo(SwipeableChatRoomCardComponent);
