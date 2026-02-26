"use client";

/**
 * ProfileCardPopup - 프로필 카드 팝업
 *
 * 채팅방에서 아바타 클릭 시 표시되는 프로필 카드입니다.
 *
 * 데스크톱: 클릭 위치 근처에 위치 기반 팝업 (팝오버 안에서도 자연스러움)
 * 모바일: 하단 시트 (바텀시트)
 */

import { memo, useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useEscapeKey } from "@/lib/accessibility/hooks";
import { Avatar } from "@/components/atoms/Avatar";
import { MessageSquare, X, Loader2 } from "lucide-react";
import { startDirectChatAction } from "@/lib/domains/chat/actions";
import type { ChatUserType } from "@/lib/domains/chat/types";

/** 프로필 카드에 표시할 데이터 */
export interface ProfileCardData {
  userId: string;
  userType: ChatUserType;
  name: string;
  profileImageUrl?: string | null;
  schoolName?: string | null;
  gradeDisplay?: string | null;
}

/** 역할 라벨 */
const roleLabels: Record<ChatUserType, string> = {
  student: "학생",
  admin: "관리자",
  parent: "학부모",
};

interface ProfileCardPopupProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileCardData | null;
  /** 클릭 위치 (있으면 데스크톱 팝업, 없으면 모바일 바텀시트) */
  position?: { x: number; y: number } | null;
  currentUserId?: string;
  basePath?: string;
}

function ProfileCardPopupComponent({
  isOpen,
  onClose,
  profile,
  position,
  currentUserId,
  basePath = "/chat",
}: ProfileCardPopupProps) {
  const router = useRouter();
  const [isStartingChat, setIsStartingChat] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, isOpen);

  const isDesktopPopup = !!position;

  // 모바일 바텀시트: body 스크롤 방지
  useEffect(() => {
    if (isOpen && !isDesktopPopup) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, isDesktopPopup]);

  // 데스크톱 팝업: 뷰포트 안에 맞추기 (callback ref)
  const popupCallbackRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !position) return;

      const rect = el.getBoundingClientRect();
      const padding = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let x = position.x;
      let y = position.y;

      if (x + rect.width + padding > vw) x = vw - rect.width - padding;
      if (y + rect.height + padding > vh) y = vh - rect.height - padding;
      x = Math.max(padding, x);
      y = Math.max(padding, y);

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },
    [position]
  );

  const handleStartDirectChat = useCallback(async () => {
    if (!profile || isStartingChat) return;

    setIsStartingChat(true);
    try {
      const result = await startDirectChatAction(
        profile.userId,
        profile.userType
      );
      if (result.success && result.data) {
        onClose();
        router.push(`${basePath}/${result.data.id}`);
      }
    } finally {
      setIsStartingChat(false);
    }
  }, [profile, isStartingChat, onClose, router, basePath]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!isOpen || !profile) return null;

  const isMe = profile.userId === currentUserId;
  const studentInfo = [profile.schoolName, profile.gradeDisplay]
    .filter(Boolean)
    .join(" · ");

  /** 프로필 정보 + 액션 버튼 (공통) */
  const profileContent = (compact: boolean) => (
    <>
      {/* 닫기 버튼 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-bg-secondary transition-colors z-10"
        aria-label="닫기"
      >
        <X className={cn("text-text-tertiary", compact ? "w-4 h-4" : "w-5 h-5")} />
      </button>

      {/* 프로필 정보 */}
      <div className={cn(
        "flex flex-col items-center",
        compact ? "pt-5 pb-3 px-4" : "pt-8 pb-4 px-6"
      )}>
        <Avatar
          src={profile.profileImageUrl}
          name={profile.name}
          size={compact ? "lg" : "xl"}
        />
        <h3 className={cn(
          "font-semibold text-text-primary",
          compact ? "mt-2 text-base" : "mt-3 text-lg"
        )}>
          {profile.name}
        </h3>
        <span
          className={cn(
            "mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full",
            profile.userType === "admin"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          )}
        >
          {roleLabels[profile.userType]}
        </span>
        {studentInfo && (
          <p className="mt-1.5 text-sm text-text-secondary">{studentInfo}</p>
        )}
      </div>

      {/* 1:1 채팅 버튼 */}
      {!isMe && (
        <div className={cn(compact ? "px-4 pb-4" : "px-6 pb-6")}>
          <button
            type="button"
            onClick={handleStartDirectChat}
            disabled={isStartingChat}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              compact ? "py-2.5 rounded-lg text-sm" : "py-3 rounded-xl",
              "bg-primary text-white font-medium",
              "hover:bg-primary-600 active:bg-primary-700",
              "transition-colors",
              isStartingChat && "opacity-50 cursor-not-allowed"
            )}
          >
            {isStartingChat ? (
              <Loader2 className={cn("animate-spin", compact ? "w-4 h-4" : "w-5 h-5")} />
            ) : (
              <MessageSquare className={cn(compact ? "w-4 h-4" : "w-5 h-5")} />
            )}
            <span>{isStartingChat ? "채팅방 열기..." : "1:1 채팅"}</span>
          </button>
        </div>
      )}
    </>
  );

  // ─── 데스크톱: 클릭 위치에 팝업 ───
  if (isDesktopPopup && position) {
    const desktopContent = (
      <>
        {/* 투명 배경 (클릭 시 닫기) */}
        <div
          ref={backdropRef}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-40"
          data-chat-overlay
          aria-hidden="true"
        />

        {/* 프로필 카드 팝업 */}
        <div
          ref={popupCallbackRef}
          style={{ left: position.x, top: position.y }}
          className={cn(
            "fixed z-50",
            "bg-bg-primary rounded-xl",
            "border border-border",
            "shadow-xl",
            "w-64",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "overflow-hidden"
          )}
          role="dialog"
          aria-label={`${profile.name} 프로필`}
        >
          {profileContent(true)}
        </div>
      </>
    );

    if (typeof window === "undefined") return null;
    return createPortal(desktopContent, document.body);
  }

  // ─── 모바일: 하단 시트 ───
  const mobileContent = (
    <>
      {/* 딤 배경 */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className={cn(
          "fixed inset-0 z-40 bg-black/50",
          "animate-in fade-in-0 duration-200"
        )}
        data-chat-overlay
        aria-hidden="true"
      />

      {/* 하단 시트 */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50",
          "bg-bg-primary rounded-t-2xl",
          "animate-in slide-in-from-bottom duration-200",
          "pb-safe",
          "w-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name} 프로필`}
      >
        {profileContent(false)}
      </div>
    </>
  );

  if (typeof window === "undefined") return null;
  return createPortal(mobileContent, document.body);
}

export const ProfileCardPopup = memo(ProfileCardPopupComponent);
