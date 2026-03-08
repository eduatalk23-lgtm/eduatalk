"use client";

/**
 * useSwipeAction - 목록 항목 스와이프 액션 훅
 *
 * 터치/마우스 드래그로 좌측 스와이프 시 액션 버튼을 노출합니다.
 * 카카오톡 채팅 목록 스타일.
 */

import { useRef, useCallback, useState } from "react";

/** 스와이프 활성화 임계값 (px) */
const SWIPE_THRESHOLD = 60;
/** 최대 스와이프 거리 (px) */
const MAX_SWIPE = 160;

interface UseSwipeActionReturn {
  /** 스와이프 컨테이너에 적용할 이벤트 핸들러 */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  /** 현재 스와이프 이동량 (px, 음수 = 왼쪽) */
  offsetX: number;
  /** 스와이프가 열린 상태인지 */
  isOpen: boolean;
  /** 스와이프 닫기 */
  close: () => void;
}

export function useSwipeAction(): UseSwipeActionReturn {
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const directionLockedRef = useRef<"horizontal" | "vertical" | null>(null);

  const close = useCallback(() => {
    setOffsetX(0);
    setIsOpen(false);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    isDraggingRef.current = true;
    directionLockedRef.current = null;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;

    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;

    // 방향 잠금 (처음 10px 이동 시 결정)
    if (!directionLockedRef.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        directionLockedRef.current =
          Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      return;
    }

    // 세로 스크롤 우선
    if (directionLockedRef.current === "vertical") return;

    // 이미 열린 상태에서 오른쪽으로 드래그 → 닫기
    if (isOpen) {
      const newOffset = Math.min(0, Math.max(-MAX_SWIPE, -MAX_SWIPE + dx));
      setOffsetX(newOffset);
    } else {
      // 왼쪽 스와이프만 허용
      if (dx > 0) return;
      const newOffset = Math.max(-MAX_SWIPE, dx);
      setOffsetX(newOffset);
    }
  }, [isOpen]);

  const onTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    directionLockedRef.current = null;

    if (Math.abs(offsetX) >= SWIPE_THRESHOLD) {
      // 임계값 초과 → 열기
      setOffsetX(-MAX_SWIPE);
      setIsOpen(true);
    } else {
      // 임계값 미달 → 닫기
      setOffsetX(0);
      setIsOpen(false);
    }
  }, [offsetX]);

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    offsetX,
    isOpen,
    close,
  };
}
