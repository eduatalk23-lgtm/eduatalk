'use client';

import { useRef, useState, useCallback, useEffect, type RefObject } from 'react';

interface UsePullToRefreshOptions {
  containerRef: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<void> | void;
  /** 리프레시 트리거까지 필요한 당김 거리 (px, default: 80) */
  threshold?: number;
  /** 모바일에서만 활성화할 때 false 전달 */
  enabled?: boolean;
}

/**
 * Pull-to-Refresh 훅 (모바일 터치 제스처)
 *
 * 스크롤 컨테이너가 최상단(scrollTop ≤ 0)일 때
 * 아래로 당기면 새로고침을 트리거합니다.
 *
 * 기존 터치 인터랙션과 충돌 방지:
 * - 2핑거 제스처(핀치줌)는 무시
 * - 인터랙티브 요소(plan block, resize handle 등) 위에서는 비활성
 */
export function usePullToRefresh({
  containerRef,
  onRefresh,
  threshold = 80,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartY = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || isRefreshing) return;
      if (e.touches.length !== 1) return;

      const container = containerRef.current;
      if (!container || container.scrollTop > 0) return;

      // 인터랙티브 요소 위에서는 PTR 비활성
      const target = e.target as HTMLElement;
      if (
        target.closest(
          '[data-grid-block], [data-plan-chip], .cursor-ns-resize, [data-quick-create-btn], [data-date-number], [data-overflow-btn]',
        )
      )
        return;

      touchStartY.current = e.touches[0].clientY;
    },
    [enabled, isRefreshing, containerRef],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || isRefreshing || !touchStartY.current) return;
      if (e.touches.length !== 1) return;

      const container = containerRef.current;
      if (!container) return;

      // 스크롤이 발생했으면 PTR 취소
      if (container.scrollTop > 0) {
        if (isPullingRef.current) {
          isPullingRef.current = false;
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
        touchStartY.current = 0;
        return;
      }

      const deltaY = e.touches[0].clientY - touchStartY.current;

      if (deltaY > 10) {
        e.preventDefault();
        isPullingRef.current = true;
        const resistance = 0.4;
        const distance = Math.min(deltaY * resistance, threshold * 1.5);
        pullDistanceRef.current = distance;
        setPullDistance(distance);
      } else if (deltaY < -5 && isPullingRef.current) {
        isPullingRef.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        touchStartY.current = 0;
      }
    },
    [enabled, isRefreshing, containerRef, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) {
      touchStartY.current = 0;
      return;
    }

    const finalDistance = pullDistanceRef.current;
    isPullingRef.current = false;
    touchStartY.current = 0;
    pullDistanceRef.current = 0;

    if (finalDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.4); // 로딩 위치로 축소
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  return {
    pullDistance,
    pullProgress,
    isRefreshing,
    isPulling: pullDistance > 0,
  };
}
