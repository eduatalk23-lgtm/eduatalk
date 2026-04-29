"use client";

/**
 * MessageContextMenu - 메시지 컨텍스트 메뉴
 *
 * 모바일: 길게 누르기 → 하단 시트 (바텀시트)
 * 데스크톱: 우클릭 → 커서 위치에 컨텍스트 메뉴 팝업
 *
 * 리액션 추가, 복사, 답장, 편집, 삭제, 신고 등의 액션을 제공합니다.
 */

import { memo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useFocusTrap, useEscapeKey } from "@/lib/accessibility/hooks";
import { focusFirst } from "@/lib/accessibility";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/domains/chat/types";
import { Copy, Reply, Edit2, Trash2, Flag, Pin, PinOff, Forward, Eye } from "lucide-react";

/** 메시지 메뉴 컨텍스트 정보 */
export interface MessageMenuContext {
  /** 메시지 ID */
  messageId: string;
  /** 메시지 내용 */
  content: string;
  /** 메시지 생성 시각 (읽음 정보 조회용) */
  createdAt: string;
  /** 메시지 수정 시각 (충돌 감지용) */
  updatedAt: string;
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
  /** 우클릭 커서 위치 (있으면 데스크톱 팝업, 없으면 모바일 바텀시트) */
  position?: { x: number; y: number } | null;
  /** 복사 클릭 콜백 */
  onCopy: () => void;
  /** 답장 클릭 콜백 */
  onReply: () => void;
  /** 전달 클릭 콜백 */
  onForward?: () => void;
  /** 편집 클릭 콜백 (본인 메시지 + 편집 가능 시) */
  onEdit?: () => void;
  /** 삭제 클릭 콜백 (본인 메시지) */
  onDelete?: () => void;
  /** 신고 클릭 콜백 (타인 메시지) */
  onReport?: () => void;
  /** 고정/해제 클릭 콜백 (고정 권한 있을 때) */
  onTogglePin?: () => void;
  /** 읽음 정보 보기 콜백 (본인 메시지, 그룹 채팅) */
  onViewReaders?: () => void;
  /** 리액션 토글 콜백 */
  onToggleReaction: (emoji: ReactionEmoji) => void;
}

/** 액션 버튼 (공통 컴포넌트) */
function ActionButton({
  onClick,
  icon: Icon,
  label,
  variant = "default",
  compact = false,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant?: "default" | "danger";
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        "hover:bg-bg-secondary active:bg-bg-tertiary",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
        variant === "danger" ? "text-error" : "text-text-primary"
      )}
    >
      <Icon className={cn("w-4 h-4", variant === "default" && "text-text-secondary")} />
      <span className={cn(compact && "text-sm")}>{label}</span>
    </button>
  );
}

