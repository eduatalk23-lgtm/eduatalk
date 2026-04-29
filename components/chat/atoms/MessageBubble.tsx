"use client";

/**
 * MessageBubble - 채팅 메시지 버블
 *
 * 단일 채팅 메시지를 표시합니다.
 * 본인/타인 메시지에 따라 스타일이 달라집니다.
 */

import { memo, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { format, isValid } from "date-fns";
import { ko } from "date-fns/locale";

/** 안전한 날짜 포맷 (비정상 날짜 방어) */
function safeFormatDate(dateStr: string, pattern: string): string {
  const d = new Date(dateStr);
  if (!isValid(d)) return "";
  return format(d, pattern, { locale: ko });
}
import { Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/atoms/Avatar";
import type { ReactionSummary, ReactionEmoji, ReplyTargetInfo, ChatAttachment, ChatLinkPreview, MentionInfo } from "@/lib/domains/chat/types";
import { renderContentWithMentions } from "@/lib/domains/chat/renderMentions";
import { ReactionPills } from "./ReactionPills";
import { AttachmentRenderer } from "./AttachmentRenderer";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { useLongPress, type LongPressPosition } from "@/lib/hooks/useLongPress";
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
  | { type: "forward" }
  | { type: "togglePin" }
  | { type: "longPress"; position?: LongPressPosition }
  | { type: "avatarClick"; position?: LongPressPosition }
  | { type: "retry" }
  | { type: "removeFailed" }
  | { type: "imageClick"; attachment: ChatAttachment; index: number };

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
  /** 그룹 채팅 안 읽은 멤버 이름 — title tooltip 표시용 */
  unreadMemberNames?: string[];
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
  /** 첨부파일 목록 */
  attachments?: ChatAttachment[];
  /** 링크 프리뷰 목록 */
  linkPreviews?: ChatLinkPreview[];
  /** 발신자 ID (프로필 카드용) */
  senderId?: string;
  /** 발신자 유형 (프로필 카드용) */
  senderType?: "student" | "admin" | "parent";
  /** 발신자 프로필 이미지 URL */
  senderProfileImageUrl?: string | null;
  /** 멘션 정보 */
  mentions?: MentionInfo[];
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

/** 장문 텍스트 접기 기준 */
const LONG_TEXT_CHAR_LIMIT = 500;
const LONG_TEXT_LINE_LIMIT = 10;

/** 읽음 숫자 공통 스타일 */
const UNREAD_COUNT_CLASS = "text-2xs text-primary-600 dark:text-primary-400 font-semibold leading-tight";

/** unreadCount span — 그룹 채팅에서 unreadMemberNames 가 있으면 title tooltip 노출 */
function UnreadCountBadge({
  count,
  memberNames,
  className,
}: {
  count: number;
  memberNames?: string[];
  className?: string;
}) {
  const title =
    memberNames && memberNames.length > 0
      ? `안 읽음: ${memberNames.join(", ")}`
      : undefined;
  return (
    <span className={cn(UNREAD_COUNT_CLASS, className)} title={title}>
      {count}
    </span>
  );
}

/** 인라인 시간/상태 표시 (버블 옆, 카카오톡 스타일) */
function InlineTimeInfo({
  formattedTime,
  createdAt,
  isOwn,
  hasError,
  isQueued,
  isSending,
  isEdited,
  unreadCount,
  unreadMemberNames,
}: {
  formattedTime: string;
  createdAt: string;
  isOwn: boolean;
  hasError: boolean;
  isQueued: boolean;
  isSending: boolean;
  isEdited: boolean;
  unreadCount?: number;
  unreadMemberNames?: string[];
}) {
  // 에러/대기 시에는 시간 영역 숨김 (별도 UI로 표시)
  if (hasError || isQueued) return null;

  return (
    <div className="flex flex-col items-end justify-end gap-0.5 flex-shrink-0 self-end pb-1">
      {/* 안 읽은 인원수 (카카오톡: 메시지 옆 숫자) */}
      {isOwn && !isSending && unreadCount !== undefined && unreadCount > 0 && (
        <UnreadCountBadge count={unreadCount} memberNames={unreadMemberNames} />
      )}
      {/* 전송 중 표시 */}
      {isOwn && isSending && (
        <MessageStatusIndicator status="sending" className="w-3 h-3" />
      )}
      <time dateTime={createdAt} className="text-2xs text-text-secondary leading-tight">
        {formattedTime}
      </time>
      {isEdited && <span className="text-2xs text-text-secondary leading-tight">(수정됨)</span>}
    </div>
  );
}

/** 전송 실패 바텀시트 (카카오톡 스타일) */
function ErrorActionSheet({
  errorMessage,
  canRetry,
  onRetry,
  onDelete,
  onClose,
}: {
  errorMessage: string;
  canRetry: boolean;
  onRetry: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-bg-overlay animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative w-full max-w-md bg-bg-primary rounded-t-2xl",
          "animate-in fade-in slide-in-from-bottom-4 duration-200",
          "pb-[env(safe-area-inset-bottom)]"
        )}
        role="dialog"
        aria-label="메시지 전송 실패"
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-secondary-300" />
        </div>

        {/* 에러 메시지 */}
        <div className="px-5 py-3 text-center">
          <p className="text-sm text-error font-medium">{errorMessage}</p>
        </div>

        {/* 액션 버튼 */}
        <div className="px-4 pb-4 flex flex-col gap-2">
          {canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "w-full flex items-center justify-center gap-2",
                "py-3.5 rounded-xl",
                "bg-primary-500 text-white font-medium",
                "hover:bg-primary-500/90 active:bg-primary-500/80",
                "transition-colors"
              )}
            >
              <RotateCcw className="w-4.5 h-4.5" />
              재전송
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              "py-3.5 rounded-xl",
              "bg-bg-secondary text-error font-medium",
              "hover:bg-error/10 active:bg-error/20",
              "transition-colors"
            )}
          >
            <Trash2 className="w-4.5 h-4.5" />
            삭제
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-full py-3.5 rounded-xl",
              "text-text-secondary font-medium",
              "hover:bg-bg-secondary active:bg-bg-tertiary",
              "transition-colors"
            )}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
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
  permissions: _permissions = {},
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
    unreadMemberNames,
    reactions = [],
    replyTarget,
    isPinned: _isPinned = false,
    status,
    errorInfo,
    // 레거시 호환성 (deprecated)
    isError = false,
    isRetrying = false,
    attachments = [],
    linkPreviews = [],
    senderProfileImageUrl,
    mentions,
  } = message;

  // 상태 결정 (새 status 우선, 레거시 폴백)
  const derivedStatus: MessageDeliveryStatus | undefined = status
    ?? (isRetrying ? "sending" : undefined)
    ?? (isError ? "error" : undefined);

  // 에러 상태 여부 (UI 표시용)
  const hasError = derivedStatus === "error";
  const isSending = derivedStatus === "sending";
  const isQueued = derivedStatus === "queued";

  // 에러 메시지 결정 (상세 에러 정보가 있으면 사용, 아니면 기본 메시지)
  const errorMessage = errorInfo?.message ?? "전송 실패";
  const canRetryError = errorInfo?.canRetry ?? true;

  // 표시 옵션 추출 (isGrouped는 부모에서 간격 조절 + 꼬리 제거에 사용)
  const { showName = true, showTime = true, isGrouped = false } = displayOptions;

  // 장문 텍스트 접기/펼치기
  const [isExpanded, setIsExpanded] = useState(false);
  // 에러 바텀시트 표시
  const [showErrorSheet, setShowErrorSheet] = useState(false);
  const isLongText = !isDeleted && !isSystem && (
    content.length > LONG_TEXT_CHAR_LIMIT ||
    (content.match(/\n/g)?.length ?? 0) > LONG_TEXT_LINE_LIMIT
  );

  // 액션 디스패치 헬퍼
  const dispatch = useCallback(
    (action: MessageAction) => {
      onAction?.(action);
    },
    [onAction]
  );

  // Long press 핸들러 (모바일 터치 + 데스크톱 우클릭)
  const longPressHandlers = useLongPress({
    onLongPress: (position) => dispatch({ type: "longPress", position }),
    disabled: isSystem || !onAction,
  });

  // 스크린 리더용 메시지 요약 생성 (hook은 early return 전에 호출)
  const ariaLabel = useMemo(() => {
    const sender = isOwn ? "나" : senderName ?? "알 수 없음";
    const time = safeFormatDate(createdAt, "a h시 mm분");
    const statusText = hasError ? ", 전송 실패" : isSending ? ", 전송 중" : isQueued ? ", 대기 중" : "";
    return `${sender}의 메시지, ${time}${statusText}`;
  }, [isOwn, senderName, createdAt, hasError, isSending, isQueued]);

  // 시스템 메시지 (입장/퇴장 등)
  if (isSystem) {
    return (
      <div className="flex items-center justify-center py-3">
        <div className="flex items-center gap-3 w-full max-w-sm">
          {/* 왼쪽 선 */}
          <div className="flex-1 h-px bg-secondary-200" />
          {/* 시스템 메시지 텍스트 */}
          <span className="text-xs text-text-tertiary px-2 whitespace-nowrap">
            {content}
          </span>
          {/* 오른쪽 선 */}
          <div className="flex-1 h-px bg-secondary-200" />
        </div>
      </div>
    );
  }

  // 삭제된 메시지 (아바타 + 인라인 시간 적용)
  if (isDeleted) {
    const deletedTime = safeFormatDate(createdAt, "a h:mm");
    return (
      <div
        className={cn(
          "max-w-[80%] animate-in fade-in duration-300",
          isOwn ? "ml-auto" : "mr-auto"
        )}
      >
        <div className={cn("flex gap-2", isOwn && "justify-end")}>
          {/* 아바타 / 스페이서 (타인 메시지만) */}
          {!isOwn && (
            showName && senderName ? (
              <div className="w-8 flex-shrink-0 self-start">
                <Avatar src={senderProfileImageUrl} name={senderName} size="sm" />
              </div>
            ) : (
              <div className="w-8 flex-shrink-0" />
            )
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            {!isOwn && showName && senderName && (
              <span className="text-xs text-text-secondary pl-1">{senderName}</span>
            )}
            <div className={cn("flex items-end gap-1", isOwn && "flex-row-reverse")}>
              <div
                className={cn(
                  "px-4 py-2 rounded-2xl",
                  "bg-secondary-50",
                  "border border-secondary-200",
                  "text-text-tertiary italic text-sm",
                  isOwn ? "rounded-br-sm" : "rounded-bl-sm"
                )}
              >
                삭제된 메시지입니다
              </div>
              {showTime && deletedTime && (
                <span className="text-2xs text-text-secondary self-end pb-1 flex-shrink-0">
                  {deletedTime}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 시간 포맷 (절대 시간: "오후 3:45")
  const formattedTime = safeFormatDate(createdAt, "a h:mm");

  // 인라인 시간 props
  const timeProps = {
    formattedTime,
    createdAt,
    isOwn,
    hasError,
    isQueued,
    isSending,
    isEdited,
    unreadCount,
    unreadMemberNames,
  };

  return (
    <article
      {...longPressHandlers}
      className={cn(
        "group max-w-[80%]",
        isOwn ? "ml-auto" : "mr-auto"
      )}
      aria-label={ariaLabel}
    >
      <div className={cn("flex gap-2", isOwn && "justify-end")}>
        {/* 아바타 (타인 메시지만) */}
        {!isOwn && (
          showName && senderName ? (
            <button
              type="button"
              onClick={(e) => dispatch({ type: "avatarClick", position: { x: e.clientX, y: e.clientY } })}
              className="flex-shrink-0 self-start"
            >
              <Avatar src={senderProfileImageUrl} name={senderName} size="sm" />
            </button>
          ) : (
            <div className="w-8 flex-shrink-0" />
          )
        )}

        {/* 이름 + 버블 + 인라인 시간 */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {/* 발신자 이름 (타인 메시지, 그룹 첫 메시지) */}
          {!isOwn && showName && senderName && (
            <span className="text-xs text-text-secondary pl-1" aria-hidden="true">
              {senderName}
            </span>
          )}

          {/* 버블 + 인라인 시간 (가로 배치) */}
          <div className={cn("flex items-end gap-1", isOwn && "flex-row-reverse")}>
            {/* 메시지 버블 + 리액션 영역 */}
            <div className="relative flex flex-col gap-1 min-w-0">
              {/* 답장 원본 메시지 표시 */}
              {replyTarget && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "replyTargetClick" })}
                  className={cn(
                    "px-3 py-1.5 rounded-t-lg text-xs text-left cursor-pointer",
                    "bg-secondary-50",
                    "border-l-2 border-primary",
                    "hover:bg-secondary-100 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  )}
                >
                  <p className="font-medium text-primary">{replyTarget.senderName}</p>
                  <p className="text-text-secondary truncate max-w-full flex items-center gap-1">
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
                </button>
              )}

              {/* 메시지 버블 */}
              <div
                className={cn(
                  "rounded-2xl overflow-hidden",
                  isOwn
                    ? "bg-primary-500 dark:bg-primary-400 text-white"
                    : "bg-bg-secondary text-text-primary",
                  // 카카오톡 스타일 꼬리 — 그룹 메시지(연속 발신)에서는 제거
                  !isGrouped && (isOwn ? "rounded-br-sm" : "rounded-bl-sm"),
                  replyTarget && "rounded-t-none",
                  (hasError || isQueued) && "opacity-60"
                )}
              >
                {/* 첨부파일 (이미지/파일) */}
                {attachments.length > 0 && (
                  <div className={cn(content.trim() ? "p-1.5 pb-0" : "p-1.5")}>
                    <AttachmentRenderer
                      attachments={attachments}
                      isOwn={isOwn}
                      showSaveToDrive
                      onImageClick={(attachment, index) =>
                        dispatch({ type: "imageClick", attachment, index })
                      }
                    />
                  </div>
                )}

                {/* 텍스트 내용 (장문 접기 지원) */}
                {content.trim() && (
                  <div className="relative">
                    <div
                      className={cn(
                        "px-4 py-2 break-words whitespace-pre-wrap",
                        isLongText && !isExpanded && "max-h-[240px] overflow-hidden"
                      )}
                    >
                      {renderContentWithMentions(content, mentions, isOwn)}
                    </div>
                    {isLongText && !isExpanded && (
                      <div className="absolute bottom-0 left-0 right-0">
                        <div
                          className={cn(
                            "h-12",
                            isOwn
                              ? "bg-gradient-to-t from-primary-500 dark:from-primary-400 to-transparent"
                              : "bg-gradient-to-t from-secondary-100 to-transparent"
                          )}
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                          className={cn(
                            "w-full py-1.5 text-xs font-medium text-center transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                            isOwn
                              ? "bg-primary-500 dark:bg-primary-400 text-white/90 hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white focus-visible:ring-white/60"
                              : "bg-secondary-100 text-text-secondary hover:bg-secondary-200 hover:text-text-primary focus-visible:ring-primary"
                          )}
                        >
                          펼쳐보기
                        </button>
                      </div>
                    )}
                    {isLongText && isExpanded && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                        className={cn(
                          "w-full py-1.5 text-xs font-medium text-center transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                          isOwn
                            ? "text-white/90 hover:bg-white/10 hover:text-white focus-visible:ring-white/60"
                            : "text-text-secondary hover:bg-secondary-200/50 hover:text-text-primary focus-visible:ring-primary"
                        )}
                      >
                        접기
                      </button>
                    )}
                  </div>
                )}

                {/* 링크 프리뷰 */}
                {linkPreviews.length > 0 && (
                  <div className="px-2 pb-2 flex flex-col gap-1.5">
                    {linkPreviews.map((preview) => (
                      <LinkPreviewCard
                        key={preview.id}
                        preview={preview}
                        isOwn={isOwn}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 오프라인 대기 표시 */}
              {isOwn && isQueued && (
                <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                  <MessageStatusIndicator status="queued" className="w-3 h-3" />
                  <span>네트워크 연결 시 자동 전송</span>
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

            </div>

            {/* 전송 실패: 빨간 느낌표 (카카오톡 스타일, 버블 옆) */}
            {isOwn && hasError && (
              <button
                type="button"
                onClick={() => setShowErrorSheet(true)}
                className="flex-shrink-0 self-end pb-1 group/error"
                aria-label={`전송 실패: ${errorMessage}`}
              >
                <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center transition-transform group-active/error:scale-90">
                  <span className="text-white text-xs font-bold leading-none">!</span>
                </div>
              </button>
            )}

            {/* 읽음 숫자 (시간 숨겨져도 항상 표시) */}
            {!showTime && isOwn && !timeProps.isSending && !timeProps.hasError && !timeProps.isQueued && unreadCount !== undefined && unreadCount > 0 && (
              <UnreadCountBadge
                count={unreadCount}
                memberNames={unreadMemberNames}
                className="flex-shrink-0 self-end pb-1"
              />
            )}
            {/* 인라인 시간 (버블 옆) */}
            {showTime && <InlineTimeInfo {...timeProps} />}
          </div>
        </div>
      </div>

      {/* 전송 실패 바텀시트 */}
      {showErrorSheet && typeof document !== "undefined" && createPortal(
        <ErrorActionSheet
          errorMessage={errorMessage}
          canRetry={canRetryError}
          onRetry={() => { setShowErrorSheet(false); dispatch({ type: "retry" }); }}
          onDelete={() => { setShowErrorSheet(false); dispatch({ type: "removeFailed" }); }}
          onClose={() => setShowErrorSheet(false)}
        />,
        document.body
      )}
    </article>
  );
}

/** 커스텀 memo 비교: 인라인 객체 참조 변경에도 실제 값이 같으면 re-render 방지 */
function areMessageBubblePropsEqual(
  prev: MessageBubbleProps,
  next: MessageBubbleProps
): boolean {
  const pm = prev.message;
  const nm = next.message;

  if (
    pm.content !== nm.content ||
    pm.createdAt !== nm.createdAt ||
    pm.isOwn !== nm.isOwn ||
    pm.senderName !== nm.senderName ||
    pm.isSystem !== nm.isSystem ||
    pm.isDeleted !== nm.isDeleted ||
    pm.isEdited !== nm.isEdited ||
    pm.unreadCount !== nm.unreadCount ||
    pm.isPinned !== nm.isPinned ||
    pm.status !== nm.status ||
    pm.isError !== nm.isError ||
    pm.isRetrying !== nm.isRetrying ||
    pm.replyTarget?.id !== nm.replyTarget?.id ||
    pm.senderId !== nm.senderId ||
    pm.senderType !== nm.senderType ||
    pm.senderProfileImageUrl !== nm.senderProfileImageUrl
  )
    return false;

  // reactions 배열 값 비교
  const pr = pm.reactions ?? [];
  const nr = nm.reactions ?? [];
  if (pr.length !== nr.length) return false;
  for (let i = 0; i < pr.length; i++) {
    if (
      pr[i].emoji !== nr[i].emoji ||
      pr[i].count !== nr[i].count ||
      pr[i].hasReacted !== nr[i].hasReacted
    )
      return false;
  }

  // attachments 배열 값 비교
  const pa = pm.attachments ?? [];
  const na = nm.attachments ?? [];
  if (pa.length !== na.length) return false;
  for (let i = 0; i < pa.length; i++) {
    if (pa[i].id !== na[i].id) return false;
  }

  // linkPreviews 배열 값 비교
  const pl = pm.linkPreviews ?? [];
  const nl = nm.linkPreviews ?? [];
  if (pl.length !== nl.length) return false;
  for (let i = 0; i < pl.length; i++) {
    if (pl[i].id !== nl[i].id) return false;
  }

  // displayOptions 비교
  const pd = prev.displayOptions;
  const nd = next.displayOptions;
  if (
    pd?.showName !== nd?.showName ||
    pd?.showTime !== nd?.showTime ||
    pd?.isGrouped !== nd?.isGrouped
  )
    return false;

  // permissions 비교
  const pp = prev.permissions;
  const np = next.permissions;
  if (pp?.canEdit !== np?.canEdit || pp?.canPin !== np?.canPin) return false;

  // onAction은 항상 새 참조이므로 비교 스킵
  return true;
}

export const MessageBubble = memo(MessageBubbleComponent, areMessageBubblePropsEqual);
