"use client";

/**
 * ChatInput - 메시지 입력 컴포넌트
 *
 * 텍스트 입력 + 파일 첨부 + 이모지 피커 + 전송 버튼 + 답장 표시
 * 드래그 앤 드롭 파일 업로드 지원
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Send, X, Paperclip, FileText, Smile, Upload } from "lucide-react";
import type { ReplyTargetInfo, UploadingAttachment } from "@/lib/domains/chat/types";
import { ALLOWED_FILE_TYPES, MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/domains/chat/types";
import { formatFileSize, isImageType } from "@/lib/domains/chat/fileValidation";

/** textarea 최대 높이 (약 7줄, 업계 표준 150-200px 범위) */
const TEXTAREA_MAX_HEIGHT = 160;

/** 자주 사용하는 이모지 (카테고리별) */
const EMOJI_SECTIONS = [
  {
    label: "자주 사용",
    emojis: ["😀", "😂", "🥲", "😊", "🥰", "😎", "🤔", "👍", "👏", "🙏", "❤️", "🔥", "✅", "💯", "🎉"],
  },
  {
    label: "표정",
    emojis: ["😅", "😭", "🤣", "😤", "😮", "🫡", "🤗", "😴", "🥳", "🤩", "😇", "🫠", "😬", "🤝", "💪"],
  },
  {
    label: "기타",
    emojis: ["📚", "✏️", "📝", "💡", "⭐", "🏆", "📌", "🔔", "⏰", "📅", "✨", "💬", "👀", "🎯", "🚀"],
  },
] as const;

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
  /** 파일 선택 핸들러 */
  onFilesSelected?: (files: File[]) => void;
  /** 업로드 중인 파일 목록 */
  uploadingFiles?: UploadingAttachment[];
  /** 파일 제거 핸들러 */
  onRemoveFile?: (clientId: string) => void;
  /** 마운트 시 자동 포커스 */
  autoFocus?: boolean;
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
  onFilesSelected,
  uploadingFiles = [],
  onRemoveFile,
  autoFocus = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const dragCounterRef = useRef(0);

  // 자동 높이 조절 (부드러운 전환은 CSS transition으로 처리)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
    }
  }, [value]);

  // 자동 포커스 (채팅방 진입 시)
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // 이모지 피커 외부 클릭 닫기
  useEffect(() => {
    if (!showEmojiPicker) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const completedUploads = uploadingFiles.filter((f) => f.status === "done").length;
  const isUploading = uploadingFiles.some((f) => f.status === "uploading" || f.status === "pending");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && completedUploads === 0) || isSending || disabled || isUploading) return;

    onSend(trimmed);
    setValue("");
    onTypingChange?.(false);

    // 높이 초기화
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, completedUploads, isSending, disabled, isUploading, onSend, onTypingChange]);

  // 한글 IME 조합 이벤트 핸들러
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Esc로 이모지 피커 닫기
      if (e.key === "Escape" && showEmojiPicker) {
        setShowEmojiPicker(false);
        return;
      }
      // Enter로 전송 (Shift+Enter는 줄바꿈, 한글 조합 중에는 전송 방지)
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isComposing, showEmojiPicker]
  );

  // 이모지 삽입
  const insertEmoji = useCallback((emoji: string) => {
    setValue((prev) => {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = prev.slice(0, start) + emoji + prev.slice(end);
        // 커서 위치를 이모지 뒤로 이동
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          textarea.focus();
        });
        return newValue.slice(0, maxLength);
      }
      return (prev + emoji).slice(0, maxLength);
    });
    onTypingChange?.(true);
  }, [maxLength, onTypingChange]);

  // 파일 선택 핸들러
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remaining = MAX_ATTACHMENTS_PER_MESSAGE - uploadingFiles.length;
      const selected = Array.from(files).slice(0, remaining);

      if (selected.length > 0) {
        onFilesSelected?.(selected);
      }

      // input 초기화 (같은 파일 재선택 허용)
      e.target.value = "";
    },
    [onFilesSelected, uploadingFiles.length]
  );

  // 클립보드 이미지 붙여넣기
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        const remaining = MAX_ATTACHMENTS_PER_MESSAGE - uploadingFiles.length;
        onFilesSelected?.(imageFiles.slice(0, remaining));
      }
    },
    [onFilesSelected, uploadingFiles.length]
  );

  // ============================================
  // 드래그 앤 드롭
  // ============================================

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      if (!onFilesSelected) return;

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const remaining = MAX_ATTACHMENTS_PER_MESSAGE - uploadingFiles.length;
      if (remaining <= 0) return;

      const selected = Array.from(files).slice(0, remaining);
      onFilesSelected(selected);
    },
    [onFilesSelected, uploadingFiles.length]
  );

  const canSend =
    (value.trim().length > 0 || completedUploads > 0) &&
    !isSending &&
    !disabled &&
    !isUploading;

  const canAttach = uploadingFiles.length < MAX_ATTACHMENTS_PER_MESSAGE && !disabled;

  return (
    <div
      className="relative flex flex-col bg-bg-primary border-t border-border pb-[env(safe-area-inset-bottom)]"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 드래그 앤 드롭 오버레이 */}
      {isDragOver && onFilesSelected && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-primary" />
            <p className="text-sm font-medium text-primary">파일을 놓으세요</p>
          </div>
        </div>
      )}

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
              className="w-11 h-11 flex items-center justify-center hover:bg-bg-tertiary rounded-full transition-colors flex-shrink-0"
              aria-label="답장 취소"
            >
              <X className="w-5 h-5 text-text-tertiary" />
            </button>
          )}
        </div>
      )}

      {/* 첨부파일 미리보기 바 */}
      {uploadingFiles.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto border-b border-border">
          {uploadingFiles.map((file) => (
            <div
              key={file.clientId}
              className="relative flex-shrink-0 group"
            >
              {/* 이미지 썸네일 or 파일 아이콘 */}
              {isImageType(file.file.type) ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.previewUrl}
                    alt={file.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-bg-secondary flex flex-col items-center justify-center gap-1">
                  <FileText className="w-5 h-5 text-text-tertiary" />
                  <span className="text-[9px] text-text-tertiary truncate max-w-[56px]">
                    {file.file.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
              )}

              {/* 업로드 진행률 오버레이 (원형 프로그레스) */}
              {file.status === "uploading" && (
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="2.5" />
                    <circle
                      cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="2.5"
                      strokeDasharray={`${file.progress * 0.9425} ${94.25 - file.progress * 0.9425}`}
                      strokeLinecap="round"
                      className="transition-[stroke-dasharray] duration-300"
                    />
                  </svg>
                  <span className="absolute text-[10px] text-white font-medium">{file.progress}%</span>
                </div>
              )}

              {/* 에러 표시 */}
              {file.status === "error" && (
                <div className="absolute inset-0 bg-error/20 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] text-error font-medium">실패</span>
                </div>
              )}

              {/* 제거 버튼 */}
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.clientId)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bg-primary border border-border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`${file.file.name} 제거`}
                >
                  <X className="w-3 h-3 text-text-secondary" />
                </button>
              )}

              {/* 파일 크기 */}
              <span className="absolute bottom-0.5 right-0.5 text-[8px] text-white bg-black/50 rounded px-0.5">
                {formatFileSize(file.file.size)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* 파일 첨부 버튼 */}
        {onFilesSelected && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canAttach}
              className={cn(
                "flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0 transition-colors",
                canAttach
                  ? "text-text-secondary hover:bg-bg-secondary active:bg-bg-tertiary"
                  : "text-text-tertiary opacity-50 cursor-not-allowed"
              )}
              aria-label="파일 첨부"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_FILE_TYPES.join(",")}
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
            />
          </>
        )}

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
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full resize-none rounded-2xl px-4 py-2.5 text-sm",
              "bg-bg-secondary text-text-primary placeholder:text-text-tertiary",
              "border border-transparent focus:border-primary focus:outline-none",
              "transition-[border-color,height] duration-150 ease-out",
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

        {/* 이모지 피커 버튼 */}
        <div className="relative">
          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={disabled}
            className={cn(
              "flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0 transition-colors",
              disabled
                ? "text-text-tertiary opacity-50 cursor-not-allowed"
                : showEmojiPicker
                  ? "text-primary bg-primary/10"
                  : "text-text-secondary hover:bg-bg-secondary active:bg-bg-tertiary"
            )}
            aria-label="이모지"
            aria-expanded={showEmojiPicker}
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* 이모지 퀵 패널 */}
          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              className={cn(
                "absolute bottom-full right-0 mb-2 w-[320px]",
                "bg-bg-primary border border-border rounded-xl shadow-lg",
                "overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
              )}
              role="dialog"
              aria-label="이모지 선택"
            >
              <div className="max-h-[240px] overflow-y-auto p-2 space-y-2">
                {EMOJI_SECTIONS.map((section) => (
                  <div key={section.label}>
                    <p className="text-[10px] text-text-tertiary font-medium px-1 mb-1">
                      {section.label}
                    </p>
                    <div className="grid grid-cols-8 gap-0.5">
                      {section.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-lg hover:bg-bg-secondary active:bg-bg-tertiary transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 전송 버튼 - 모바일 터치 타겟 44px */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0",
            "transition-all duration-200",
            canSend
              ? "bg-primary text-white hover:bg-primary-hover active:scale-95 scale-100"
              : "bg-bg-tertiary text-text-tertiary cursor-not-allowed scale-95"
          )}
        >
          <Send className={cn(
            "w-5 h-5 transition-transform duration-200",
            canSend ? "translate-x-0" : "-translate-x-0.5"
          )} />
        </button>
      </div>
    </div>
  );
}

export const ChatInput = memo(ChatInputComponent);
