"use client";

/**
 * ChatRoom - 채팅방 전체 뷰
 *
 * 메시지 목록 + 입력창을 포함합니다.
 * 비즈니스 로직은 useChatRoomLogic 훅으로 분리되어 있습니다.
 */

import { memo, useRef, useCallback, useMemo, useReducer, useEffect, useState, forwardRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatRoomLogic } from "@/lib/domains/chat/hooks";
import { useChatConnectionStatus } from "@/lib/hooks/useChatConnectionStatus";
import { useVisualViewport } from "@/lib/hooks/useVisualViewport";
import { setCurrentChatRoom } from "@/lib/realtime/useAppPresence";
import { useChatLayout } from "@/components/chat/layouts/ChatLayoutContext";
import type { ReactionEmoji, ReplyTargetInfo, ChatAttachment, ChatUserType, ChatUser, ChatMessageWithGrouping } from "@/lib/domains/chat/types";
import type { LongPressPosition } from "@/lib/hooks/useLongPress";
import { cn } from "@/lib/cn";
import { MessageBubble, type MessageAction, type MessageData, type MessageDisplayOptions, type MessagePermissions } from "../atoms/MessageBubble";
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
import { ImageLightbox } from "../molecules/ImageLightbox";
import { MessageSearch } from "../molecules/MessageSearch";
import { PinnedMessagesBar } from "../molecules/PinnedMessagesBar";
import { AnnouncementBanner } from "../atoms/AnnouncementBanner";
import { AnnouncementDialog } from "../molecules/AnnouncementDialog";
import { MessageContextMenu, type MessageMenuContext } from "../molecules/MessageContextMenu";
import { MessageReadersModal } from "../molecules/MessageReadersModal";
import { ChatRoomInfo } from "./ChatRoomInfo";
import { EditMessageDialog } from "../molecules/EditMessageDialog";
import { ProfileCardPopup, type ProfileCardData } from "../molecules/ProfileCardPopup";
import { ForwardModal } from "../molecules/ForwardModal";
import { ScheduledMessagesPanel } from "../molecules/ScheduledMessagesPanel";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Loader2, ArrowLeft, MoreVertical, Search, Megaphone, ChevronDown, MessageSquareOff, RefreshCw, Bell, BellOff, CalendarClock } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { RetryableErrorBoundary, type ErrorFallbackProps } from "@/components/errors/RetryableErrorBoundary";
import { toggleMuteChatRoomAction } from "@/lib/domains/chat/actions";
import { scheduleMessageAction } from "@/lib/domains/chat/scheduled/actions";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { useToast } from "@/components/ui/ToastProvider";

// Virtuoso prepend용 시작 인덱스 (충분히 큰 값)
const FIRST_ITEM_INDEX_BASE = 10_000;

// 메시지 타입별 높이 추정 (Virtuoso는 측정 후 캐싱하므로, 미측정 아이템의 초기 추정에만 사용)
const ESTIMATED_HEIGHTS: Record<string, number> = {
  text: 72,
  image: 220,
  file: 64,
  mixed: 240,
  video: 200,
  audio: 80,
  system: 40,
};
const DEFAULT_ITEM_HEIGHT = 80;

// ============================================
// 디바이스 적응형 Virtuoso 설정
// deviceMemory / hardwareConcurrency 기반 3-tier 분류
// ============================================
type DeviceTier = "low" | "mid" | "high";

function getDeviceTier(): DeviceTier {
  if (typeof navigator === "undefined") return "mid";
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (memory <= 2 || cores <= 2) return "low";
  if (memory >= 8 && cores >= 8) return "high";
  return "mid";
}

const DEVICE_TIER = getDeviceTier();

const VIEWPORT_BUFFER: Record<DeviceTier, { top: number; bottom: number }> = {
  low:  { top: 600,  bottom: 300 },
  mid:  { top: 1500, bottom: 800 },
  high: { top: 2500, bottom: 1200 },
};

const SCROLL_SEEK_ENTER: Record<DeviceTier, number> = {
  low: 500, mid: 800, high: 1200,
};

const SCROLL_SEEK_EXIT: Record<DeviceTier, number> = {
  low: 80, mid: 100, high: 150,
};

// ============================================
// UI 상태 타입 및 Reducer
// ============================================

interface ChatRoomUIState {
  // 스크롤 상태
  isAtBottom: boolean;
  newMessageCount: number;
  // 모달/패널 상태
  isSearchMode: boolean;
  isAnnouncementDialogOpen: boolean;
  isMenuOpen: boolean;
  isInfoOpen: boolean;
  isScheduledPanelOpen: boolean;
  isHeaderMenuOpen: boolean;
  // 작업 대상
  menuContext: MessageMenuContext | null;
  menuPosition: LongPressPosition | null;
  deleteTarget: string | null;
  editingMessage: { id: string; content: string; updatedAt: string } | null;
  profileCardTarget: ProfileCardData | null;
  profileCardPosition: LongPressPosition | null;
}

