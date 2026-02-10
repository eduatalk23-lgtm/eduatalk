"use client";

/**
 * ChatRoom - 채팅방 전체 뷰
 *
 * 메시지 목록 + 입력창을 포함합니다.
 * 비즈니스 로직은 useChatRoomLogic 훅으로 분리되어 있습니다.
 */

import { memo, useRef, useCallback, useMemo, useReducer, useEffect, useState } from "react";
import { useChatRoomLogic } from "@/lib/domains/chat/hooks";
import { useChatConnectionStatus } from "@/lib/hooks/useChatConnectionStatus";
import type { ReactionEmoji, ReplyTargetInfo } from "@/lib/domains/chat/types";
import { cn } from "@/lib/cn";
import { MessageBubble, type MessageAction, type MessageData } from "../atoms/MessageBubble";
import type { MessageDeliveryStatus } from "../atoms/MessageStatusIndicator";
import { DateDivider } from "../atoms/DateDivider";
import { TypingIndicator } from "../atoms/TypingIndicator";
import { OnlineStatus } from "../atoms/OnlineStatus";
import { ConnectionStatusIndicator } from "../atoms/ConnectionStatusIndicator";
import { MessageSkeleton } from "../atoms/MessageSkeleton";
import {
  ScreenReaderAnnouncer,
  formatNewMessageAnnouncement,
  formatTypingAnnouncement,
  formatConnectionAnnouncement,
} from "../atoms/ScreenReaderAnnouncer";
import { ChatInput } from "../molecules/ChatInput";
import { MessageSearch } from "../molecules/MessageSearch";
import { PinnedMessagesBar } from "../molecules/PinnedMessagesBar";
import { AnnouncementBanner } from "../atoms/AnnouncementBanner";
import { AnnouncementDialog } from "../molecules/AnnouncementDialog";
import { MessageContextMenu, type MessageMenuContext } from "../molecules/MessageContextMenu";
import { ChatRoomInfo } from "./ChatRoomInfo";
import { EditMessageDialog } from "../molecules/EditMessageDialog";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Loader2, ArrowLeft, MoreVertical, Search, Megaphone, ChevronDown, MessageSquareOff, RefreshCw } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { RetryableErrorBoundary, type ErrorFallbackProps } from "@/components/errors/RetryableErrorBoundary";

// ============================================
// UI 상태 타입 및 Reducer
// ============================================

interface ChatRoomUIState {
  // 스크롤 상태
  isAtBottom: boolean;
  hasNewMessages: boolean;
  firstItemIndex: number;
  // 모달/패널 상태
  isSearchMode: boolean;
  isAnnouncementDialogOpen: boolean;
  isMenuOpen: boolean;
  isInfoOpen: boolean;
  // 작업 대상
  menuContext: MessageMenuContext | null;
  deleteTarget: string | null;
  editingMessage: { id: string; content: string; updatedAt: string } | null;
}

type ChatRoomUIAction =
  | { type: "SET_AT_BOTTOM"; value: boolean }
  | { type: "SET_HAS_NEW_MESSAGES"; value: boolean }
  | { type: "SET_FIRST_ITEM_INDEX"; value: number }
  | { type: "DECREMENT_FIRST_ITEM_INDEX"; by: number }
  | { type: "SET_SEARCH_MODE"; value: boolean }
  | { type: "SET_ANNOUNCEMENT_DIALOG"; value: boolean }
  | { type: "SET_MENU_OPEN"; value: boolean }
  | { type: "SET_INFO_OPEN"; value: boolean }
  | { type: "SET_MENU_CONTEXT"; context: MessageMenuContext | null }
  | { type: "SET_DELETE_TARGET"; id: string | null }
  | { type: "SET_EDITING_MESSAGE"; message: { id: string; content: string; updatedAt: string } | null }
  | { type: "OPEN_CONTEXT_MENU"; context: MessageMenuContext }
  | { type: "CLOSE_MENU" };

const initialUIState: ChatRoomUIState = {
  isAtBottom: true,
  hasNewMessages: false,
  firstItemIndex: 10000,
  isSearchMode: false,
  isAnnouncementDialogOpen: false,
  isMenuOpen: false,
  isInfoOpen: false,
  menuContext: null,
  deleteTarget: null,
  editingMessage: null,
};

