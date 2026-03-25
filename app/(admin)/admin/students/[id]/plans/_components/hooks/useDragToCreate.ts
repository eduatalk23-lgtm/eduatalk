'use client';

import { useState, useCallback, useEffect, useRef, useMemo, type RefObject } from 'react';
import { createDragAutoScroll } from '../utils/dragAutoScroll';
import {
  pxToLogicalMinutes,
  logicalMinutesToPx,
  EXTENSION_ZONE_END,
  type LogicalDayConfig,
} from '../utils/logicalDayUtils';

interface UseDragToCreateInput {
  containerRef: RefObject<HTMLDivElement | null>;
  displayRange: { start: string; end: string };
  pxPerMinute: number;
  snapMinutes: number;
  enabled: boolean;
  /** 새벽 접기 상태 */
  deadZoneCollapsed: boolean;
  /** 드래그 완료 시 호출 (date, startLogicalMin, endLogicalMin) — 논리적 분 */
  onDragEnd: (date: string, startMinutes: number, endMinutes: number) => void;
}

interface DragState {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export function useDragToCreate({
  containerRef,
  displayRange,
  pxPerMinute,
  snapMinutes,
  enabled,
  deadZoneCollapsed,
  onDragEnd,
}: UseDragToCreateInput) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStartRef = useRef<{
    date: string;
    startY: number;
    scrollTop: number;
    startMinutes: number;
  } | null>(null);
  const isDraggingRef = useRef(false);
  const autoScrollRef = useRef<ReturnType<typeof createDragAutoScroll> | null>(null);

  const logicalConfig: LogicalDayConfig = useMemo(
    () => ({ deadZoneCollapsed, pxPerMinute }),
    [deadZoneCollapsed, pxPerMinute],
  );

  /** px → 논리적 분 (snap 적용, 클램프) */
  const getMinutesFromY = useCallback(
    (clientY: number, snap: 'floor' | 'ceil' = 'floor'): number => {
      if (!containerRef.current) return 0;
      const snapFn = snap === 'ceil' ? Math.ceil : Math.floor;
      // 컬럼 요소 기준으로 계산 (일일뷰 sticky 종일 행 오프셋 보정)
      const colEl = containerRef.current.querySelector('[data-column-date]') as HTMLElement | null;
      if (colEl) {
        const colRect = colEl.getBoundingClientRect();
        const offsetY = clientY - colRect.top;
        const logicalMin = pxToLogicalMinutes(offsetY, logicalConfig);
        const snapped = snapFn(logicalMin / snapMinutes) * snapMinutes;
        return Math.max(0, Math.min(snapped, EXTENSION_ZONE_END));
      }
      // fallback
      const rect = containerRef.current.getBoundingClientRect();
      const offsetY = clientY - rect.top + containerRef.current.scrollTop;
      const logicalMin = pxToLogicalMinutes(offsetY, logicalConfig);
      const snapped = snapFn(logicalMin / snapMinutes) * snapMinutes;
      return Math.max(0, Math.min(snapped, EXTENSION_ZONE_END));
    },
    [containerRef, deadZoneCollapsed, pxPerMinute, snapMinutes],
  );

  const getDateFromX = useCallback(
    (clientX: number, clientY?: number): string | null => {
      if (!containerRef.current) return null;
      const columns = containerRef.current.querySelectorAll('[data-column-date]');
      // clientY가 제공되면 X+Y 모두 확인 (biweekly: 같은 X에 2주치 컬럼이 겹침)
      if (clientY != null) {
        for (const col of columns) {
          const rect = (col as HTMLElement).getBoundingClientRect();
          if (clientX >= rect.left && clientX <= rect.right &&
              clientY >= rect.top && clientY <= rect.bottom) {
            return (col as HTMLElement).getAttribute('data-column-date');
          }
        }
      }
      // fallback: X만으로 판별 (첫 번째 매칭)
      for (const col of columns) {
        const rect = (col as HTMLElement).getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          return (col as HTMLElement).getAttribute('data-column-date');
        }
      }
      return null;
    },
    [containerRef],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;
      // 기존 블록 또는 종일 영역 위에서는 시작하지 않음
      if ((e.target as HTMLElement).closest('[data-grid-block]') ||
          (e.target as HTMLElement).closest('[data-allday-row]') ||
          (e.target as HTMLElement).closest('[data-dead-zone-bar]')) return;
      // 시간 거터 무시
      const date = getDateFromX(e.clientX, e.clientY);
      if (!date) return;

      e.preventDefault(); // 텍스트 선택 방지 → 드래그 안정화

      const startMinutes = getMinutesFromY(e.clientY);

