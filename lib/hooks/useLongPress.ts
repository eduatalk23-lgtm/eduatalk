"use client";

/**
 * useLongPress - Long Press 감지 훅
 *
 * 모바일에서 터치 길게 누르기, 데스크톱에서 우클릭을 감지합니다.
 * 컨텍스트 메뉴 표시 등에 사용됩니다.
 */

import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  /** Long press 발생 시 콜백 */
  onLongPress: () => void;
  /** Long press 감지까지의 지연 시간 (ms, 기본값 500ms) */
  delay?: number;
  /** 움직임 허용 범위 (px, 기본값 10px) - 이 범위를 벗어나면 취소 */
  threshold?: number;
  /** 비활성화 여부 */
  disabled?: boolean;
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Long Press 감지 훅
 *
 * @example
 * ```tsx
 * const longPressHandlers = useLongPress({
 *   onLongPress: () => setMenuOpen(true),
 *   delay: 500,
 *   disabled: isSystem,
 * });
 *
 * return <div {...longPressHandlers}>...</div>;
 * ```
 */
export function useLongPress({
  onLongPress,
  delay = 500,
  threshold = 10,
  disabled = false,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  // 타이머 정리
  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 터치 시작
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      isLongPressTriggeredRef.current = false;

      timerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        // 햅틱 피드백 (지원하는 경우)
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
        onLongPress();
      }, delay);
    },
    [disabled, delay, onLongPress]
  );

  // 터치 이동 - 일정 범위 이상 이동하면 취소
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current) return;

      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startPosRef.current.x);
      const dy = Math.abs(touch.clientY - startPosRef.current.y);

      // 임계값 초과 시 취소
      if (dx > threshold || dy > threshold) {
        clear();
      }
    },
    [threshold, clear]
  );

  // 터치 종료
  const onTouchEnd = useCallback(() => {
    clear();
    startPosRef.current = null;
  }, [clear]);

  // 데스크톱 우클릭
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      onLongPress();
    },
    [disabled, onLongPress]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onContextMenu,
  };
}
