"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resizePlanDuration, type PlanType } from "@/lib/domains/plan/actions/calendarDrag";

export type ResizeDirection = "top" | "bottom";

export interface ResizeState {
  isResizing: boolean;
  direction: ResizeDirection | null;
  planId: string | null;
  initialY: number;
  currentY: number;
  originalStartTime: string | null;
  originalEndTime: string | null;
  previewStartTime: string | null;
  previewEndTime: string | null;
}

export interface UsePlanResizeOptions {
  minuteHeight?: number; // 1분당 픽셀 높이
  snapMinutes?: number; // 스냅 단위 (분)
  minDuration?: number; // 최소 시간 (분)
  maxDuration?: number; // 최대 시간 (분)
  onResizeStart?: (planId: string) => void;
  onResizeEnd?: (planId: string, newStart: string, newEnd: string) => void;
  onResizeError?: (error: string) => void;
}

const DEFAULT_OPTIONS: Required<UsePlanResizeOptions> = {
  minuteHeight: 2, // 1분당 2픽셀
  snapMinutes: 5, // 5분 단위 스냅
  minDuration: 15, // 최소 15분
  maxDuration: 240, // 최대 4시간
  onResizeStart: () => {},
  onResizeEnd: () => {},
  onResizeError: () => {},
};

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}

function formatTime(hours: number, minutes: number): string {
  const h = Math.max(0, Math.min(23, hours));
  const m = Math.max(0, Math.min(59, minutes));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return formatTime(hours, minutes);
}

