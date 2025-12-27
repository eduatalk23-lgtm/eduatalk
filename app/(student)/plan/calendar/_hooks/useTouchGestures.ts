"use client";

import { useRef, useCallback, useEffect } from "react";

type SwipeDirection = "left" | "right" | "up" | "down" | null;

type UseTouchGesturesOptions = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // 최소 스와이프 거리 (px)
  disabled?: boolean;
};

type TouchState = {
  startX: number;
  startY: number;
  startTime: number;
  isDragging: boolean;
};

/**
 * 터치 제스처 훅
 *
 * 스와이프 제스처를 감지하여 콜백을 호출합니다.
 */
export function useTouchGestures({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  disabled = false,
}: UseTouchGesturesOptions) {
  const touchState = useRef<TouchState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const detectSwipeDirection = useCallback(
    (deltaX: number, deltaY: number): SwipeDirection => {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // 수평 스와이프
      if (absX > absY && absX > threshold) {
        return deltaX > 0 ? "right" : "left";
      }

      // 수직 스와이프
      if (absY > absX && absY > threshold) {
        return deltaY > 0 ? "down" : "up";
      }

      return null;
    },
    [threshold]
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isDragging: true,
      };
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || !touchState.current?.isDragging) return;

      // 기본 스크롤 방지는 하지 않음 (사용자 스크롤 허용)
    },
    [disabled]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (disabled || !touchState.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchState.current.startX;
      const deltaY = touch.clientY - touchState.current.startY;
      const duration = Date.now() - touchState.current.startTime;

      // 500ms 이내의 빠른 스와이프만 인식
      if (duration < 500) {
        const direction = detectSwipeDirection(deltaX, deltaY);

        switch (direction) {
          case "left":
            onSwipeLeft?.();
            break;
          case "right":
            onSwipeRight?.();
            break;
          case "up":
            onSwipeUp?.();
            break;
          case "down":
            onSwipeDown?.();
            break;
        }
      }

      touchState.current = null;
    },
    [disabled, detectSwipeDirection, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]
  );

  // 이벤트 리스너 등록
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    touchHandlers: {
      ref: containerRef,
    },
  };
}