function uiReducer(state: ChatRoomUIState, action: ChatRoomUIAction): ChatRoomUIState {
  switch (action.type) {
    case "SET_AT_BOTTOM":
      return {
        ...state,
        isAtBottom: action.value,
        // 맨 아래로 스크롤하면 새 메시지 표시 해제
        hasNewMessages: action.value ? false : state.hasNewMessages,
      };
    case "SET_HAS_NEW_MESSAGES":
      return { ...state, hasNewMessages: action.value };
    case "SET_FIRST_ITEM_INDEX":
      return { ...state, firstItemIndex: action.value };
    case "DECREMENT_FIRST_ITEM_INDEX":
      return { ...state, firstItemIndex: state.firstItemIndex - action.by };
    case "SET_SEARCH_MODE":
      return { ...state, isSearchMode: action.value };
    case "SET_ANNOUNCEMENT_DIALOG":
      return { ...state, isAnnouncementDialogOpen: action.value };
    case "SET_MENU_OPEN":
      return { ...state, isMenuOpen: action.value };
    case "SET_INFO_OPEN":
      return { ...state, isInfoOpen: action.value };
    case "SET_MENU_CONTEXT":
      return { ...state, menuContext: action.context };
    case "SET_DELETE_TARGET":
      return { ...state, deleteTarget: action.id };
    case "SET_EDITING_MESSAGE":
      return { ...state, editingMessage: action.message };
    case "OPEN_CONTEXT_MENU":
      return { ...state, menuContext: action.context, isMenuOpen: true };
    case "CLOSE_MENU":
      return { ...state, isMenuOpen: false };
    default:
      return state;
  }
}

// ============================================
// 채팅 에러 Fallback 컴포넌트
// ============================================

function ChatErrorFallback({ error, errorType, resetError, isRetrying }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-bg-primary p-6 text-center">
      <MessageSquareOff className="w-12 h-12 text-text-tertiary mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        {errorType === "network" ? "연결이 끊어졌습니다" : "채팅을 불러올 수 없습니다"}
      </h3>
      <p className="text-sm text-text-secondary mb-6 max-w-xs">
        {errorType === "network"
          ? "인터넷 연결을 확인해주세요. 연결이 복구되면 자동으로 다시 시도합니다."
          : "일시적인 문제가 발생했습니다. 다시 시도해주세요."}
      </p>
      <button
        type="button"
        onClick={resetError}
        disabled={isRetrying}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
      >
        {isRetrying ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>재연결 중...</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            <span>다시 시도</span>
          </>
        )}
      </button>
      {process.env.NODE_ENV === "development" && error && (
        <details className="mt-4 text-left w-full max-w-md">
          <summary className="text-xs text-text-tertiary cursor-pointer">개발자 정보</summary>
          <pre className="mt-2 p-2 bg-secondary-100 dark:bg-secondary-800 rounded text-xs overflow-auto max-h-32">
            {error.toString()}
          </pre>
        </details>
      )}
    </div>
  );
}

interface ChatRoomProps {
  /** 채팅방 ID */
  roomId: string;
  /** 현재 사용자 ID */
  userId: string;
  /** 뒤로 가기 핸들러 */
  onBack?: () => void;
  /** 메뉴 버튼 클릭 핸들러 */
  onMenuClick?: () => void;
  /** 채팅 목록 경로 (기본값: /chat) - 나가기 시 이동 */
  basePath?: string;
  /** 헤더 우측에 추가할 액션 버튼 (Popover 등에서 닫기/전체화면 버튼 주입용) */
  headerActions?: React.ReactNode;
}

