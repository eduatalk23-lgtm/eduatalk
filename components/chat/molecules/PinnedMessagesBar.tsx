"use client";

/**
 * PinnedMessagesBar - 고정 메시지 바
 *
 * 채팅방 상단에 고정된 메시지 목록을 표시합니다.
 * 클릭 시 해당 메시지로 스크롤, 관리자는 고정 해제 가능.
 */

import { memo, useState } from "react";
import { cn } from "@/lib/cn";
import { Pin, ChevronDown, ChevronUp, X } from "lucide-react";
import type { PinnedMessageWithContent } from "@/lib/domains/chat/types";

interface PinnedMessagesBarProps {
  /** 고정된 메시지 목록 */
  pinnedMessages: PinnedMessageWithContent[];
  /** 고정 해제 권한 여부 */
  canUnpin: boolean;
  /** 메시지 클릭 시 스크롤 */
  onMessageClick: (messageId: string) => void;
  /** 고정 해제 콜백 */
  onUnpin?: (messageId: string) => void;
}

function PinnedMessagesBarComponent({
  pinnedMessages,
  canUnpin,
  onMessageClick,
  onUnpin,
}: PinnedMessagesBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (pinnedMessages.length === 0) {
    return null;
  }

  // 단일 메시지 모드 (펼침 버튼 표시)
  if (!isExpanded && pinnedMessages.length === 1) {
    const pinned = pinnedMessages[0];
    return (
      <div className="flex items-center gap-1 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-900/30">
        <Pin className="w-4 h-4 text-primary flex-shrink-0" />
        <button
          type="button"
          onClick={() => onMessageClick(pinned.message_id)}
          className="flex-1 min-h-[44px] flex items-center text-left text-sm truncate hover:text-primary transition-colors px-2"
        >
          <span>
            <span className="font-medium text-primary">
              {pinned.message.senderName}:
            </span>{" "}
            <span className="text-text-secondary">
              {pinned.message.isDeleted ? "삭제된 메시지" : pinned.message.content}
            </span>
          </span>
        </button>
        {canUnpin && onUnpin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnpin(pinned.message_id);
            }}
            className="w-11 h-11 flex items-center justify-center hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors flex-shrink-0"
            aria-label="고정 해제"
          >
            <X className="w-4 h-4 text-text-tertiary hover:text-error" />
          </button>
        )}
      </div>
    );
  }

  // 축소 모드 (여러 개 - 캐러셀 형태)
  if (!isExpanded && pinnedMessages.length > 1) {
    const pinned = pinnedMessages[currentIndex];
    return (
      <div className="flex items-center gap-1 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-900/30">
        <Pin className="w-4 h-4 text-primary flex-shrink-0" />
        <button
          type="button"
          onClick={() => onMessageClick(pinned.message_id)}
          className="flex-1 min-h-[44px] flex items-center text-left text-sm truncate hover:text-primary transition-colors px-2"
        >
          <span>
            <span className="font-medium text-primary">
              {pinned.message.senderName}:
            </span>{" "}
            <span className="text-text-secondary">
              {pinned.message.isDeleted ? "삭제된 메시지" : pinned.message.content}
            </span>
          </span>
        </button>
        <span className="text-xs text-text-tertiary">
          {currentIndex + 1}/{pinnedMessages.length}
        </span>
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => (i + 1) % pinnedMessages.length)}
          className="w-11 h-11 flex items-center justify-center hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors flex-shrink-0"
          aria-label="다음 고정 메시지"
        >
          <ChevronDown className="w-5 h-5 text-text-tertiary" />
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="min-h-[44px] px-3 flex items-center text-xs text-primary hover:underline flex-shrink-0"
        >
          전체 보기
        </button>
      </div>
    );
  }

  // 확장 모드 (전체 목록)
  return (
    <div className="bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-900/30">
      <div className="flex items-center justify-between px-3 py-1">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            고정된 메시지 ({pinnedMessages.length})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="w-11 h-11 flex items-center justify-center hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
          aria-label="접기"
        >
          <ChevronUp className="w-5 h-5 text-text-tertiary" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {pinnedMessages.map((pinned) => (
          <div
            key={pinned.id}
            className={cn(
              "flex items-center gap-1 px-3",
              "hover:bg-primary-100/50 dark:hover:bg-primary-900/40 transition-colors"
            )}
          >
            <button
              type="button"
              onClick={() => onMessageClick(pinned.message_id)}
              className="flex-1 min-h-[44px] flex items-center text-left text-sm truncate px-2"
            >
              <span>
                <span className="font-medium text-primary">
                  {pinned.message.senderName}:
                </span>{" "}
                <span className="text-text-secondary">
                  {pinned.message.isDeleted ? "삭제된 메시지" : pinned.message.content}
                </span>
              </span>
            </button>
            {canUnpin && onUnpin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnpin(pinned.message_id);
                }}
                className="w-11 h-11 flex items-center justify-center hover:bg-primary-200 dark:hover:bg-primary-800 rounded-lg transition-colors flex-shrink-0"
                aria-label="고정 해제"
              >
                <X className="w-4 h-4 text-text-tertiary hover:text-error" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const PinnedMessagesBar = memo(PinnedMessagesBarComponent);
