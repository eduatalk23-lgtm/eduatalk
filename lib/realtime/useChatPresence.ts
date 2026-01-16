"use client";

/**
 * useChatPresence - 채팅방 Presence 상태 관리
 *
 * Supabase Presence API를 사용하여:
 * - 타이핑 인디케이터 (누가 입력 중인지)
 * - 온라인 상태 (누가 접속 중인지)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PresenceUser } from "@/lib/domains/chat/types";

interface UseChatPresenceOptions {
  /** 채팅방 ID */
  roomId: string;
  /** 현재 사용자 ID */
  userId: string;
  /** 현재 사용자 이름 */
  userName: string;
  /** 활성화 여부 */
  enabled?: boolean;
}

interface UseChatPresenceReturn {
  /** 온라인 사용자 목록 (자신 제외) */
  onlineUsers: PresenceUser[];
  /** 타이핑 중인 사용자 목록 (자신 제외) */
  typingUsers: PresenceUser[];
  /** 타이핑 상태 설정 */
  setTyping: (isTyping: boolean) => void;
}

/** 타이핑 자동 해제 타임아웃 (ms) */
const TYPING_TIMEOUT = 2000;

export function useChatPresence({
  roomId,
  userId,
  userName,
  enabled = true,
}: UseChatPresenceOptions): UseChatPresenceReturn {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Presence 채널 구독
  useEffect(() => {
    if (!enabled || !roomId || !userId || !userName) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`presence-${roomId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();

        // 모든 사용자 목록 (자신 제외)
        const allUsers = Object.values(state)
          .flat()
          .filter((u) => u.userId !== userId);

        setOnlineUsers(allUsers);
        setTypingUsers(allUsers.filter((u) => u.isTyping));
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        // 새 사용자 입장 시 로그 (디버깅용)
        if (process.env.NODE_ENV === "development") {
          console.log("[Presence] User joined:", newPresences);
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        // 사용자 퇴장 시 로그 (디버깅용)
        if (process.env.NODE_ENV === "development") {
          console.log("[Presence] User left:", leftPresences);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // 초기 상태 등록
          await channel.track({
            userId,
            name: userName,
            isTyping: false,
            lastSeen: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      // 타이핑 타임아웃 정리
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // 채널 정리
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, userId, userName, enabled]);

  // 타이핑 상태 업데이트
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current) return;

      // 기존 타임아웃 클리어
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // 상태 업데이트
      channelRef.current.track({
        userId,
        name: userName,
        isTyping,
        lastSeen: new Date().toISOString(),
      });

      // 타이핑 중이면 자동 해제 타이머 설정
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          channelRef.current?.track({
            userId,
            name: userName,
            isTyping: false,
            lastSeen: new Date().toISOString(),
          });
        }, TYPING_TIMEOUT);
      }
    },
    [userId, userName]
  );

  return {
    onlineUsers,
    typingUsers,
    setTyping,
  };
}
