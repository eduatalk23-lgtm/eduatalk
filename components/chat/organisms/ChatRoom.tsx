"use client";

/**
 * ChatRoom - 채팅방 전체 뷰
 *
 * 메시지 목록 + 입력창을 포함합니다.
 * 비즈니스 로직은 useChatRoomLogic 훅으로 분리되어 있습니다.
 */

import { memo, useRef, useCallback, useState, useMemo } from "react";
import { useChatRoomLogic } from "@/lib/domains/chat/hooks";
import type { ReactionEmoji, ReplyTargetInfo } from "@/lib/domains/chat/types";
import { cn } from "@/lib/cn";
import { MessageBubble } from "../atoms/MessageBubble";
import { DateDivider } from "../atoms/DateDivider";
import { TypingIndicator } from "../atoms/TypingIndicator";
import { OnlineStatus } from "../atoms/OnlineStatus";
import { ChatInput } from "../molecules/ChatInput";
import { MessageSearch } from "../molecules/MessageSearch";
import { PinnedMessagesBar } from "../molecules/PinnedMessagesBar";
import { AnnouncementBanner } from "../atoms/AnnouncementBanner";
import { AnnouncementDialog } from "../molecules/AnnouncementDialog";
import { MessageContextMenu, type MessageMenuContext } from "../molecules/MessageContextMenu";
import { ChatRoomInfo } from "./ChatRoomInfo";
import { EditMessageDialog } from "../molecules/EditMessageDialog";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Loader2, ArrowLeft, MoreVertical, Search, Megaphone, ChevronDown } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

interface ChatRoomProps {
  /** 채팅방 ID */
  roomId: string;
  /** 현재 사용자 ID */
  userId: string;
  /** 뒤로 가기 핸들러 */
  onBack?: () => void;
  /** 메뉴 버튼 클릭 핸들러 */
  onMenuClick?: () => void;
}

