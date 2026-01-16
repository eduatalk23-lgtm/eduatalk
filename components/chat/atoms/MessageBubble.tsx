"use client";

/**
 * MessageBubble - 채팅 메시지 버블
 *
 * 단일 채팅 메시지를 표시합니다.
 * 본인/타인 메시지에 따라 스타일이 달라집니다.
 */

import { memo, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/cn";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import type { ReactionSummary, ReactionEmoji, ReplyTargetInfo } from "@/lib/domains/chat/types";
import { ReactionPills } from "./ReactionPills";
import { ReactionPicker } from "./ReactionPicker";
import { useLongPress } from "@/lib/hooks/useLongPress";
import {
  MessageStatusIndicator,
  type MessageDeliveryStatus,
} from "./MessageStatusIndicator";

// ============================================
// 액션 타입 정의 (Props 통합용)
// ============================================

/** 메시지 버블에서 발생하는 액션 타입 */
export type MessageAction =
  | { type: "toggleReaction"; emoji: ReactionEmoji }
  | { type: "reply" }
  | { type: "replyTargetClick" }
  | { type: "edit" }
  | { type: "delete" }
  | { type: "report" }
  | { type: "togglePin" }
  | { type: "longPress" }
  | { type: "retry" }
  | { type: "removeFailed" };

/** 에러 정보 (상세 에러 표시용) */
export interface MessageErrorInfo {
  /** 사용자에게 표시할 에러 메시지 */
  message: string;
  /** 재시도 가능 여부 */
  canRetry: boolean;
  /** 재시도까지 대기 시간 (밀리초) */
  retryAfter?: number;
}

/** 메시지 데이터 (MessageBubble에 필요한 최소 정보) */
export interface MessageData {
  content: string;
  createdAt: string;
  isOwn: boolean;
  senderName?: string;
  isSystem?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  unreadCount?: number;
  reactions?: ReactionSummary[];
  replyTarget?: ReplyTargetInfo | null;
  isPinned?: boolean;
  /** 메시지 전송 상태 (본인 메시지용) */
  status?: MessageDeliveryStatus;
  /** 상세 에러 정보 (status="error"일 때) */
  errorInfo?: MessageErrorInfo;
  /** @deprecated Use status="error" instead */
  isError?: boolean;
  /** @deprecated Use status="sending" instead */
  isRetrying?: boolean;
}

/** 메시지 표시 옵션 */
export interface MessageDisplayOptions {
  showName?: boolean;
  showTime?: boolean;
  isGrouped?: boolean;
}

/** 메시지 권한 */
export interface MessagePermissions {
  canEdit?: boolean;
  canPin?: boolean;
}

interface MessageBubbleProps {
  /** 메시지 데이터 */
  message: MessageData;
  /** 표시 옵션 */
  displayOptions?: MessageDisplayOptions;
  /** 권한 정보 */
  permissions?: MessagePermissions;
  /** 통합 액션 핸들러 */
  onAction?: (action: MessageAction) => void;
}

function MessageBubbleComponent({
  message,
  displayOptions = {},
  permissions = {},
  onAction,
}: MessageBubbleProps) {
  // 메시지 데이터 추출
  const {
    content,
    createdAt,
    isOwn,
    senderName,
    isSystem = false,
    isDeleted = false,
    isEdited = false,
    unreadCount,
    reactions = [],
    replyTarget,
    isPinned = false,
    status,
    errorInfo,
    // 레거시 호환성 (deprecated)
    isError = false,
    isRetrying = false,
  } = message;

  // 상태 결정 (새 status 우선, 레거시 폴백)
  const derivedStatus: MessageDeliveryStatus | undefined = status
    ?? (isRetrying ? "sending" : undefined)
    ?? (isError ? "error" : undefined);

  // 에러 상태 여부 (UI 표시용)
  const hasError = derivedStatus === "error";
  const isSending = derivedStatus === "sending";

  // 에러 메시지 결정 (상세 에러 정보가 있으면 사용, 아니면 기본 메시지)
  const errorMessage = errorInfo?.message ?? "전송 실패";
  const canRetryError = errorInfo?.canRetry ?? true;

  // 표시 옵션 추출 (isGrouped는 부모에서 간격 조절에 사용)
  const { showName = true, showTime = true, isGrouped: _isGrouped = false } = displayOptions;

  // 권한 정보 추출
  const { canEdit = false, canPin = false } = permissions;

  const [showPicker, setShowPicker] = useState(false);

  // 액션 디스패치 헬퍼
  const dispatch = useCallback(
    (action: MessageAction) => {
      onAction?.(action);
    },
    [onAction]
  );

  // Long press 핸들러 (모바일 터치 + 데스크톱 우클릭)
  const longPressHandlers = useLongPress({
    onLongPress: () => dispatch({ type: "longPress" }),
    disabled: isSystem || !onAction,
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

  // 삭제된 메시지 (애니메이션 적용)
  if (isDeleted) {
    return (
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[80%] animate-in fade-in duration-300",
          isOwn ? "items-end ml-auto" : "items-start mr-auto"
        )}
      >
        {/* 발신자 이름 (타인 메시지, 그룹핑 시 첫 메시지만) */}
        {!isOwn && showName && senderName && (
          <span className="text-xs text-text-secondary pl-1">{senderName}</span>
        )}

        {/* 삭제된 메시지 버블 */}
        <div
          className={cn(
            "px-4 py-2 rounded-2xl",
            "bg-secondary-50 dark:bg-secondary-900/50",
            "border border-secondary-200 dark:border-secondary-700",
            "text-text-tertiary italic text-sm",
            isOwn ? "rounded-br-sm" : "rounded-bl-sm"
          )}
        >
          삭제된 메시지입니다
        </div>

        {/* 시간 표시 */}
        {showTime && (
          <span className="text-xs text-text-tertiary">
            {format(new Date(createdAt), "a h:mm", { locale: ko })}
          </span>
        )}
      </div>
    );
  }

  // 시간 포맷 (절대 시간: "오후 3:45")
  const formattedTime = format(new Date(createdAt), "a h:mm", { locale: ko });

  const handleReactionSelect = (emoji: ReactionEmoji) => {
    dispatch({ type: "toggleReaction", emoji });
    setShowPicker(false);
  };

  // 스크린 리더용 메시지 요약 생성
  const ariaLabel = useMemo(() => {
    const sender = isOwn ? "나" : senderName ?? "알 수 없음";
    const time = format(new Date(createdAt), "a h시 mm분", { locale: ko });
    const statusText = hasError ? ", 전송 실패" : isSending ? ", 전송 중" : "";
    return `${sender}의 메시지, ${time}${statusText}`;
  }, [isOwn, senderName, createdAt, hasError, isSending]);

  return (
    <article
      {...longPressHandlers}
      className={cn(
        "group flex flex-col gap-1 max-w-[80%]",
        isOwn ? "items-end ml-auto" : "items-start mr-auto"
      )}
      aria-label={ariaLabel}
    >
      {/* 발신자 이름 (타인 메시지, 그룹핑 시 첫 메시지만) */}
      {!isOwn && showName && senderName && (
        <span className="text-xs text-text-secondary pl-1" aria-hidden="true">
          {senderName}
        </span>
      )}

      {/* 메시지 버블 + 리액션 영역 */}
      <div className="relative flex flex-col gap-1">
        {/* 답장 원본 메시지 표시 */}
        {replyTarget && (
          <button
            type="button"
            onClick={() => dispatch({ type: "replyTargetClick" })}
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
            hasError && "opacity-60"
          )}
        >
          {content}
        </div>

        {/* 전송 실패 표시 (본인 메시지 + 에러 상태) */}
        {isOwn && hasError && (
          <div className="flex flex-col gap-1">
            {/* 에러 메시지 */}
            <div className="flex items-center gap-1.5 text-xs text-error">
              <MessageStatusIndicator status="error" className="w-3 h-3 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>

            {/* 재시도/삭제 버튼 */}
            <div className="flex items-center gap-2">
              {canRetryError && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "retry" })}
                  disabled={isSending}
                  className={cn(
                    "text-xs text-primary hover:underline transition-opacity",
                    isSending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSending ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      재전송 중...
                    </span>
                  ) : (
                    "다시 시도"
                  )}
                </button>
              )}
              {!isSending && onAction && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "removeFailed" })}
                  className="text-xs text-text-tertiary hover:text-error transition-colors"
                  aria-label="전송 취소 및 삭제"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        )}

        {/* 리액션 표시 */}
        {reactions.length > 0 && (
          <div className={cn(isOwn ? "flex justify-end" : "flex justify-start")}>
            <ReactionPills
              reactions={reactions}
              onToggle={(emoji) => dispatch({ type: "toggleReaction", emoji })}
              disabled={!onAction}
            />
          </div>
        )}

        {/* 리액션 피커 (호버 시 + 버튼) - 모바일 터치 타겟 44px */}
        {onAction && (
          <div
            className={cn(
              "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity",
              isOwn ? "-left-12" : "-right-12"
            )}
          >
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className={cn(
                "w-11 h-11 flex items-center justify-center",
                "rounded-full bg-bg-secondary hover:bg-bg-tertiary",
                "text-text-tertiary hover:text-text-secondary",
                "transition-colors text-lg"
              )}
              aria-label="리액션 추가"
            >
              +
            </button>
          </div>
        )}

        {/* 리액션 피커 팝업 */}
        {showPicker && onAction && (
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

      {/* 하단 정보 (시간, 상태, 수정됨, 읽음 수) - 그룹핑 시 마지막 메시지만 표시 */}
      {showTime && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs text-text-tertiary",
            isOwn ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* 본인 메시지 상태 표시 (에러가 아닐 때만, 에러는 별도 표시) */}
          {isOwn && derivedStatus && !hasError && (
            <MessageStatusIndicator
              status={derivedStatus}
              className="w-3.5 h-3.5"
            />
          )}
          <time dateTime={createdAt} aria-hidden="true">{formattedTime}</time>
          {isEdited && (
            <span className="text-text-tertiary">(수정됨)</span>
          )}
          {/* 읽음 수 (status가 read가 아닐 때만 표시) */}
          {isOwn && unreadCount !== undefined && unreadCount > 0 && derivedStatus !== "read" && (
            <span className="text-primary font-medium">{unreadCount}</span>
          )}
        </div>
      )}

      {/* 액션 메뉴 (마우스 호버 시 표시) - 모바일 터치 타겟 44px */}
      {onAction && (
        <div
          className={cn(
            "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
            isOwn ? "flex-row-reverse" : "flex-row"
          )}
        >
          {!isDeleted && !isSystem && (
            <button
              type="button"
              onClick={() => dispatch({ type: "reply" })}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-text-tertiary hover:text-primary px-2"
            >
              답장
            </button>
          )}
          {canPin && !isSystem && !isDeleted && (
            <button
              type="button"
              onClick={() => dispatch({ type: "togglePin" })}
              className={cn(
                "min-h-[44px] min-w-[44px] flex items-center justify-center text-xs px-2",
                isPinned
                  ? "text-primary hover:text-text-tertiary"
                  : "text-text-tertiary hover:text-primary"
              )}
            >
              {isPinned ? "고정 해제" : "고정"}
            </button>
          )}
          {isOwn && canEdit && !isDeleted && (
            <button
              type="button"
              onClick={() => dispatch({ type: "edit" })}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-text-tertiary hover:text-text-secondary px-2"
            >
              편집
            </button>
          )}
          {isOwn && !isDeleted && (
            <button
              type="button"
              onClick={() => dispatch({ type: "delete" })}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-text-tertiary hover:text-error px-2"
            >
              삭제
            </button>
          )}
          {!isOwn && !isDeleted && (
            <button
              type="button"
              onClick={() => dispatch({ type: "report" })}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-text-tertiary hover:text-error px-2"
            >
              신고
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);
