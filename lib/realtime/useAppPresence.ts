"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL = 120_000; // 120초 (Disk I/O 절약: 30s→120s)
/** 탭 전환 debounce (빠른 alt-tab 등에서 불필요한 DB 쓰기 방지) */
const VISIBILITY_DEBOUNCE = 3_000; // 3초

/** 현재 보고 있는 채팅방 ID (모듈 스코프, ChatRoom에서 설정) */
let _currentChatRoomId: string | null = null;

/**
 * 현재 보고 있는 채팅방 ID를 설정합니다.
 * ChatRoom 컴포넌트에서 마운트/언마운트 시 호출.
 *
 * chatRoomId가 바뀌면 즉시 DB에 반영합니다 (Push 판단에 필요).
 */
export function setCurrentChatRoom(roomId: string | null) {
  const prev = _currentChatRoomId;
  _currentChatRoomId = roomId;

  // 채팅방 진입/퇴장은 Push 스킵 판단에 직접적이므로 즉시 DB 반영
  if (prev !== roomId && _pendingUpsert) {
    _pendingUpsert("active");
  }
}

/** 모듈 스코프 upsert 함수 참조 (setCurrentChatRoom에서 사용) */
let _pendingUpsert: ((status: "active" | "idle" | "offline") => void) | null =
  null;

/**
 * 앱 전역에서 사용자 온라인 상태를 추적.
 * 레이아웃에서 한 번만 마운트.
 *
 * 두 가지 메커니즘을 병행합니다:
 * 1. Supabase Presence 채널 — 클라이언트 간 실시간 상태 공유
 * 2. DB heartbeat (user_presence 테이블) — 서버 사이드 Push 스킵 판단
 *
 * 최적화:
 * - 상태가 변경되지 않으면 DB UPDATE를 건너뜁니다
 * - 탭 전환(visibilitychange)은 3초 debounce 적용
 * - updated_at만 갱신이 필요한 heartbeat는 최소한의 UPSERT 수행
 */
export function useAppPresence(userId: string | null) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    /** 마지막으로 DB에 기록한 상태 (중복 쓰기 방지) */
    let lastWrittenStatus: "active" | "idle" | "offline" | null = null;
    let lastWrittenRoomId: string | null | undefined = undefined;

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
      const roomId = status === "active" ? _currentChatRoomId : null;
      const isStatusChanged = status !== lastWrittenStatus;
      const isRoomChanged = roomId !== lastWrittenRoomId;

      // heartbeat: 상태/방이 같으면 updated_at만 갱신 필요
      // → 상태가 active로 동일해도 updated_at 갱신은 해야 함 (stale 방지)
      // → 단, idle/offline이 반복되면 스킵 (이미 비활성 상태)
      if (!isStatusChanged && !isRoomChanged && status !== "active") {
        return;
      }

      lastWrittenStatus = status;
      lastWrittenRoomId = roomId;

      supabase
        .from("user_presence")
        .upsert({
          user_id: userId,
          status,
          updated_at: new Date().toISOString(),
          current_chat_room_id: roomId,
        })
        .then(({ error }) => {
          if (error) {
            console.warn("[Presence] DB upsert failed:", error.message);
          }
        });
    };

    // 모듈 스코프 참조 설정 (setCurrentChatRoom에서 사용)
    _pendingUpsert = upsertPresence;

    // 초기 active 상태 기록
    upsertPresence("active");

    // 30초마다 heartbeat (탭이 보이는 동안만)
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        upsertPresence("active");
      }
    }, HEARTBEAT_INTERVAL);

    // --- 3. Visibility change (debounced) ---
    const handleVisibility = () => {
      // 이전 대기 중인 debounce 취소
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }

      if (document.hidden) {
        // 백그라운드 전환: iOS PWA는 JS 즉시 중단되므로 sendBeacon으로 즉시 전송
        channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
          status: "idle",
        });

        if (navigator.sendBeacon) {
          const beaconUrl = `/api/presence?status=idle`;
          navigator.sendBeacon(beaconUrl);
          lastWrittenStatus = "idle";
          lastWrittenRoomId = null;
        } else {
          upsertPresence("idle");
        }
      } else {
        // 포그라운드 복귀: 3초 debounce (빠른 탭 전환 필터링)
        visibilityTimerRef.current = setTimeout(() => {
          channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            status: "active",
          });
          upsertPresence("active");
        }, VISIBILITY_DEBOUNCE);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    // --- 4. Cleanup ---
    return () => {
      _pendingUpsert = null;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
      // sendBeacon으로 "offline" 상태를 확실히 전달 (async upsert 미완료 방지)
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/presence?status=offline`
        );
      } else {
        upsertPresence("offline");
      }
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
