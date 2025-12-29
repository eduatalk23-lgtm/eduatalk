"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type TimeRange = {
  date: string;
  startTime: string;
  endTime: string;
  startSlotIndex: number;
  endSlotIndex: number;
};

type UseTimeRangeSelectOptions = {
  onRangeSelect?: (range: TimeRange) => void;
  onRangeChange?: (range: TimeRange | null) => void;
  minSlots?: number; // 최소 선택 슬롯 수 (기본 1)
  maxSlots?: number; // 최대 선택 슬롯 수 (기본 무제한)
};

/**
 * useTimeRangeSelect - 캘린더에서 시간 범위를 드래그하여 선택하는 훅
 *
 * 기능:
 * - 마우스/터치 드래그로 시간 슬롯 범위 선택
 * - 선택 범위 시각화 (startSlotIndex ~ endSlotIndex)
 * - 선택 완료 시 콜백 호출
 *
 * 사용법:
 * 1. 각 타임슬롯에 slotHandlers 연결
 * 2. selectedRange로 현재 선택 범위 확인
 * 3. onRangeSelect 콜백으로 선택 완료 처리
 */
export function useTimeRangeSelect(options?: UseTimeRangeSelectOptions) {
  const {
    onRangeSelect,
    onRangeChange,
    minSlots = 1,
    maxSlots = Infinity,
  } = options || {};

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(null);
  const startRef = useRef<{ date: string; slotIndex: number; time: string } | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // 범위 변경 알림
  useEffect(() => {
    onRangeChange?.(selectedRange);
  }, [selectedRange, onRangeChange]);

  // 선택 시작
  const handleSlotMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, date: string, slotIndex: number, time: string) => {
      // 왼쪽 클릭만 처리
      if ("button" in e && e.button !== 0) return;

      e.preventDefault();
      setIsSelecting(true);
      startRef.current = { date, slotIndex, time };

      setSelectedRange({
        date,
        startTime: time,
        endTime: time,
        startSlotIndex: slotIndex,
        endSlotIndex: slotIndex,
      });
    },
    []
  );

  // 선택 중
  const handleSlotMouseEnter = useCallback(
    (date: string, slotIndex: number, time: string) => {
      if (!isSelecting || !startRef.current) return;

      // 같은 날짜 내에서만 선택 가능
      if (date !== startRef.current.date) return;

      const start = startRef.current;
      const startIdx = Math.min(start.slotIndex, slotIndex);
      const endIdx = Math.max(start.slotIndex, slotIndex);

      // 슬롯 수 제한 확인
      const slotCount = endIdx - startIdx + 1;
      if (slotCount > maxSlots) return;

      // 시작/끝 시간 계산
      const startTime = slotIndex < start.slotIndex ? time : start.time;
      const endTime = slotIndex >= start.slotIndex ? time : start.time;

      setSelectedRange({
        date,
        startTime,
        endTime,
        startSlotIndex: startIdx,
        endSlotIndex: endIdx,
      });
    },
    [isSelecting, maxSlots]
  );

  // 선택 완료 (마우스업)
  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selectedRange) {
      setIsSelecting(false);
      return;
    }

    const slotCount = selectedRange.endSlotIndex - selectedRange.startSlotIndex + 1;

    if (slotCount >= minSlots) {
      onRangeSelect?.(selectedRange);
    } else {
      // 최소 슬롯 미달 시 선택 취소
      setSelectedRange(null);
    }

    setIsSelecting(false);
    startRef.current = null;
  }, [isSelecting, selectedRange, minSlots, onRangeSelect]);

  // 전역 마우스업 리스너 (선택 중 마우스가 영역 밖으로 나갔다가 놓는 경우)
  useEffect(() => {
    if (!isSelecting) return;

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchend", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchend", handleGlobalMouseUp);
    };
  }, [isSelecting, handleMouseUp]);

  // 선택 취소 (ESC 키)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSelecting(false);
        setSelectedRange(null);
        startRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 선택 초기화
  const clearSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedRange(null);
    startRef.current = null;
  }, []);

  // 슬롯이 현재 선택 범위 내에 있는지 확인
  const isSlotSelected = useCallback(
    (date: string, slotIndex: number): boolean => {
      if (!selectedRange) return false;
      if (date !== selectedRange.date) return false;
      return slotIndex >= selectedRange.startSlotIndex && slotIndex <= selectedRange.endSlotIndex;
    },
    [selectedRange]
  );

  // 슬롯이 선택 범위의 시작인지 확인
  const isSlotStart = useCallback(
    (date: string, slotIndex: number): boolean => {
      if (!selectedRange) return false;
      return date === selectedRange.date && slotIndex === selectedRange.startSlotIndex;
    },
    [selectedRange]
  );

  // 슬롯이 선택 범위의 끝인지 확인
  const isSlotEnd = useCallback(
    (date: string, slotIndex: number): boolean => {
      if (!selectedRange) return false;
      return date === selectedRange.date && slotIndex === selectedRange.endSlotIndex;
    },
    [selectedRange]
  );

  return {
    // 상태
    isSelecting,
    selectedRange,

    // 슬롯 핸들러
    slotHandlers: {
      onMouseDown: handleSlotMouseDown,
      onMouseEnter: handleSlotMouseEnter,
      onMouseUp: handleMouseUp,
      onTouchStart: handleSlotMouseDown,
      onTouchMove: (e: React.TouchEvent, date: string, slotIndex: number, time: string) => {
        // 터치 이동 시 현재 위치의 슬롯 찾기
        handleSlotMouseEnter(date, slotIndex, time);
      },
      onTouchEnd: handleMouseUp,
    },

    // 유틸리티
    isSlotSelected,
    isSlotStart,
    isSlotEnd,
    clearSelection,

    // 컨테이너 ref (터치 이벤트 처리용)
    containerRef,
  };
}
