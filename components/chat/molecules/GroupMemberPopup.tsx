"use client";

/**
 * GroupMemberPopup - 그룹 채팅방 멤버 프리뷰 팝업
 *
 * 채팅방 목록에서 그룹 아바타 클릭 시 멤버 미리보기를 표시합니다.
 * 데스크톱: 클릭 위치 기반 팝업 / 모바일: 바텀시트
 * ProfileCardPopup과 동일한 포지셔닝·애니메이션 패턴을 사용합니다.
 */

import { memo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { lockScroll, unlockScroll } from "@/lib/utils/scrollLock";
import { Avatar } from "@/components/atoms/Avatar";
import { X, ArrowRight } from "lucide-react";
import type { ChatRoomListItem } from "@/lib/domains/chat/types";

interface GroupMemberPopupProps {
  isOpen: boolean;
  onClose: () => void;
  room: ChatRoomListItem | null;
  /** 클릭 위치 (있으면 데스크톱 팝업, null이면 모바일 바텀시트) */
  position?: { x: number; y: number } | null;
  /** 채팅방 진입 핸들러 */
  onEnterRoom: (roomId: string) => void;
}

function GroupMemberPopupComponent({
  isOpen,
  onClose,
  room,
  position,
  onEnterRoom,
}: GroupMemberPopupProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const isDesktop = !!position;
  const showPopup = isOpen && !!room;

  // Escape 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [isOpen, onClose]);

  // 모바일 스크롤 잠금
  useEffect(() => {
    if (isOpen && !isDesktop) {
      lockScroll();
      return () => unlockScroll();
    }
  }, [isOpen, isDesktop]);

  // 데스크톱 팝업 위치 보정
  useEffect(() => {
    const el = popupRef.current;
    if (!el || !position || !showPopup) return;

    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const margin = 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = position.x;
      let y = position.y;

      if (x + rect.width + margin > vw) x = vw - rect.width - margin;
      x = Math.max(margin, x);

      const spaceBelow = vh - position.y;
      if (spaceBelow < rect.height + margin) {
        y = position.y - rect.height - 8;
      }
      y = Math.max(margin, Math.min(y, vh - rect.height - margin));

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    });
    return () => cancelAnimationFrame(raf);
  }, [position, showPopup]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleEnterRoom = () => {
    if (room) {
      onClose();
      onEnterRoom(room.id);
    }
  };

  if (typeof window === "undefined" || !room) return null;

  const displayName = room.name ?? "그룹 채팅";
  const members = room.memberPreviews;

  const content = (compact: boolean) => (
    <>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-bg-secondary transition-colors z-10"
        aria-label="닫기"
      >
        <X className={cn("text-text-tertiary", compact ? "w-4 h-4" : "w-5 h-5")} />
      </button>

      {/* 헤더 */}
      <div className={cn("border-b border-border", compact ? "px-4 pt-3 pb-2" : "px-5 pt-5 pb-3")}>
        <h3 className={cn("font-semibold text-text-primary", compact ? "text-sm" : "text-base")}>
          {displayName}
        </h3>
        <span className="text-xs text-text-tertiary">
          {room.memberCount}명 참여 중
        </span>
      </div>

      {/* 멤버 리스트 */}
      <div className={cn(compact ? "px-2 py-1.5" : "px-3 py-2")}>
        {members.map((member, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2.5 rounded-lg",
              compact ? "px-2 py-1.5" : "px-2 py-2"
            )}
          >
            <Avatar
              name={member.name}
              src={member.profileImageUrl}
              size="sm"
            />
            <span className={cn(
              "text-text-primary truncate",
              compact ? "text-sm" : "text-sm"
            )}>
              {member.name}
            </span>
          </div>
        ))}
        {room.memberCount > members.length && (
          <p className={cn(
            "text-text-tertiary text-center",
            compact ? "text-xs py-1" : "text-xs py-1.5"
          )}>
            외 {room.memberCount - members.length}명
          </p>
        )}
      </div>

      {/* 채팅방 열기 버튼 */}
      <div className={cn("border-t border-border", compact ? "px-4 py-2.5" : "px-5 py-3")}>
        <button
          type="button"
          onClick={handleEnterRoom}
          className={cn(
            "w-full flex items-center justify-center gap-1.5",
            "bg-primary-500 text-white font-medium transition-colors",
            "hover:bg-primary-600 active:bg-primary-700",
            compact ? "py-2 rounded-lg text-xs" : "py-2.5 rounded-xl text-sm"
          )}
        >
          채팅방 열기
          <ArrowRight className={cn(compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
        </button>
      </div>
    </>
  );

  // 데스크톱: 클릭 위치 기반 팝업
  if (isDesktop && position) {
    return createPortal(
      <AnimatePresence>
        {showPopup && (
          <>
            <motion.div
              key="group-desktop-backdrop"
              ref={backdropRef}
              onClick={handleBackdropClick}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/20"
              data-chat-overlay
              aria-hidden="true"
            />
            <motion.div
              key="group-desktop-popup"
              ref={popupRef}
              style={{ left: position.x, top: position.y }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "fixed z-50",
                "bg-bg-primary rounded-xl",
                "border border-border",
                "shadow-xl",
                "w-64",
                "overflow-hidden"
              )}
              role="dialog"
              aria-label={`${displayName} 멤버`}
            >
              {content(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    );
  }

  // 모바일: 바텀시트
  return createPortal(
    <AnimatePresence>
      {showPopup && (
        <>
          <motion.div
            key="group-mobile-backdrop"
            ref={backdropRef}
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            data-chat-overlay
            aria-hidden="true"
          />
          <motion.div
            key="group-mobile-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50",
              "bg-bg-primary rounded-t-2xl",
              "pb-[env(safe-area-inset-bottom)]",
              "w-full"
            )}
            role="dialog"
            aria-modal="true"
            aria-label={`${displayName} 멤버`}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-text-tertiary/30" />
            </div>
            {content(false)}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export const GroupMemberPopup = memo(GroupMemberPopupComponent);
