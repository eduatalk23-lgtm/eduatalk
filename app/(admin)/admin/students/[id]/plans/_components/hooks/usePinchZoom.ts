'use client';

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 1;
const STORAGE_KEY = 'calendarGrid_zoomLevel';
const WHEEL_SENSITIVITY = 0.005;

/**
 * 핀치/스크롤 줌 훅
 *
 * - 데스크톱: Ctrl+스크롤 휠로 줌 인/아웃
 * - 모바일: 두 손가락 핀치 제스처
 * - 줌 레벨 localStorage 영속
 */
export function usePinchZoom(containerRef: RefObject<HTMLElement | null>) {
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_ZOOM;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= MIN_ZOOM && val <= MAX_ZOOM) return val;
    }
    return DEFAULT_ZOOM;
  });

  // 핀치 제스처 추적
  const initialPinchDistance = useRef<number | null>(null);
  const pinchStartZoom = useRef(DEFAULT_ZOOM);

  const clampZoom = useCallback((val: number) => {
    return Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, val)) * 20) / 20; // 0.05 단위 스냅
  }, []);

  const updateZoom = useCallback(
    (newZoom: number) => {
      const clamped = clampZoom(newZoom);
      setZoomLevel(clamped);
      localStorage.setItem(STORAGE_KEY, String(clamped));
    },
    [clampZoom],
  );

  // 데스크톱: Ctrl+Wheel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * WHEEL_SENSITIVITY;
      setZoomLevel((prev) => {
        const next = clampZoom(prev + delta);
        localStorage.setItem(STORAGE_KEY, String(next));
        return next;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [containerRef, clampZoom]);

  // 모바일: 핀치 제스처
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getTouchDistance = (touches: TouchList): number => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialPinchDistance.current = getTouchDistance(e.touches);
        pinchStartZoom.current = zoomLevel;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || initialPinchDistance.current === null) return;
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / initialPinchDistance.current;
      const newZoom = clampZoom(pinchStartZoom.current * scale);
      setZoomLevel(newZoom);
    };

    const handleTouchEnd = () => {
      if (initialPinchDistance.current !== null) {
        initialPinchDistance.current = null;
        // 최종 줌 레벨 저장
        localStorage.setItem(STORAGE_KEY, String(zoomLevel));
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, zoomLevel, clampZoom]);

  const zoomIn = useCallback(() => updateZoom(zoomLevel + 0.25), [zoomLevel, updateZoom]);
  const zoomOut = useCallback(() => updateZoom(zoomLevel - 0.25), [zoomLevel, updateZoom]);
  const resetZoom = useCallback(() => updateZoom(DEFAULT_ZOOM), [updateZoom]);

  /** 줌 적용된 PX_PER_MINUTE (기본값 1 * zoomLevel) */
  const pxPerMinute = zoomLevel; // HOUR_HEIGHT_PX=60, PX_PER_MINUTE=1 이므로 zoomLevel=1 → 1px/min

  return {
    zoomLevel,
    pxPerMinute,
    zoomIn,
    zoomOut,
    resetZoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
  };
}
