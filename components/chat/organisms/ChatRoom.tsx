"use client";

/**
 * ChatRoom - 채팅방 전체 뷰
 *
 * 메시지 목록 + 입력창을 포함합니다.
 * 비즈니스 로직은 useChatRoomLogic 훅으로 분리되어 있습니다.
 */

import { memo, useRef, useCallback, useMemo, useReducer, useEffect, useState, forwardRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatRoomLogic, useChatMode } from "@/lib/domains/chat/hooks";
import type { ChatModeAnchor } from "@/lib/domains/chat/hooks";
import { estimateMessageHeight } from "@/lib/domains/chat/heightEstimation";
import { useChatConnectionStatus } from "@/lib/hooks/useChatConnectionStatus";
import { useVisualViewport } from "@/lib/hooks/useVisualViewport";
import { useCLSMonitor } from "@/lib/hooks/useCLSMonitor";
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
import { Avatar } from "@/components/atoms/Avatar";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { scheduleMessageAction } from "@/lib/domains/chat/scheduled/actions";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { useToast } from "@/components/ui/ToastProvider";

// 결정론적 높이 추정: heightEstimation.ts 사용 (메시지 메타데이터 기반)
const DEFAULT_ITEM_HEIGHT = 72;

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

// 뷰포트 버퍼: 스크롤 방향으로 미리 렌더링할 영역 (px)
// 모바일 모멘텀 스크롤은 수천 px/s에 달하므로 충분한 버퍼 필요.
// 버퍼가 부족하면 아이템이 뷰포트 진입 전에 마운트되지 않아 빈 영역(깜빡임) 노출.
const VIEWPORT_BUFFER: Record<DeviceTier, { top: number; bottom: number }> = {
  low:  { top: 1200, bottom: 600 },
  mid:  { top: 3000, bottom: 1500 },
  high: { top: 4000, bottom: 2000 },
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
// 키보드 관리자 — useVisualViewport를 ChatRoom에서 격리
// ============================================
// 모바일 주소창 show/hide 시 visualViewport.scroll/resize 이벤트가 발생하면
// useVisualViewport가 setState를 호출한다. 이를 ChatRoom 내에 두면
// ChatRoom 전체(Virtuoso 포함)가 리렌더되므로, 별도 컴포넌트로 격리하여
// 키보드 상태 변화만 isKeyboardTransitioning ref를 통해 전달한다.

function ChatKeyboardManager({
  virtuosoHandleRef,
  isAtBottomStateRef,
  isKeyboardTransitioningRef,
}: {
  virtuosoHandleRef: React.RefObject<VirtuosoHandle | null>;
  isAtBottomStateRef: React.RefObject<boolean>;
  isKeyboardTransitioningRef: React.MutableRefObject<boolean>;
}) {
  const { isKeyboardOpen, keyboardHeight, isStabilized } = useVisualViewport();
  const prevKeyboardOpenRef = useRef(false);
  const wasAtBottomRef = useRef(false);

  // 키보드 높이를 CSS custom property로 주입
  useEffect(() => {
    document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
    return () => { document.documentElement.style.removeProperty("--keyboard-height"); };
  }, [keyboardHeight]);

  // 키보드 상태 변경 감지 → 의도 캡처 + 전환 시작
  useEffect(() => {
    if (prevKeyboardOpenRef.current !== isKeyboardOpen) {
      wasAtBottomRef.current = isAtBottomStateRef.current;
      isKeyboardTransitioningRef.current = true;
      prevKeyboardOpenRef.current = isKeyboardOpen;
    }
  }, [isKeyboardOpen, isAtBottomStateRef, isKeyboardTransitioningRef]);

  // 뷰포트 안정화 후 스크롤 보정
  useEffect(() => {
    if (isStabilized && isKeyboardTransitioningRef.current) {
      isKeyboardTransitioningRef.current = false;
      if (wasAtBottomRef.current) {
        virtuosoHandleRef.current?.scrollToIndex({ index: 0, behavior: "auto" });
      }
    }
  }, [isStabilized, isKeyboardTransitioningRef, virtuosoHandleRef]);

  return null;
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
  /** 그룹 채팅(>2명)·본인 메시지 한정 — 안 읽은 멤버 이름 (tooltip 표시용) */
  unreadMemberNames?: string[];
  isPinned: boolean;
  canPinMessages: boolean;
  canEditMessage: (createdAt: string) => boolean;
  isMessageEdited: (msg: ChatMessageWithGrouping) => boolean;
  createActionHandler: (message: ChatMessageItemProps["message"]) => (action: MessageAction) => void;
  getRefCallback: (id: string) => (el: HTMLDivElement | null) => void;
  // isFocused는 useEffect로 DOM 직접 관리 (renderMessage 리렌더링 방지)
}

const ChatMessageItem = memo(function ChatMessageItem({
  message,
  userId,
  readCount,
  unreadMemberNames,
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
    unreadMemberNames: isOwn ? unreadMemberNames : undefined,
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
    <div
      ref={getRefCallback(message.id)}
      tabIndex={-1}
      className="outline-none data-[focused]:ring-2 data-[focused]:ring-primary/50 data-[focused]:ring-inset data-[focused]:rounded-lg data-[focused]:transition-shadow"
    >
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
  /** 방 나가기/아카이브 후 콜백 (플로팅 패널 등에서 router.replace 대신 사용) */
  onLeaveRoom?: () => void;
}

function ChatRoomComponent({
  roomId,
  userId,
  onBack,
  basePath = "/chat",
  headerActions,
  onLeaveRoom,
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
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [uiState, dispatch] = useReducer(uiReducer, initialUIState);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const prevFocusedIdRef = useRef<string | null>(null);

  // 포커스 스타일을 DOM 직접 조작으로 관리 (renderMessage 리렌더링 방지)
  useEffect(() => {
    // 이전 포커스 해제
    if (prevFocusedIdRef.current) {
      const prevEl = messageRefs.current.get(prevFocusedIdRef.current);
      if (prevEl) {
        prevEl.removeAttribute("data-focused");
        prevEl.tabIndex = -1;
      }
    }
    // 새 포커스 설정
    if (focusedMessageId) {
      const el = messageRefs.current.get(focusedMessageId);
      if (el) {
        el.setAttribute("data-focused", "");
        el.tabIndex = 0;
      }
    }
    prevFocusedIdRef.current = focusedMessageId;
  }, [focusedMessageId]);

  // 개발 모드 CLS 자동 모니터링
  useCLSMonitor(messageListRef, "ChatRoom");

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

  // Virtuoso 스크롤러 DOM 요소 ref (관성 스크롤 제어용)
  const scrollerElRef = useRef<HTMLDivElement | null>(null);

  // Stale closure 방지: isAtBottom의 최신 값을 ref로 추적
  const isAtBottomRef = useRef(isAtBottom);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // scaleY(-1) 반전 리스트: "시각적 최하단" = scrollTop ≈ 0.
  // Virtuoso의 atBottomStateChange 대신 스크롤 이벤트로 직접 감지.
  // 스크롤 리스너는 VirtuosoScroller ref 콜백에서 설정 (Virtuoso 마운트 타이밍 보장).
  const AT_BOTTOM_THRESHOLD = 100;
  const scrollListenerCleanupRef = useRef<(() => void) | null>(null);

  const attachScrollListener = useCallback((el: HTMLDivElement | null) => {
    // 기존 리스너 정리
    scrollListenerCleanupRef.current?.();
    scrollListenerCleanupRef.current = null;

    if (!el) return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const visuallyAtBottom = el.scrollTop < AT_BOTTOM_THRESHOLD;
        if (visuallyAtBottom !== isAtBottomRef.current) {
          dispatch({ type: "SET_AT_BOTTOM", value: visuallyAtBottom });
          modeBottomChangeRef.current?.(visuallyAtBottom);
        }
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    scrollListenerCleanupRef.current = () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const attachScrollListenerRef = useRef(attachScrollListener);
  attachScrollListenerRef.current = attachScrollListener;

  // cleanup on unmount
  useEffect(() => () => { scrollListenerCleanupRef.current?.(); }, []);

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
    // scaleY(-1) 반전: scrollTop=0 = 시각적 최하단
    const el = scrollerElRef.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }

    // 안전망: smooth 스크롤 미완료 시 강제 이동
    setTimeout(() => {
      if (scrollerElRef.current && scrollerElRef.current.scrollTop > AT_BOTTOM_THRESHOLD) {
        scrollerElRef.current.scrollTop = 0;
      }
    }, 300);
  }, []);

  // modeBottomChange는 useChatMode에서 나오지만 선언 순서가 뒤이므로 ref로 안정화
  const modeBottomChangeRef = useRef<((atBottom: boolean) => void) | null>(null);

  // scaleY(-1) 반전 리스트: Virtuoso의 atBottom = DOM bottom = 시각적 최상단.
  // "시각적 최하단"(최신 메시지) 감지는 scrollTop ≈ 0 기반으로 별도 처리.
  // Virtuoso의 atBottomStateChange는 무시하고, 스크롤 이벤트로 직접 감지.
  const handleAtBottomChange = useCallback((_atBottom: boolean) => {
    // Virtuoso의 atBottom은 scaleY(-1)에서 의미가 반전되므로 무시.
    // 실제 "시각적 최하단" 감지는 아래 스크롤 핸들러에서 처리.
  }, []);

  // ============================================
  // iOS 키보드 열림/닫힘 시 스크롤 보정
  // ============================================
  // useVisualViewport → ChatKeyboardManager로 격리 (주소창 변화 시 ChatRoom 리렌더 방지)
  // isKeyboardTransitioning ref만 공유하여 followOutput에서 키보드 전환 감지
  const isKeyboardTransitioning = useRef(false);

  // ============================================
  // Virtuoso props 메모이제이션 (매 렌더마다 새 참조 → Virtuoso 내부 재처리 방지)
  // ============================================
  const handleFollowOutput = useCallback((_atBottom: boolean) => {
    // scaleY(-1) 반전 리스트:
    // - Virtuoso의 followOutput은 END 추가 시 트리거 = 과거 메시지 pagination
    // - 새 메시지는 START에 prepend → followOutput 미트리거
    // - 과거 메시지 로딩 시 자동 스크롤 불필요 → 항상 false
    return false;
  }, []);

  // ScrollSeek 워밍업: 마운트 직후 Virtuoso가 아이템 높이를 아직 측정하지 않은 상태에서
  // ScrollSeek 비활성화: 플레이스홀더(회색 블록)가 실제 메시지와 시각적으로 달라
  // 빠른 스크롤 시 깜빡임으로 인식됨. 대신 뷰포트 버퍼를 대폭 증가하여
  // 아이템이 뷰포트 진입 전에 충분히 마운트되도록 보장.
  const scrollSeekConfig = undefined;

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
    readCountsMap,
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
    isLoading, fetchStatus, error,
    hasNextPage, isFetchingNextPage, fetchNextPage,
    hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage,
    refetch,
  } = status;
  const { replyTarget, setReplyTarget } = replyTargetState;
  const { canEditMessage, isMessageEdited } = utils;
  const { showSuccess, showError } = useToast();

  // ChatInput onSend 안정화: replyTarget/sendMessage를 ref로 추적 → 콜백 참조 불변
  const replyTargetRef = useRef(replyTarget);
  replyTargetRef.current = replyTarget;
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const handleSend = useCallback((content: string, mentions?: import("@/lib/domains/chat/types").MentionInfo[]) => {
    sendMessageRef.current(content, replyTargetRef.current?.id, mentions);
    // 전송 후 최하단으로 스크롤 (scaleY(-1): scrollTop=0 = visual bottom)
    requestAnimationFrame(() => {
      if (scrollerElRef.current) scrollerElRef.current.scrollTop = 0;
    });
  }, []);

  const handleCancelReply = useCallback(() => setReplyTarget(null), [setReplyTarget]);

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
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc("toggle_mute_chat_room", { p_room_id: roomId, p_muted: newMuted });
    if (!error) {
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
  // 결정론적 높이 추정 (메시지 메타데이터 기반 — heightEstimation.ts)
  // ============================================
  const estimatedItemHeight = useMemo(() => {
    if (messages.length === 0) return DEFAULT_ITEM_HEIGHT;
    const sample = messages.slice(0, 50);
    let total = 0;
    for (const msg of sample) {
      total += estimateMessageHeight(msg, msg.grouping);
    }
    return Math.round(total / sample.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 데이터 로드 시 1회 계산
  }, [messages.length > 0]);

  // ============================================
  // 초기 앵커 결정 + 듀얼 모드 (Live/Archive)
  // ============================================
  // 세션 앵커 소비 (StrictMode 안전)
  const anchorRef = useRef<ChatModeAnchor | null>(null);
  const anchorConsumedRef = useRef(false);

  if (!anchorConsumedRef.current) {
    try {
      const raw = sessionStorage.getItem(`chat-scroll-anchor:${roomId}`);
      if (raw) {
        const anchor = JSON.parse(raw) as { messageId: string; index: number; timestamp: number };
        const ANCHOR_TTL_MS = 5 * 60 * 1000;
        if (Date.now() - anchor.timestamp < ANCHOR_TTL_MS) {
          // 세션 앵커는 스크롤 복원용 — archive 모드로 진입하지 않음
          anchorRef.current = { messageId: anchor.messageId, timestamp: "" };
        }
        sessionStorage.removeItem(`chat-scroll-anchor:${roomId}`);
      }
      anchorConsumedRef.current = true;
    } catch {
      anchorConsumedRef.current = true;
    }
  }

  // 초기 앵커: unread divider가 있으면 archive 모드 진입
  const initialAnchorRef = useRef<ChatModeAnchor | null>(null);
  const initialAnchorComputedRef = useRef(false);

  if (!initialAnchorComputedRef.current && messages.length > 0) {
    const dividerIndex = messages.findIndex((m) => m.grouping.showUnreadDivider);
    if (dividerIndex > 0 && dividerIndex < messages.length - 1) {
      initialAnchorRef.current = {
        messageId: messages[dividerIndex].id,
        timestamp: messages[dividerIndex].created_at,
      };
    }
    initialAnchorComputedRef.current = true;
  }

  // 듀얼 모드 상태머신
  const { state: modeState, enterArchive, handleAtBottomChange: modeBottomChange } = useChatMode(
    initialAnchorRef.current
  );
  // ref 연결 (handleAtBottomChange보다 뒤에 선언되므로 ref로 브릿지)
  modeBottomChangeRef.current = modeBottomChange;

  // 초기 스크롤 인덱스 (동기적 1회 계산)
  const initialScrollIndexRef = useRef<number | null>(null);

  if (initialScrollIndexRef.current === null && messages.length > 0) {
    // 1) 세션 앵커 복원
    const sessionAnchor = anchorRef.current;
    if (sessionAnchor) {
      const idx = messages.findIndex((m) => m.id === sessionAnchor.messageId);
      initialScrollIndexRef.current = idx >= 0 ? idx : messages.length - 1;
    } else if (initialAnchorRef.current) {
      // 2) Unread divider
      const idx = messages.findIndex((m) => m.id === initialAnchorRef.current!.messageId);
      initialScrollIndexRef.current = idx >= 0 ? Math.max(0, idx - 2) : messages.length - 1;
    } else {
      // 3) 최하단
      initialScrollIndexRef.current = messages.length - 1;
    }
  }

  const initialScrollIndex = initialScrollIndexRef.current ?? 0;

  // Inverted List: 데이터 로드 후 최신 메시지(index 0)로 스크롤
  // scaleY(-1) 반전 리스트에서 scrollTop=0 = 시각적 최하단(최신 메시지).
  // initialTopMostItemIndex는 빈 데이터로 마운트되면 무효화되므로,
  // 데이터 도착 후 직접 scrollTop=0 강제 설정.
  // NOTE: reversedMessages는 아래에서 선언되므로 messages.length 사용.
  const initialScrollAppliedRef = useRef(false);
  useEffect(() => {
    if (initialScrollAppliedRef.current || messages.length === 0) return;
    initialScrollAppliedRef.current = true;

    if (modeState.mode === "live") {
      // 즉시 scrollTop=0 (scaleY(-1)에서 visual bottom)
      const el = scrollerElRef.current;
      if (el) el.scrollTop = 0;

      // Virtuoso 내부 레이아웃 완료 후 재확인 (rAF x2)
      requestAnimationFrame(() => {
        if (scrollerElRef.current) scrollerElRef.current.scrollTop = 0;
        requestAnimationFrame(() => {
          if (scrollerElRef.current) scrollerElRef.current.scrollTop = 0;
          virtuosoRef.current?.scrollToIndex({ index: 0, behavior: "auto" });
        });
      });
    }
  }, [messages.length, modeState.mode]);  

  // ============================================
  // Two-Pass Rendering: archive 모드 초기 측정 안정화
  // ============================================
  // Virtuoso가 initialTopMostItemIndex로 스크롤하기까지 수 프레임이 걸림.
  // 해결: archive 모드 진입 시 opacity:0 → 안정화 후 DOM 직접 조작으로 opacity:1.
  // useState 대신 ref + DOM 직접 조작 → ChatRoom 리렌더 0.
  const isArchiveEntry = !!initialAnchorRef.current;
  const virtuosoWrapperRef = useRef<HTMLDivElement | null>(null);
  const stabilizedRef = useRef(!isArchiveEntry);

  // handleRangeChanged는 뒤에서 선언되므로 ref로 브릿지
  const rangeChangedRef = useRef<((range: { startIndex: number; endIndex: number }) => void) | null>(null);

  const handleRangeChangedWithStabilization = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      // archive 모드 첫 rangeChanged → 80ms 후 opacity:1 (DOM 직접, setState 없음)
      if (!stabilizedRef.current) {
        stabilizedRef.current = true;
        setTimeout(() => {
          if (virtuosoWrapperRef.current) {
            virtuosoWrapperRef.current.style.opacity = "1";
          }
        }, 80);
      }

      rangeChangedRef.current?.(range);
    },
    [] // 의존성 없음 → 참조 영구 안정
  );

  // fallback: 500ms 내에 rangeChanged가 안 오면 강제 표시
  useEffect(() => {
    if (stabilizedRef.current) return;
    const fallback = setTimeout(() => {
      stabilizedRef.current = true;
      if (virtuosoWrapperRef.current) {
        virtuosoWrapperRef.current.style.opacity = "1";
      }
    }, 500);
    return () => clearTimeout(fallback);
  }, []);

  // ============================================
  // Inverted List: 역순 데이터 (newest→oldest)
  // ============================================
  // firstItemIndex 기반 prepend를 완전 폐기.
  // 과거 메시지 로딩 = 배열 끝에 APPEND → 스크롤 보상 불필요 → 깜빡임 0.
  // CSS scaleY(-1)로 시각적으로 뒤집어 최신 메시지가 아래에 표시.
  const reversedMessages = useMemo(
    () => [...messages].reverse(),
    [messages]
  );

  // ============================================
  // 스크롤 핸들러 (Inverted)
  // ============================================
  const lastFetchTimeRef = useRef(0);
  const FETCH_THROTTLE_MS = 300;
  const lastAnchorSaveRef = useRef(Date.now() + 2000);
  const ANCHOR_SAVE_THROTTLE_MS = 1000;

  const scrollDepsRef = useRef({
    hasNextPage, isFetchingNextPage, fetchNextPage,
    hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage,
    messages, roomId,
  });
  scrollDepsRef.current = {
    hasNextPage, isFetchingNextPage, fetchNextPage,
    hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage,
    messages, roomId,
  };

  // Inverted: endReached = 과거 메시지 로드 (배열 끝 = 가장 오래된 메시지)
  // APPEND이므로 스크롤 보상 불필요 → 깜빡임 0
  const handleEndReached = useCallback(() => {
    const { hasNextPage: hnp, isFetchingNextPage: ifnp, fetchNextPage: fnp } = scrollDepsRef.current;
    if (!hnp || ifnp) return;
    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_THROTTLE_MS) return;
    lastFetchTimeRef.current = now;
    void fnp();
  }, []);

  // Inverted: startReached = 최신 메시지 로드 (배열 시작 = 가장 최신 메시지)
  const handleStartReached = useCallback(() => {
    const { hasPreviousPage: hpp, isFetchingPreviousPage: ifpp, fetchPreviousPage: fpp } = scrollDepsRef.current;
    if (!hpp || ifpp) return;
    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_THROTTLE_MS) return;
    lastFetchTimeRef.current = now;
    void fpp();
  }, []);

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      const deps = scrollDepsRef.current;

      // 스크롤 앵커 저장 (throttle 1s) — reversed index를 original로 변환
      const now = Date.now();
      if (now - lastAnchorSaveRef.current >= ANCHOR_SAVE_THROTTLE_MS) {
        lastAnchorSaveRef.current = now;
        // Inverted: startIndex는 reversed array의 인덱스
        // original messages에서의 인덱스로 변환
        const reversedIdx = range.startIndex;
        const originalIdx = deps.messages.length - 1 - reversedIdx;
        const anchorMessage = deps.messages[originalIdx];
        if (anchorMessage) {
          try {
            sessionStorage.setItem(
              `chat-scroll-anchor:${deps.roomId}`,
              JSON.stringify({
                messageId: anchorMessage.id,
                index: originalIdx,
                timestamp: now,
              })
            );
          } catch {
            // sessionStorage 용량 초과 무시
          }
        }
      }
    },
    []
  );
  rangeChangedRef.current = handleRangeChanged;

  // ============================================
  // 메시지 스크롤
  // ============================================
  const scrollToMessage = useCallback((messageId: string) => {
    dispatch({ type: "SET_SEARCH_MODE", value: false });
    // 검색/답장 클릭 → archive 모드 진입
    const targetMsg = scrollDepsRef.current.messages.find((m) => m.id === messageId);
    if (targetMsg) {
      enterArchive({ messageId, timestamp: targetMsg.created_at });
    }
    const index = scrollDepsRef.current.messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      // Inverted: original index를 reversed index로 변환
      const reversedIdx = scrollDepsRef.current.messages.length - 1 - index;
      virtuosoRef.current?.scrollToIndex({
        index: reversedIdx,
        behavior: "smooth",
        align: "center",
      });

      // 스크롤 완료 후 요소가 뷰포트에 나타날 때까지 폴링 (최대 1.5초)
      let attempts = 0;
      const maxAttempts = 30; // 50ms × 30 = 1500ms
      const pollForElement = () => {
        const element = messageRefs.current.get(messageId);
        if (element) {
          // animation 재실행을 위해 일단 제거 후 다음 프레임에 추가
          element.classList.remove("animate-message-highlight");
          // reflow 강제로 animation restart
          void element.offsetWidth;
          element.classList.add("animate-message-highlight");
          const removeTimer = setTimeout(() => {
            element.classList.remove("animate-message-highlight");
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
  }, []);

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

  // (중복 isGroupChat 정의 제거 — 1194:`room?.type === "group"` 와 정합)
  // readCount를 ref Map에서 조회: READ_RECEIPT 변경이 allMessages/messagesWithGrouping 재계산을 유발하지 않음
  // Inverted: 각 아이템에 scaleY(-1) 적용 (Scroller의 scaleY(-1)과 상쇄 → 올바른 방향)
  const renderMessage = useCallback((_index: number, message: (typeof messages)[number]) => {
    const readCount = readCountsMap.current.get(message.id);
    const isOwnMsg = message.sender_id === userId;

    // 그룹·본인 메시지·미독 인원 존재 시에만 안 읽은 멤버 이름 산출
    let unreadMemberNames: string[] | undefined;
    if (isGroupChat && isOwnMsg && readCount && readCount > 0) {
      const createdAtMs = new Date(message.created_at).getTime();
      unreadMemberNames = data.members
        .filter(
          (m) =>
            m.user_id !== userId &&
            new Date(m.last_read_at).getTime() < createdAtMs
        )
        .map((m) => m.user?.name ?? "알 수 없음");
    }

    return (
      <div style={{ transform: "scaleY(-1)" }}>
        <ChatMessageItem
          message={message}
          userId={userId}
          readCount={readCount}
          unreadMemberNames={unreadMemberNames}
          isPinned={pinnedMessageIds.has(message.id)}
          canPinMessages={canPin}
          canEditMessage={canEditMessage}
          isMessageEdited={isMessageEdited}
          createActionHandler={createMessageActionHandler}
          getRefCallback={getRefCallback}
        />
      </div>
    );
  }, [
    userId,
    pinnedMessageIds,
    canPin,
    canEditMessage,
    isMessageEdited,
    getRefCallback,
    createMessageActionHandler,
    readCountsMap,
    isGroupChat,
    data.members,
  ]);

  const computeItemKey = useCallback((_index: number, message: (typeof messages)[number]) => message.id, []);

  // ============================================
  // 키보드 네비게이션 (roving tabindex)
  // ============================================
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  // messages/focusedMessageId를 ref로 추적하여 핸들러 참조 안정화
  // → 메시지 변경마다 wrapper div의 onKeyDown이 바뀌어 불필요한 리렌더 방지
  const focusedMessageIdRef = useRef(focusedMessageId);
  focusedMessageIdRef.current = focusedMessageId;

  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    const msgs = scrollDepsRef.current.messages;
    const focusedId = focusedMessageIdRef.current;
    if (msgs.length === 0) return;

    // Inverted list: msgs는 oldest→newest, Virtuoso data는 reversed (newest→oldest).
    // original index → reversed index 변환 필요.
    const toReversedIdx = (originalIdx: number) => msgs.length - 1 - originalIdx;

    switch (e.key) {
      case "ArrowUp": {
        e.preventDefault();
        const currentIdx = focusedId
          ? msgs.findIndex((m) => m.id === focusedId)
          : msgs.length;
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : 0;
        const prevMsg = msgs[prevIdx];
        if (prevMsg) {
          setFocusedMessageId(prevMsg.id);
          const el = messageRefs.current.get(prevMsg.id);
          if (el) el.focus();
          else virtuosoRef.current?.scrollToIndex({ index: toReversedIdx(prevIdx), behavior: "auto" });
        }
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        const currentIdx = focusedId
          ? msgs.findIndex((m) => m.id === focusedId)
          : -1;
        const nextIdx = currentIdx < msgs.length - 1 ? currentIdx + 1 : msgs.length - 1;
        const nextMsg = msgs[nextIdx];
        if (nextMsg) {
          setFocusedMessageId(nextMsg.id);
          const el = messageRefs.current.get(nextMsg.id);
          if (el) el.focus();
          else virtuosoRef.current?.scrollToIndex({ index: toReversedIdx(nextIdx), behavior: "auto" });
        }
        break;
      }
      case "Home":
        e.preventDefault();
        if (msgs.length > 0) {
          setFocusedMessageId(msgs[0].id);
          // oldest message = reversed 배열의 마지막
          virtuosoRef.current?.scrollToIndex({ index: msgs.length - 1, behavior: "auto" });
        }
        break;
      case "End":
        e.preventDefault();
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          setFocusedMessageId(last.id);
          // newest message = reversed 배열의 첫 번째 (scrollTop=0)
          if (scrollerElRef.current) scrollerElRef.current.scrollTop = 0;
        }
        break;
      case "Escape":
        setFocusedMessageId(null);
        chatInputRef.current?.focus();
        break;
    }
  }, []);

  // ScrollSeek 플레이스홀더: 정적 배경 (animate-pulse 제거 — 스켈레톤 유사 깜빡임 방지)
  const ScrollSeekPlaceholder = useCallback(({ height }: { height: number }) => (
    <div style={{ height }} className="px-4 py-1.5">
      <div className="bg-bg-secondary/40 rounded-2xl" style={{ height: Math.max(height - 12, 40) }} />
    </div>
  ), []);

  // Header/Footer: 고정 높이 컨테이너를 항상 유지하여 CLS 방지
  // null 반환 시 36px → 0px 급변으로 스크롤 점프가 발생하므로, DOM을 항상 렌더링
  // ref 패턴: fetch 상태 변경 시 콜백 참조가 바뀌지 않도록 안정화
  // → virtuosoComponents 재생성 방지 → Virtuoso 내부 재처리(플리커) 방지
  const headerFooterDepsRef = useRef({ hasNextPage, isFetchingNextPage, hasPreviousPage, isFetchingPreviousPage });
  headerFooterDepsRef.current = { hasNextPage, isFetchingNextPage, hasPreviousPage, isFetchingPreviousPage };

  // Inverted List: Header = 시각적 하단 (최신 메시지 쪽), Footer = 시각적 상단 (과거 메시지 쪽)
  // Scroller의 scaleY(-1)로 위치가 뒤집히므로 내용물도 scaleY(-1) 적용
  const VirtuosoHeader = useCallback(() => {
    const { hasPreviousPage: hpp, isFetchingPreviousPage: ifpp } = headerFooterDepsRef.current;
    return (
      <div className="flex justify-center items-center h-9" style={{ transform: "scaleY(-1)" }}>
        {(hpp || ifpp) && (
          <Loader2
            className={cn(
              "w-5 h-5 text-text-tertiary transition-opacity duration-150",
              ifpp ? "animate-spin opacity-100" : "opacity-0"
            )}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }, []);

  const VirtuosoFooter = useCallback(() => {
    const { hasNextPage: hnp, isFetchingNextPage: ifnp } = headerFooterDepsRef.current;
    return (
      <div className="flex justify-center items-center h-9" style={{ transform: "scaleY(-1)" }} aria-label={hnp ? "이전 메시지 로딩 중" : undefined}>
        {(hnp || ifnp) && (
          <Loader2
            className={cn(
              "w-5 h-5 text-text-tertiary transition-opacity duration-150",
              ifnp ? "animate-spin opacity-100" : "opacity-0"
            )}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }, []);

  const VirtuosoScroller = useMemo(
    () =>
      forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
        function Scroller(props, ref) {
          return (
            <div
              {...props}
              ref={(el) => {
                // scrollerElRef 캡처 (관성 스크롤 freeze용)
                scrollerElRef.current = el;
                // scaleY(-1) 반전 리스트: 스크롤 기반 "시각적 최하단" 감지
                attachScrollListenerRef.current(el);
                // Virtuoso가 전달한 ref도 연결
                if (typeof ref === "function") ref(el);
                else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }}
              style={{
                ...props.style,
                // Inverted List: 시각적으로 뒤집어 최신 메시지가 아래에 표시
                transform: "scaleY(-1)",
                overscrollBehavior: "none",
                touchAction: "pan-y",
                overflowAnchor: "none" as const,
                scrollBehavior: "auto" as const,
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

  // 1:1 헤더 아바타용 상대방 정보
  const directOtherUser = useMemo(() => {
    if (!room || room.type !== "direct") return null;
    return data.members.find((m) => m.user_id !== userId)?.user ?? null;
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
      {/* 키보드 관리: useVisualViewport를 격리하여 ChatRoom 리렌더 방지 */}
      <ChatKeyboardManager
        virtuosoHandleRef={virtuosoRef}
        isAtBottomStateRef={isAtBottomRef}
        isKeyboardTransitioningRef={isKeyboardTransitioning}
      />

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
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </button>
        )}

        {/* 1:1 채팅 헤더 아바타 (카카오톡 패턴) */}
        {directOtherUser && (
          <Avatar
            src={directOtherUser.profileImageUrl}
            name={directOtherUser.name}
            size="sm"
          />
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

      {/* ============================================
          Always-Mounted Virtuoso + 오버레이 패턴
          ============================================
          Virtuoso를 항상 마운트 상태로 유지. 로딩/에러/빈 상태는 오버레이로 처리.
          → DOM 교체(skeleton↔Virtuoso) 플리커 완전 제거.
      */}
      {error ? (
        /* 에러: Virtuoso 대신 에러 UI (에러 시에만 전체 교체 허용) */
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
      ) : (
        <div className="flex-1 relative min-h-0 bg-bg-primary">
          {/* Virtuoso: 항상 마운트 — data=[]이면 빈 상태로 대기 (DOM 교체 없음) */}
          {/* Two-Pass: archive 모드 초기 측정 중 opacity:0 → 안정화 후 DOM 직접 opacity:1 */}
          <div
            ref={(el) => {
              (messageListRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              virtuosoWrapperRef.current = el;
            }}
            className="absolute inset-0 flex flex-col outline-none"
            style={isArchiveEntry ? { opacity: 0 } : undefined}
            role="log"
            aria-label="메시지 목록"
            aria-live="polite"
            aria-relevant="additions"
            tabIndex={0}
            onKeyDown={handleListKeyDown}
          >
            <Virtuoso
              ref={virtuosoRef}
              className="flex-1"
              data={reversedMessages}
              initialTopMostItemIndex={
                // Inverted: reversed array에서의 인덱스
                // live 모드: index 0 = 최신 메시지 (시각적 최하단)
                // archive 모드: original index를 reversed로 변환
                modeState.mode === "live"
                  ? 0
                  : messages.length > 0
                    ? messages.length - 1 - initialScrollIndex
                    : 0
              }
              defaultItemHeight={estimatedItemHeight}
              followOutput={handleFollowOutput}
              atBottomThreshold={100}
              atBottomStateChange={handleAtBottomChange}
              startReached={handleStartReached}
              endReached={handleEndReached}
              rangeChanged={handleRangeChangedWithStabilization}
              computeItemKey={computeItemKey}
              increaseViewportBy={VIEWPORT_BUFFER[DEVICE_TIER]}
              components={virtuosoComponents}
              itemContent={renderMessage}
            />
          </div>

          {/* 로딩 오버레이: 캐시도 없고 서버 응답도 없을 때만 */}
          {isLoading && messages.length === 0 && (
            <div className="absolute inset-0 z-10 bg-bg-primary flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          )}

          {/* 빈 상태 오버레이 */}
          {!isLoading && messages.length === 0 && fetchStatus !== "fetching" && (
            <div
              className="absolute inset-0 z-10 bg-bg-primary flex flex-col items-center justify-center text-center gap-1"
            >
              <p className="text-text-secondary text-sm">
                아직 메시지가 없습니다
              </p>
              <p className="text-text-tertiary text-xs">
                첫 메시지를 보내보세요!
              </p>
            </div>
          )}
        </div>
      )}

      {/* 맨 아래로 스크롤 버튼 — ChatInput 바로 위에 부유 */}
      <div className="relative">
        <div
          className={cn(
            "absolute right-4 z-10",
            "bottom-2",
            "motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-out",
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
              "hover:bg-bg-secondary motion-safe:transition-[background-color,transform] motion-safe:duration-200",
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
        onSend={handleSend}
        onTypingChange={setTyping}
        replyTarget={replyTarget}
        onCancelReply={handleCancelReply}
        disabled={isLoading}
        placeholder={isLoading ? "메시지를 불러오는 중..." : undefined}
        onFilesSelected={attachmentState.addFiles}
        uploadingFiles={attachmentState.uploadingFiles}
        onRemoveFile={attachmentState.removeFile}
        onRetryFile={attachmentState.retryUpload}
        storageQuota={attachmentState.quota}
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
        onLeaveRoom={onLeaveRoom}
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
