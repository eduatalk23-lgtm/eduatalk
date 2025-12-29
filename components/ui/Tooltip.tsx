"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type TooltipPosition = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  children: ReactNode;
  content: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
};

/**
 * Tooltip 컴포넌트
 *
 * 호버 시 추가 정보를 표시하는 툴팁
 *
 * @example
 * <Tooltip content="콘텐츠로 빠르게 플랜 생성">
 *   <button>빠른 생성</button>
 * </Tooltip>
 */
export function Tooltip({
  children,
  content,
  position = "top",
  delay = 200,
  className,
  contentClassName,
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 위치 계산 및 뷰포트 경계 체크
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !containerRef.current) return;

    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    const rect = tooltip.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    let newPosition = position;

    // 뷰포트 경계 체크
    if (position === "top" && rect.top < 0) {
      newPosition = "bottom";
    } else if (position === "bottom" && rect.bottom > window.innerHeight) {
      newPosition = "top";
    } else if (position === "left" && rect.left < 0) {
      newPosition = "right";
    } else if (position === "right" && rect.right > window.innerWidth) {
      newPosition = "left";
    }

    if (newPosition !== actualPosition) {
      setActualPosition(newPosition);
    }
  }, [isVisible, position, actualPosition]);

  const handleMouseEnter = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleFocus = () => {
    if (disabled) return;
    setIsVisible(true);
  };

  const handleBlur = () => {
    setIsVisible(false);
  };

  // 클린업
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionStyles: Record<TooltipPosition, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowStyles: Record<TooltipPosition, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent",
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      {isVisible && content && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            "absolute z-50 animate-in fade-in-0 zoom-in-95 duration-150",
            positionStyles[actualPosition],
            contentClassName
          )}
        >
          <div className="relative rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-lg max-w-xs">
            {content}
            <span
              className={cn(
                "absolute border-4",
                arrowStyles[actualPosition]
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 간단한 텍스트 툴팁용 래퍼
 */
export function SimpleTooltip({
  children,
  text,
  position = "top",
}: {
  children: ReactNode;
  text: string;
  position?: TooltipPosition;
}) {
  return (
    <Tooltip content={text} position={position}>
      {children}
    </Tooltip>
  );
}
