"use client";

/**
 * MessageReadersModal - 메시지 읽음 상세 정보 모달
 *
 * 카카오톡 Message Info처럼 메시지를 읽은/안 읽은 멤버 목록을 표시합니다.
 * 모바일: 바텀시트, 데스크톱: 센터 모달
 */

import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/atoms/Avatar";
import { useEscapeKey } from "@/lib/accessibility/hooks";
import { getMessageReadersAction } from "@/lib/domains/chat/actions";
import type { MessageReaderInfo } from "@/lib/domains/chat/actions";
import { X, Loader2, Eye, EyeOff } from "lucide-react";

interface MessageReadersModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  messageCreatedAt: string;
}

function MessageReadersModalComponent({
  isOpen,
  onClose,
  roomId,
  messageCreatedAt,
}: MessageReadersModalProps) {
  const [readers, setReaders] = useState<MessageReaderInfo[]>([]);
  const [nonReaders, setNonReaders] = useState<MessageReaderInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    getMessageReadersAction(roomId, messageCreatedAt)
      .then((result) => {
        if (result.success && result.data) {
          setReaders(result.data.readers);
          setNonReaders(result.data.nonReaders);
        } else {
          setError(result.error ?? "읽음 정보를 불러올 수 없습니다.");
        }
      })
      .catch(() => {
        setError("읽음 정보를 불러올 수 없습니다.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, roomId, messageCreatedAt]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 배경 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* 모달 */}
      <div
        className={cn(
          "relative bg-bg-primary rounded-t-2xl sm:rounded-2xl",
          "w-full sm:max-w-sm max-h-[70vh] flex flex-col",
          "shadow-xl animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 duration-200"
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-text-primary">읽음 정보</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-bg-secondary transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-text-tertiary text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* 읽은 멤버 */}
              <Section
                icon={<Eye className="w-4 h-4" />}
                label="읽음"
                count={readers.length}
                members={readers}
              />

              {/* 안 읽은 멤버 */}
              {nonReaders.length > 0 && (
                <Section
                  icon={<EyeOff className="w-4 h-4" />}
                  label="안 읽음"
                  count={nonReaders.length}
                  members={nonReaders}
                  className="mt-3"
                />
              )}

              {readers.length === 0 && nonReaders.length === 0 && (
                <div className="py-8 text-center text-text-tertiary text-sm">
                  읽음 정보가 없습니다.
                </div>
              )}
            </>
          )}
        </div>

        {/* 모바일 하단 여백 (safe area) */}
        <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  count,
  members,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  members: MessageReaderInfo[];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 py-2 text-sm font-medium text-text-secondary">
        {icon}
        <span>
          {label} ({count})
        </span>
      </div>
      <ul className="space-y-0.5">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex items-center gap-3 px-2 py-2 rounded-lg"
          >
            <Avatar
              src={member.profileImageUrl}
              name={member.name}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {member.name}
              </p>
              {member.readAt && (
                <p className="text-xs text-text-tertiary">
                  {formatReadTime(member.readAt)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatReadTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const MessageReadersModal = memo(MessageReadersModalComponent);
