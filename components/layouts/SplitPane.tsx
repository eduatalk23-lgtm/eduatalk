"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  memo,
  type ReactNode,
  type MouseEvent,
  type TouchEvent,
} from "react";
import { cn } from "@/lib/cn";

// ============================================================================
// Types
// ============================================================================

export type SplitDirection = "horizontal" | "vertical";

export interface SplitPaneProps {
  /** 왼쪽/위 패널 내용 */
  primary: ReactNode;
  /** 오른쪽/아래 패널 내용 (선택적) */
  secondary?: ReactNode;
  /** 분할 방향 */
  direction?: SplitDirection;
  /** 초기 분할 비율 (0-100) */
  defaultSize?: number;
  /** 최소 primary 패널 크기 (px) */
  minPrimarySize?: number;
  /** 최소 secondary 패널 크기 (px) */
  minSecondarySize?: number;
  /** 리사이즈 가능 여부 */
  resizable?: boolean;
  /** 리사이저 표시 여부 */
  showResizer?: boolean;
  /** 접기 가능 여부 */
  collapsible?: boolean;
  /** secondary가 접힌 상태로 시작 */
  defaultCollapsed?: boolean;
  /** 크기 변경 콜백 */
  onSizeChange?: (size: number) => void;
  /** 접힘 상태 변경 콜백 */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 컨테이너 클래스 */
  className?: string;
  /** primary 패널 클래스 */
  primaryClassName?: string;
  /** secondary 패널 클래스 */
  secondaryClassName?: string;
  /** secondary가 없을 때 표시할 내용 */
  emptySecondary?: ReactNode;
  /** 모바일에서 스택 레이아웃으로 전환 */
  stackOnMobile?: boolean;
  /** 모바일 브레이크포인트 (px) */
  mobileBreakpoint?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SIZE = 35; // 35%
const MIN_PRIMARY = 200; // px
const MIN_SECONDARY = 300; // px
const RESIZER_WIDTH = 8; // px

// ============================================================================
// Component
// ============================================================================

/**
 * SplitPane 컴포넌트
 *
 * 두 패널을 나란히 배치하는 Master-Detail 레이아웃을 제공합니다.
 * 리사이즈, 접기, 모바일 스택 레이아웃을 지원합니다.
 *
 * @example
 * // 기본 사용 (목록 + 상세)
 * <SplitPane
 *   primary={<StudentList onSelect={setSelected} />}
 *   secondary={selected && <StudentDetail id={selected} />}
 *   emptySecondary={<EmptyState message="학생을 선택하세요" />}
 * />
 *
 * @example
 * // 수직 분할
 * <SplitPane
 *   direction="vertical"
 *   primary={<CodeEditor />}
 *   secondary={<Terminal />}
 *   defaultSize={60}
 * />
 */
function SplitPaneComponent({
  primary,
  secondary,
  direction = "horizontal",
  defaultSize = DEFAULT_SIZE,
  minPrimarySize = MIN_PRIMARY,
  minSecondarySize = MIN_SECONDARY,
  resizable = true,
  showResizer = true,
  collapsible = true,
  defaultCollapsed = false,
  onSizeChange,
  onCollapsedChange,
  className,
  primaryClassName,
  secondaryClassName,
  emptySecondary,
  stackOnMobile = true,
  mobileBreakpoint = 768,
}: SplitPaneProps) {
  const [size, setSize] = useState(defaultSize);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  // 모바일 감지
  useEffect(() => {
    if (!stackOnMobile) return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [stackOnMobile, mobileBreakpoint]);

  // 드래그 시작
  const handleDragStart = useCallback(
    (clientPos: number) => {
      if (!resizable || isCollapsed) return;
      setIsDragging(true);
      startPosRef.current = clientPos;
      startSizeRef.current = size;
    },
    [resizable, isCollapsed, size]
  );

  // 드래그 중
  const handleDrag = useCallback(
    (clientPos: number) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerSize =
        direction === "horizontal" ? containerRect.width : containerRect.height;

      const delta = clientPos - startPosRef.current;
      const deltaPercent = (delta / containerSize) * 100;
      let newSize = startSizeRef.current + deltaPercent;

      // 최소/최대 크기 제한
      const minPrimaryPercent = (minPrimarySize / containerSize) * 100;
      const maxPrimaryPercent =
        100 - (minSecondarySize / containerSize) * 100 - (RESIZER_WIDTH / containerSize) * 100;

      newSize = Math.max(minPrimaryPercent, Math.min(maxPrimaryPercent, newSize));

      setSize(newSize);
      onSizeChange?.(newSize);
    },
    [isDragging, direction, minPrimarySize, minSecondarySize, onSizeChange]
  );

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 마우스 이벤트
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      const clientPos = direction === "horizontal" ? e.clientX : e.clientY;
      handleDragStart(clientPos);
    },
    [direction, handleDragStart]
  );

  // 터치 이벤트
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      const clientPos = direction === "horizontal" ? touch.clientX : touch.clientY;
      handleDragStart(clientPos);
    },
    [direction, handleDragStart]
  );

  // 전역 이벤트 리스너
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const clientPos = direction === "horizontal" ? e.clientX : e.clientY;
      handleDrag(clientPos);
    };

    const handleTouchMove = (e: globalThis.TouchEvent) => {
      const touch = e.touches[0];
      const clientPos = direction === "horizontal" ? touch.clientX : touch.clientY;
      handleDrag(clientPos);
    };

    const handleUp = () => handleDragEnd();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDragging, direction, handleDrag, handleDragEnd]);

  // 접기/펼치기
  const toggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  // Secondary가 없으면 Primary만 렌더링
  const hasSecondary = secondary !== undefined || emptySecondary !== undefined;

  // 모바일에서 스택 레이아웃
  if (isMobile && stackOnMobile) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className={cn("flex-1 overflow-auto", primaryClassName)}>{primary}</div>
        {hasSecondary && (
          <div className={cn("flex-1 overflow-auto border-t border-gray-200 dark:border-gray-700", secondaryClassName)}>
            {secondary || emptySecondary}
          </div>
        )}
      </div>
    );
  }

  // Secondary가 없으면 Primary만 표시
  if (!hasSecondary) {
    return (
      <div className={cn("h-full", className)}>
        <div className={cn("h-full overflow-auto", primaryClassName)}>{primary}</div>
      </div>
    );
  }

  const isHorizontal = direction === "horizontal";
  const primaryStyle = isCollapsed
    ? { [isHorizontal ? "width" : "height"]: "100%" }
    : { [isHorizontal ? "width" : "height"]: `${size}%` };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col",
        isDragging && "select-none",
        className
      )}
    >
      {/* Primary Panel */}
      <div
        className={cn(
          "overflow-auto",
          isCollapsed ? "flex-1" : "flex-shrink-0",
          primaryClassName
        )}
        style={primaryStyle}
      >
        {primary}
      </div>

      {/* Resizer */}
      {showResizer && !isCollapsed && (
        <div
          className={cn(
            "relative flex-shrink-0 group",
            isHorizontal ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
            "bg-gray-100 dark:bg-gray-800",
            "hover:bg-indigo-100 dark:hover:bg-indigo-900/30",
            isDragging && "bg-indigo-200 dark:bg-indigo-800/50"
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Resizer Handle */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              isHorizontal ? "flex-col gap-0.5" : "flex-row gap-0.5"
            )}
          >
            <span className="w-0.5 h-0.5 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-indigo-500" />
            <span className="w-0.5 h-0.5 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-indigo-500" />
            <span className="w-0.5 h-0.5 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-indigo-500" />
          </div>

          {/* Collapse Button */}
          {collapsible && (
            <button
              onClick={toggleCollapse}
              className={cn(
                "absolute z-10 flex items-center justify-center rounded-full",
                "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
                "shadow-sm hover:shadow-md transition-shadow",
                "size-6 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400",
                isHorizontal
                  ? "top-1/2 -translate-y-1/2 -right-3"
                  : "left-1/2 -translate-x-1/2 -bottom-3"
              )}
              aria-label={isCollapsed ? "펼치기" : "접기"}
            >
              <svg
                className={cn(
                  "size-3 transition-transform",
                  isHorizontal
                    ? isCollapsed ? "rotate-180" : ""
                    : isCollapsed ? "-rotate-90" : "rotate-90"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Secondary Panel */}
      {!isCollapsed && (
        <div
          className={cn(
            "flex-1 overflow-auto min-w-0",
            secondaryClassName
          )}
        >
          {secondary || emptySecondary}
        </div>
      )}

      {/* Collapsed Secondary Button */}
      {isCollapsed && collapsible && (
        <button
          onClick={toggleCollapse}
          className={cn(
            "flex items-center justify-center",
            "bg-gray-50 dark:bg-gray-900/50 border-l border-gray-200 dark:border-gray-700",
            "text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400",
            "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
            isHorizontal ? "w-8" : "h-8"
          )}
          aria-label="상세 패널 열기"
        >
          <svg
            className={cn(
              "size-4",
              isHorizontal ? "" : "rotate-90"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

export const SplitPane = memo(SplitPaneComponent);

// ============================================================================
// Preset Layouts
// ============================================================================

/**
 * Master-Detail 레이아웃 프리셋
 *
 * 목록(master)과 상세(detail) 패널로 구성된 레이아웃
 */
export function MasterDetailLayout({
  master,
  detail,
  emptyDetail,
  masterWidth = 35,
  className,
  masterClassName,
  detailClassName,
}: {
  master: ReactNode;
  detail?: ReactNode;
  emptyDetail?: ReactNode;
  masterWidth?: number;
  className?: string;
  masterClassName?: string;
  detailClassName?: string;
}) {
  return (
    <SplitPane
      primary={master}
      secondary={detail}
      emptySecondary={emptyDetail}
      defaultSize={masterWidth}
      minPrimarySize={280}
      minSecondarySize={400}
      primaryClassName={cn("border-r border-gray-200 dark:border-gray-700", masterClassName)}
      secondaryClassName={detailClassName}
      className={className}
    />
  );
}

/**
 * 에디터 레이아웃 프리셋
 *
 * 코드 에디터와 프리뷰/터미널 패널로 구성된 레이아웃
 */
export function EditorLayout({
  editor,
  preview,
  direction = "horizontal",
  editorSize = 50,
  className,
}: {
  editor: ReactNode;
  preview: ReactNode;
  direction?: SplitDirection;
  editorSize?: number;
  className?: string;
}) {
  return (
    <SplitPane
      primary={editor}
      secondary={preview}
      direction={direction}
      defaultSize={editorSize}
      minPrimarySize={200}
      minSecondarySize={200}
      className={className}
    />
  );
}

export default SplitPane;
