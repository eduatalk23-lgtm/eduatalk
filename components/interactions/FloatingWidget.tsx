"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  createContext,
  useContext,
  memo,
} from "react";
import { cn } from "@/lib/cn";
import { createPortal } from "react-dom";

// ============================================================================
// Client-Only Hook
// ============================================================================

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 클라이언트 사이드에서만 true를 반환하는 훅
 * SSR에서는 false를 반환
 */
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

// ============================================================================
// Types
// ============================================================================

export type FloatingPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "custom";

export interface FloatingWidgetPosition {
  x: number;
  y: number;
}

export interface FloatingWidgetProps {
  /** 위젯 컨텐츠 */
  children: ReactNode;
  /** 위젯 ID */
  id: string;
  /** 초기 위치 */
  initialPosition?: FloatingPosition;
  /** 커스텀 초기 좌표 */
  initialCoordinates?: FloatingWidgetPosition;
  /** 드래그 가능 여부 */
  draggable?: boolean;
  /** 최소화 가능 여부 */
  minimizable?: boolean;
  /** 최소화 상태 */
  minimized?: boolean;
  /** 최소화 상태 변경 핸들러 */
  onMinimizedChange?: (minimized: boolean) => void;
  /** 닫기 핸들러 */
  onClose?: () => void;
  /** 위치 변경 핸들러 */
  onPositionChange?: (position: FloatingWidgetPosition) => void;
  /** 컨테이너 클래스 */
  className?: string;
  /** 헤더 영역 (드래그 핸들) */
  header?: ReactNode;
  /** 최소화 시 표시할 컨텐츠 */
  minimizedContent?: ReactNode;
  /** z-index */
  zIndex?: number;
  /** 화면 경계 내 유지 */
  constrainToViewport?: boolean;
  /** 표시 여부 */
  visible?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const POSITION_OFFSETS: Record<FloatingPosition, { x: string; y: string }> = {
  "bottom-right": { x: "calc(100vw - 100% - 24px)", y: "calc(100vh - 100% - 24px)" },
  "bottom-left": { x: "24px", y: "calc(100vh - 100% - 24px)" },
  "top-right": { x: "calc(100vw - 100% - 24px)", y: "24px" },
  "top-left": { x: "24px", y: "24px" },
  custom: { x: "0", y: "0" },
};

const MINIMIZED_SIZE = { width: 56, height: 56 };
const DEFAULT_Z_INDEX = 9999;

// ============================================================================
// Context for Managing Multiple Widgets
// ============================================================================

interface FloatingWidgetManagerContextValue {
  bringToFront: (id: string) => void;
  getZIndex: (id: string) => number;
  registerWidget: (id: string) => void;
  unregisterWidget: (id: string) => void;
}

const FloatingWidgetManagerContext = createContext<FloatingWidgetManagerContextValue | null>(null);

export function FloatingWidgetManager({ children }: { children: ReactNode }) {
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const baseZIndex = DEFAULT_Z_INDEX;

  const registerWidget = useCallback((id: string) => {
    setWidgetOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const unregisterWidget = useCallback((id: string) => {
    setWidgetOrder((prev) => prev.filter((wId) => wId !== id));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setWidgetOrder((prev) => {
      const filtered = prev.filter((wId) => wId !== id);
      return [...filtered, id];
    });
  }, []);

  const getZIndex = useCallback(
    (id: string) => {
      const index = widgetOrder.indexOf(id);
      return baseZIndex + (index >= 0 ? index : 0);
    },
    [widgetOrder, baseZIndex]
  );

  return (
    <FloatingWidgetManagerContext.Provider
      value={{ bringToFront, getZIndex, registerWidget, unregisterWidget }}
    >
      {children}
    </FloatingWidgetManagerContext.Provider>
  );
}

function useFloatingWidgetManager() {
  return useContext(FloatingWidgetManagerContext);
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * FloatingWidget 컴포넌트
 *
 * 화면에 떠다니는 위젯을 제공합니다. 드래그, 최소화, 닫기 기능을 지원합니다.
 *
 * @example
 * <FloatingWidget
 *   id="timer"
 *   initialPosition="bottom-right"
 *   draggable
 *   minimizable
 *   header={<div className="font-semibold">타이머</div>}
 *   minimizedContent={<Clock className="size-6" />}
 * >
 *   <TimerContent />
 * </FloatingWidget>
 */
function FloatingWidgetComponent({
  children,
  id,
  initialPosition = "bottom-right",
  initialCoordinates,
  draggable = true,
  minimizable = true,
  minimized: controlledMinimized,
  onMinimizedChange,
  onClose,
  onPositionChange,
  className,
  header,
  minimizedContent,
  zIndex: propZIndex,
  constrainToViewport = true,
  visible = true,
}: FloatingWidgetProps) {
  const isClient = useIsClient();
  const manager = useFloatingWidgetManager();
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // 내부 상태 - initialCoordinates가 있으면 사용, 없으면 null (CSS calc 사용)
  const [internalMinimized, setInternalMinimized] = useState(false);
  const [position, setPosition] = useState<FloatingWidgetPosition | null>(
    initialCoordinates ?? null
  );
  const [isDragging, setIsDragging] = useState(false);

  const isMinimized = controlledMinimized ?? internalMinimized;
  const effectiveZIndex = propZIndex ?? manager?.getZIndex(id) ?? DEFAULT_Z_INDEX;

  // 위젯 등록
  useEffect(() => {
    if (!isClient) return;
    manager?.registerWidget(id);
    return () => {
      manager?.unregisterWidget(id);
    };
  }, [id, manager, isClient]);

  // 드래그 핸들러
  const handleDragStart = useCallback(
    (e: ReactMouseEvent) => {
      if (!draggable || !widgetRef.current) return;

      e.preventDefault();
      setIsDragging(true);
      manager?.bringToFront(id);

      const rect = widgetRef.current.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const initialX = rect.left;
      const initialY = rect.top;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newX = initialX + deltaX;
        let newY = initialY + deltaY;

        // 뷰포트 경계 제한
        if (constrainToViewport && widgetRef.current) {
          const widgetRect = widgetRef.current.getBoundingClientRect();
          const maxX = window.innerWidth - widgetRect.width;
          const maxY = window.innerHeight - widgetRect.height;

          newX = Math.max(0, Math.min(newX, maxX));
          newY = Math.max(0, Math.min(newY, maxY));
        }

        setPosition({ x: newX, y: newY });
        onPositionChange?.({ x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [draggable, id, manager, constrainToViewport, onPositionChange]
  );

  // 최소화 토글
  const toggleMinimized = useCallback(() => {
    const newValue = !isMinimized;
    if (onMinimizedChange) {
      onMinimizedChange(newValue);
    } else {
      setInternalMinimized(newValue);
    }
  }, [isMinimized, onMinimizedChange]);

  // 클릭으로 앞으로 가져오기
  const handleClick = useCallback(() => {
    manager?.bringToFront(id);
  }, [id, manager]);

  if (!isClient || !visible) return null;

  const positionStyle: React.CSSProperties = position
    ? {
        left: position.x,
        top: position.y,
        transform: "none",
      }
    : {
        left: POSITION_OFFSETS[initialPosition].x,
        top: POSITION_OFFSETS[initialPosition].y,
      };

  const widget = (
    <div
      ref={widgetRef}
      className={cn(
        "fixed",
        isDragging ? "cursor-grabbing" : "cursor-default",
        "transition-[width,height] duration-200",
        className
      )}
      style={{
        ...positionStyle,
        zIndex: effectiveZIndex,
        width: isMinimized ? MINIMIZED_SIZE.width : undefined,
        height: isMinimized ? MINIMIZED_SIZE.height : undefined,
      }}
      onClick={handleClick}
    >
      <div
        className={cn(
          "bg-white dark:bg-secondary-900",
          "rounded-xl shadow-xl",
          "border border-secondary-200 dark:border-secondary-700",
          "overflow-hidden",
          isMinimized && "flex items-center justify-center"
        )}
      >
        {isMinimized ? (
          // 최소화 상태
          <button
            type="button"
            onClick={toggleMinimized}
            className={cn(
              "w-full h-full flex items-center justify-center",
              "text-secondary-600 dark:text-secondary-400",
              "hover:bg-secondary-100 dark:hover:bg-secondary-800",
              "transition-colors"
            )}
            style={{ width: MINIMIZED_SIZE.width, height: MINIMIZED_SIZE.height }}
          >
            {minimizedContent ?? (
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        ) : (
          // 확장 상태
          <>
            {/* 헤더 / 드래그 핸들 */}
            <div
              ref={dragRef}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2",
                "bg-secondary-50 dark:bg-secondary-800/50",
                "border-b border-secondary-200 dark:border-secondary-700",
                draggable && "cursor-grab active:cursor-grabbing"
              )}
              onMouseDown={handleDragStart}
            >
              <div className="flex-1 min-w-0">{header}</div>
              <div className="flex items-center gap-1">
                {minimizable && (
                  <button
                    type="button"
                    onClick={toggleMinimized}
                    className={cn(
                      "p-1 rounded",
                      "text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300",
                      "hover:bg-secondary-200 dark:hover:bg-secondary-700",
                      "transition-colors"
                    )}
                    aria-label="최소화"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                    </svg>
                  </button>
                )}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      "p-1 rounded",
                      "text-secondary-400 hover:text-error-600 dark:hover:text-error-400",
                      "hover:bg-secondary-200 dark:hover:bg-secondary-700",
                      "transition-colors"
                    )}
                    aria-label="닫기"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 컨텐츠 */}
            <div className="p-3">{children}</div>
          </>
        )}
      </div>
    </div>
  );

  // Portal로 body에 렌더링
  return createPortal(widget, document.body);
}

export const FloatingWidget = memo(FloatingWidgetComponent);

// ============================================================================
// Floating Timer Widget
// ============================================================================

export interface FloatingTimerProps {
  /** 현재 시간 (초) */
  currentTime: number;
  /** 총 시간 (초) */
  totalTime?: number;
  /** 플랜 이름 */
  planName: string;
  /** 재생 중 여부 */
  isPlaying: boolean;
  /** 재생/일시정지 핸들러 */
  onTogglePlay: () => void;
  /** 정지 핸들러 */
  onStop: () => void;
  /** 닫기 핸들러 */
  onClose?: () => void;
  /** 표시 여부 */
  visible?: boolean;
  /** 초기 위치 */
  initialPosition?: FloatingPosition;
}

/**
 * FloatingTimer 컴포넌트
 *
 * 떠다니는 타이머 미니 플레이어입니다.
 *
 * @example
 * <FloatingTimer
 *   currentTime={elapsed}
 *   totalTime={3600}
 *   planName="수학 공부"
 *   isPlaying={isPlaying}
 *   onTogglePlay={handleTogglePlay}
 *   onStop={handleStop}
 *   visible={showFloatingTimer}
 * />
 */
export function FloatingTimer({
  currentTime,
  totalTime,
  planName,
  isPlaying,
  onTogglePlay,
  onStop,
  onClose,
  visible = true,
  initialPosition = "bottom-right",
}: FloatingTimerProps) {
  const [minimized, setMinimized] = useState(false);

  // 시간 포맷
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  // 진행률
  const progress = totalTime ? (currentTime / totalTime) * 100 : 0;

  return (
    <FloatingWidget
      id="floating-timer"
      visible={visible}
      initialPosition={initialPosition}
      draggable
      minimizable
      minimized={minimized}
      onMinimizedChange={setMinimized}
      onClose={onClose}
      header={
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "size-2 rounded-full",
              isPlaying ? "bg-success-500 animate-pulse" : "bg-secondary-400"
            )}
          />
          <span className="text-sm font-medium text-secondary-900 dark:text-secondary-100 truncate max-w-[150px]">
            {planName}
          </span>
        </div>
      }
      minimizedContent={
        <div className="relative">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isPlaying && (
            <div className="absolute -top-1 -right-1 size-2 bg-success-500 rounded-full animate-pulse" />
          )}
        </div>
      }
    >
      <div className="w-[200px] flex flex-col gap-3">
        {/* 시간 표시 */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-secondary-900 dark:text-secondary-100">
            {formatTime(currentTime)}
          </div>
          {totalTime && (
            <div className="text-xs text-secondary-500 dark:text-secondary-400">
              목표: {formatTime(totalTime)}
            </div>
          )}
        </div>

        {/* 진행률 바 */}
        {totalTime && (
          <div className="w-full h-1.5 bg-secondary-200 dark:bg-secondary-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}

        {/* 컨트롤 버튼 */}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className={cn(
              "p-2 rounded-full",
              isPlaying
                ? "bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400"
                : "bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400",
              "hover:opacity-80 transition-opacity"
            )}
            aria-label={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying ? (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onStop}
            className={cn(
              "p-2 rounded-full",
              "bg-secondary-100 dark:bg-secondary-800",
              "text-secondary-600 dark:text-secondary-400",
              "hover:bg-error-100 dark:hover:bg-error-900/30",
              "hover:text-error-600 dark:hover:text-error-400",
              "transition-colors"
            )}
            aria-label="정지"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </button>
        </div>
      </div>
    </FloatingWidget>
  );
}

export default FloatingWidget;
