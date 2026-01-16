"use client";

/**
 * ChatInput - 메시지 입력 컴포넌트
 *
 * 텍스트 입력 + 전송 버튼 + 답장 표시
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Send, X } from "lucide-react";
import type { ReplyTargetInfo } from "@/lib/domains/chat/types";

interface ChatInputProps {
  /** 메시지 전송 핸들러 */
  onSend: (content: string) => void;
  /** 전송 중 상태 */
  isSending?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 플레이스홀더 */
  placeholder?: string;
  /** 최대 글자 수 */
  maxLength?: number;
  /** 타이핑 상태 변경 핸들러 */
  onTypingChange?: (isTyping: boolean) => void;
  /** 답장 대상 메시지 정보 */
  replyTarget?: ReplyTargetInfo | null;
  /** 답장 취소 핸들러 */
  onCancelReply?: () => void;
}

function ChatInputComponent({
  onSend,
  isSending = false,
  disabled = false,
  placeholder = "메시지를 입력하세요...",
  maxLength = 1000,
  onTypingChange,
  replyTarget,
  onCancelReply,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동 높이 조절
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isSending || disabled) return;

    onSend(trimmed);
    setValue("");
    onTypingChange?.(false);

    // 높이 초기화
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isSending, disabled, onSend, onTypingChange]);

  // 한글 IME 조합 이벤트 핸들러
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter로 전송 (Shift+Enter는 줄바꿈, 한글 조합 중에는 전송 방지)
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isComposing]
  );

  const canSend = value.trim().length > 0 && !isSending && !disabled;

  return (
    <div className="flex flex-col bg-bg-primary border-t border-border">
      {/* 답장 대상 표시 */}
      {replyTarget && (
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-border">
          <div className="w-1 h-8 bg-primary rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary font-medium">{replyTarget.senderName}에게 답장</p>
            <p className="text-xs text-text-secondary truncate">
              {replyTarget.isDeleted ? "삭제된 메시지" : replyTarget.content}
            </p>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="p-1 hover:bg-bg-tertiary rounded-full transition-colors"
              aria-label="답장 취소"
            >
              <X className="w-4 h-4 text-text-tertiary" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* 텍스트 입력 */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              const newValue = e.target.value.slice(0, maxLength);
              setValue(newValue);
              onTypingChange?.(newValue.length > 0);
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full resize-none rounded-2xl px-4 py-2.5 text-sm",
              "bg-bg-secondary text-text-primary placeholder:text-text-tertiary",
              "border border-transparent focus:border-primary focus:outline-none",
              "transition-colors",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
          {/* 글자 수 표시 (임계치 근처) */}
          {value.length > maxLength * 0.8 && (
            <span
              className={cn(
                "absolute right-3 bottom-1 text-[10px]",
                value.length >= maxLength ? "text-error" : "text-text-tertiary"
              )}
            >
              {value.length}/{maxLength}
            </span>
          )}
        </div>

        {/* 전송 버튼 */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
            "transition-colors",
            canSend
              ? "bg-primary text-white hover:bg-primary-hover"
              : "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export const ChatInput = memo(ChatInputComponent);
