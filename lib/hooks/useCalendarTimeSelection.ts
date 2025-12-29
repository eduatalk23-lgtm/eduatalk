/**
 * useCalendarTimeSelection 훅
 *
 * 캘린더에서 드래그로 시간 범위를 선택하고 플랜 생성을 트리거합니다.
 *
 * @module lib/hooks/useCalendarTimeSelection
 */

"use client";

import { useState, useCallback, useRef, useMemo } from "react";

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 선택된 시간 범위
 */
export interface TimeSelection {
  /** 선택 날짜 (YYYY-MM-DD) */
  date: string;
  /** 시작 시간 (HH:MM) */
  startTime: string;
  /** 종료 시간 (HH:MM) */
  endTime: string;
  /** 선택 시간 (분 단위) */
  durationMinutes: number;
}

/**
 * 드래그 상태
 */
export interface DragState {
  /** 드래그 중 여부 */
  isDragging: boolean;
  /** 드래그 시작 시간 */
  startTime: string | null;
  /** 현재 드래그 위치 시간 */
  currentTime: string | null;
  /** 드래그 시작 날짜 */
  date: string | null;
}

/**
 * 훅 옵션
 */
export interface UseCalendarTimeSelectionOptions {
  /** 시간 간격 (분 단위, 기본값: 30) */
  timeSlotInterval?: number;
  /** 최소 선택 시간 (분 단위, 기본값: 30) */
  minDuration?: number;
  /** 최대 선택 시간 (분 단위, 기본값: 480 = 8시간) */
  maxDuration?: number;
  /** 선택 완료 콜백 */
  onSelectionComplete?: (selection: TimeSelection) => void;
  /** 선택 취소 콜백 */
  onSelectionCancel?: () => void;
}

// ============================================================================
// 상수
// ============================================================================

const DEFAULT_TIME_SLOT_INTERVAL = 30;
const DEFAULT_MIN_DURATION = 30;
const DEFAULT_MAX_DURATION = 480;

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 시간을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * 분을 시간 형식으로 변환
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 시간을 지정된 간격으로 반올림
 */
function roundToInterval(time: string, interval: number, roundUp: boolean = false): string {
  const minutes = timeToMinutes(time);
  const rounded = roundUp
    ? Math.ceil(minutes / interval) * interval
    : Math.floor(minutes / interval) * interval;
  return minutesToTime(Math.max(0, Math.min(1439, rounded)));
}

/**
 * Y 좌표를 시간으로 변환
 */
function yToTime(
  y: number,
  containerTop: number,
  containerHeight: number,
  startHour: number,
  endHour: number
): string {
  const relativeY = Math.max(0, Math.min(containerHeight, y - containerTop));
  const ratio = relativeY / containerHeight;
  const totalMinutes = (endHour - startHour) * 60;
  const minutes = startHour * 60 + ratio * totalMinutes;
  return minutesToTime(Math.round(minutes));
}

// ============================================================================
// 훅
// ============================================================================

/**
 * 캘린더 시간 선택 훅
 *
 * @example
 * ```tsx
 * const {
 *   selection,
 *   dragState,
 *   handlers,
 *   clearSelection,
 *   isSelecting
 * } = useCalendarTimeSelection({
 *   onSelectionComplete: (selection) => {
 *     // 플랜 생성 모달 열기
 *     setQuickAddOpen(true);
 *     setSelectedDate(selection.date);
 *     setSelectedStartTime(selection.startTime);
 *     setSelectedEndTime(selection.endTime);
 *   }
 * });
 *
 * return (
 *   <div
 *     ref={containerRef}
 *     {...handlers}
 *     className={cn("relative", isSelecting && "select-none")}
 *   >
 *     {// 캘린더 타임라인}
 *   </div>
 * );
 * ```
 */
