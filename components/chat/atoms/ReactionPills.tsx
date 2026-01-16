"use client";

/**
 * ReactionPills - 메시지 리액션 표시
 *
 * 메시지 하단에 리액션 요약을 표시합니다.
 * 클릭 시 해당 리액션을 토글합니다.
 */

import { memo } from "react";
import { cn } from "@/lib/cn";
import type { ReactionSummary, ReactionEmoji } from "@/lib/domains/chat/types";

interface ReactionPillsProps {
  /** 리액션 요약 목록 */
  reactions: ReactionSummary[];
  /** 리액션 토글 콜백 */
  onToggle: (emoji: ReactionEmoji) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

function ReactionPillsComponent({
  reactions,
  onToggle,
  disabled = false,
  className,
}: ReactionPillsProps) {
  // 리액션이 없으면 렌더링하지 않음
  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onToggle(reaction.emoji)}
          disabled={disabled}
          className={cn(
            // 최소 터치 타겟 44px 보장 (min-h-[44px])
            "inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full",
            "text-sm transition-colors",
            "hover:bg-bg-tertiary active:scale-95",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            reaction.hasReacted
              ? "bg-primary/10 border border-primary/30"
              : "bg-bg-secondary border border-transparent"
          )}
          aria-label={`${reaction.emoji} ${reaction.count}명이 리액션함${
            reaction.hasReacted ? ", 내 리액션" : ""
          }`}
        >
          <span className="text-base leading-none">{reaction.emoji}</span>
          <span
            className={cn(
              "text-sm font-medium",
              reaction.hasReacted ? "text-primary" : "text-text-secondary"
            )}
          >
            {reaction.count}
          </span>
        </button>
      ))}
    </div>
  );
}

export const ReactionPills = memo(ReactionPillsComponent);
