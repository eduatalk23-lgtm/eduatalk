'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseResizableOptions {
  /** 초기 높이 (px) */
  initialHeight: number;
  /** 최소 높이 (px) - 기본 15 (15분) */
  minHeight?: number;
  /** 최대 높이 (px) */
  maxHeight: number;
  /** 스냅 단위 (px) - 기본 15 (15분 = 15px) */
  snapIncrement?: number;
  /** 리사이즈 완료 콜백 */
  onResizeEnd: (newHeightPx: number) => void;
}

interface UseResizableReturn {
  /** 드래그 중 현재 높이 (스냅 적용) */
  currentHeight: number;
  /** 리사이즈 진행 중 여부 */
  isResizing: boolean;
  /** 리사이즈 핸들에 적용할 이벤트 프로퍼티 */
  resizeHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
}

/**
 * 드래그 리사이즈 훅
 *
 * 네이티브 mouse/touch 이벤트를 사용하여 @dnd-kit과 독립적으로 동작.
 * requestAnimationFrame으로 부드러운 업데이트.
 */
export function useResizable({
  initialHeight,
  minHeight = 15,
  maxHeight,
  snapIncrement = 15,
  onResizeEnd,
}: UseResizableOptions): UseResizableReturn {
  // 리사이즈 중의 높이만 상태로 관리, 아닐 때는 initialHeight 사용
  const [resizeHeight, setResizeHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const currentHeight = isResizing && resizeHeight != null ? resizeHeight : initialHeight;

  const startYRef = useRef(0);
  const startHeightRef = useRef(initialHeight);
  const rafRef = useRef<number | null>(null);
  const latestHeightRef = useRef(initialHeight);
  const onResizeEndRef = useRef(onResizeEnd);
  const snapRef = useRef({ minHeight, maxHeight, snapIncrement });

  // Sync refs in effect to avoid "Cannot access refs during render"
  useEffect(() => {
    onResizeEndRef.current = onResizeEnd;
    snapRef.current = { minHeight, maxHeight, snapIncrement };
    if (!isResizing) {
      latestHeightRef.current = initialHeight;
      startHeightRef.current = initialHeight;
    }
  });

  const snap = useCallback((rawHeight: number): number => {
    const { minHeight: min, maxHeight: max, snapIncrement: inc } = snapRef.current;
    const snapped = Math.round(rawHeight / inc) * inc;
    return Math.max(min, Math.min(max, snapped));
  }, []);

  // Use refs for event handlers to avoid circular dependencies
  const handlersRef = useRef<{
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: () => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
  } | null>(null);

  const cleanup = useCallback(() => {
    if (handlersRef.current) {
      document.removeEventListener('mousemove', handlersRef.current.onMouseMove);
      document.removeEventListener('mouseup', handlersRef.current.onMouseUp);
      document.removeEventListener('touchmove', handlersRef.current.onTouchMove);
      document.removeEventListener('touchend', handlersRef.current.onTouchEnd);
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const startResize = useCallback(
    (startY: number, mode: 'mouse' | 'touch') => {
      startYRef.current = startY;
      startHeightRef.current = latestHeightRef.current;
      setIsResizing(true);

      const onMove = (clientY: number) => {
        const delta = clientY - startYRef.current;
        const rawHeight = startHeightRef.current + delta;
        const snappedHeight = snap(rawHeight);
        latestHeightRef.current = snappedHeight;

        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          setResizeHeight(snappedHeight);
        });
      };

      const onEnd = () => {
        setIsResizing(false);
        setResizeHeight(null);
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        cleanup();

        const finalHeight = latestHeightRef.current;
        if (finalHeight !== startHeightRef.current) {
          onResizeEndRef.current(finalHeight);
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        onMove(e.clientY);
      };
      const onMouseUp = () => onEnd();
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) onMove(e.touches[0].clientY);
      };
      const onTouchEnd = () => onEnd();

      handlersRef.current = { onMouseMove, onMouseUp, onTouchMove, onTouchEnd };

      if (mode === 'mouse') {
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'ns-resize';
      } else {
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
      }
      document.body.style.userSelect = 'none';
    },
    [snap, cleanup]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      startResize(e.clientY, 'mouse');
    },
    [startResize]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      if (e.touches.length !== 1) return;
      startResize(e.touches[0].clientY, 'touch');
    },
    [startResize]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      cleanup();
    };
  }, [cleanup]);

  return {
    currentHeight,
    isResizing,
    resizeHandleProps: {
      onMouseDown,
      onTouchStart,
    },
  };
}