export function usePlanResize(options: UsePlanResizeOptions = {}) {
  const router = useRouter();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<ResizeState>({
    isResizing: false,
    direction: null,
    planId: null,
    initialY: 0,
    currentY: 0,
    originalStartTime: null,
    originalEndTime: null,
    previewStartTime: null,
    previewEndTime: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 픽셀 변위를 분 단위로 변환
  const deltaYToMinutes = useCallback(
    (deltaY: number): number => {
      const rawMinutes = Math.round(deltaY / opts.minuteHeight);
      // 스냅 적용
      return Math.round(rawMinutes / opts.snapMinutes) * opts.snapMinutes;
    },
    [opts.minuteHeight, opts.snapMinutes]
  );

  // 리사이즈 시작
  const startResize = useCallback(
    (
      planId: string,
      direction: ResizeDirection,
      startTime: string,
      endTime: string,
      clientY: number
    ) => {
      setState({
        isResizing: true,
        direction,
        planId,
        initialY: clientY,
        currentY: clientY,
        originalStartTime: startTime,
        originalEndTime: endTime,
        previewStartTime: startTime,
        previewEndTime: endTime,
      });
      opts.onResizeStart(planId);
    },
    [opts]
  );

  // 리사이즈 진행 중
  const updateResize = useCallback(
    (clientY: number) => {
      const currentState = stateRef.current;
      if (!currentState.isResizing || !currentState.originalStartTime || !currentState.originalEndTime) {
        return;
      }

      const deltaY = clientY - currentState.initialY;
      const deltaMinutes = deltaYToMinutes(deltaY);

      const originalStartMinutes = timeToMinutes(currentState.originalStartTime);
      const originalEndMinutes = timeToMinutes(currentState.originalEndTime);
      const originalDuration = originalEndMinutes - originalStartMinutes;

      let newStartMinutes = originalStartMinutes;
      let newEndMinutes = originalEndMinutes;

      if (currentState.direction === "top") {
        // 상단 핸들: 시작 시간 변경
        newStartMinutes = originalStartMinutes + deltaMinutes;
        // 최소 시간 제한
        const maxStartMinutes = originalEndMinutes - opts.minDuration;
        newStartMinutes = Math.min(newStartMinutes, maxStartMinutes);
        // 0시 이하 방지
        newStartMinutes = Math.max(0, newStartMinutes);
      } else {
        // 하단 핸들: 종료 시간 변경
        newEndMinutes = originalEndMinutes + deltaMinutes;
        // 최소 시간 제한
        const minEndMinutes = originalStartMinutes + opts.minDuration;
        newEndMinutes = Math.max(newEndMinutes, minEndMinutes);
        // 24시 초과 방지
        newEndMinutes = Math.min(24 * 60 - 1, newEndMinutes);
      }

      // 최대 시간 제한
      const newDuration = newEndMinutes - newStartMinutes;
      if (newDuration > opts.maxDuration) {
        if (currentState.direction === "top") {
          newStartMinutes = newEndMinutes - opts.maxDuration;
        } else {
          newEndMinutes = newStartMinutes + opts.maxDuration;
        }
      }

      setState((prev) => ({
        ...prev,
        currentY: clientY,
        previewStartTime: minutesToTime(newStartMinutes),
        previewEndTime: minutesToTime(newEndMinutes),
      }));
    },
    [deltaYToMinutes, opts.minDuration, opts.maxDuration]
  );

  // 리사이즈 완료
  const endResize = useCallback(
    async (planType: PlanType = "student_plan") => {
      const currentState = stateRef.current;
      if (
        !currentState.isResizing ||
        !currentState.planId ||
        !currentState.previewStartTime ||
        !currentState.previewEndTime
      ) {
        setState({
          isResizing: false,
          direction: null,
          planId: null,
          initialY: 0,
          currentY: 0,
          originalStartTime: null,
          originalEndTime: null,
          previewStartTime: null,
          previewEndTime: null,
        });
        return;
      }

      // 변경 없으면 스킵
      if (
        currentState.previewStartTime === currentState.originalStartTime &&
        currentState.previewEndTime === currentState.originalEndTime
      ) {
        setState({
          isResizing: false,
          direction: null,
          planId: null,
          initialY: 0,
          currentY: 0,
          originalStartTime: null,
          originalEndTime: null,
          previewStartTime: null,
          previewEndTime: null,
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const result = await resizePlanDuration(
          currentState.planId,
          planType,
          currentState.previewStartTime,
          currentState.previewEndTime
        );

        if (result.success) {
          opts.onResizeEnd(
            currentState.planId,
            currentState.previewStartTime,
            currentState.previewEndTime
          );
          router.refresh();
        } else {
          opts.onResizeError(result.error || "시간 변경에 실패했습니다.");
        }
      } catch (error) {
        opts.onResizeError(
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
        );
      } finally {
        setIsSubmitting(false);
        setState({
          isResizing: false,
          direction: null,
          planId: null,
          initialY: 0,
          currentY: 0,
          originalStartTime: null,
          originalEndTime: null,
          previewStartTime: null,
          previewEndTime: null,
        });
      }
    },
    [router, opts]
  );

  // 리사이즈 취소
  const cancelResize = useCallback(() => {
    setState({
      isResizing: false,
      direction: null,
      planId: null,
      initialY: 0,
      currentY: 0,
      originalStartTime: null,
      originalEndTime: null,
      previewStartTime: null,
      previewEndTime: null,
    });
  }, []);

  // 전역 마우스 이벤트 리스너
  useEffect(() => {
    if (!state.isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      updateResize(e.clientY);
    };

    const handleMouseUp = () => {
      endResize();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelResize();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    // 리사이즈 중 선택 방지
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [state.isResizing, updateResize, endResize, cancelResize]);

  return {
    state,
    isSubmitting,
    startResize,
    updateResize,
    endResize,
    cancelResize,
    // 헬퍼: 특정 플랜이 현재 리사이즈 중인지 확인
    isResizingPlan: (planId: string) =>
      state.isResizing && state.planId === planId,
    // 헬퍼: 특정 플랜의 프리뷰 시간 가져오기
    getPreviewTimes: (planId: string) =>
      state.planId === planId
        ? {
            startTime: state.previewStartTime,
            endTime: state.previewEndTime,
          }
        : null,
  };
}
