"use client";

/**
 * ChatInput - 메시지 입력 컴포넌트
 *
 * 레이아웃: [+첨부] [textarea] [전송] — 모든 화면 크기 동일
 * 예약 전송: + 메뉴에서 접근
 * 이모지: OS 키보드 이모지 사용
 * 드래그 앤 드롭 파일 업로드 지원
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Send, X, Paperclip, FileText, Upload, Plus, Camera, ImageIcon, RotateCw, Clock, Calendar } from "lucide-react";
import type { ReplyTargetInfo, UploadingAttachment, MentionInfo, ChatRoomMemberWithUser } from "@/lib/domains/chat/types";
import { ALLOWED_FILE_TYPES, ALLOWED_IMAGE_TYPES, MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/domains/chat/types";
import { formatFileSize, isImageType } from "@/lib/domains/chat/fileValidation";
import type { StorageQuotaInfo } from "@/lib/domains/chat/quota";
import { MentionPicker } from "./MentionPicker";
import { StorageQuotaBar } from "./StorageQuotaBar";

/** textarea 최대 높이 (약 7줄, 업계 표준 150-200px 범위) */
const TEXTAREA_MAX_HEIGHT = 160;

interface ChatInputProps {
  /** 채팅방 ID (draft 저장용) */
  roomId?: string;
  /** 메시지 전송 핸들러 */
  onSend: (content: string, mentions?: MentionInfo[]) => void;
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
  /** 파일 업로드 재시도 핸들러 */
  onRetryFile?: (clientId: string) => void;
  /** 마운트 시 자동 포커스 */
  autoFocus?: boolean;
  /** 채팅방 멤버 목록 (멘션용) */
  members?: ChatRoomMemberWithUser[];
  /** 현재 사용자 ID (멘션 목록에서 본인 제외) */
  currentUserId?: string;
  /** 예약 전송 핸들러 (제공 시 전송 버튼에 드롭다운 추가) */
  onScheduleSend?: (content: string, scheduledAt: Date, mentions?: MentionInfo[]) => void;
  /** 사용자 스토리지 쿼터 (>=70% 또는 첨부 큐 존재 시 표시) */
  storageQuota?: StorageQuotaInfo | null;
}

/** sessionStorage key prefix for chat drafts */
const DRAFT_KEY_PREFIX = "chat-draft:";