type ChatRoomUIAction =
  | { type: "SET_AT_BOTTOM"; value: boolean }
  | { type: "INCREMENT_NEW_MESSAGES" }
  | { type: "RESET_NEW_MESSAGES" }
  | { type: "SET_SEARCH_MODE"; value: boolean }
  | { type: "SET_ANNOUNCEMENT_DIALOG"; value: boolean }
  | { type: "SET_MENU_OPEN"; value: boolean }
  | { type: "SET_INFO_OPEN"; value: boolean }
  | { type: "SET_SCHEDULED_PANEL_OPEN"; value: boolean }
  | { type: "SET_HEADER_MENU_OPEN"; value: boolean }
  | { type: "SET_MENU_CONTEXT"; context: MessageMenuContext | null }
  | { type: "SET_DELETE_TARGET"; id: string | null }
  | { type: "SET_EDITING_MESSAGE"; message: { id: string; content: string; updatedAt: string } | null }
  | { type: "SET_PROFILE_CARD"; target: ProfileCardData | null; position?: LongPressPosition }
  | { type: "OPEN_CONTEXT_MENU"; context: MessageMenuContext; position?: LongPressPosition }
  | { type: "CLOSE_MENU" };

const initialUIState: ChatRoomUIState = {
  isAtBottom: true,
  newMessageCount: 0,
  isSearchMode: false,
  isAnnouncementDialogOpen: false,
  isMenuOpen: false,
  isInfoOpen: false,
  isScheduledPanelOpen: false,
  isHeaderMenuOpen: false,
  menuContext: null,
  menuPosition: null,
  deleteTarget: null,
  editingMessage: null,
  profileCardTarget: null,
  profileCardPosition: null,
};

function uiReducer(state: ChatRoomUIState, action: ChatRoomUIAction): ChatRoomUIState {
  switch (action.type) {
    case "SET_AT_BOTTOM":
      return {
        ...state,
        isAtBottom: action.value,
        // 맨 아래로 스크롤하면 새 메시지 카운트 초기화
        newMessageCount: action.value ? 0 : state.newMessageCount,
      };
    case "INCREMENT_NEW_MESSAGES":
      return { ...state, newMessageCount: state.newMessageCount + 1 };
    case "RESET_NEW_MESSAGES":
      return { ...state, newMessageCount: 0 };
    case "SET_SEARCH_MODE":
      return { ...state, isSearchMode: action.value };
    case "SET_ANNOUNCEMENT_DIALOG":
      return { ...state, isAnnouncementDialogOpen: action.value };
    case "SET_MENU_OPEN":
      return { ...state, isMenuOpen: action.value };
    case "SET_INFO_OPEN":
      return { ...state, isInfoOpen: action.value };
    case "SET_SCHEDULED_PANEL_OPEN":
      return { ...state, isScheduledPanelOpen: action.value };
    case "SET_HEADER_MENU_OPEN":
      return { ...state, isHeaderMenuOpen: action.value };
    case "SET_MENU_CONTEXT":
      return { ...state, menuContext: action.context };
    case "SET_DELETE_TARGET":
      return { ...state, deleteTarget: action.id };
    case "SET_EDITING_MESSAGE":
      return { ...state, editingMessage: action.message };
    case "SET_PROFILE_CARD":
      return { ...state, profileCardTarget: action.target, profileCardPosition: action.position ?? null };
    case "OPEN_CONTEXT_MENU":
      return { ...state, menuContext: action.context, menuPosition: action.position ?? null, isMenuOpen: true };
    case "CLOSE_MENU":
      return { ...state, isMenuOpen: false, menuPosition: null };
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
        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
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
          <pre className="mt-2 p-2 bg-secondary-100 rounded text-xs overflow-auto max-h-32">
            {error.toString()}
          </pre>
        </details>
      )}
    </div>
  );
}

// ============================================
// 메시지 아이템 (메모이제이션 최적화)
// ============================================

interface ChatMessageItemProps {
  message: ChatMessageWithGrouping & {
    sender?: ChatUser | null;
    replyTarget?: ReplyTargetInfo | null;
    status?: MessageDeliveryStatus;
    reactions?: Array<{ emoji: ReactionEmoji; count: number; hasReacted: boolean }>;
    attachments?: ChatAttachment[];
    linkPreviews?: Array<{ id: string; message_id: string; url: string; title: string | null; description: string | null; image_url: string | null; site_name: string | null; fetched_at: string }>;
  };
  userId: string;
  readCount: number | undefined;
  isPinned: boolean;
  canPinMessages: boolean;
  canEditMessage: (createdAt: string) => boolean;
  isMessageEdited: (msg: ChatMessageWithGrouping) => boolean;
  createActionHandler: (message: ChatMessageItemProps["message"]) => (action: MessageAction) => void;
  getRefCallback: (id: string) => (el: HTMLDivElement | null) => void;
}

