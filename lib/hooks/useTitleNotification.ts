"use client";

import { useEffect, useRef } from "react";

const DEFAULT_TITLE = "TimeLevelUp";
const TOGGLE_INTERVAL_MS = 1000;

/**
 * 탭이 백그라운드일 때 읽지 않은 메시지 수를 제목에 표시합니다.
 * 탭이 포커스를 되찾으면 기본 타이틀로 복원합니다.
 *
 * @param unreadCount 전체 읽지 않은 메시지 수
 */
export function useTitleNotification(unreadCount: number) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAlternateRef = useRef(false);

  useEffect(() => {
    function clearToggle() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isAlternateRef.current = false;
      document.title = DEFAULT_TITLE;
    }

    function startToggle() {
      if (intervalRef.current) return; // 이미 토글 중
      intervalRef.current = setInterval(() => {
        isAlternateRef.current = !isAlternateRef.current;
        document.title = isAlternateRef.current
          ? `(${unreadCount}) 새 메시지 - ${DEFAULT_TITLE}`
          : DEFAULT_TITLE;
      }, TOGGLE_INTERVAL_MS);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        clearToggle();
      } else if (unreadCount > 0) {
        startToggle();
      }
    }

    // 초기 상태 체크
    if (document.hidden && unreadCount > 0) {
      startToggle();
    } else {
      // unreadCount가 0이 되면 즉시 정리
      clearToggle();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearToggle();
    };
  }, [unreadCount]);
}