function ChatInputComponent({
  roomId,
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
  onRetryFile,
  autoFocus = false,
  members = [],
  currentUserId,
  onScheduleSend,
  storageQuota,
}: ChatInputProps) {
  const [value, setValue] = useState(() => {
    if (!roomId) return "";
    try {
      return sessionStorage.getItem(`${DRAFT_KEY_PREFIX}${roomId}`) ?? "";
    } catch {
      return "";
    }
  });
  const [isComposing, setIsComposing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionInfo[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const dragCounterRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** @ 기호가 시작된 위치 */
  const mentionStartRef = useRef<number>(-1);

  // Draft 저장 (300ms debounce)
  useEffect(() => {
    if (!roomId) return;
    const key = `${DRAFT_KEY_PREFIX}${roomId}`;
    const timer = setTimeout(() => {
      try {
        if (value) {
          sessionStorage.setItem(key, value);
        } else {
          sessionStorage.removeItem(key);
        }
      } catch { /* quota exceeded — ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, roomId]);

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


  // 첨부 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!showAttachMenu) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(e.target as Node) &&
        attachButtonRef.current &&
        !attachButtonRef.current.contains(e.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAttachMenu]);

  const completedUploads = uploadingFiles.filter((f) => f.status === "done").length;
  const isUploading = uploadingFiles.some((f) => f.status === "uploading" || f.status === "pending");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && completedUploads === 0) || isSending || disabled || isUploading) return;

    onSend(trimmed, mentions.length > 0 ? mentions : undefined);
    // 전송 시 짧은 햅틱 피드백 (모바일)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(30); } catch { /* ignore */ }
    }
    setValue("");
    // Draft 삭제
    if (roomId) {
      try { sessionStorage.removeItem(`${DRAFT_KEY_PREFIX}${roomId}`); } catch { /* ignore */ }
    }
    setMentions([]);
    setMentionQuery(null);
    onTypingChange?.(false);

    // 높이 초기화
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, completedUploads, isSending, disabled, isUploading, onSend, onTypingChange, mentions, roomId]);

  const handleSchedule = useCallback((scheduledAt: Date) => {
    const trimmed = value.trim();
    if ((!trimmed && completedUploads === 0) || !onScheduleSend || isSending || disabled) return;

    onScheduleSend(trimmed, scheduledAt, mentions.length > 0 ? mentions : undefined);
    setValue("");
    if (roomId) {
      try { sessionStorage.removeItem(`${DRAFT_KEY_PREFIX}${roomId}`); } catch { /* ignore */ }
    }
    setMentions([]);
    setMentionQuery(null);
    onTypingChange?.(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, completedUploads, onScheduleSend, isSending, disabled, mentions, roomId, onTypingChange]);

  // 한글 IME 조합 이벤트 핸들러
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 멘션 피커가 열려있으면 Enter/Tab/ArrowDown/ArrowUp 가로채기 방지
      // (MentionPicker에서 document keydown으로 처리)
      if (mentionQuery !== null && ["Enter", "Tab", "ArrowDown", "ArrowUp", "Escape"].includes(e.key)) {
        return;
      }
      // Enter로 전송 (Shift+Enter는 줄바꿈, 한글 조합 중에는 전송 방지)
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isComposing, mentionQuery]
  );


  // 멘션 트리거 감지 (텍스트 변경 시)
  const detectMention = useCallback(
    (text: string, cursorPos: number) => {
      if (members.length === 0 || !currentUserId) {
        setMentionQuery(null);
        return;
      }

      // 커서 위치에서 역방향으로 @ 찾기
      const textBeforeCursor = text.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf("@");

      if (atIndex === -1) {
        setMentionQuery(null);
        return;
      }

      // @ 앞이 공백이거나 텍스트 시작이어야 함
      if (atIndex > 0 && !/\s/.test(textBeforeCursor[atIndex - 1])) {
        setMentionQuery(null);
        return;
      }

      // @ 이후 텍스트에 공백이 포함되어 있으면 멘션 종료
      const queryText = textBeforeCursor.slice(atIndex + 1);
      if (queryText.includes("\n")) {
        setMentionQuery(null);
        return;
      }

      mentionStartRef.current = atIndex;
      setMentionQuery(queryText);
    },
    [members.length, currentUserId]
  );

  // 멘션 선택 핸들러
  const handleMentionSelect = useCallback(
    (member: ChatRoomMemberWithUser) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const atIndex = mentionStartRef.current;
      if (atIndex === -1) return;

      const mentionText = `@${member.user.name} `;
      const before = value.slice(0, atIndex);
      const after = value.slice(textarea.selectionStart);
      const newValue = before + mentionText + after;

      setValue(newValue.slice(0, maxLength));
      setMentionQuery(null);
      mentionStartRef.current = -1;

      // 중복 멘션 방지
      const alreadyMentioned = mentions.some(
        (m) => m.userId === member.user_id && m.userType === member.user_type
      );
      if (!alreadyMentioned) {
        setMentions((prev) => [
          ...prev,
          {
            userId: member.user_id,
            userType: member.user_type,
            name: member.user.name,
          },
        ]);
      }

      // 커서 위치 조정
      requestAnimationFrame(() => {
        const newPos = atIndex + mentionText.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
        textarea.focus();
      });
    },
    [value, maxLength, mentions]
  );

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

  // 클립보드 파일 붙여넣기 (이미지 + 일반 파일)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        const remaining = MAX_ATTACHMENTS_PER_MESSAGE - uploadingFiles.length;
        // addFiles에서 MIME 타입 검증 → 미지원 파일은 에러 토스트 표시
        onFilesSelected?.(pastedFiles.slice(0, remaining));
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
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary-500/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-primary" />
            <p className="text-sm font-medium text-primary">파일을 놓으세요</p>
          </div>
        </div>
      )}

      {/* 답장 대상 표시 */}
      {replyTarget && (
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-border">
          <div className="w-1 h-8 bg-primary-500 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary font-medium">{replyTarget.senderName}에게 답장</p>
            <p className="text-xs text-text-secondary truncate flex items-center gap-1">
              {replyTarget.isDeleted ? "삭제된 메시지" : (
                <>
                  {replyTarget.attachmentType && (
                    <span className="flex-shrink-0" aria-hidden="true">
                      {replyTarget.attachmentType === "image" ? "🖼️" : "📎"}
                    </span>
                  )}
                  {replyTarget.content || (
                    replyTarget.attachmentType === "image" ? "사진"
                    : replyTarget.attachmentType === "file" ? "파일"
                    : replyTarget.attachmentType === "mixed" ? "사진, 파일"
                    : ""
                  )}
                </>
              )}
            </p>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="w-11 h-11 flex items-center justify-center hover:bg-bg-tertiary rounded-full transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              aria-label="답장 취소"
            >
              <X className="w-5 h-5 text-text-tertiary" />
            </button>
          )}
        </div>
      )}

      {/* 스토리지 쿼터 바 — 첨부 큐 존재 시 또는 사용량 ≥70% */}
      {storageQuota &&
        (uploadingFiles.length > 0 || storageQuota.usagePercent >= 70) && (
          <StorageQuotaBar
            quota={storageQuota}
            className="border-b border-border bg-bg-primary"
          />
        )}

      {/* 첨부파일 미리보기 바 */}
      {uploadingFiles.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto border-b border-border bg-bg-primary shadow-sm [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          {uploadingFiles.map((file) => (
            <div
              key={file.clientId}
              className="relative flex-shrink-0 group"
            >
              {/* 이미지 썸네일 or 파일 아이콘 */}
              {isImageType(file.file.type) ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-bg-secondary border border-border/30">
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
                <div
                  className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center"
                  role="progressbar"
                  aria-valuenow={file.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${file.file.name} 업로드 중 ${file.progress}%`}
                >
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="2.5" />
                    <circle
                      cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="2.5"
                      strokeDasharray={`${file.progress * 0.9425} ${94.25 - file.progress * 0.9425}`}
                      strokeLinecap="round"
                      className="transition-[stroke-dasharray] duration-300"
                    />
                  </svg>
                  <span className="absolute text-[10px] text-white font-medium" aria-hidden="true">{file.progress}%</span>
                </div>
              )}

              {/* 에러 표시 + 재시도 */}
              {file.status === "error" && (
                <div className="absolute inset-0 bg-error/20 rounded-lg flex flex-col items-center justify-center gap-0.5">
                  <span className="text-[9px] text-error font-medium text-center px-1 line-clamp-1">
                    실패
                  </span>
                  {onRetryFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryFile(file.clientId);
                      }}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-error/80 text-white text-[9px] font-medium hover:bg-error transition-colors"
                      aria-label={`${file.file.name} 재시도`}
                    >
                      <RotateCw className="w-2.5 h-2.5" />
                      재시도
                    </button>
                  )}
                </div>
              )}

              {/* 제거 버튼 */}
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.clientId)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bg-primary border border-border rounded-full flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  aria-label={`${file.file.name} 제거`}
                >
                  <X className="w-3 h-3 text-text-secondary" />
                </button>
              )}

              {/* 파일 크기 */}
              <span className="absolute bottom-0.5 right-0.5 text-[10px] text-white bg-black/60 rounded px-0.5">
                {formatFileSize(file.file.size)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 px-2 py-2 sm:gap-2 sm:px-3 sm:py-3">
        {/* 첨부 메뉴 */}
        {onFilesSelected && (
          <div className="relative">
            <button
              ref={attachButtonRef}
              type="button"
              onClick={() => setShowAttachMenu((prev) => !prev)}
              disabled={!canAttach}
              className={cn(
                "flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full flex-shrink-0 transition-[color,background-color,transform] duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                canAttach
                  ? showAttachMenu
                    ? "text-primary bg-primary-500/10 rotate-45"
                    : "text-text-secondary hover:bg-bg-secondary active:bg-bg-tertiary rotate-0"
                  : "text-text-tertiary opacity-50 cursor-not-allowed"
              )}
              aria-label="첨부"
              aria-expanded={showAttachMenu}
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* 첨부 옵션 메뉴 */}
            {showAttachMenu && (
              <div
                ref={attachMenuRef}
                className={cn(
                  "absolute bottom-full left-0 mb-2",
                  "bg-bg-primary border border-border rounded-xl shadow-lg",
                  "overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150",
                  "min-w-[140px]"
                )}
                role="menu"
                aria-label="첨부 옵션"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowAttachMenu(false);
                    cameraInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  <Camera className="w-5 h-5 text-text-secondary" />
                  카메라
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowAttachMenu(false);
                    galleryInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-text-secondary" />
                  갤러리
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowAttachMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  <Paperclip className="w-5 h-5 text-text-secondary" />
                  파일
                </button>
              </div>
            )}

            {/* 카메라 전용 input (capture로 카메라 직접 실행) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
            />
            {/* 갤러리 전용 input (이미지만 필터) */}
            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
            />
            {/* 파일 전용 input (모든 허용 타입) */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_FILE_TYPES.join(",")}
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
            />
          </div>
        )}

        {/* 텍스트 입력 */}
        <div className="flex-1 relative">
          {/* 멘션 피커 */}
          {mentionQuery !== null && currentUserId && (
            <MentionPicker
              members={members}
              query={mentionQuery}
              currentUserId={currentUserId}
              onSelect={handleMentionSelect}
              onClose={() => {
                setMentionQuery(null);
                mentionStartRef.current = -1;
              }}
            />
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              const newValue = e.target.value.slice(0, maxLength);
              setValue(newValue);
              onTypingChange?.(newValue.length > 0);
              detectMention(newValue, e.target.selectionStart);
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full resize-none rounded-2xl px-3 py-2 text-base sm:px-4 sm:py-2.5",
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

        {/* 전송 버튼 — 탭: 즉시 전송 / 길게 누르기: 예약 드롭다운 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (showSchedulePanel) {
                setShowSchedulePanel(false);
                return;
              }
              handleSubmit();
            }}
            onPointerDown={() => {
              if (showSchedulePanel) return;
              if (!onScheduleSend || !canSend) return;
              longPressTimerRef.current = setTimeout(() => {
                longPressTimerRef.current = null;
                setShowSchedulePanel(true);
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                  try { navigator.vibrate(50); } catch { /* ignore */ }
                }
              }, 500);
            }}
            onPointerUp={() => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
            }}
            onPointerLeave={() => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
            }}
            disabled={!canSend}
            className={cn(
              "flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full flex-shrink-0",
              "transition-[background-color,transform] duration-200 select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              canSend
                ? "bg-primary-500 text-white hover:bg-primary-600 active:scale-95 scale-100"
                : "bg-secondary-200 text-text-tertiary cursor-not-allowed scale-95"
            )}
            aria-label={onScheduleSend ? "전송 (길게 눌러서 예약)" : "전송"}
          >
            <Send className={cn(
              "w-5 h-5 transition-transform duration-200",
              canSend ? "translate-x-0" : "-translate-x-0.5"
            )} />
          </button>

          {/* 예약 전송 드롭다운 (+ 메뉴와 동일한 팝업 스타일) */}
          {showSchedulePanel && onScheduleSend && (
            <ScheduleDropdown
              onSchedule={(date) => {
                handleSchedule(date);
                setShowSchedulePanel(false);
              }}
              onClose={() => setShowSchedulePanel(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** 예약 전송 드롭다운 — 전송 버튼 위 팝업 (+ 메뉴와 동일 스타일) */
function ScheduleDropdown({
  onSchedule,
  onClose,
}: {
  onSchedule: (date: Date) => void;
  onClose: () => void;
}) {
  const [customValue, setCustomValue] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const now = new Date();

  // 빠른 선택 옵션
  const quickOptions: Array<{ label: string; date: Date }> = [];

  const today18 = new Date(now);
  today18.setHours(18, 0, 0, 0);
  if (today18.getTime() > now.getTime() + 60_000) {
    quickOptions.push({ label: "오늘 오후 6:00", date: today18 });
  }

  const tomorrow9 = new Date(now);
  tomorrow9.setDate(tomorrow9.getDate() + 1);
  tomorrow9.setHours(9, 0, 0, 0);
  quickOptions.push({ label: "내일 오전 9:00", date: tomorrow9 });

  const tomorrow18 = new Date(now);
  tomorrow18.setDate(tomorrow18.getDate() + 1);
  tomorrow18.setHours(18, 0, 0, 0);
  quickOptions.push({ label: "내일 오후 6:00", date: tomorrow18 });

  // 외부 클릭 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleCustomSubmit = () => {
    if (!customValue) return;
    const date = new Date(customValue);
    if (isNaN(date.getTime())) return;
    if (date.getTime() < Date.now() + 60_000) return;
    if (date.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) return;
    onSchedule(date);
  };

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "absolute bottom-full right-0 mb-2",
        "bg-bg-primary border border-border rounded-xl shadow-lg",
        "overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150",
        "min-w-[200px] w-64 z-50"
      )}
      role="menu"
      aria-label="예약 전송"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Clock className="w-4 h-4 text-text-secondary" />
        <span className="text-sm font-medium text-text-primary">예약 전송</span>
      </div>

      {/* 빠른 선택 */}
      <div className="py-1">
        {quickOptions.map((opt) => (
          <button
            key={opt.label}
            type="button"
            role="menuitem"
            onClick={() => onSchedule(opt.date)}
            className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary active:bg-bg-tertiary transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="border-t border-border" />

      {/* 커스텀 시간 */}
      {!showCustom ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setShowCustom(true);
            if (!customValue) {
              const d = new Date(now);
              d.setDate(d.getDate() + 1);
              d.setHours(9, 0, 0, 0);
              setCustomValue(fmt(d));
            }
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-primary-600 hover:bg-bg-secondary transition-colors"
        >
          <Calendar className="w-4 h-4" />
          날짜 및 시간 선택
        </button>
      ) : (
        <div className="px-4 py-3 flex flex-col gap-2">
          <input
            type="datetime-local"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            min={fmt(new Date(Date.now() + 2 * 60_000))}
            max={fmt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}
            className="w-full px-3 py-2 text-sm rounded-lg bg-bg-secondary border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customValue}
            className={cn(
              "w-full py-2 text-sm font-medium rounded-lg transition-colors",
              customValue
                ? "bg-primary-500 text-white hover:bg-primary-600"
                : "bg-secondary-200 text-text-tertiary cursor-not-allowed"
            )}
          >
            예약하기
          </button>
        </div>
      )}
    </div>
  );
}

export const ChatInput = memo(ChatInputComponent);