export function useCalendarTimeSelection(
  options: UseCalendarTimeSelectionOptions = {}
) {
  const {
    timeSlotInterval = DEFAULT_TIME_SLOT_INTERVAL,
    minDuration = DEFAULT_MIN_DURATION,
    maxDuration = DEFAULT_MAX_DURATION,
    onSelectionComplete,
    onSelectionCancel,
  } = options;

  // 상태
  const [selection, setSelection] = useState<TimeSelection | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startTime: null,
    currentTime: null,
    date: null,
  });

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  // 드래그 시작
  const handleDragStart = useCallback(
    (date: string, time: string, e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const roundedTime = roundToInterval(time, timeSlotInterval);

      setDragState({
        isDragging: true,
        startTime: roundedTime,
        currentTime: roundedTime,
        date,
      });
      setSelection(null);
    },
    [timeSlotInterval]
  );

  // 드래그 중
  const handleDragMove = useCallback(
    (time: string) => {
      if (!isDraggingRef.current || !dragState.startTime || !dragState.date) return;

      const roundedTime = roundToInterval(time, timeSlotInterval, true);

      setDragState((prev) => ({
        ...prev,
        currentTime: roundedTime,
      }));
    },
    [dragState.startTime, dragState.date, timeSlotInterval]
  );

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const { startTime, currentTime, date } = dragState;
    if (!startTime || !currentTime || !date) {
      setDragState({
        isDragging: false,
        startTime: null,
        currentTime: null,
        date: null,
      });
      return;
    }

    // 시작/종료 시간 정렬
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(currentTime);
    const actualStart = Math.min(startMinutes, endMinutes);
    const actualEnd = Math.max(startMinutes, endMinutes);
    const duration = actualEnd - actualStart;

    // 드래그 상태 초기화
    setDragState({
      isDragging: false,
      startTime: null,
      currentTime: null,
      date: null,
    });

    // 최소 시간 미만이면 취소
    if (duration < minDuration) {
      onSelectionCancel?.();
      return;
    }

    // 최대 시간 제한
    const limitedDuration = Math.min(duration, maxDuration);
    const limitedEnd = actualStart + limitedDuration;

    const finalSelection: TimeSelection = {
      date,
      startTime: minutesToTime(actualStart),
      endTime: minutesToTime(limitedEnd),
      durationMinutes: limitedDuration,
    };

    setSelection(finalSelection);
    onSelectionComplete?.(finalSelection);
  }, [dragState, minDuration, maxDuration, onSelectionComplete, onSelectionCancel]);

  // 선택 지우기
  const clearSelection = useCallback(() => {
    setSelection(null);
    setDragState({
      isDragging: false,
      startTime: null,
      currentTime: null,
      date: null,
    });
    isDraggingRef.current = false;
  }, []);

  // 드래그 중 미리보기 범위 계산
  const previewRange = useMemo(() => {
    if (!dragState.isDragging || !dragState.startTime || !dragState.currentTime) {
      return null;
    }

    const startMinutes = timeToMinutes(dragState.startTime);
    const endMinutes = timeToMinutes(dragState.currentTime);

    return {
      startTime: minutesToTime(Math.min(startMinutes, endMinutes)),
      endTime: minutesToTime(Math.max(startMinutes, endMinutes)),
      durationMinutes: Math.abs(endMinutes - startMinutes),
    };
  }, [dragState]);

  // 컨테이너에서 Y 좌표를 시간으로 변환하는 헬퍼
  const getTimeFromY = useCallback(
    (y: number, startHour: number = 0, endHour: number = 24): string | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      return yToTime(y, rect.top, rect.height, startHour, endHour);
    },
    []
  );

  return {
    // 상태
    selection,
    dragState,
    previewRange,
    isSelecting: dragState.isDragging,

    // Ref
    containerRef,

    // 핸들러
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    clearSelection,

    // 유틸리티
    getTimeFromY,
  };
}

/**
 * 드래그 선택 오버레이 스타일 계산
 */
export function getSelectionOverlayStyle(
  startTime: string,
  endTime: string,
  startHour: number = 0,
  endHour: number = 24
): React.CSSProperties {
  const totalMinutes = (endHour - startHour) * 60;
  const startMinutes = timeToMinutes(startTime) - startHour * 60;
  const endMinutes = timeToMinutes(endTime) - startHour * 60;

  const topPercent = (startMinutes / totalMinutes) * 100;
  const heightPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;

  return {
    position: "absolute",
    top: `${topPercent}%`,
    height: `${heightPercent}%`,
    left: 0,
    right: 0,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderRadius: "0.25rem",
    border: "2px dashed rgb(99, 102, 241)",
    pointerEvents: "none" as const,
  };
}
