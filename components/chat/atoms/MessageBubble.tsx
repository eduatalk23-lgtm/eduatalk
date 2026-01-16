"use client";

/**
 * MessageBubble - 채팅 메시지 버블
 *
 * 단일 채팅 메시지를 표시합니다.
 * 본인/타인 메시지에 따라 스타일이 달라집니다.
 */

import { memo, useState } from "react";
import { cn } from "@/lib/cn";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactionSummary, ReactionEmoji, ReplyTargetInfo } from "@/lib/domains/chat/types";
import { ReactionPills } from "./ReactionPills";
import { ReactionPicker } from "./ReactionPicker";
import { useLongPress } from "@/lib/hooks/useLongPress";

interface MessageBubbleProps {
  /** 메시지 내용 */
  content: string;
  /** 본인 메시지 여부 */
  isOwn: boolean;
  /** 발신자 이름 (타인 메시지일 때 표시) */
  senderName?: string;
  /** 메시지 생성 시간 */
  createdAt: string;
  /** 시스템 메시지 여부 */
  isSystem?: boolean;
  /** 수정된 메시지 여부 */
  isEdited?: boolean;
  /** 읽지 않은 사람 수 (본인 메시지에만 표시) */
  unreadCount?: number;
  /** 편집 가능 여부 (5분 이내 본인 메시지) */
  canEdit?: boolean;
  /** 리액션 요약 목록 */
  reactions?: ReactionSummary[];
  /** 답장 원본 메시지 정보 */
  replyTarget?: ReplyTargetInfo | null;
  /** 고정된 메시지 여부 */
  isPinned?: boolean;
  /** 고정 권한 여부 */
  canPin?: boolean;
  /** 발신자 이름 표시 여부 (그룹핑용, 기본값: true) */
  showName?: boolean;
  /** 시간 표시 여부 (그룹핑용, 기본값: true) */
  showTime?: boolean;
  /** 그룹핑된 메시지 여부 (간격 축소용) */
  isGrouped?: boolean;
  /** 리액션 토글 콜백 */
  onToggleReaction?: (emoji: ReactionEmoji) => void;
  /** 답장 클릭 콜백 */
  onReply?: () => void;
  /** 답장 원본 클릭 콜백 (해당 메시지로 스크롤) */
  onReplyTargetClick?: () => void;
  /** 편집 클릭 콜백 */
  onEdit?: () => void;
  /** 삭제 클릭 콜백 */
  onDelete?: () => void;
  /** 신고 클릭 콜백 (타인 메시지) */
  onReport?: () => void;
  /** 고정/해제 클릭 콜백 */
  onTogglePin?: () => void;
  /** 클릭 시 콜백 (길게 눌러 신고 등) */
  onLongPress?: () => void;
  /** 전송 실패 상태 */
  isError?: boolean;
  /** 재전송 중 상태 */
  isRetrying?: boolean;
  /** 재전송 콜백 */
  onRetry?: () => void;
  /** 전송 실패 메시지 삭제 콜백 */
  onRemoveFailed?: () => void;
}