/** 리액션 바 (공통) */
function ReactionBar({
  onReaction,
  compact = false,
}: {
  onReaction: (emoji: ReactionEmoji) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex justify-center gap-2", compact ? "px-3 py-2" : "px-4 py-3")}>
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReaction(emoji)}
          className={cn(
            "flex items-center justify-center",
            compact ? "w-9 h-9 text-xl" : "w-11 h-11 text-2xl",
            "rounded-full",
            "bg-secondary-100",
            "hover:bg-secondary-200",
            "active:scale-95",
            "transition-[background-color,transform] duration-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          )}
          aria-label={`${emoji} 리액션 추가`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** 액션 목록 (공통) */
function ActionList({
  context,
  compact = false,
  onCopy,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReport,
  onTogglePin,
  onViewReaders,
}: {
  context: MessageMenuContext;
  compact?: boolean;
  onCopy: () => void;
  onReply: () => void;
  onForward?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onTogglePin?: () => void;
  onViewReaders?: () => void;
}) {
  return (
    <div className="py-1">
      <ActionButton onClick={onCopy} icon={Copy} label="복사" compact={compact} />
      <ActionButton onClick={onReply} icon={Reply} label="답장" compact={compact} />
      {onForward && (
        <ActionButton onClick={onForward} icon={Forward} label="전달" compact={compact} />
      )}

      {context.isOwn && onViewReaders && (
        <ActionButton onClick={onViewReaders} icon={Eye} label="읽음 정보" compact={compact} />
      )}

      {context.isOwn && context.canEdit && onEdit && (
        <ActionButton onClick={onEdit} icon={Edit2} label="편집" compact={compact} />
      )}

      {context.canPin && onTogglePin && (
        <ActionButton
          onClick={onTogglePin}
          icon={context.isPinned ? PinOff : Pin}
          label={context.isPinned ? "고정 해제" : "고정"}
          compact={compact}
        />
      )}

      {context.isOwn && onDelete && (
        <ActionButton onClick={onDelete} icon={Trash2} label="삭제" variant="danger" compact={compact} />
      )}

      {!context.isOwn && onReport && (
        <ActionButton onClick={onReport} icon={Flag} label="신고" variant="danger" compact={compact} />
      )}
    </div>
  );
}

function MessageContextMenuComponent({
  isOpen,
  onClose,
  context,
  position,
  onCopy,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReport,
  onTogglePin,
  onViewReaders,
  onToggleReaction,
}: MessageContextMenuProps) {
  const { containerRef } = useFocusTrap(isOpen);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, isOpen);

  const isDesktopPopup = !!position;

  // 데스크톱 팝업: 렌더 후 뷰포트 안에 맞추기 (callback ref로 DOM 직접 조정)
  // useFocusTrap 의 useEffect 는 ref 가 채워지기 전에 실행될 수 있어
  // 데스크탑 팝업 경로에서는 여기서 focusFirst 를 명시적으로 한 번 더 호출.
  const popupCallbackRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !position) return;

      // focusTrap containerRef도 연결
      if (typeof containerRef === "object" && containerRef !== null) {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }

      const rect = el.getBoundingClientRect();
      const padding = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let x = position.x;
      let y = position.y;

      if (x + rect.width + padding > vw) x = vw - rect.width - padding;
      if (y + rect.height + padding > vh) y = vh - rect.height - padding;
      x = Math.max(padding, x);
      y = Math.max(padding, y);

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      // useFocusTrap 이 ref null 시점에 focusFirst(null) 을 호출했을 가능성 보강
      focusFirst(el);
    },
    [position, containerRef]
  );

  // 모바일 바텀시트: body 스크롤 방지
  useEffect(() => {
    if (isOpen && !isDesktopPopup) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, isDesktopPopup]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!isOpen || !context) return null;

  const actionProps = { context, onCopy, onReply, onForward, onEdit, onDelete, onReport, onTogglePin, onViewReaders };

  // ─── 데스크톱: 커서 위치에 팝업 ───
  if (isDesktopPopup && position) {
    const desktopContent = (
      <>
        {/* 투명 배경 (클릭 시 닫기) */}
        <div
          ref={backdropRef}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-40"
          data-chat-overlay
          aria-hidden="true"
        />

        {/* 컨텍스트 메뉴 팝업 */}
        <div
          ref={popupCallbackRef}
          style={{ left: position.x, top: position.y }}
          className={cn(
            "fixed z-50",
            "bg-bg-primary rounded-xl",
            "border border-border",
            "shadow-xl",
            "min-w-[200px] max-w-[280px]",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "overflow-hidden"
          )}
          role="menu"
          aria-label="메시지 메뉴"
        >
          {/* 리액션 바 (컴팩트) */}
          <ReactionBar onReaction={onToggleReaction} compact />

          {/* 구분선 */}
          <div className="px-3">
            <div className="h-px bg-border" />
          </div>

          {/* 액션 목록 (컴팩트) */}
          <ActionList {...actionProps} compact />
        </div>
      </>
    );

    if (typeof window === "undefined") return null;
    return createPortal(desktopContent, document.body);
  }

  // ─── 모바일: 하단 시트 ───
  const mobileContent = (
    <>
      {/* 딤 배경 */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className={cn(
          "fixed inset-0 z-40 bg-bg-overlay",
          "animate-in fade-in-0 duration-200"
        )}
        data-chat-overlay
        aria-hidden="true"
      />

      {/* 하단 시트 */}
      <div
        ref={containerRef}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50",
          "bg-bg-primary rounded-t-2xl",
          "animate-in slide-in-from-bottom duration-200",
          "pb-[env(safe-area-inset-bottom)] max-h-[80dvh] overflow-y-auto"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="메시지 메뉴"
      >
        {/* 드래그 핸들 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-secondary-300 rounded-full" />
        </div>

        {/* 리액션 바 */}
        <ReactionBar onReaction={onToggleReaction} />

        {/* 구분선 */}
        <div className="px-4">
          <div className="h-px bg-border" />
        </div>

        {/* 액션 목록 */}
        <ActionList {...actionProps} />

        {/* 취소 버튼 */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-full py-3 rounded-xl",
              "bg-secondary-100",
              "hover:bg-secondary-200",
              "text-text-primary font-medium",
              "transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            )}
          >
            취소
          </button>
        </div>
      </div>
    </>
  );

  if (typeof window === "undefined") return null;
  return createPortal(mobileContent, document.body);
}

export const MessageContextMenu = memo(MessageContextMenuComponent);
