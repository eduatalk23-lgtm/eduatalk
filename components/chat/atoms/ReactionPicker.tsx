"use client";

/**
 * ReactionPicker - 리액션 이모지 선택 팝업
 *
 * 메시지에 추가할 리액션 이모지를 선택합니다.
 */

import { memo } from "react";
import { cn } from "@/lib/cn";
import { useClickOutside, useEscapeKey } from "@/lib/accessibility/hooks";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/domains/chat/types";

interface ReactionPickerProps {
  /** 이모지 선택 콜백 */
  onSelect: (emoji: ReactionEmoji) => void;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 추가 클래스 */
  className?: string;
}

function ReactionPickerComponent({
  onSelect,
  onClose,
  className,
}: ReactionPickerProps) {
  // 외부 클릭 시 닫기
  const containerRef = useClickOutside<HTMLDivElement>(onClose);

  // ESC 키로 닫기
  useEscapeKey(onClose);

  const handleSelect = (emoji: ReactionEmoji) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-50",
        "flex items-center gap-1 p-1.5",
        "bg-bg-primary rounded-lg shadow-lg",
        "border border-border",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
      role="menu"
      aria-label="리액션 선택"
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleSelect(emoji)}
          className={cn(
            "w-8 h-8 flex items-center justify-center",
            "rounded-md text-lg",
            "hover:bg-bg-secondary hover:scale-110",
            "active:scale-95",
            "transition-all duration-100"
          )}
          role="menuitem"
          aria-label={`${emoji} 리액션 추가`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export const ReactionPicker = memo(ReactionPickerComponent);