      dragStartRef.current = {
        date,
        startY: e.clientY,
        scrollTop: containerRef.current?.scrollTop ?? 0,
        startMinutes,
      };
    },
    [enabled, getDateFromX, getMinutesFromY, containerRef],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const dy = Math.abs(e.clientY - dragStartRef.current.startY);
      // 최소 이동 거리 (5px) 미만이면 드래그로 인식하지 않음
      if (dy < 5 && !isDraggingRef.current) return;

      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        document.body.style.cursor = 'crosshair';
        document.body.style.userSelect = 'none';
        // 자동 스크롤 시작
        if (containerRef.current) {
          autoScrollRef.current = createDragAutoScroll(containerRef.current);
          autoScrollRef.current.start();
        }
      }

      // 자동 스크롤 업데이트
      autoScrollRef.current?.update(e.clientY);

      // Google Calendar 스타일: leading edge = floor, trailing edge = ceil
      const currentFloor = getMinutesFromY(e.clientY, 'floor');
      const currentCeil = getMinutesFromY(e.clientY, 'ceil');
      const anchorMin = dragStartRef.current.startMinutes;
      const anchorEndMin = anchorMin + snapMinutes; // 앵커 블록의 끝

      const start = Math.min(anchorMin, currentFloor);
      const end = Math.max(anchorEndMin, currentCeil);

      setDragState({
        date: dragStartRef.current.date,
        startMinutes: start,
        endMinutes: end,
      });
    },
    [getMinutesFromY, containerRef, snapMinutes],
  );

  const resetDrag = useCallback(() => {
    autoScrollRef.current?.stop();
    autoScrollRef.current = null;
    dragStartRef.current = null;
    isDraggingRef.current = false;
    setDragState(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      // 자동 스크롤 정지
      autoScrollRef.current?.stop();
      autoScrollRef.current = null;

      if (!dragStartRef.current) return;

      if (isDraggingRef.current) {
        // Google Calendar 스타일: leading edge = floor, trailing edge = ceil
        const currentFloor = getMinutesFromY(e.clientY, 'floor');
        const currentCeil = getMinutesFromY(e.clientY, 'ceil');
        const anchorMin = dragStartRef.current.startMinutes;
        const anchorEndMin = anchorMin + snapMinutes;

        const start = Math.min(anchorMin, currentFloor);
        const end = Math.max(anchorEndMin, currentCeil);

        // 최소 15분(snapMinutes) 미만이면 무시 (클릭으로 간주)
        if (end - start >= snapMinutes) {
          onDragEnd(dragStartRef.current.date, start, end);

          // 드래그 완료 후 브라우저가 발생시키는 click 이벤트를 한 번 소비하여
          // handleGridClick과의 경합을 방지
          const container = containerRef.current;
          if (container) {
            const swallowClick = (ev: MouseEvent) => {
              ev.stopPropagation();
              ev.preventDefault();
            };
            container.addEventListener('click', swallowClick, { capture: true, once: true });
            // 안전장치: 300ms 후 리스너 제거 (click이 발생하지 않는 경우)
            setTimeout(() => container.removeEventListener('click', swallowClick, { capture: true }), 300);
          }

          // ★ dragState 유지 → QuickCreate 팝오버가 닫힐 때까지 프리뷰 블록 표시
          dragStartRef.current = null;
          isDraggingRef.current = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          return;
        }
      }

      // 무효 드래그 (threshold 미달) → 클리어
      resetDrag();
    },
    [getMinutesFromY, snapMinutes, onDragEnd, containerRef, resetDrag],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isDraggingRef.current || dragStartRef.current)) {
        resetDrag();
      }
    },
    [resetDrag],
  );

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, containerRef, handleMouseDown, handleMouseMove, handleMouseUp, handleKeyDown]);

  // 프리뷰 스타일 계산
  const previewStyle = dragState
    ? (() => {
        // 해당 날짜 컬럼의 위치 찾기
        const colEl = containerRef.current?.querySelector(
          `[data-column-date="${dragState.date}"]`,
        ) as HTMLElement | null;
        if (!colEl || !containerRef.current) return null;

        const containerRect = containerRef.current.getBoundingClientRect();
        const colRect = colEl.getBoundingClientRect();

        const topPx = logicalMinutesToPx(dragState.startMinutes, logicalConfig);
        const bottomPx = logicalMinutesToPx(dragState.endMinutes, logicalConfig);
        return {
          top: `${topPx}px`,
          height: `${Math.max(bottomPx - topPx, 2)}px`,
          left: `${colRect.left - containerRect.left + containerRef.current.scrollLeft}px`,
          width: `${colRect.width}px`,
        } as React.CSSProperties;
      })()
    : null;

  // 부모가 QuickCreate 닫을 때 호출 → 프리뷰 블록 제거
  const clearDragPreview = useCallback(() => setDragState(null), []);

  return { dragState, previewStyle, clearDragPreview };
}
