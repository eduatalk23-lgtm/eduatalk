'use client';

import { useState, useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { timeToMinutes, minutesToPx, minutesToTime } from '../utils/timeGridUtils';
import { createDragAutoScroll } from '../utils/dragAutoScroll';
import { movePlanToDate } from '@/lib/domains/admin-plan/actions/movePlanToDate';
import { updateItemTime } from '@/lib/domains/calendar/actions/legacyBridge';
import type { PlanItemData } from '@/lib/types/planItem';
import type { UndoableAction } from '../undoTypes';

interface UseCrossDayDragInput {
  columnRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  displayRange: { start: string; end: string };
  pxPerMinute: number;
  snapMinutes: number;
  enabled: boolean;
  studentId: string;
  plannerId: string;
  onMoveComplete: (sourceDate: string, targetDate: string) => void;
  onUndoPush?: (action: UndoableAction) => void;
}

interface GhostPosition {
  date: string;
  top: number;
  height: number;
  left: number;
  width: number;
  startTime: string;
  endTime: string;
  plan: PlanItemData;
}

export function useCrossDayDrag({
  columnRefs,
  scrollContainerRef,
  displayRange,
  pxPerMinute,
  snapMinutes,
  enabled,
  studentId,
  plannerId,
  onMoveComplete,
  onUndoPush,
}: UseCrossDayDragInput) {
  const [isDragging, setIsDragging] = useState(false);
  const [ghost, setGhost] = useState<GhostPosition | null>(null);

  const rangeStartMin = timeToMinutes(displayRange.start);
  const rangeEndMin = timeToMinutes(displayRange.end);

  const dragDataRef = useRef<{
    plan: PlanItemData;
    sourceDate: string;
    sourceDurationMin: number;
    sourceHeightPx: number;
    offsetY: number; // mousedown 위치와 블록 top 사이의 offset
  } | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof createDragAutoScroll> | null>(null);

  const getDateFromX = useCallback(
    (clientX: number): string | null => {
      for (const [date, el] of columnRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          return date;
        }
      }
      return null;
    },
    [columnRefs],
  );

  const getMinutesFromY = useCallback(
    (clientY: number, columnDate: string): number => {
      const colEl = columnRefs.current.get(columnDate);
      if (!colEl) return 0;
      // colEl.getBoundingClientRect()는 스크롤을 이미 반영한 뷰포트 기준 좌표
      // scrollTop을 추가하면 이중 계산이 되므로 사용하지 않음
      const rect = colEl.getBoundingClientRect();
      const offsetY = clientY - rect.top;
      const minutes = rangeStartMin + offsetY / pxPerMinute;
      const snapped = Math.round(minutes / snapMinutes) * snapMinutes;
      return Math.max(rangeStartMin, Math.min(snapped, rangeEndMin));
    },
    [columnRefs, rangeStartMin, rangeEndMin, pxPerMinute, snapMinutes],
  );

  const startDrag = useCallback(
    (plan: PlanItemData, sourceDate: string, e: React.MouseEvent | React.TouchEvent) => {
      if (!enabled) return;

      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      // 블록 top 위치 기준 offset 계산
      const blockEl = (e.target as HTMLElement).closest('[data-grid-block]');
      const blockRect = blockEl?.getBoundingClientRect();
      const offsetY = blockRect ? clientY - blockRect.top : 0;

      const durationMin =
        plan.startTime && plan.endTime
          ? timeToMinutes(plan.endTime) - timeToMinutes(plan.startTime)
          : plan.estimatedMinutes ?? 60;

      // 200ms 지연으로 클릭과 드래그 구분
      longPressTimerRef.current = setTimeout(() => {
        dragDataRef.current = {
          plan,
          sourceDate,
          sourceDurationMin: durationMin,
          sourceHeightPx: durationMin * pxPerMinute,
          offsetY,
        };
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        // 자동 스크롤 시작
        const container = scrollContainerRef?.current;
        if (container) {
          autoScrollRef.current = createDragAutoScroll(container);
          autoScrollRef.current.start();
        }
      }, 200);
    },
    [enabled, pxPerMinute, scrollContainerRef],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragDataRef.current || !isDragging) return;

      // 자동 스크롤 업데이트
      autoScrollRef.current?.update(e.clientY);

      const targetDate = getDateFromX(e.clientX);
      if (!targetDate) return;

      const colEl = columnRefs.current.get(targetDate);
      if (!colEl) return;

      const colRect = colEl.getBoundingClientRect();
      const scrollParent = scrollContainerRef?.current ?? colEl.closest('.overflow-y-auto');
      const containerRect = (scrollParent as HTMLElement | null)?.getBoundingClientRect();

      // 드래그 중인 위치에서 시간 계산
      const minutes = getMinutesFromY(
        e.clientY - dragDataRef.current.offsetY + dragDataRef.current.sourceHeightPx / 2,
        targetDate,
      );
      const topMinutes = minutes - dragDataRef.current.sourceDurationMin / 2;
      const snappedTop = Math.round(topMinutes / snapMinutes) * snapMinutes;
      const clampedTop = Math.max(rangeStartMin, Math.min(snappedTop, rangeEndMin - dragDataRef.current.sourceDurationMin));

      setGhost({
        date: targetDate,
        top: minutesToPx(clampedTop, rangeStartMin, pxPerMinute),
        height: dragDataRef.current.sourceHeightPx,
        left: colRect.left - (containerRect?.left ?? 0),
        width: colRect.width,
        startTime: minutesToTime(clampedTop),
        endTime: minutesToTime(clampedTop + dragDataRef.current.sourceDurationMin),
        plan: dragDataRef.current.plan,
      });
    },
    [isDragging, getDateFromX, getMinutesFromY, columnRefs, scrollContainerRef, rangeStartMin, rangeEndMin, pxPerMinute, snapMinutes],
  );

  const handleMouseUp = useCallback(
    async (e: MouseEvent) => {
      // long press 타이머 취소
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // 자동 스크롤 정지
      autoScrollRef.current?.stop();
      autoScrollRef.current = null;

      if (!dragDataRef.current || !isDragging) {
        dragDataRef.current = null;
        return;
      }

      const targetDate = getDateFromX(e.clientX);
      const data = dragDataRef.current;

      // 정리
      setIsDragging(false);
      setGhost(null);
      dragDataRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (!targetDate || !data.plan.startTime) return;

      // 드롭 위치의 시간 계산
      const dropMinutes = getMinutesFromY(e.clientY, targetDate);
      const newStartMin = Math.round(
        (dropMinutes - data.sourceDurationMin / 2) / snapMinutes,
      ) * snapMinutes;
      const clampedStart = Math.max(rangeStartMin, Math.min(newStartMin, rangeEndMin - data.sourceDurationMin));
      const newEndMin = clampedStart + data.sourceDurationMin;

      const newStartTime = minutesToTime(clampedStart);
      const newEndTime = minutesToTime(newEndMin);

      // 이전 값 캡처 (undo용)
      const prevDate = data.sourceDate;
      const prevStartTime = data.plan.startTime!;
      const prevEndTime = data.plan.endTime ?? '';
      const prevEstimatedMinutes = data.plan.estimatedMinutes ?? undefined;

      if (targetDate !== data.sourceDate) {
        // 다른 날짜로 이동
        await movePlanToDate({
          planId: data.plan.id,
          studentId,
          targetDate,
          newStartTime,
          newEndTime,
          estimatedMinutes: data.sourceDurationMin,
        });
        onMoveComplete(data.sourceDate, targetDate);

        onUndoPush?.({
          type: 'move-to-date',
          planId: data.plan.id,
          studentId,
          prev: {
            date: prevDate,
            startTime: prevStartTime,
            endTime: prevEndTime,
            estimatedMinutes: prevEstimatedMinutes,
          },
          description: '플랜이 이동되었습니다.',
        });
      } else {
        // 같은 날짜 내 시간만 변경
        await updateItemTime({
          studentId,
          plannerId,
          planDate: data.sourceDate,
          itemId: data.plan.id,
          itemType: 'plan',
          newStartTime,
          newEndTime,
          estimatedMinutes: data.sourceDurationMin,
        });
        onMoveComplete(data.sourceDate, data.sourceDate);

        onUndoPush?.({
          type: 'resize',
          planId: data.plan.id,
          studentId,
          plannerId,
          planDate: data.sourceDate,
          prev: {
            startTime: prevStartTime,
            endTime: prevEndTime,
            estimatedMinutes: prevEstimatedMinutes,
          },
          description: '시간이 변경되었습니다.',
        });
      }
    },
    [
      isDragging,
      getDateFromX,
      getMinutesFromY,
      rangeStartMin,
      rangeEndMin,
      snapMinutes,
      studentId,
      plannerId,
      onMoveComplete,
      onUndoPush,
    ],
  );

  // 마우스 이벤트 등록
  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, handleMouseMove, handleMouseUp]);

  // 클린업
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      autoScrollRef.current?.stop();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // 드래그 중인 플랜 ID (소스 블록 투명 처리용)
  const draggingPlanId = isDragging && dragDataRef.current ? dragDataRef.current.plan.id : null;

  return {
    isDragging,
    startDrag,
    ghost,
    draggingPlanId,
    targetDate: ghost?.date ?? null,
  };
}
