"use client";

/**
 * ChatFAB - 플로팅 채팅 버튼
 *
 * 화면 우측 하단에 고정되며, 클릭 시 채팅 패널을 토글합니다.
 * 읽지 않은 메시지 수를 배지로 표시합니다.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { UnreadBadge } from "./UnreadBadge";
import { cn } from "@/lib/cn";

interface ChatFABProps {
  isOpen: boolean;
  unreadCount: number;
  onClick: () => void;
}

function ChatFABComponent({ isOpen, unreadCount, onClick }: ChatFABProps) {
  return (
    <motion.button
      type="button"
      data-chat-fab
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={cn(
        "fixed z-[45] flex items-center justify-center rounded-full shadow-lg transition-colors",
        "bg-primary-500 text-white hover:bg-primary-600",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // 모바일: bottom-nav 위 + safe-area, 데스크톱: 우측 하단
        "right-4 h-12 w-12 md:bottom-6 md:right-6 md:h-14 md:w-14",
        "bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6"
      )}
      aria-label={isOpen ? "채팅 닫기" : "채팅 열기"}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      <motion.div
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        {isOpen ? (
          <X className="h-5 w-5 md:h-6 md:w-6" />
        ) : (
          <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
        )}
      </motion.div>

      {/* 읽지 않은 메시지 배지 (패널 닫힘 상태에서만) */}
      {!isOpen && unreadCount > 0 && (
        <div className="absolute -top-1 -right-1">
          <UnreadBadge count={unreadCount} size="sm" />
        </div>
      )}
    </motion.button>
  );
}

export const ChatFAB = memo(ChatFABComponent);
