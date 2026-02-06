"use client";

/**
 * useChatPresence - 채팅방 Presence 상태 관리
 *
 * Supabase Presence API를 사용하여:
 * - 타이핑 인디케이터 (누가 입력 중인지)
 * - 온라인 상태 (누가 접속 중인지)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
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

  // userName을 ref로 추적 (useEffect 의존성에서 제외하여 채널 재생성 방지)
  const userNameRef = useRef(userName);
  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  // 이전 상태와 비교하여 불필요한 re-render 방지
  const prevOnlineKeyRef = useRef("");
  const prevTypingKeyRef = useRef("");

  // Presence 채널 구독
  useEffect(() => {
    if (!enabled || !roomId || !userId) return;

    // 싱글톤 클라이언트 사용 (모듈 레벨에서 import)
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

        // 온라인 사용자: userId 기준으로 비교 (불필요한 re-render 방지)
        const onlineKey = allUsers.map((u) => u.userId).join(",");
        if (onlineKey !== prevOnlineKeyRef.current) {
          prevOnlineKeyRef.current = onlineKey;
          setOnlineUsers(allUsers);
        }

        // 타이핑 사용자: userId+isTyping 기준으로 비교
        const typing = allUsers.filter((u) => u.isTyping);
        const typingKey = typing.map((u) => u.userId).join(",");
        if (typingKey !== prevTypingKeyRef.current) {
          prevTypingKeyRef.current = typingKey;
          setTypingUsers(typing);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // 초기 상태 등록
          await channel.track({
            userId,
            name: userNameRef.current,
            isTyping: false,
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
  }, [roomId, userId, enabled]);

  // userName이 변경되면 현재 presence 상태 업데이트 (채널 재생성 없이)
  useEffect(() => {
    if (!channelRef.current || !userName) return;
    channelRef.current.track({
      userId,
      name: userName,
      isTyping: false,
    });
  }, [userName, userId]);

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
        name: userNameRef.current,
        isTyping,
      });

      // 타이핑 중이면 자동 해제 타이머 설정
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          channelRef.current?.track({
            userId,
            name: userNameRef.current,
            isTyping: false,
          });
        }, TYPING_TIMEOUT);
      }
    },
    [userId]
  );

  return {
    onlineUsers,
    typingUsers,
    setTyping,
  };
}
