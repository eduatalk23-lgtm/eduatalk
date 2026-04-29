"use client";

/**
 * ForwardModal - 메시지 전달 대상 채팅방 선택 모달
 *
 * 채팅방 목록에서 전달할 방을 선택합니다.
 */

import { memo, useState, useMemo, useCallback, useTransition, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/atoms/Avatar";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";
import { sendMessageAction } from "@/lib/domains/chat/actions";
import { Search, X, Loader2, Users, Check } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

interface ForwardModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 전달할 메시지 내용 */
  content: string;
  /** 원본 발신자 이름 (전달 메시지에 표시) */
  senderName: string;
  /** 현재 채팅방 ID (목록에서 제외) */
  currentRoomId: string;
  /** 원본 메시지에 첨부파일이 있는지 */
  hasAttachment?: boolean;
}

function ForwardModalComponent({
  isOpen,
  onClose,
  content,
  senderName,
  currentRoomId,
  hasAttachment = false,
}: ForwardModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  // 모달이 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedRoomIds(new Set());
      setSearchQuery("");
    }
  }, [isOpen]);

  const { data: rooms = [] } = useQuery({
    ...chatRoomsQueryOptions(),
    enabled: isOpen,
  });

  const filteredRooms = useMemo(() => {
    const available = rooms.filter((r) => r.id !== currentRoomId);
    if (!searchQuery.trim()) return available;
    const query = searchQuery.toLowerCase();
    return available.filter((room) => {
      const name = room.type === "direct" ? room.otherUser?.name : room.name;
      return name?.toLowerCase().includes(query);
    });
  }, [rooms, currentRoomId, searchQuery]);

  const toggleRoom = useCallback((roomId: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  }, []);

  const handleForward = useCallback(() => {
    if (selectedRoomIds.size === 0) return;

    startTransition(async () => {
      const forwardContent = `[전달된 메시지] ${senderName}:\n${content}`;

      const results = await Promise.allSettled(
        Array.from(selectedRoomIds).map((roomId) =>
          sendMessageAction(roomId, forwardContent)
        )
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        showSuccess(
          selectedRoomIds.size === 1
            ? "메시지가 전달되었습니다."
            : `${successCount}개 채팅방에 전달되었습니다.`
        );
      } else {
        showError(`${failCount}개 채팅방 전달 실패`);
      }

      setSelectedRoomIds(new Set());
      setSearchQuery("");
      onClose();
    });
  }, [selectedRoomIds, content, senderName, onClose, showSuccess, showError]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 배경 */}
      <div
        className="absolute inset-0 bg-bg-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모달 */}
      <div
        className={cn(
          "relative w-full sm:max-w-md bg-bg-primary rounded-t-2xl sm:rounded-2xl",
          "max-h-[80vh] flex flex-col",
          "animate-in fade-in slide-in-from-bottom-4 duration-200"
        )}
        role="dialog"
        aria-label="메시지 전달"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-text-primary">메시지 전달</h3>
          <div className="flex items-center gap-2">
            {selectedRoomIds.size > 0 && (
              <button
                type="button"
                onClick={handleForward}
                disabled={isPending}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  isPending
                    ? "bg-secondary-200 text-text-tertiary cursor-not-allowed"
                    : "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700"
                )}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `전달 (${selectedRoomIds.size})`
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* 전달할 메시지 미리보기 */}
        <div className="px-4 py-2 bg-bg-secondary border-b border-border">
          <p className="text-xs text-text-tertiary">{senderName}</p>
          <p className="text-sm text-text-secondary truncate">{content || "(텍스트 없음)"}</p>
          {hasAttachment && (
            <p className="text-xs text-amber-500 mt-1">첨부파일은 전달되지 않습니다. 텍스트만 전달됩니다.</p>
          )}
        </div>

        {/* 검색 */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded-xl">
            <Search className="w-4 h-4 text-text-tertiary flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="채팅방 검색..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-0.5 text-text-tertiary hover:text-text-secondary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 채팅방 목록 */}
        <div className="flex-1 overflow-y-auto px-2 pb-[env(safe-area-inset-bottom)]">
          {filteredRooms.length === 0 ? (
            <p className="text-center text-sm text-text-tertiary py-8">
              {searchQuery ? "검색 결과가 없습니다" : "전달할 채팅방이 없습니다"}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredRooms.map((room) => {
                const isSelected = selectedRoomIds.has(room.id);
                const displayName =
                  room.type === "direct"
                    ? room.otherUser?.name ?? "알 수 없음"
                    : room.name ?? `그룹 (${room.memberCount}명)`;

                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => toggleRoom(room.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors",
                      isSelected
                      ? "bg-primary-50 dark:bg-primary-900/30 border-l-2 border-primary"
                      : "hover:bg-secondary-100 border-l-2 border-transparent"
                    )}
                  >
                    {/* 아바타 */}
                    {room.type === "direct" && room.otherUser ? (
                      <Avatar
                        name={room.otherUser.name}
                        src={room.otherUser.profileImageUrl}
                        size="md"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-text-secondary" />
                      </div>
                    )}

                    <span className="flex-1 font-medium text-text-primary truncate">
                      {displayName}
                    </span>

                    {/* 선택 체크 */}
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                        isSelected
                          ? "bg-primary-500 border-primary"
                          : "border-border"
                      )}
                    >
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const ForwardModal = memo(ForwardModalComponent);