function MessageBubbleComponent({
  content,
  isOwn,
  senderName,
  createdAt,
  isSystem = false,
  isEdited = false,
  unreadCount,
  canEdit = false,
  reactions = [],
  replyTarget,
  isPinned = false,
  canPin = false,
  showName = true,
  showTime = true,
  isGrouped = false,
  onToggleReaction,
  onReply,
  onReplyTargetClick,
  onEdit,
  onDelete,
  onReport,
  onTogglePin,
  onLongPress,
  isError = false,
  isRetrying = false,
  onRetry,
  onRemoveFailed,
}: MessageBubbleProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Long press 핸들러 (모바일 터치 + 데스크톱 우클릭)
  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress?.(),
    disabled: isSystem,
  });

  // 시스템 메시지 (입장/퇴장 등)
  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-text-tertiary bg-secondary-100 dark:bg-secondary-800 px-3 py-1 rounded-full">
          {content}
        </span>
      </div>
    );
  }

  // 시간 포맷 (절대 시간: "오후 3:45")
  const formattedTime = format(new Date(createdAt), "a h:mm", { locale: ko });

  const handleReactionSelect = (emoji: ReactionEmoji) => {
    onToggleReaction?.(emoji);
    setShowPicker(false);
  };

  return (
    <div
      {...longPressHandlers}
      className={cn(
        "group flex flex-col gap-1 max-w-[80%]",
        isOwn ? "items-end ml-auto" : "items-start mr-auto"
      )}
    >
      {/* 발신자 이름 (타인 메시지, 그룹핑 시 첫 메시지만) */}
      {!isOwn && showName && senderName && (
        <span className="text-xs text-text-secondary pl-1">{senderName}</span>
      )}

      {/* 메시지 버블 + 리액션 영역 */}
      <div className="relative flex flex-col gap-1">
        {/* 답장 원본 메시지 표시 */}
        {replyTarget && (
          <button
            type="button"
            onClick={onReplyTargetClick}
            className={cn(
              "px-3 py-1.5 rounded-t-lg text-xs text-left cursor-pointer",
              "bg-secondary-50 dark:bg-secondary-900/50",
              "border-l-2 border-primary",
              "hover:bg-secondary-100 dark:hover:bg-secondary-900 transition-colors"
            )}
          >
            <p className="font-medium text-primary">{replyTarget.senderName}</p>
            <p className="text-text-secondary truncate max-w-[200px]">
              {replyTarget.isDeleted ? "삭제된 메시지" : replyTarget.content}
            </p>
          </button>
        )}

        {/* 메시지 버블 */}
        <div
          className={cn(
            "px-4 py-2 rounded-2xl break-words whitespace-pre-wrap",
            isOwn
              ? "bg-primary-500 text-white rounded-br-sm"
              : "bg-secondary-100 dark:bg-secondary-800 text-text-primary rounded-bl-sm",
            replyTarget && "rounded-t-none",
            isError && "opacity-60"
          )}
        >
          {content}
        </div>

        {/* 전송 실패 표시 (본인 메시지 + 에러 상태) */}
        {isOwn && isError && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className={cn(
                "flex items-center gap-1 text-xs text-error",
                "hover:underline transition-opacity",
                isRetrying && "opacity-50 cursor-not-allowed"
              )}
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>재전송 중...</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  <span>전송 실패 - 다시 시도</span>
                </>
              )}
            </button>
            {!isRetrying && onRemoveFailed && (
              <button
                type="button"
                onClick={onRemoveFailed}
                className="text-xs text-text-tertiary hover:text-error transition-colors"
                aria-label="전송 취소 및 삭제"
              >
                삭제
              </button>
            )}
          </div>
        )}

        {/* 리액션 표시 */}
        {reactions.length > 0 && (
          <div className={cn(isOwn ? "flex justify-end" : "flex justify-start")}>
            <ReactionPills
              reactions={reactions}
              onToggle={(emoji) => onToggleReaction?.(emoji)}
              disabled={!onToggleReaction}
            />
          </div>
        )}

        {/* 리액션 피커 (호버 시 + 버튼) */}
        {onToggleReaction && (
          <div
            className={cn(
              "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity",
              isOwn ? "-left-8" : "-right-8"
            )}
          >
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className={cn(
                "w-6 h-6 flex items-center justify-center",
                "rounded-full bg-bg-secondary hover:bg-bg-tertiary",
                "text-text-tertiary hover:text-text-secondary",
                "transition-colors text-sm"
              )}
              aria-label="리액션 추가"
            >
              +
            </button>
          </div>
        )}

        {/* 리액션 피커 팝업 */}
        {showPicker && onToggleReaction && (
          <ReactionPicker
            onSelect={handleReactionSelect}
            onClose={() => setShowPicker(false)}
            className={cn(
              "bottom-full pb-1",
              isOwn ? "right-0" : "left-0"
            )}
          />
        )}
      </div>

      {/* 하단 정보 (시간, 수정됨, 읽음 수) - 그룹핑 시 마지막 메시지만 표시 */}
      {showTime && (
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-text-tertiary",
            isOwn ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span>{formattedTime}</span>
          {isEdited && (
            <span className="text-text-tertiary">(수정됨)</span>
          )}
          {isOwn && unreadCount !== undefined && unreadCount > 0 && (
            <span className="text-primary font-medium">{unreadCount}</span>
          )}
        </div>
      )}

      {/* 액션 메뉴 (마우스 호버 시 표시) */}
      <div
        className={cn(
          "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
          isOwn ? "flex-row-reverse" : "flex-row"
        )}
      >
        {onReply && (
          <button
            type="button"
            onClick={onReply}
            className="text-xs text-text-tertiary hover:text-primary px-1"
          >
            답장
          </button>
        )}
        {canPin && onTogglePin && (
          <button
            type="button"
            onClick={onTogglePin}
            className={cn(
              "text-xs px-1",
              isPinned
                ? "text-primary hover:text-text-tertiary"
                : "text-text-tertiary hover:text-primary"
            )}
          >
            {isPinned ? "고정 해제" : "고정"}
          </button>
        )}
        {isOwn && canEdit && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-text-tertiary hover:text-text-secondary px-1"
          >
            편집
          </button>
        )}
        {isOwn && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-text-tertiary hover:text-error px-1"
          >
            삭제
          </button>
        )}
        {!isOwn && onReport && (
          <button
            type="button"
            onClick={onReport}
            className="text-xs text-text-tertiary hover:text-error px-1"
          >
            신고
          </button>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);
