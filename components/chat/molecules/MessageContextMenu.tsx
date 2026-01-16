"use client";

/**
 * MessageContextMenu - 메시지 컨텍스트 메뉴
 *
 * 메시지를 길게 누르거나 우클릭 시 나타나는 하단 시트 메뉴입니다.
 * 리액션 추가, 복사, 답장, 편집, 삭제, 신고 등의 액션을 제공합니다.
 */

import { memo, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useClickOutside, useEscapeKey } from "@/lib/accessibility/hooks";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/domains/chat/types";
import { Copy, Reply, Edit2, Trash2, Flag, Pin, PinOff } from "lucide-react";

/** 메시지 메뉴 컨텍스트 정보 */
export interface MessageMenuContext {
  /** 메시지 ID */
  messageId: string;
  /** 메시지 내용 */
  content: string;
  /** 본인 메시지 여부 */
  isOwn: boolean;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 고정 권한 여부 */
  canPin: boolean;
  /** 현재 고정 상태 */
  isPinned: boolean;
}

interface MessageContextMenuProps {
  /** 메뉴 열림 상태 */
  isOpen: boolean;
  /** 메뉴 닫기 콜백 */
  onClose: () => void;
  /** 메시지 컨텍스트 정보 */
  context: MessageMenuContext | null;
  /** 복사 클릭 콜백 */
  onCopy: () => void;
  /** 답장 클릭 콜백 */
  onReply: () => void;
  /** 편집 클릭 콜백 (본인 메시지 + 편집 가능 시) */
  onEdit?: () => void;
  /** 삭제 클릭 콜백 (본인 메시지) */
  onDelete?: () => void;
  /** 신고 클릭 콜백 (타인 메시지) */
  onReport?: () => void;
  /** 고정/해제 클릭 콜백 (고정 권한 있을 때) */
  onTogglePin?: () => void;
  /** 리액션 토글 콜백 */
  onToggleReaction: (emoji: ReactionEmoji) => void;
}

function MessageContextMenuComponent({
  isOpen,
  onClose,
  context,
  onCopy,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onTogglePin,
  onToggleReaction,
}: MessageContextMenuProps) {
  // 외부 클릭 시 닫기
  const sheetRef = useClickOutside<HTMLDivElement>(onClose, isOpen);

  // ESC 키로 닫기
  useEscapeKey(onClose, isOpen);

  // 메뉴 열렸을 때 body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen || !context) return null;

  const handleReactionClick = (emoji: ReactionEmoji) => {
    onToggleReaction(emoji);
  };

  const menuContent = (
    <>
      {/* 딤 배경 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50",
          "animate-in fade-in-0 duration-200"
        )}
        aria-hidden="true"
      />

      {/* 하단 시트 */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50",
          "bg-bg-primary rounded-t-2xl",
          "animate-in slide-in-from-bottom duration-200",
          "pb-safe max-h-[80vh] overflow-y-auto"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="메시지 메뉴"
      >
        {/* 드래그 핸들 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-secondary-300 dark:bg-secondary-600 rounded-full" />
        </div>

        {/* 빠른 리액션 바 */}
        <div className="flex justify-center gap-2 px-4 py-3">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReactionClick(emoji)}
              className={cn(
                "w-11 h-11 flex items-center justify-center",
                "rounded-full text-2xl",
                "bg-secondary-100 dark:bg-secondary-800",
                "hover:bg-secondary-200 dark:hover:bg-secondary-700",
                "active:scale-95",
                "transition-all duration-100"
              )}
              aria-label={`${emoji} 리액션 추가`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* 구분선 */}
        <div className="px-4">
          <div className="h-px bg-border" />
        </div>

        {/* 액션 목록 */}
        <div className="py-2">
          {/* 복사 - 항상 표시 */}
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3",
              "hover:bg-bg-secondary active:bg-bg-tertiary",
              "transition-colors text-text-primary"
            )}
          >
            <Copy className="w-5 h-5 text-text-secondary" />
            <span>복사</span>
          </button>

          {/* 답장 - 항상 표시 */}
          <button
            type="button"
            onClick={onReply}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3",
              "hover:bg-bg-secondary active:bg-bg-tertiary",
              "transition-colors text-text-primary"
            )}
          >
            <Reply className="w-5 h-5 text-text-secondary" />
            <span>답장</span>
          </button>

          {/* 편집 - 본인 메시지 + 편집 가능 시 */}
          {context.isOwn && context.canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3",
                "hover:bg-bg-secondary active:bg-bg-tertiary",
                "transition-colors text-text-primary"
              )}
            >
              <Edit2 className="w-5 h-5 text-text-secondary" />
              <span>편집</span>
            </button>
          )}

          {/* 고정/해제 - 고정 권한 있을 때 */}
          {context.canPin && onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3",
                "hover:bg-bg-secondary active:bg-bg-tertiary",
                "transition-colors text-text-primary"
              )}
            >
              {context.isPinned ? (
                <>
                  <PinOff className="w-5 h-5 text-text-secondary" />
                  <span>고정 해제</span>
                </>
              ) : (
                <>
                  <Pin className="w-5 h-5 text-text-secondary" />
                  <span>고정</span>
                </>
              )}
            </button>
          )}

          {/* 삭제 - 본인 메시지 (위험 스타일) */}
          {context.isOwn && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3",
                "hover:bg-bg-secondary active:bg-bg-tertiary",
                "transition-colors text-error"
              )}
            >
              <Trash2 className="w-5 h-5" />
              <span>삭제</span>
            </button>
          )}

          {/* 신고 - 타인 메시지 (위험 스타일) */}
          {!context.isOwn && onReport && (
            <button
              type="button"
              onClick={onReport}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3",
                "hover:bg-bg-secondary active:bg-bg-tertiary",
                "transition-colors text-error"
              )}
            >
              <Flag className="w-5 h-5" />
              <span>신고</span>
            </button>
          )}
        </div>

        {/* 취소 버튼 */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-full py-3 rounded-xl",
              "bg-secondary-100 dark:bg-secondary-800",
              "hover:bg-secondary-200 dark:hover:bg-secondary-700",
              "text-text-primary font-medium",
              "transition-colors"
            )}
          >
            취소
          </button>
        </div>
      </div>
    </>
  );

  // Portal로 body에 직접 렌더링
  if (typeof window === "undefined") return null;
  return createPortal(menuContent, document.body);
}

export const MessageContextMenu = memo(MessageContextMenuComponent);
