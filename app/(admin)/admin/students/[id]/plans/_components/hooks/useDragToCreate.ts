'use client';

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';
import { timeToMinutes, minutesToPx } from '../utils/timeGridUtils';
import { createDragAutoScroll } from '../utils/dragAutoScroll';

interface UseDragToCreateInput {
  containerRef: RefObject<HTMLDivElement | null>;
  displayRange: { start: string; end: string };
  pxPerMinute: number;
  snapMinutes: number;
  enabled: boolean;
  /** 드래그 완료 시 호출 (date, startMin, endMin) */
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

  const rangeStartMin = timeToMinutes(displayRange.start);
  const rangeEndMin = timeToMinutes(displayRange.end);

  const getMinutesFromY = useCallback(
    (clientY: number): number => {
      if (!containerRef.current) return 0;
      // 컬럼 요소 기준으로 계산 (일일뷰 sticky 종일 행 오프셋 보정)
      const colEl = containerRef.current.querySelector('[data-column-date]') as HTMLElement | null;
      if (colEl) {
        const colRect = colEl.getBoundingClientRect();
        const offsetY = clientY - colRect.top;
        const minutes = rangeStartMin + offsetY / pxPerMinute;
        const snapped = Math.round(minutes / snapMinutes) * snapMinutes;
        return Math.max(rangeStartMin, Math.min(snapped, rangeEndMin));
      }
      // fallback
      const rect = containerRef.current.getBoundingClientRect();
      const offsetY = clientY - rect.top + containerRef.current.scrollTop;
      const minutes = rangeStartMin + offsetY / pxPerMinute;
      const snapped = Math.round(minutes / snapMinutes) * snapMinutes;
      return Math.max(rangeStartMin, Math.min(snapped, rangeEndMin));
    },
    [containerRef, rangeStartMin, rangeEndMin, pxPerMinute, snapMinutes],
  );

  const getDateFromX = useCallback(
    (clientX: number): string | null => {
      if (!containerRef.current) return null;
      const columns = containerRef.current.querySelectorAll('[data-column-date]');
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
          (e.target as HTMLElement).closest('[data-allday-row]')) return;
      // 시간 거터 무시
      const date = getDateFromX(e.clientX);
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
        // 자동 스크롤 시작
        if (containerRef.current) {
          autoScrollRef.current = createDragAutoScroll(containerRef.current);
          autoScrollRef.current.start();
        }
      }

      // 자동 스크롤 업데이트
      autoScrollRef.current?.update(e.clientY);

      const currentMinutes = getMinutesFromY(e.clientY);
      const start = Math.min(dragStartRef.current.startMinutes, currentMinutes);
      const end = Math.max(dragStartRef.current.startMinutes, currentMinutes);

      setDragState({
        date: dragStartRef.current.date,
        startMinutes: start,
        endMinutes: end,
      });
    },
    [getMinutesFromY, containerRef],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      // 자동 스크롤 정지
      autoScrollRef.current?.stop();
      autoScrollRef.current = null;

      if (!dragStartRef.current) return;

      if (isDraggingRef.current) {
        const currentMinutes = getMinutesFromY(e.clientY);
        const start = Math.min(dragStartRef.current.startMinutes, currentMinutes);
        const end = Math.max(dragStartRef.current.startMinutes, currentMinutes);

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
          return;
        }
      }

      // 무효 드래그 (threshold 미달) → 클리어
      dragStartRef.current = null;
      isDraggingRef.current = false;
      setDragState(null);
    },
    [getMinutesFromY, snapMinutes, onDragEnd, containerRef],
  );

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, containerRef, handleMouseDown, handleMouseMove, handleMouseUp]);

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

        return {
          top: `${minutesToPx(dragState.startMinutes, rangeStartMin, pxPerMinute)}px`,
          height: `${(dragState.endMinutes - dragState.startMinutes) * pxPerMinute}px`,
          left: `${colRect.left - containerRect.left + containerRef.current.scrollLeft}px`,
          width: `${colRect.width}px`,
        } as React.CSSProperties;
      })()
    : null;

  // 부모가 QuickCreate 닫을 때 호출 → 프리뷰 블록 제거
  const clearDragPreview = useCallback(() => setDragState(null), []);

  return { dragState, previewStyle, clearDragPreview };
}
