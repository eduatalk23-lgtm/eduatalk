"use client";

/**
 * ChatPopover - 플로팅 채팅 패널
 *
 * 데스크톱: 우측 하단 380x560px 패널
 * 모바일: 전체 화면
 * 미디어 쿼리로 분기하여 단일 패널만 렌더합니다.
 *
 * 헤더 전략:
 * - list 뷰: Popover 자체 헤더 표시, ChatList는 hideHeader
 * - room 뷰: Popover 헤더 없음, ChatRoom에 headerActions 주입
 */

import { memo, useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft, MessageSquarePlus } from "lucide-react";
import { ChatList } from "./ChatList";
import { ChatRoom } from "./ChatRoom";
import { cn } from "@/lib/cn";
import { lockScroll, unlockScroll } from "@/lib/utils/scrollLock";

type PopoverView = "list" | "room";

interface ChatPopoverProps {
  userId: string;
  basePath: string;
  onClose: () => void;
  CreateChatModal: React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
    basePath: string;
    onRoomCreated?: (roomId: string) => void;
  }>;
}

/** md 브레이크포인트 (Tailwind 기본값 768px) */
const MD_BREAKPOINT = "(min-width: 768px)";

/** 데스크톱 패널 애니메이션 */
const desktopVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 25, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: { duration: 0.15 },
  },
};

/** 모바일 풀스크린 애니메이션 */
const mobileVariants = {
  hidden: { opacity: 0, y: "100%" },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 30, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    y: "100%",
    transition: { duration: 0.2 },
  },
};

function getIsDesktop(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(MD_BREAKPOINT).matches;
}

function useIsDesktop(): boolean {
  const isDesktopSync = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }
      const mql = window.matchMedia(MD_BREAKPOINT);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    getIsDesktop,
    () => false // SSR
  );

  // Hydration 완료 후 실제 값으로 업데이트
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR/초기 렌더링 시 false 반환, 마운트 후 실제 값 반환
  return mounted ? isDesktopSync : false;
}

function ChatPopoverComponent({
  userId,
  basePath,
  onClose,
  CreateChatModal,
}: ChatPopoverProps) {
  const [view, setView] = useState<PopoverView>("list");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  // 채팅방 선택
  const handleRoomClick = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setView("room");
  }, []);

  // 목록으로 돌아가기
  const handleBack = useCallback(() => {
    setView("list");
    setSelectedRoomId(null);
  }, []);

  // 새 채팅방 생성 후 이동
  const handleRoomCreated = useCallback((roomId: string) => {
    setIsCreateModalOpen(false);
    setSelectedRoomId(roomId);
    setView("room");
  }, []);

  // Escape 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isCreateModalOpen) return;
        if (view === "room") {
          handleBack();
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [view, isCreateModalOpen, handleBack, onClose]);

  // 데스크톱: 패널 바깥 클릭 시 닫기
  useEffect(() => {
    if (!isDesktop) return;

    const handlePointerDown = (e: PointerEvent) => {
      // 모달이 열려 있으면 바깥 클릭 무시
      if (isCreateModalOpen) return;

      const target = e.target as HTMLElement;
      // FAB 버튼 클릭은 제외 (FAB이 자체 토글 처리)
      if (target.closest("[data-chat-fab]")) return;
      // 패널 내부 클릭은 무시
      if (panelRef.current?.contains(target)) return;
      // Dialog/Modal 내부 클릭은 무시 (Portal로 body에 렌더링됨)
      if (target.closest("[role='dialog']")) return;
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isDesktop, isCreateModalOpen, onClose]);

  // 모바일: body 스크롤 잠금 (카운터 기반)
  useEffect(() => {
    if (isDesktop) return;

    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [isDesktop]);

  // 포커스 트랩 (데스크톱/모바일 공통)
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = panel.querySelectorAll(focusableSelector);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    panel.addEventListener("keydown", handleTabKey);
    return () => panel.removeEventListener("keydown", handleTabKey);
  }, [isDesktop]);

  // ChatRoom 헤더에 주입할 액션 버튼
  const roomHeaderActions = isDesktop ? (
    <button
      type="button"
      onClick={onClose}
      className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
      aria-label="채팅 닫기"
    >
      <X className="h-4 w-4 text-text-secondary" />
    </button>
  ) : null;

  // 공통 콘텐츠 영역
  const contentArea = (
    <div className="flex-1 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {view === "list" ? (
          <motion.div
            key="list"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <ChatList
              onRoomClick={handleRoomClick}
              onNewChat={() => setIsCreateModalOpen(true)}
              hideHeader
            />
          </motion.div>
        ) : selectedRoomId ? (
          <motion.div
            key="room"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <ChatRoom
              roomId={selectedRoomId}
              userId={userId}
              onBack={handleBack}
              basePath={basePath}
              headerActions={roomHeaderActions}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  // list 뷰 전용 Popover 헤더
  const listHeader = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-primary">
      <div className="flex items-center gap-2">
        {!isDesktop && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-bg-secondary transition-colors"
            aria-label="채팅 닫기"
          >
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
        )}
        <h2 className="text-base font-semibold text-text-primary">
          채팅 목록
        </h2>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
          aria-label="새 채팅"
          title="새 채팅"
        >
          <MessageSquarePlus className="h-4 w-4 text-text-secondary" />
        </button>
        {isDesktop && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
            aria-label="채팅 닫기"
          >
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isDesktop ? (
        /* 데스크톱 패널 */
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label="채팅"
          aria-modal="false"
          variants={desktopVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(
            "fixed z-[40] flex flex-col overflow-hidden bg-bg-primary border border-border shadow-2xl",
            "bottom-24 right-6 w-[380px] h-[560px] rounded-2xl",
          )}
        >
          {view === "list" && listHeader}
          {contentArea}
        </motion.div>
      ) : (
        /* 모바일 풀스크린 */
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label="채팅"
          aria-modal="true"
          variants={mobileVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[40] flex flex-col bg-bg-primary pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        >
          {view === "list" && listHeader}
          {contentArea}
        </motion.div>
      )}

      {/* 새 채팅 모달 */}
      <CreateChatModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        basePath={basePath}
        onRoomCreated={handleRoomCreated}
      />
    </>
  );
}

export const ChatPopover = memo(ChatPopoverComponent);