function ChatRoomComponent({
  roomId,
  userId,
  onBack,
  basePath = "/chat",
  headerActions,
}: ChatRoomProps) {
  // ============================================
  // UI 상태 (useReducer로 통합)
  // ============================================
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [uiState, dispatch] = useReducer(uiReducer, initialUIState);

  // 상태 구조 분해
  const {
    isAtBottom,
    hasNewMessages,
    firstItemIndex,
    isSearchMode,
    isAnnouncementDialogOpen,
    isMenuOpen,
    isInfoOpen,
    menuContext,
    deleteTarget,
    editingMessage,
  } = uiState;

  // Stale closure 방지: isAtBottom의 최신 값을 ref로 추적
  const isAtBottomRef = useRef(isAtBottom);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // 스크린 리더 알림 상태
  const [srAnnouncement, setSrAnnouncement] = useState<string | null>(null);
  const prevConnectionStatusRef = useRef<string | null>(null);

  // ============================================
  // 스크롤 핸들러
  // ============================================
  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      behavior: "smooth",
    });
  }, []);

  const handleAtBottomChange = useCallback((atBottom: boolean) => {
    dispatch({ type: "SET_AT_BOTTOM", value: atBottom });
  }, []);

  // ============================================
  // 비즈니스 로직 훅
  // ============================================
  const {
    data,
    permissions,
    actions,
    status,
    pinnedMessageIds,
    replyTargetState,
    utils,
  } = useChatRoomLogic({
    roomId,
    userId,
    isAtBottom,
    onNewMessageArrived: useCallback(() => {
      // isAtBottomRef를 사용하여 stale closure 방지
      if (isAtBottomRef.current) {
        scrollToBottom();
      } else {
        dispatch({ type: "SET_HAS_NEW_MESSAGES", value: true });
      }
    }, [scrollToBottom]),
  });

  const { room, messages, pinnedMessages, announcement, readCounts, onlineUsers, typingUsers, otherMemberLeft } = data;
  const { canPin, canSetAnnouncement } = permissions;

  // ============================================
  // 연결 상태
  // ============================================
  const {
    status: connectionStatus,
    pendingCount,
    retryCount,
    maxRetries,
    nextRetryIn,
    reconnect,
  } = useChatConnectionStatus(roomId);
  const { sendMessage, toggleReaction, togglePin, setAnnouncement, setTyping, retryMessage, removeFailedMessage } = actions;
  const { isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = status;
  const { replyTarget, setReplyTarget } = replyTargetState;
  const { canEditMessage, isMessageEdited } = utils;

  // ============================================
  // 스크린 리더 알림
  // ============================================

  // 연결 상태 변경 알림
  useEffect(() => {
    if (prevConnectionStatusRef.current !== null && prevConnectionStatusRef.current !== connectionStatus) {
      setSrAnnouncement(formatConnectionAnnouncement(connectionStatus));
    }
    prevConnectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  // 타이핑 상태 알림 (debounce 적용)
  const typingAnnouncementRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typingAnnouncementRef.current) {
      clearTimeout(typingAnnouncementRef.current);
    }

    if (typingUsers.length > 0) {
      // 1초 후에 타이핑 알림 (빠른 타이핑 시작/종료 무시)
      typingAnnouncementRef.current = setTimeout(() => {
        const announcement = formatTypingAnnouncement(typingUsers);
        if (announcement) {
          setSrAnnouncement(announcement);
        }
      }, 1000);
    }

    return () => {
      if (typingAnnouncementRef.current) {
        clearTimeout(typingAnnouncementRef.current);
      }
    };
  }, [typingUsers]);

  // ============================================
  // 사이드바 핸들러
  // ============================================
  const handleInfoOpen = useCallback(() => {
    dispatch({ type: "SET_INFO_OPEN", value: true });
  }, []);

  const handleInfoClose = useCallback(() => {
    dispatch({ type: "SET_INFO_OPEN", value: false });
  }, []);

  // ============================================
  // 무한 스크롤
  // ============================================
  const handleStartReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage().then(() => {
        // 페이지당 메시지 수 (50)로 인덱스 조정
        // Virtuoso가 스크롤 위치를 자동 보정하므로 정확하지 않아도 됨
        dispatch({ type: "DECREMENT_FIRST_ITEM_INDEX", by: 50 });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ============================================
  // 메시지 스크롤
  // ============================================
  const scrollToMessage = useCallback((messageId: string) => {
    dispatch({ type: "SET_SEARCH_MODE", value: false });
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      virtuosoRef.current?.scrollToIndex({
        index: firstItemIndex + index,
        behavior: "smooth",
        align: "center",
      });
      setTimeout(() => {
        const element = messageRefs.current.get(messageId);
        if (element) {
          element.classList.add("bg-warning/20");
          setTimeout(() => element.classList.remove("bg-warning/20"), 2000);
        }
      }, 300);
    }
  }, [messages, firstItemIndex]);

  // ============================================
  // 메시지 액션 핸들러
  // ============================================
  const handleReply = useCallback((message: { id: string; content: string; sender?: { name: string } | null; is_deleted?: boolean }) => {
    setReplyTarget({
      id: message.id,
      content: message.content,
      senderName: message.sender?.name ?? "알 수 없음",
      isDeleted: message.is_deleted ?? false,
    });
  }, [setReplyTarget]);

  const handleEdit = useCallback((messageId: string, currentContent: string, updatedAt: string) => {
    dispatch({ type: "SET_EDITING_MESSAGE", message: { id: messageId, content: currentContent, updatedAt } });
  }, []);

  const handleDelete = useCallback((messageId: string) => {
    dispatch({ type: "SET_DELETE_TARGET", id: messageId });
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      actions.deleteMessage(deleteTarget);
    }
    dispatch({ type: "SET_DELETE_TARGET", id: null });
  }, [deleteTarget, actions]);

  const handleEditSave = useCallback((newContent: string) => {
    if (editingMessage) {
      actions.editMessage(editingMessage.id, newContent, editingMessage.updatedAt);
    }
    dispatch({ type: "SET_EDITING_MESSAGE", message: null });
  }, [editingMessage, actions]);

  // ============================================
  // 컨텍스트 메뉴
  // ============================================
  const handleMessageLongPress = useCallback((message: (typeof messages)[number]) => {
    const isOwn = message.sender_id === userId;
    dispatch({
      type: "OPEN_CONTEXT_MENU",
      context: {
        messageId: message.id,
        content: message.content,
        updatedAt: message.updated_at,
        isOwn,
        canEdit: isOwn && canEditMessage(message.created_at),
        canPin: canPin && message.message_type !== "system",
        isPinned: pinnedMessageIds.has(message.id),
      },
    });
  }, [userId, canEditMessage, canPin, pinnedMessageIds]);

  const handleCopy = useCallback(async () => {
    if (menuContext) {
      await navigator.clipboard.writeText(menuContext.content);
    }
    dispatch({ type: "CLOSE_MENU" });
  }, [menuContext]);

  const handleMenuReply = useCallback(() => {
    if (menuContext) {
      const message = messages.find((m) => m.id === menuContext.messageId);
      if (message) handleReply(message);
    }
    dispatch({ type: "CLOSE_MENU" });
  }, [menuContext, messages, handleReply]);

  const handleMenuEdit = useCallback(() => {
    if (menuContext?.canEdit) {
      handleEdit(menuContext.messageId, menuContext.content, menuContext.updatedAt);
    }
    dispatch({ type: "CLOSE_MENU" });
  }, [menuContext, handleEdit]);

  const handleMenuDelete = useCallback(() => {
    if (menuContext?.isOwn) {
      handleDelete(menuContext.messageId);
    }
    dispatch({ type: "CLOSE_MENU" });
  }, [menuContext, handleDelete]);

  const handleMenuTogglePin = useCallback(() => {
    if (menuContext?.canPin) {
      togglePin(menuContext.messageId, menuContext.isPinned);
    }
    dispatch({ type: "CLOSE_MENU" });
  }, [menuContext, togglePin]);

  const handleMenuReaction = useCallback((emoji: ReactionEmoji) => {
    if (menuContext) {
      toggleReaction(menuContext.messageId, emoji);
    }
    dispatch({ type: "CLOSE_MENU" });
  }, [menuContext, toggleReaction]);

  // ============================================
  // 메시지 렌더링
  // ============================================
  const getRefCallback = useCallback((messageId: string) => (el: HTMLDivElement | null) => {
    if (el) messageRefs.current.set(messageId, el);
    else messageRefs.current.delete(messageId);
  }, []);

  // 메시지 액션 핸들러 의존성을 ref로 추적하여 안정적 참조 유지
  const actionDepsRef = useRef({
    toggleReaction, handleReply, scrollToMessage, handleEdit, handleDelete,
    togglePin, pinnedMessageIds, handleMessageLongPress, retryMessage, removeFailedMessage,
  });
  useEffect(() => {
    actionDepsRef.current = {
      toggleReaction, handleReply, scrollToMessage, handleEdit, handleDelete,
      togglePin, pinnedMessageIds, handleMessageLongPress, retryMessage, removeFailedMessage,
    };
  });

  // 안정적 참조: 의존성 변경에도 함수 참조가 바뀌지 않음
  const createMessageActionHandler = useCallback(
    (message: (typeof messages)[number]) =>
      (action: MessageAction) => {
        const deps = actionDepsRef.current;
        const messageReplyTarget = (message as { replyTarget?: ReplyTargetInfo | null }).replyTarget;

        switch (action.type) {
          case "toggleReaction":
            deps.toggleReaction(message.id, action.emoji);
            break;
          case "reply":
            deps.handleReply(message);
            break;
          case "replyTargetClick":
            if (messageReplyTarget?.id) {
              deps.scrollToMessage(messageReplyTarget.id);
            }
            break;
          case "edit":
            deps.handleEdit(message.id, message.content, message.updated_at);
            break;
          case "delete":
            deps.handleDelete(message.id);
            break;
          case "report":
            break;
          case "togglePin":
            deps.togglePin(message.id, deps.pinnedMessageIds.has(message.id));
            break;
          case "longPress":
            deps.handleMessageLongPress(message);
            break;
          case "retry":
            deps.retryMessage(message);
            break;
          case "removeFailed":
            deps.removeFailedMessage(message.id);
            break;
        }
      },
    []
  );

  const renderMessage = useCallback((_index: number, message: (typeof messages)[number]) => {
    const isOwn = message.sender_id === userId;
    const messageReplyTarget = (message as { replyTarget?: ReplyTargetInfo | null }).replyTarget;
    const messageStatus = (message as { status?: MessageDeliveryStatus }).status;
    const { grouping } = message;

    // 상태 결정: 전송 중이면 sending, 에러면 error, 그 외에는 sent
    // Note: delivered와 read는 서버에서 추적이 필요하므로 추후 구현
    const derivedStatus: MessageDeliveryStatus | undefined = isOwn
      ? messageStatus ?? (message.id.startsWith("temp-") ? "sending" : "sent")
      : undefined;

    // 메시지 데이터 구성
    const messageData: MessageData = {
      content: message.is_deleted ? "" : message.content,
      createdAt: message.created_at,
      isOwn,
      senderName: message.sender?.name,
      isSystem: message.message_type === "system",
      isDeleted: message.is_deleted,
      isEdited: isMessageEdited(message),
      unreadCount: isOwn ? readCounts[message.id] : undefined,
      reactions: (message as { reactions?: Array<{ emoji: ReactionEmoji; count: number; hasReacted: boolean }> }).reactions ?? [],
      replyTarget: messageReplyTarget,
      isPinned: pinnedMessageIds.has(message.id),
      status: derivedStatus,
      // 레거시 호환성 (deprecated - 추후 제거)
      isError: messageStatus === "error",
      isRetrying: messageStatus === "sending" && message.id.startsWith("temp-"),
    };

    return (
      <div
        ref={getRefCallback(message.id)}
        className="transition-colors duration-300"
      >
        {grouping.showDateDivider && grouping.dateDividerText && (
          <DateDivider date={grouping.dateDividerText} />
        )}

        <div className={cn("px-4", grouping.isGrouped ? "py-0.5" : "py-1.5")}>
          <MessageBubble
            message={messageData}
            displayOptions={{
              showName: grouping.showName,
              showTime: grouping.showTime,
              isGrouped: grouping.isGrouped,
            }}
            permissions={{
              canEdit: isOwn && canEditMessage(message.created_at),
              canPin: canPin && message.message_type !== "system",
            }}
            onAction={createMessageActionHandler(message)}
          />
        </div>
      </div>
    );
  }, [
    userId,
    readCounts,
    pinnedMessageIds,
    canPin,
    canEditMessage,
    isMessageEdited,
    getRefCallback,
    createMessageActionHandler,
  ]);

  const computeItemKey = useCallback((_index: number, message: (typeof messages)[number]) => message.id, []);

  const ScrollSeekPlaceholder = useCallback(({ height }: { height: number }) => (
    <div style={{ height }} className="px-4 py-1.5">
      <div className="bg-bg-secondary rounded-2xl animate-pulse" style={{ height: Math.max(height - 12, 40) }} />
    </div>
  ), []);

  // ============================================
  // 방 이름 결정
  // ============================================
  const roomName = useMemo(() => {
    if (!room) return "채팅";
    return room.type === "direct"
      ? data.members.find((m) => m.user_id !== userId)?.user?.name ?? "채팅"
      : room.name ?? `그룹 (${data.members.length}명)`;
  }, [room, data.members, userId]);

  // ============================================
  // 렌더링
  // ============================================
  return (
    <RetryableErrorBoundary
      fallback={ChatErrorFallback}
      autoRetryOnReconnect
      showHomeLink={false}
    >
      {/* 스크린 리더 알림 영역 */}
      <ScreenReaderAnnouncer message={srAnnouncement} politeness="polite" />

      <div
        className="relative flex flex-col h-full bg-bg-primary"
        role="region"
        aria-label={`${roomName} 채팅방`}
      >
        {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-primary">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-text-primary truncate">
              {roomName}
            </h2>
            {room?.type === "direct" && (
              <OnlineStatus isOnline={onlineUsers.length > 0} />
            )}
          </div>
          {room?.type === "group" && (
            <p className="text-xs text-text-tertiary">
              {onlineUsers.length > 0
                ? `${onlineUsers.length + 1}명 온라인`
                : `${data.members.length}명 참여 중`}
            </p>
          )}
        </div>

        {/* 연결 상태 표시 */}
        <ConnectionStatusIndicator
          status={connectionStatus}
          pendingCount={pendingCount}
          retryCount={retryCount}
          maxRetries={maxRetries}
          nextRetryIn={nextRetryIn}
          onReconnect={reconnect}
        />

        <button
          type="button"
          onClick={() => dispatch({ type: "SET_SEARCH_MODE", value: true })}
          className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
        >
          <Search className="w-5 h-5 text-text-secondary" />
        </button>

        {canSetAnnouncement && (
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_ANNOUNCEMENT_DIALOG", value: true })}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
            aria-label="공지 설정"
          >
            <Megaphone className="w-5 h-5 text-text-secondary" />
          </button>
        )}

        <button
          type="button"
          onClick={handleInfoOpen}
          className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
          aria-label="채팅방 정보"
        >
          <MoreVertical className="w-5 h-5 text-text-secondary" />
        </button>

        {headerActions}
      </div>

      {/* 공지 배너 */}
      {announcement && (
        <AnnouncementBanner
          announcement={announcement}
          canEdit={canSetAnnouncement}
          onEdit={() => dispatch({ type: "SET_ANNOUNCEMENT_DIALOG", value: true })}
          onDelete={() => {
            if (confirm("공지를 삭제하시겠습니까?")) {
              setAnnouncement(null);
            }
          }}
        />
      )}

      {/* 고정 메시지 바 */}
      {pinnedMessages.length > 0 && (
        <PinnedMessagesBar
          pinnedMessages={pinnedMessages}
          canUnpin={canPin}
          onMessageClick={scrollToMessage}
          onUnpin={(messageId) => {
            togglePin(messageId, true);
          }}
        />
      )}

      {/* 검색 모드 */}
      {isSearchMode && (
        <div className="absolute inset-0 z-20">
          <MessageSearch
            roomId={roomId}
            onClose={() => dispatch({ type: "SET_SEARCH_MODE", value: false })}
            onSelectMessage={scrollToMessage}
          />
        </div>
      )}

      {/* 메시지 목록 */}
      {isLoading ? (
        <div className="flex-1 overflow-y-auto">
          <MessageSkeleton count={5} />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-4">
          <MessageSquareOff className="w-10 h-10 text-text-tertiary" />
          <p className="text-text-secondary text-sm">
            메시지를 불러오지 못했습니다
          </p>
          <p className="text-text-tertiary text-xs max-w-xs">
            {error instanceof Error ? error.message : "네트워크 연결을 확인해주세요"}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            다시 시도
          </button>
        </div>
      ) : messages.length === 0 ? (
        <div
          className="flex-1 flex flex-col items-center justify-center text-center gap-1"
          role="log"
          aria-label="메시지 목록"
        >
          <p className="text-text-secondary text-sm">
            아직 메시지가 없습니다
          </p>
          <p className="text-text-tertiary text-xs">
            첫 메시지를 보내보세요!
          </p>
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col"
          role="log"
          aria-label="메시지 목록"
          aria-live="polite"
          aria-relevant="additions"
        >
          <Virtuoso
            ref={virtuosoRef}
            className="flex-1"
            data={messages}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={messages.length - 1}
            followOutput="smooth"
            atBottomStateChange={handleAtBottomChange}
            startReached={handleStartReached}
            computeItemKey={computeItemKey}
            increaseViewportBy={{ top: 200, bottom: 200 }}
            scrollSeekConfiguration={{
              enter: (velocity) => Math.abs(velocity) > 800,
              exit: (velocity) => Math.abs(velocity) < 100,
            }}
            components={{
              Header: () => (
                isFetchingNextPage ? (
                  <div className="flex justify-center py-2" aria-label="이전 메시지 로딩 중">
                    <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" aria-hidden="true" />
                  </div>
                ) : null
              ),
              ScrollSeekPlaceholder,
            }}
            itemContent={renderMessage}
          />
        </div>
      )}

      {/* 맨 아래로 스크롤 버튼 */}
      <div
        className={cn(
          "absolute right-4 z-10",
          "bottom-20 md:bottom-28",
          "transition-all duration-300 ease-out",
          isAtBottom
            ? "opacity-0 translate-y-4 pointer-events-none"
            : "opacity-100 translate-y-0"
        )}
      >
        <button
          type="button"
          onClick={scrollToBottom}
          className={cn(
            "relative flex items-center justify-center",
            "w-10 h-10 rounded-full",
            "bg-bg-primary border border-border shadow-lg",
            "hover:bg-bg-secondary transition-colors duration-200",
            "hover:scale-105 active:scale-95"
          )}
          aria-label="맨 아래로 스크롤"
        >
          <ChevronDown className="w-5 h-5 text-text-secondary" />

          {hasNewMessages && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-[10px] font-medium text-white bg-primary rounded-full">
              N
            </span>
          )}
        </button>
      </div>

      {/* 타이핑 인디케이터 */}
      <TypingIndicator users={typingUsers} />

      {/* 1:1 채팅 상대방 퇴장 안내 */}
      {otherMemberLeft && (
        <div className="flex justify-center px-4 py-2 bg-secondary-50 dark:bg-secondary-900/50 border-t border-secondary-200 dark:border-secondary-700">
          <span className="text-xs text-text-tertiary">
            상대방이 대화방을 나갔습니다. 메시지를 보내면 다시 초대됩니다.
          </span>
        </div>
      )}

      {/* 입력창 */}
      <ChatInput
        onSend={(content) => sendMessage(content, replyTarget?.id)}
        onTypingChange={setTyping}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        disabled={isLoading}
        placeholder={isLoading ? "메시지를 불러오는 중..." : undefined}
      />

      {/* 공지 설정 다이얼로그 */}
      <AnnouncementDialog
        open={isAnnouncementDialogOpen}
        onOpenChange={(open) => dispatch({ type: "SET_ANNOUNCEMENT_DIALOG", value: open })}
        currentContent={announcement?.content}
        onSave={(content) => {
          setAnnouncement(content);
          dispatch({ type: "SET_ANNOUNCEMENT_DIALOG", value: false });
        }}
        isSaving={false}
      />

      {/* 메시지 컨텍스트 메뉴 */}
      <MessageContextMenu
        isOpen={isMenuOpen}
        onClose={() => dispatch({ type: "CLOSE_MENU" })}
        context={menuContext}
        onCopy={handleCopy}
        onReply={handleMenuReply}
        onEdit={menuContext?.canEdit ? handleMenuEdit : undefined}
        onDelete={menuContext?.isOwn ? handleMenuDelete : undefined}
        onTogglePin={menuContext?.canPin ? handleMenuTogglePin : undefined}
        onToggleReaction={handleMenuReaction}
      />

      {/* 채팅방 정보 사이드바 */}
      <ChatRoomInfo
        isOpen={isInfoOpen}
        onClose={handleInfoClose}
        roomId={roomId}
        userId={userId}
        room={room}
        members={data.members}
        isLoading={!room}
        basePath={basePath}
      />

        {/* 메시지 삭제 확인 */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && dispatch({ type: "SET_DELETE_TARGET", id: null })}
          title="메시지 삭제"
          description="이 메시지를 삭제하시겠습니까?"
          confirmLabel="삭제"
          cancelLabel="취소"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
          isLoading={status.isDeleting}
        />

        {/* 메시지 수정 */}
        <EditMessageDialog
          open={!!editingMessage}
          onOpenChange={(open) => !open && dispatch({ type: "SET_EDITING_MESSAGE", message: null })}
          currentContent={editingMessage?.content ?? ""}
          onSave={handleEditSave}
          isSaving={status.isEditing}
        />
      </div>
    </RetryableErrorBoundary>
  );
}

export const ChatRoom = memo(ChatRoomComponent);
