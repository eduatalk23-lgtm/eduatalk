"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL = 30_000; // 30초

/** 현재 보고 있는 채팅방 ID (모듈 스코프, ChatRoom에서 설정) */
let _currentChatRoomId: string | null = null;

/**
 * 현재 보고 있는 채팅방 ID를 설정합니다.
 * ChatRoom 컴포넌트에서 마운트/언마운트 시 호출.
 */
export function setCurrentChatRoom(roomId: string | null) {
  _currentChatRoomId = roomId;
}

/**
 * 앱 전역에서 사용자 온라인 상태를 추적.
 * 레이아웃에서 한 번만 마운트.
 *
 * 두 가지 메커니즘을 병행합니다:
 * 1. Supabase Presence 채널 — 클라이언트 간 실시간 상태 공유
 * 2. DB heartbeat (user_presence 테이블) — 서버 사이드 Push 스킵 판단
 */
export function useAppPresence(userId: string | null) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    // --- 1. Supabase Presence channel ---
    const channel = supabase.channel("app-presence", {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
          status: "active",
        });
      }
    });

    // --- 2. DB presence heartbeat ---
    const upsertPresence = (status: "active" | "idle" | "offline") => {
      supabase
        .from("user_presence")
        .upsert({
          user_id: userId,
          status,
          updated_at: new Date().toISOString(),
          current_chat_room_id: status === "active" ? _currentChatRoomId : null,
        })
        .then(({ error }) => {
          if (error) {
            console.warn("[Presence] DB upsert failed:", error.message);
          }
        });
    };

    // 초기 active 상태 기록
    upsertPresence("active");

    // 30초마다 heartbeat (탭이 보이는 동안만)
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        upsertPresence("active");
      }
    }, HEARTBEAT_INTERVAL);

    // --- 3. Visibility change ---
    const handleVisibility = () => {
      const status = document.hidden ? "idle" : "active";

      // Supabase Presence 업데이트
      channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        status,
      });

      // DB presence 업데이트
      // iOS PWA: 백그라운드 전환 시 JS가 곧 중단되므로
      // sendBeacon으로 "idle" 상태를 확실히 전달
      if (document.hidden && navigator.sendBeacon) {
        const beaconUrl = `/api/presence?userId=${encodeURIComponent(userId)}&status=idle`;
        navigator.sendBeacon(beaconUrl);
      } else {
        upsertPresence(status);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    // --- 4. Cleanup ---
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      // sendBeacon으로 "offline" 상태를 확실히 전달 (async upsert 미완료 방지)
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/presence?userId=${encodeURIComponent(userId)}&status=offline`
        );
      } else {
        upsertPresence("offline");
      }
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