const ChatMessageItem = memo(function ChatMessageItem({
  message,
  userId,
  readCount,
  isPinned,
  canPinMessages,
  canEditMessage,
  isMessageEdited,
  createActionHandler,
  getRefCallback,
}: ChatMessageItemProps) {
  const isOwn = message.sender_id === userId;
  const { grouping } = message;
  const messageStatus = message.status;

  const derivedStatus: MessageDeliveryStatus | undefined = isOwn
    ? messageStatus ?? (message.id.startsWith("temp-") ? "sending" : "sent")
    : undefined;

  const messageData: MessageData = {
    content: message.is_deleted ? "" : message.content,
    createdAt: message.created_at,
    isOwn,
    senderName: message.sender?.name,
    isSystem: message.message_type === "system",
    isDeleted: message.is_deleted,
    isEdited: isMessageEdited(message),
    unreadCount: isOwn ? readCount : undefined,
    reactions: message.reactions ?? [],
    replyTarget: message.replyTarget,
    isPinned,
    status: derivedStatus,
    attachments: message.attachments ?? [],
    linkPreviews: message.linkPreviews ?? [],
    senderId: message.sender_id,
    senderType: message.sender_type,
    senderProfileImageUrl: message.sender?.profileImageUrl,
    isError: messageStatus === "error",
    isRetrying: messageStatus === "sending" && message.id.startsWith("temp-"),
    mentions: message.metadata?.mentions,
  };

  const displayOptions: MessageDisplayOptions = {
    showName: grouping.showName,
    showTime: grouping.showTime,
    isGrouped: grouping.isGrouped,
  };

  const permissions: MessagePermissions = {
    canEdit: isOwn && canEditMessage(message.created_at),
    canPin: canPinMessages && message.message_type !== "system",
  };

  return (
    <div ref={getRefCallback(message.id)} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 transition-colors">
      {grouping.showDateDivider && grouping.dateDividerText && (
        <DateDivider date={grouping.dateDividerText} />
      )}
      {grouping.showUnreadDivider && (
        <div className="flex items-center gap-3 py-3 px-4" role="separator" aria-label="여기까지 읽었습니다">
          <div className="flex-1 h-px bg-primary-500/50" />
          <span className="text-xs text-primary font-medium whitespace-nowrap">
            여기까지 읽었습니다
          </span>
          <div className="flex-1 h-px bg-primary-500/50" />
        </div>
      )}
      <div className={cn("px-4", grouping.isGrouped ? "py-0.5" : "py-1.5")}>
        <MessageBubble
          message={messageData}
          displayOptions={displayOptions}
          permissions={permissions}
          onAction={createActionHandler(message)}
        />
      </div>
    </div>
  );
});

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
  // 레이아웃 컨텍스트 (split-pane 모드 감지)
  // ============================================
  const { isSplitPane } = useChatLayout();
  const queryClient = useQueryClient();

  // ============================================
  // UI 상태 (useReducer로 통합)
  // ============================================
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [uiState, dispatch] = useReducer(uiReducer, initialUIState);

  // 이미지 라이트박스 상태
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    images: ChatAttachment[];
    initialIndex: number;
  }>({ isOpen: false, images: [], initialIndex: 0 });

  // 메시지 전달 상태
  const [forwardTarget, setForwardTarget] = useState<{
    content: string;
    senderName: string;
    hasAttachment: boolean;
  } | null>(null);

  // 읽음 정보 모달 상태
  const [readersTarget, setReadersTarget] = useState<{
    messageCreatedAt: string;
  } | null>(null);

  // 상태 구조 분해
  const {
    isAtBottom,
    newMessageCount,
    isSearchMode,
    isAnnouncementDialogOpen,
    isMenuOpen,
    isInfoOpen,
    isScheduledPanelOpen,
    isHeaderMenuOpen,
    menuContext,
    menuPosition,
    deleteTarget,
    editingMessage,
    profileCardTarget,
    profileCardPosition,
  } = uiState;

  // 하이라이트 타이머 cleanup용 ref
  const highlightTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Stale closure 방지: isAtBottom의 최신 값을 ref로 추적
  const isAtBottomRef = useRef(isAtBottom);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // 하이라이트 타이머 cleanup
  useEffect(() => {
    const timers = highlightTimersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

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
  // iOS 키보드 열림/닫힘 시 스크롤 보정
  // ============================================
  const { isKeyboardOpen, keyboardHeight, isStabilized } = useVisualViewport();
  const prevKeyboardOpenRef = useRef(false);
  // 키보드 전환 시작 시점의 isAtBottom을 캡처 (전환 중 스크롤 변경 방어)
  const wasAtBottomOnKeyboardChangeRef = useRef(false);
  const isKeyboardTransitioning = useRef(false);

  // 키보드 높이를 CSS custom property로 주입 → 입력창/리스트에서 정밀 제어
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--keyboard-height",
      `${keyboardHeight}px`
    );
    return () => {
      document.documentElement.style.removeProperty("--keyboard-height");
    };
  }, [keyboardHeight]);

  // 키보드 상태 변경 감지 → 의도 캡처 + 전환 시작
  useEffect(() => {
    if (prevKeyboardOpenRef.current !== isKeyboardOpen) {
      wasAtBottomOnKeyboardChangeRef.current = isAtBottomRef.current;
      isKeyboardTransitioning.current = true;
      prevKeyboardOpenRef.current = isKeyboardOpen;
    }
  }, [isKeyboardOpen]);

  // 뷰포트 안정화 후 스크롤 보정 (100ms 고정 대신 적응형)
  useEffect(() => {
    if (isStabilized && isKeyboardTransitioning.current) {
      isKeyboardTransitioning.current = false;
      // 키보드 전환 시작 시 하단이었을 때만 스크롤 보정
      if (wasAtBottomOnKeyboardChangeRef.current) {
        virtuosoRef.current?.scrollToIndex({ index: "LAST", behavior: "auto" });
      }
    }
  }, [isStabilized]);

  // ============================================
  // 비즈니스 로직 훅
  // ============================================
  const {
    data,
    permissions,
    actions,
    status,
    attachments: attachmentState,
    pinnedMessageIds,
    replyTargetState,
    utils,
  } = useChatRoomLogic({
    roomId,
    userId,
    isAtBottom,
    onNewMessageArrived: useCallback(() => {
      // followOutput이 자동 스크롤을 처리하므로, 여기서는 badge만 관리
      if (!isAtBottomRef.current) {
        dispatch({ type: "INCREMENT_NEW_MESSAGES" });
      }
    }, []),
  });

  const { room, messages, pinnedMessages, announcement, onlineUsers, typingUsers, otherMemberLeft } = data;
  const { canPin, canSetAnnouncement } = permissions;

  // ============================================
  // Presence: 현재 보고 있는 채팅방 등록 (Push 억제용)
  // ============================================
  useEffect(() => {
    setCurrentChatRoom(roomId);

    // 채팅방 진입 시 해당 방의 stale 알림 정리 (이전 세션에서 남은 알림 제거)
    navigator.serviceWorker?.controller?.postMessage({
      type: "CLEAR_NOTIFICATIONS",
      tags: [`chat-${roomId}`, `chat-mention-${roomId}`],
    });

    return () => setCurrentChatRoom(null);
  }, [roomId]);

  // ============================================
  // 브라우저 기본 드롭 동작 차단 (채팅 영역 외부에 파일 드롭 시 페이지 이탈 방지)
  // ============================================
  useEffect(() => {
    const preventDefaultDrop = (e: DragEvent) => {
      // preventDefault만 사용 (stopPropagation 시 같은 페이지 내 다른 드롭 영역 차단됨)
      e.preventDefault();
    };
    window.addEventListener("dragover", preventDefaultDrop);
    window.addEventListener("drop", preventDefaultDrop);
    return () => {
      window.removeEventListener("dragover", preventDefaultDrop);
      window.removeEventListener("drop", preventDefaultDrop);
    };
  }, []);

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
  const {
    isLoading, error,
    hasNextPage, isFetchingNextPage, fetchNextPage,
    hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage,
    refetch,
  } = status;
  const { replyTarget, setReplyTarget } = replyTargetState;
  const { canEditMessage, isMessageEdited } = utils;
  const { showSuccess, showError } = useToast();

  // 예약 전송 핸들러 (첨부파일 포함)
  const { uploadingFiles: scheduleUploadingFiles, clearFiles } = attachmentState;
  const handleScheduleSend = useCallback(
    async (content: string, scheduledAt: Date, mentions?: import("@/lib/domains/chat/types").MentionInfo[]) => {
      // 완료된 첨부파일 ID 수집
      const completedAttachmentIds = scheduleUploadingFiles
        .filter((f) => f.status === "done" && f.result)
        .map((f) => f.result!.id);

      const result = await scheduleMessageAction(roomId, content, scheduledAt.toISOString(), {
        replyToId: replyTarget?.id,
        attachmentIds: completedAttachmentIds.length > 0 ? completedAttachmentIds : undefined,
      });

      if (result.success) {
        const timeStr = scheduledAt.toLocaleString("ko-KR", {
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        showSuccess(`${timeStr}에 전송이 예약되었습니다`);
        setReplyTarget(null);
        if (completedAttachmentIds.length > 0) {
          clearFiles();
        }
      } else {
        showError(result.error ?? "예약 전송에 실패했습니다");
      }
    },
    [roomId, replyTarget?.id, setReplyTarget, showSuccess, showError, scheduleUploadingFiles, clearFiles]
  );

  // 현재 사용자의 알림 뮤트 상태
  const myMembership = data.members.find((m) => m.user_id === userId);
  const [isMuted, setIsMuted] = useState(myMembership?.is_muted ?? false);
  // 멤버십 데이터가 로드되면 동기화
  useEffect(() => {
    if (myMembership) setIsMuted(myMembership.is_muted);
  }, [myMembership?.is_muted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMute = useCallback(async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted); // 낙관적 업데이트
    const result = await toggleMuteChatRoomAction(roomId, newMuted);
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
    } else {
      setIsMuted(!newMuted); // 롤백
    }
  }, [isMuted, roomId, queryClient]);

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
  // 메시지 구성 기반 defaultItemHeight (미측정 아이템의 스크롤바/위치 추정 정확도 향상)
  // ============================================
  const estimatedItemHeight = useMemo(() => {
    if (messages.length === 0) return DEFAULT_ITEM_HEIGHT;
    // 첫 50개 메시지 기반 가중 평균 (전체 순회 방지)
    const sample = messages.slice(0, 50);
    let total = 0;
    for (const msg of sample) {
      total += ESTIMATED_HEIGHTS[msg.message_type] ?? DEFAULT_ITEM_HEIGHT;
    }
    return Math.round(total / sample.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 데이터 로드 시 1회 계산
  }, [messages.length > 0]);

  // ============================================
  // 초기 스크롤 위치: 세션 앵커 → unread divider → 최하단
  // ============================================
  const initialScrollIndex = useMemo(() => {
    if (messages.length === 0) return 0;

    // 1) 세션 앵커 복원 (5분 이내, 같은 방)
    try {
      const raw = sessionStorage.getItem(`chat-scroll-anchor:${roomId}`);
      if (raw) {
        const anchor = JSON.parse(raw) as { messageId: string; index: number; timestamp: number };
        const ANCHOR_TTL_MS = 5 * 60 * 1000;
        if (Date.now() - anchor.timestamp < ANCHOR_TTL_MS) {
          const anchorIdx = messages.findIndex((m) => m.id === anchor.messageId);
          if (anchorIdx >= 0) {
            // 앵커 복원 성공 → 사용 후 제거 (1회성)
            sessionStorage.removeItem(`chat-scroll-anchor:${roomId}`);
            return anchorIdx;
          }
          // 앵커 메시지가 삭제된 경우: 저장된 index를 범위 내에서 사용
          if (anchor.index >= 0 && anchor.index < messages.length) {
            sessionStorage.removeItem(`chat-scroll-anchor:${roomId}`);
            return anchor.index;
          }
        }
        // TTL 만료 → 앵커 제거
        sessionStorage.removeItem(`chat-scroll-anchor:${roomId}`);
      }
    } catch {
      // sessionStorage 접근 실패 무시
    }

    // 2) Unread divider 위치
    const dividerIndex = messages.findIndex((m) => m.grouping.showUnreadDivider);
    if (dividerIndex > 0 && dividerIndex < messages.length - 1) {
      return Math.max(0, dividerIndex - 2);
    }

    // 3) 최하단
    return messages.length - 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 렌더링 시 1회만 계산
  }, []);

  // ============================================
  // 무한 스크롤
  // ============================================
  const pendingPaginationRef = useRef(false);
  const prevMessageCountRef = useRef(messages.length);
  const prependedCountRef = useRef(0);
  const prevFirstIdRef = useRef(messages[0]?.id);

  // 메시지 수 변화를 감지하여 prepend 카운트 동기적으로 업데이트
  // anchor ID 기반으로 정확한 prepend 수를 계산 (realtime append와의 경합 방지)
  if (pendingPaginationRef.current && messages.length > prevMessageCountRef.current) {
    if (prevFirstIdRef.current && messages[0]?.id !== prevFirstIdRef.current) {
      const anchorIdx = messages.findIndex((m) => m.id === prevFirstIdRef.current);
      if (anchorIdx > 0) {
        prependedCountRef.current += anchorIdx;
      }
    }
    pendingPaginationRef.current = false;
  }
  prevMessageCountRef.current = messages.length;
  prevFirstIdRef.current = messages[0]?.id;

  // firstItemIndex를 동기적으로 계산 (useEffect 지연 없이 렌더와 동시에 반영)
  const computedFirstItemIndex = FIRST_ITEM_INDEX_BASE - prependedCountRef.current;

  // iOS 바운스/관성 스크롤 시 startReached가 연속 호출되는 것을 방지
  const lastFetchTimeRef = useRef(0);
  const FETCH_THROTTLE_MS = 300;

  const handleStartReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_THROTTLE_MS) return;

    lastFetchTimeRef.current = now;
    pendingPaginationRef.current = true;
    void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 사전 프리패치: 상위 10개 아이템 이내 진입 시 미리 로딩 시작
  // + 스크롤 앵커 저장 (채팅방 재진입 시 복원용)
  const PREFETCH_THRESHOLD = 10;
  const lastAnchorSaveRef = useRef(0);
  const ANCHOR_SAVE_THROTTLE_MS = 1000;

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      const visibleStartIndex = range.startIndex - computedFirstItemIndex;

      // 프리패치
      if (
        visibleStartIndex <= PREFETCH_THRESHOLD &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        const now = Date.now();
        if (now - lastFetchTimeRef.current < FETCH_THROTTLE_MS) return;
        lastFetchTimeRef.current = now;
        pendingPaginationRef.current = true;
        void fetchNextPage();
      }

      // 스크롤 앵커 저장 (throttle 1s)
      const now = Date.now();
      if (now - lastAnchorSaveRef.current >= ANCHOR_SAVE_THROTTLE_MS) {
        lastAnchorSaveRef.current = now;
        const anchorMessage = messages[visibleStartIndex];
        if (anchorMessage) {
          try {
            sessionStorage.setItem(
              `chat-scroll-anchor:${roomId}`,
              JSON.stringify({
                messageId: anchorMessage.id,
                index: visibleStartIndex,
                timestamp: now,
              })
            );
          } catch {
            // sessionStorage 용량 초과 무시
          }
        }
      }
    },
    [computedFirstItemIndex, hasNextPage, isFetchingNextPage, fetchNextPage, messages, roomId]
  );

  // 순방향 페이징: 리스트 끝(최신) 도달 시 더 새로운 메시지 로드
  const handleEndReached = useCallback(() => {
    if (!hasPreviousPage || isFetchingPreviousPage) return;

    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_THROTTLE_MS) return;

    lastFetchTimeRef.current = now;
    void fetchPreviousPage();
  }, [hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

  // ============================================
  // 메시지 스크롤
  // ============================================
  const scrollToMessage = useCallback((messageId: string) => {
    dispatch({ type: "SET_SEARCH_MODE", value: false });
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      virtuosoRef.current?.scrollToIndex({
        index: (FIRST_ITEM_INDEX_BASE - prependedCountRef.current) + index,
        behavior: "smooth",
        align: "center",
      });

      // 스크롤 완료 후 요소가 뷰포트에 나타날 때까지 폴링 (최대 1.5초)
      let attempts = 0;
      const maxAttempts = 30; // 50ms × 30 = 1500ms
      const pollForElement = () => {
        const element = messageRefs.current.get(messageId);
        if (element) {
          element.classList.add("bg-warning/20");
          const removeTimer = setTimeout(() => {
            element.classList.remove("bg-warning/20");
            highlightTimersRef.current.delete(removeTimer);
          }, 2000);
          highlightTimersRef.current.add(removeTimer);
        } else if (attempts < maxAttempts) {
          attempts++;
          const retryTimer = setTimeout(pollForElement, 50);
          highlightTimersRef.current.add(retryTimer);
        }
      };
      const startTimer = setTimeout(pollForElement, 100);
      highlightTimersRef.current.add(startTimer);
    }
  }, [messages]);

  // ============================================
  // 메시지 액션 핸들러
  // ============================================
  const handleReply = useCallback((message: { id: string; content: string; sender?: { name: string } | null; is_deleted?: boolean; message_type?: string }) => {
    // message_type → attachmentType 변환
    const attachmentType =
      message.message_type === "image" ? "image" as const
      : message.message_type === "file" ? "file" as const
      : message.message_type === "mixed" ? "mixed" as const
      : undefined;

    setReplyTarget({
      id: message.id,
      content: message.content,
      senderName: message.sender?.name ?? "알 수 없음",
      isDeleted: message.is_deleted ?? false,
      attachmentType,
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
  const handleMessageLongPress = useCallback((message: (typeof messages)[number], position?: LongPressPosition) => {
    const isOwn = message.sender_id === userId;
    dispatch({
      type: "OPEN_CONTEXT_MENU",
      context: {
        messageId: message.id,
        content: message.content,
        createdAt: message.created_at,
        updatedAt: message.updated_at,
        isOwn,
        canEdit: isOwn && canEditMessage(message.created_at),
        canPin: canPin && message.message_type !== "system",
        isPinned: pinnedMessageIds.has(message.id),
      },
      position,
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

  const handleViewReaders = useCallback(() => {
    if (menuContext?.isOwn && menuContext.createdAt) {
      setReadersTarget({ messageCreatedAt: menuContext.createdAt });
    }
    dispatch({ type: "CLOSE_MENU" });
  }, [menuContext]);

  // 그룹 채팅인지 여부 (읽음 정보는 그룹 채팅에서만 표시)
  const isGroupChat = room?.type === "group";

  const handleMenuForward = useCallback(() => {
    if (menuContext) {
      const message = messages.find((m) => m.id === menuContext.messageId);
      if (message) {
        const hasAttachment = message.message_type === "image" || message.message_type === "file" || message.message_type === "mixed";
        setForwardTarget({
          content: message.content,
          senderName: message.sender?.name ?? "알 수 없음",
          hasAttachment,
        });
      }
    }
    dispatch({ type: "CLOSE_MENU" });
  }, [menuContext, messages]);

  const handleForward = useCallback((message: { content: string; message_type?: string; sender?: { name: string } | null }) => {
    const hasAttachment = message.message_type === "image" || message.message_type === "file" || message.message_type === "mixed";
    setForwardTarget({
      content: message.content,
      senderName: message.sender?.name ?? "알 수 없음",
      hasAttachment,
    });
  }, []);

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

  // 아바타 클릭 → 프로필 카드 열기
  const handleAvatarClick = useCallback((message: (typeof messages)[number], position?: LongPressPosition) => {
    const member = data.members.find((m) => m.user_id === message.sender_id);
    dispatch({
      type: "SET_PROFILE_CARD",
      target: {
        userId: message.sender_id,
        userType: message.sender_type as ChatUserType,
        name: message.sender?.name ?? "알 수 없음",
        profileImageUrl: message.sender?.profileImageUrl ?? member?.user?.profileImageUrl,
        schoolName: member?.user?.schoolName,
        gradeDisplay: member?.user?.gradeDisplay,
      },
      position,
    });
  }, [data.members]);

  // 메시지 액션 핸들러 의존성을 ref로 추적하여 안정적 참조 유지
  const openLightbox = useCallback(
    (images: ChatAttachment[], index: number) => {
      setLightboxState({ isOpen: true, images, initialIndex: index });
    },
    []
  );

  const actionDepsRef = useRef({
    toggleReaction, handleReply, scrollToMessage, handleEdit, handleDelete,
    togglePin, pinnedMessageIds, handleMessageLongPress, retryMessage, removeFailedMessage, openLightbox, handleAvatarClick, handleForward,
  });
  useEffect(() => {
    actionDepsRef.current = {
      toggleReaction, handleReply, scrollToMessage, handleEdit, handleDelete,
      togglePin, pinnedMessageIds, handleMessageLongPress, retryMessage, removeFailedMessage, openLightbox, handleAvatarClick, handleForward,
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
          case "forward":
            deps.handleForward(message);
            break;
          case "report":
            break;
          case "togglePin":
            deps.togglePin(message.id, deps.pinnedMessageIds.has(message.id));
            break;
          case "longPress":
            deps.handleMessageLongPress(message, action.position);
            break;
          case "retry":
            deps.retryMessage(message);
            break;
          case "removeFailed":
            deps.removeFailedMessage(message.id);
            break;
          case "avatarClick":
            deps.handleAvatarClick(message, action.position);
            break;
          case "imageClick": {
            const images = ((message as { attachments?: ChatAttachment[] }).attachments ?? []).filter(
              (a) => a.attachment_type === "image"
            );
            if (images.length > 0) {
              deps.openLightbox(images, action.index);
            }
            break;
          }
        }
      },
    []
  );

  const renderMessage = useCallback((_index: number, message: (typeof messages)[number]) => (
    <ChatMessageItem
      message={message}
      userId={userId}
      readCount={message.readCount}
      isPinned={pinnedMessageIds.has(message.id)}
      canPinMessages={canPin}
      canEditMessage={canEditMessage}
      isMessageEdited={isMessageEdited}
      createActionHandler={createMessageActionHandler}
      getRefCallback={getRefCallback}
    />
  ), [
    userId,
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

  const VirtuosoHeader = useCallback(() => (
    isFetchingNextPage ? (
      <div className="flex justify-center py-2" aria-label="이전 메시지 로딩 중">
        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" aria-hidden="true" />
      </div>
    ) : null
  ), [isFetchingNextPage]);

  const VirtuosoFooter = useCallback(() => (
    isFetchingPreviousPage ? (
      <div className="flex justify-center py-2" aria-label="최신 메시지 로딩 중">
        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" aria-hidden="true" />
      </div>
    ) : null
  ), [isFetchingPreviousPage]);

  const VirtuosoScroller = useMemo(
    () =>
      forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
        function Scroller(props, ref) {
          return (
            <div
              {...props}
              ref={ref}
              style={{
                ...props.style,
                // 채팅 스크롤이 부모로 전파되지 않도록 격리
                overscrollBehavior: "contain",
                // 수평 제스처 차단 (iOS 뒤로가기 스와이프 충돌 방지)
                touchAction: "pan-y",
                // GPU 가속 레이어 승격 + 레이아웃 격리
                willChange: "scroll-position",
                contain: "layout style",
              }}
            />
          );
        }
      ),
    []
  );

  const virtuosoComponents = useMemo(() => ({
    Header: VirtuosoHeader,
    Footer: VirtuosoFooter,
    Scroller: VirtuosoScroller,
    ScrollSeekPlaceholder,
  }), [VirtuosoHeader, VirtuosoFooter, VirtuosoScroller, ScrollSeekPlaceholder]);

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
        className="relative flex flex-col h-full bg-bg-primary md:bg-bg-tertiary"
        role="region"
        aria-label={`${roomName} 채팅방`}
      >
        {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-primary">
        {onBack && !isSplitPane && (
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
          className="p-2 rounded-lg hover:bg-bg-secondary transition-colors flex-shrink-0"
          aria-label="메시지 검색"
        >
          <Search className="w-5 h-5 text-text-secondary" />
        </button>

        {/* 더보기 메뉴 */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_HEADER_MENU_OPEN", value: !isHeaderMenuOpen })}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
            aria-label="더보기"
            aria-expanded={isHeaderMenuOpen}
            aria-haspopup="menu"
          >
            <MoreVertical className="w-5 h-5 text-text-secondary" />
          </button>

          {isHeaderMenuOpen && (
            <>
              {/* 백드롭 */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => dispatch({ type: "SET_HEADER_MENU_OPEN", value: false })}
                aria-hidden="true"
              />
              <div
                className={cn(
                  "absolute right-0 top-full mt-1 z-50",
                  "w-48 bg-bg-primary border border-border rounded-xl shadow-lg",
                  "overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                )}
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    dispatch({ type: "SET_HEADER_MENU_OPEN", value: false });
                    handleToggleMute();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  {isMuted ? <BellOff className="w-4 h-4 text-text-tertiary" /> : <Bell className="w-4 h-4 text-text-secondary" />}
                  {isMuted ? "알림 켜기" : "알림 끄기"}
                </button>

                {canSetAnnouncement && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      dispatch({ type: "SET_HEADER_MENU_OPEN", value: false });
                      dispatch({ type: "SET_ANNOUNCEMENT_DIALOG", value: true });
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
                  >
                    <Megaphone className="w-4 h-4 text-text-secondary" />
                    공지 설정
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    dispatch({ type: "SET_HEADER_MENU_OPEN", value: false });
                    dispatch({ type: "SET_SCHEDULED_PANEL_OPEN", value: true });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  <CalendarClock className="w-4 h-4 text-text-secondary" />
                  예약 메시지
                </button>

                <div className="border-t border-border" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    dispatch({ type: "SET_HEADER_MENU_OPEN", value: false });
                    handleInfoOpen();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-text-secondary" />
                  채팅방 정보
                </button>
              </div>
            </>
          )}
        </div>

        {headerActions}
      </div>

      {/* Content area: max-width for readability on wide screens */}
      <div className="flex-1 flex flex-col min-h-0 relative max-w-5xl mx-auto w-full bg-bg-primary md:border-x md:border-border/40">

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
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-500/90 transition-colors"
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
            firstItemIndex={computedFirstItemIndex}
            initialTopMostItemIndex={initialScrollIndex}
            defaultItemHeight={estimatedItemHeight}
            followOutput={(isAtBottom) => (isAtBottom ? "auto" : false)}
            atBottomThreshold={100}
            atBottomStateChange={handleAtBottomChange}
            startReached={handleStartReached}
            endReached={handleEndReached}
            rangeChanged={handleRangeChanged}
            computeItemKey={computeItemKey}
            increaseViewportBy={VIEWPORT_BUFFER[DEVICE_TIER]}
            alignToBottom
            scrollSeekConfiguration={{
              enter: (velocity) => Math.abs(velocity) > SCROLL_SEEK_ENTER[DEVICE_TIER],
              exit: (velocity) => Math.abs(velocity) < SCROLL_SEEK_EXIT[DEVICE_TIER],
            }}
            components={virtuosoComponents}
            itemContent={renderMessage}
          />
        </div>
      )}

      {/* 맨 아래로 스크롤 버튼 — ChatInput 바로 위에 부유 */}
      <div className="relative">
        <div
          className={cn(
            "absolute right-4 z-10",
            "bottom-2",
            "motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out",
            isAtBottom
              ? "opacity-0 motion-safe:translate-y-4 pointer-events-none"
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
              "hover:bg-bg-secondary motion-safe:transition-all motion-safe:duration-200",
              "motion-safe:hover:scale-105 motion-safe:active:scale-95"
            )}
            aria-label={newMessageCount > 0 ? `새 메시지 ${newMessageCount}개, 맨 아래로 스크롤` : "맨 아래로 스크롤"}
          >
            <ChevronDown className="w-5 h-5 text-text-secondary" />

            {newMessageCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-medium text-white bg-primary-500 rounded-full"
                role="status"
                aria-live="polite"
              >
                {newMessageCount > 99 ? "99+" : newMessageCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 타이핑 인디케이터 */}
      <TypingIndicator users={typingUsers} />

      {/* 1:1 채팅 상대방 퇴장 안내 */}
      {otherMemberLeft && (
        <div className="flex justify-center px-4 py-2 bg-secondary-50 border-t border-secondary-200">
          <span className="text-xs text-text-tertiary">
            상대방이 대화방을 나갔습니다. 메시지를 보내면 다시 초대됩니다.
          </span>
        </div>
      )}

      {/* 입력창 */}
      <ChatInput
        key={roomId}
        roomId={roomId}
        onSend={(content, mentions) => {
          sendMessage(content, replyTarget?.id, mentions);
          // 메시지 전송 시 항상 하단으로 이동 (스크롤 위에 있어도)
          if (!isAtBottomRef.current) {
            requestAnimationFrame(() => {
              virtuosoRef.current?.scrollToIndex({ index: "LAST", behavior: "smooth" });
            });
          }
        }}
        onTypingChange={setTyping}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        disabled={isLoading}
        placeholder={isLoading ? "메시지를 불러오는 중..." : undefined}
        onFilesSelected={attachmentState.addFiles}
        uploadingFiles={attachmentState.uploadingFiles}
        onRemoveFile={attachmentState.removeFile}
        onRetryFile={attachmentState.retryUpload}
        autoFocus
        members={data.members}
        currentUserId={userId}
        onScheduleSend={handleScheduleSend}
      />
      </div>

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
        position={menuPosition}
        onCopy={handleCopy}
        onReply={handleMenuReply}
        onForward={handleMenuForward}
        onEdit={menuContext?.canEdit ? handleMenuEdit : undefined}
        onDelete={menuContext?.isOwn ? handleMenuDelete : undefined}
        onTogglePin={menuContext?.canPin ? handleMenuTogglePin : undefined}
        onViewReaders={menuContext?.isOwn && isGroupChat ? handleViewReaders : undefined}
        onToggleReaction={handleMenuReaction}
      />

      {/* 읽음 정보 모달 */}
      <MessageReadersModal
        isOpen={!!readersTarget}
        onClose={() => setReadersTarget(null)}
        roomId={roomId}
        messageCreatedAt={readersTarget?.messageCreatedAt ?? ""}
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
        onImageClick={(attachment, allImages) => {
          const idx = allImages.findIndex((img) => img.id === attachment.id);
          setLightboxState({
            isOpen: true,
            images: allImages,
            initialIndex: idx >= 0 ? idx : 0,
          });
        }}
      />

      {/* 예약 메시지 관리 패널 */}
      <ScheduledMessagesPanel
        isOpen={isScheduledPanelOpen}
        onClose={() => dispatch({ type: "SET_SCHEDULED_PANEL_OPEN", value: false })}
        roomId={roomId}
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

        {/* 이미지 라이트박스 */}
        <ImageLightbox
          images={lightboxState.images}
          initialIndex={lightboxState.initialIndex}
          isOpen={lightboxState.isOpen}
          onClose={() => setLightboxState((prev) => ({ ...prev, isOpen: false }))}
        />

        {/* 프로필 카드 팝업 */}
        <ProfileCardPopup
          isOpen={!!profileCardTarget}
          onClose={() => dispatch({ type: "SET_PROFILE_CARD", target: null })}
          profile={profileCardTarget}
          position={profileCardPosition}
          currentUserId={userId}
          basePath={basePath}
        />

        {/* 메시지 전달 모달 */}
        <ForwardModal
          isOpen={forwardTarget !== null}
          onClose={() => setForwardTarget(null)}
          content={forwardTarget?.content ?? ""}
          senderName={forwardTarget?.senderName ?? ""}
          currentRoomId={roomId}
          hasAttachment={forwardTarget?.hasAttachment}
        />
      </div>
    </RetryableErrorBoundary>
  );
}

export const ChatRoom = memo(ChatRoomComponent);