function ChatRoomComponent({
  roomId,
  userId,
  onBack,
}: ChatRoomProps) {
  // ============================================
  // UI 상태
  // ============================================
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [firstItemIndex, setFirstItemIndex] = useState(10000);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [menuContext, setMenuContext] = useState<MessageMenuContext | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    content: string;
  } | null>(null);

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
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasNewMessages(false);
    }
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
      if (isAtBottom) {
        scrollToBottom();
      } else {
        setHasNewMessages(true);
      }
    }, [isAtBottom, scrollToBottom]),
  });

  const { room, messages, pinnedMessages, announcement, readCounts, onlineUsers, typingUsers } = data;
  const { canPin, canSetAnnouncement } = permissions;
  const { sendMessage, toggleReaction, togglePin, setAnnouncement, setTyping, retryMessage, removeFailedMessage } = actions;
  const { isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } = status;
  const { replyTarget, setReplyTarget } = replyTargetState;
  const { canEditMessage, isMessageEdited } = utils;

  // ============================================
  // 사이드바 핸들러
  // ============================================
  const handleInfoOpen = useCallback(() => {
    setIsInfoOpen(true);
  }, []);

  const handleInfoClose = useCallback(() => {
    setIsInfoOpen(false);
  }, []);

  // ============================================
  // 무한 스크롤
  // ============================================
  const handleStartReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().then(() => {
        setFirstItemIndex((prev) => prev - 50);
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ============================================
  // 메시지 스크롤
  // ============================================
  const scrollToMessage = useCallback((messageId: string) => {
    setIsSearchMode(false);
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

  const handleEdit = useCallback((messageId: string, currentContent: string) => {
    setEditingMessage({ id: messageId, content: currentContent });
  }, []);

  const handleDelete = useCallback((messageId: string) => {
    setDeleteTarget(messageId);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      actions.deleteMessage(deleteTarget);
    }
    setDeleteTarget(null);
  }, [deleteTarget, actions]);

  const handleEditSave = useCallback((newContent: string) => {
    if (editingMessage) {
      actions.editMessage(editingMessage.id, newContent);
    }
    setEditingMessage(null);
  }, [editingMessage, actions]);

  // ============================================
  // 컨텍스트 메뉴
  // ============================================
  const handleMessageLongPress = useCallback((message: (typeof messages)[number]) => {
    const isOwn = message.sender_id === userId;
    setMenuContext({
      messageId: message.id,
      content: message.content,
      isOwn,
      canEdit: isOwn && canEditMessage(message.created_at),
      canPin: canPin && message.message_type !== "system",
      isPinned: pinnedMessageIds.has(message.id),
    });
    setIsMenuOpen(true);
  }, [userId, canEditMessage, canPin, pinnedMessageIds]);

  const handleCopy = useCallback(async () => {
    if (menuContext) {
      await navigator.clipboard.writeText(menuContext.content);
    }
    setIsMenuOpen(false);
  }, [menuContext]);

  const handleMenuReply = useCallback(() => {
    if (menuContext) {
      const message = messages.find((m) => m.id === menuContext.messageId);
      if (message) handleReply(message);
    }
    setIsMenuOpen(false);
  }, [menuContext, messages, handleReply]);

  const handleMenuEdit = useCallback(() => {
    if (menuContext?.canEdit) {
      handleEdit(menuContext.messageId, menuContext.content);
    }
    setIsMenuOpen(false);
  }, [menuContext, handleEdit]);

  const handleMenuDelete = useCallback(() => {
    if (menuContext?.isOwn) {
      handleDelete(menuContext.messageId);
    }
    setIsMenuOpen(false);
  }, [menuContext, handleDelete]);

  const handleMenuTogglePin = useCallback(() => {
    if (menuContext?.canPin) {
      togglePin(menuContext.messageId, menuContext.isPinned);
    }
    setIsMenuOpen(false);
  }, [menuContext, togglePin]);

  const handleMenuReaction = useCallback((emoji: ReactionEmoji) => {
    if (menuContext) {
      toggleReaction(menuContext.messageId, emoji);
    }
    setIsMenuOpen(false);
  }, [menuContext, toggleReaction]);

  // ============================================
  // 메시지 렌더링
  // ============================================
  const getRefCallback = useCallback((messageId: string) => (el: HTMLDivElement | null) => {
    if (el) messageRefs.current.set(messageId, el);
    else messageRefs.current.delete(messageId);
  }, []);

  const renderMessage = useCallback((_index: number, message: (typeof messages)[number]) => {
    const isOwn = message.sender_id === userId;
    const messageReplyTarget = (message as { replyTarget?: ReplyTargetInfo | null }).replyTarget;
    const messageStatus = (message as { status?: string }).status;
    const { grouping } = message;

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
            content={message.content}
            isOwn={isOwn}
            senderName={message.sender?.name}
            createdAt={message.created_at}
            isSystem={message.message_type === "system"}
            isEdited={isMessageEdited(message)}
            unreadCount={isOwn ? readCounts[message.id] : undefined}
            canEdit={isOwn && canEditMessage(message.created_at)}
            reactions={(message as { reactions?: Array<{ emoji: ReactionEmoji; count: number; hasReacted: boolean }> }).reactions ?? []}
            replyTarget={messageReplyTarget}
            isPinned={pinnedMessageIds.has(message.id)}
            canPin={canPin && message.message_type !== "system"}
            showName={grouping.showName}
            showTime={grouping.showTime}
            isGrouped={grouping.isGrouped}
            isError={messageStatus === "error"}
            isRetrying={messageStatus === "sending" && message.id.startsWith("temp-")}
            onRetry={messageStatus === "error" ? () => retryMessage(message) : undefined}
            onRemoveFailed={messageStatus === "error" ? () => removeFailedMessage(message.id) : undefined}
            onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
            onReply={message.message_type !== "system" ? () => handleReply(message) : undefined}
            onReplyTargetClick={messageReplyTarget ? () => scrollToMessage(messageReplyTarget.id) : undefined}
            onTogglePin={() => togglePin(message.id, pinnedMessageIds.has(message.id))}
            onEdit={() => handleEdit(message.id, message.content)}
            onDelete={() => handleDelete(message.id)}
            onLongPress={() => handleMessageLongPress(message)}
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
    retryMessage,
    removeFailedMessage,
    toggleReaction,
    handleReply,
    scrollToMessage,
    togglePin,
    handleEdit,
    handleDelete,
    handleMessageLongPress,
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
    <div className="relative flex flex-col h-full bg-bg-primary">
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

        <button
          type="button"
          onClick={() => setIsSearchMode(true)}
          className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
        >
          <Search className="w-5 h-5 text-text-secondary" />
        </button>

        {canSetAnnouncement && (
          <button
            type="button"
            onClick={() => setIsAnnouncementDialogOpen(true)}
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
      </div>

      {/* 공지 배너 */}
      {announcement && (
        <AnnouncementBanner
          announcement={announcement}
          canEdit={canSetAnnouncement}
          onEdit={() => setIsAnnouncementDialogOpen(true)}
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
        <div className="absolute inset-0 z-10">
          <MessageSearch
            roomId={roomId}
            onClose={() => setIsSearchMode(false)}
            onSelectMessage={scrollToMessage}
          />
        </div>
      )}

      {/* 메시지 목록 */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-text-secondary text-sm">
            메시지를 불러오지 못했습니다
          </p>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
          <p className="text-text-secondary text-sm">
            아직 메시지가 없습니다
          </p>
          <p className="text-text-tertiary text-xs">
            첫 메시지를 보내보세요!
          </p>
        </div>
      ) : (
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
                <div className="flex justify-center py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
                </div>
              ) : null
            ),
            ScrollSeekPlaceholder,
          }}
          itemContent={renderMessage}
        />
      )}

      {/* 맨 아래로 스크롤 버튼 */}
      <div
        className={cn(
          "absolute bottom-28 right-4 z-10",
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

      {/* 입력창 */}
      <ChatInput
        onSend={(content) => sendMessage(content, replyTarget?.id)}
        onTypingChange={setTyping}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
      />

      {/* 공지 설정 다이얼로그 */}
      <AnnouncementDialog
        open={isAnnouncementDialogOpen}
        onOpenChange={setIsAnnouncementDialogOpen}
        currentContent={announcement?.content}
        onSave={(content) => {
          setAnnouncement(content);
          setIsAnnouncementDialogOpen(false);
        }}
        isSaving={false}
      />

      {/* 메시지 컨텍스트 메뉴 */}
      <MessageContextMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
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
      />

      {/* 메시지 삭제 확인 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
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
        onOpenChange={(open) => !open && setEditingMessage(null)}
        currentContent={editingMessage?.content ?? ""}
        onSave={handleEditSave}
        isSaving={status.isEditing}
      />
    </div>
  );
}

export const ChatRoom = memo(ChatRoomComponent);
