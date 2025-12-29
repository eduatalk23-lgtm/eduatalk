"use client";

import { useState, useRef, useEffect, useCallback, memo, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================================================
// Types
// ============================================================================

export type TooltipPosition = "top" | "bottom" | "left" | "right";
export type TooltipSize = "sm" | "md" | "lg";
export type TooltipVariant = "dark" | "light" | "info" | "warning" | "error" | "success";

export type TooltipProps = {
  children: ReactNode;
  /** 툴팁 내용 */
  content: ReactNode;
  /** 툴팁 위치 */
  position?: TooltipPosition;
  /** 표시 지연 시간 (ms) */
  delay?: number;
  /** 숨김 지연 시간 (ms) - interactive 모드에서 유용 */
  hideDelay?: number;
  /** 컨테이너 클래스 */
  className?: string;
  /** 툴팁 내용 클래스 */
  contentClassName?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 툴팁 크기 */
  size?: TooltipSize;
  /** 툴팁 스타일 변형 */
  variant?: TooltipVariant;
  /** 최대 너비 */
  maxWidth?: number | string;
  /** 화살표 표시 여부 */
  showArrow?: boolean;
  /** 상호작용 가능 (툴팁 위에 마우스 올려도 유지) */
  interactive?: boolean;
  /** 키보드 단축키 힌트 */
  shortcut?: string | string[];
  /** 커스텀 오프셋 (px) */
  offset?: number;
  /** 포탈 사용 여부 (body에 렌더링) */
  portal?: boolean;
  /** 트리거 이벤트 */
  trigger?: "hover" | "click" | "focus";
  /** 항상 표시 */
  alwaysShow?: boolean;
  /** 애니메이션 비활성화 */
  noAnimation?: boolean;
};

// ============================================================================
// Style Constants
// ============================================================================

const sizeStyles: Record<TooltipSize, { padding: string; text: string; arrow: string }> = {
  sm: { padding: "px-2 py-1", text: "text-xs", arrow: "border-[3px]" },
  md: { padding: "px-3 py-2", text: "text-sm", arrow: "border-4" },
  lg: { padding: "px-4 py-3", text: "text-base", arrow: "border-[5px]" },
};

const variantStyles: Record<TooltipVariant, { bg: string; text: string; arrow: Record<TooltipPosition, string> }> = {
  dark: {
    bg: "bg-gray-900 dark:bg-gray-100",
    text: "text-white dark:text-gray-900",
    arrow: {
      top: "border-t-gray-900 dark:border-t-gray-100 border-x-transparent border-b-transparent",
      bottom: "border-b-gray-900 dark:border-b-gray-100 border-x-transparent border-t-transparent",
      left: "border-l-gray-900 dark:border-l-gray-100 border-y-transparent border-r-transparent",
      right: "border-r-gray-900 dark:border-r-gray-100 border-y-transparent border-l-transparent",
    },
  },
  light: {
    bg: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
    text: "text-gray-900 dark:text-gray-100",
    arrow: {
      top: "border-t-white dark:border-t-gray-800 border-x-transparent border-b-transparent",
      bottom: "border-b-white dark:border-b-gray-800 border-x-transparent border-t-transparent",
      left: "border-l-white dark:border-l-gray-800 border-y-transparent border-r-transparent",
      right: "border-r-white dark:border-r-gray-800 border-y-transparent border-l-transparent",
    },
  },
  info: {
    bg: "bg-blue-600 dark:bg-blue-500",
    text: "text-white",
    arrow: {
      top: "border-t-blue-600 dark:border-t-blue-500 border-x-transparent border-b-transparent",
      bottom: "border-b-blue-600 dark:border-b-blue-500 border-x-transparent border-t-transparent",
      left: "border-l-blue-600 dark:border-l-blue-500 border-y-transparent border-r-transparent",
      right: "border-r-blue-600 dark:border-r-blue-500 border-y-transparent border-l-transparent",
    },
  },
  warning: {
    bg: "bg-amber-500 dark:bg-amber-400",
    text: "text-white dark:text-gray-900",
    arrow: {
      top: "border-t-amber-500 dark:border-t-amber-400 border-x-transparent border-b-transparent",
      bottom: "border-b-amber-500 dark:border-b-amber-400 border-x-transparent border-t-transparent",
      left: "border-l-amber-500 dark:border-l-amber-400 border-y-transparent border-r-transparent",
      right: "border-r-amber-500 dark:border-r-amber-400 border-y-transparent border-l-transparent",
    },
  },
  error: {
    bg: "bg-red-600 dark:bg-red-500",
    text: "text-white",
    arrow: {
      top: "border-t-red-600 dark:border-t-red-500 border-x-transparent border-b-transparent",
      bottom: "border-b-red-600 dark:border-b-red-500 border-x-transparent border-t-transparent",
      left: "border-l-red-600 dark:border-l-red-500 border-y-transparent border-r-transparent",
      right: "border-r-red-600 dark:border-r-red-500 border-y-transparent border-l-transparent",
    },
  },
  success: {
    bg: "bg-green-600 dark:bg-green-500",
    text: "text-white",
    arrow: {
      top: "border-t-green-600 dark:border-t-green-500 border-x-transparent border-b-transparent",
      bottom: "border-b-green-600 dark:border-b-green-500 border-x-transparent border-t-transparent",
      left: "border-l-green-600 dark:border-l-green-500 border-y-transparent border-r-transparent",
      right: "border-r-green-600 dark:border-r-green-500 border-y-transparent border-l-transparent",
    },
  },
};

const positionStyles: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2",
  bottom: "top-full left-1/2 -translate-x-1/2",
  left: "right-full top-1/2 -translate-y-1/2",
  right: "left-full top-1/2 -translate-y-1/2",
};

const arrowPositionStyles: Record<TooltipPosition, string> = {
  top: "top-full left-1/2 -translate-x-1/2",
  bottom: "bottom-full left-1/2 -translate-x-1/2",
  left: "left-full top-1/2 -translate-y-1/2",
  right: "right-full top-1/2 -translate-y-1/2",
};

// ============================================================================
// Keyboard Shortcut Component
// ============================================================================

function KeyboardShortcut({ keys }: { keys: string | string[] }) {
  const keyArray = Array.isArray(keys) ? keys : [keys];

  return (
    <span className="ml-2 inline-flex items-center gap-0.5">
      {keyArray.map((key, index) => (
        <kbd
          key={index}
          className="inline-flex items-center justify-center rounded border border-gray-600 dark:border-gray-400 bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-300 dark:text-gray-700 min-w-[1.25rem]"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Tooltip 컴포넌트
 *
 * 호버 시 추가 정보를 표시하는 툴팁
 * 다크 모드, 다양한 크기와 스타일, 키보드 단축키 힌트를 지원합니다.
 *
 * @example
 * // 기본 사용
 * <Tooltip content="콘텐츠로 빠르게 플랜 생성">
 *   <button>빠른 생성</button>
 * </Tooltip>
 *
 * @example
 * // 키보드 단축키 힌트
 * <Tooltip content="새 플랜 생성" shortcut={["Cmd", "N"]}>
 *   <button>새 플랜</button>
 * </Tooltip>
 *
 * @example
 * // 스타일 변형
 * <Tooltip content="경고 메시지" variant="warning" size="lg">
 *   <span>!</span>
 * </Tooltip>
 */
function TooltipComponent({
  children,
  content,
  position = "top",
  delay = 200,
  hideDelay = 0,
  className,
  contentClassName,
  disabled = false,
  size = "md",
  variant = "dark",
  maxWidth = 280,
  showArrow = true,
  interactive = false,
  shortcut,
  offset = 8,
  trigger = "hover",
  alwaysShow = false,
  noAnimation = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(alwaysShow);
  const [actualPosition, setActualPosition] = useState(position);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 위치 계산 및 뷰포트 경계 체크
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !containerRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();

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

  const show = useCallback(() => {
    if (disabled || alwaysShow) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [disabled, delay, alwaysShow]);

  const hide = useCallback(() => {
    if (alwaysShow) return;
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, hideDelay);
    } else {
      setIsVisible(false);
    }
  }, [hideDelay, alwaysShow]);

  const handleMouseEnter = useCallback(() => {
    if (trigger === "hover" || trigger === "focus") {
      show();
    }
  }, [trigger, show]);

  const handleMouseLeave = useCallback(() => {
    if (trigger === "hover") {
      hide();
    }
  }, [trigger, hide]);

  const handleFocus = useCallback(() => {
    if (trigger === "focus" || trigger === "hover") {
      show();
    }
  }, [trigger, show]);

  const handleBlur = useCallback(() => {
    if (trigger === "focus") {
      hide();
    }
  }, [trigger, hide]);

  const handleClick = useCallback(() => {
    if (trigger === "click") {
      setIsVisible((prev) => !prev);
    }
  }, [trigger]);

  // Interactive 모드: 툴팁 위에 마우스 올려도 유지
  const handleTooltipMouseEnter = useCallback(() => {
    if (interactive && hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, [interactive]);

  const handleTooltipMouseLeave = useCallback(() => {
    if (interactive) {
      hide();
    }
  }, [interactive, hide]);

  // 클린업
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // 오프셋 스타일
  const offsetStyle: Record<TooltipPosition, string> = {
    top: `mb-${offset / 4}`,
    bottom: `mt-${offset / 4}`,
    left: `mr-${offset / 4}`,
    right: `ml-${offset / 4}`,
  };

  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleClick}
    >
      {children}
      {isVisible && content && (
        <div
          ref={tooltipRef}
          role="tooltip"
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          className={cn(
            "absolute z-70",
            !noAnimation && "animate-in fade-in-0 zoom-in-95 duration-150",
            positionStyles[actualPosition],
            offsetStyle[actualPosition],
            contentClassName
          )}
          style={{
            maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
          }}
        >
          <div
            className={cn(
              "relative rounded-lg shadow-lg",
              currentSize.padding,
              currentSize.text,
              currentVariant.bg,
              currentVariant.text
            )}
          >
            <span className="flex items-center">
              {content}
              {shortcut && <KeyboardShortcut keys={shortcut} />}
            </span>
            {showArrow && (
              <span
                className={cn(
                  "absolute",
                  currentSize.arrow,
                  arrowPositionStyles[actualPosition],
                  currentVariant.arrow[actualPosition]
                )}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const Tooltip = memo(TooltipComponent);

/**
 * 간단한 텍스트 툴팁용 래퍼
 *
 * @example
 * <SimpleTooltip text="도움말 텍스트">
 *   <button>버튼</button>
 * </SimpleTooltip>
 */
export function SimpleTooltip({
  children,
  text,
  position = "top",
  shortcut,
  variant = "dark",
}: {
  children: ReactNode;
  text: string;
  position?: TooltipPosition;
  shortcut?: string | string[];
  variant?: TooltipVariant;
}) {
  return (
    <Tooltip content={text} position={position} shortcut={shortcut} variant={variant}>
      {children}
    </Tooltip>
  );
}

/**
 * 아이콘 버튼용 툴팁 래퍼
 * 아이콘 버튼에 접근성 있는 툴팁을 추가합니다.
 *
 * @example
 * <IconTooltip label="설정" shortcut={["Cmd", ","]}>
 *   <button aria-label="설정"><SettingsIcon /></button>
 * </IconTooltip>
 */
export function IconTooltip({
  children,
  label,
  shortcut,
  position = "bottom",
}: {
  children: ReactNode;
  label: string;
  shortcut?: string | string[];
  position?: TooltipPosition;
}) {
  return (
    <Tooltip
      content={label}
      position={position}
      shortcut={shortcut}
      size="sm"
      delay={300}
    >
      {children}
    </Tooltip>
  );
}

/**
 * 정보 툴팁
 * 추가 정보나 도움말을 제공할 때 사용합니다.
 *
 * @example
 * <InfoTooltip content="이 필드는 필수입니다." />
 */
export function InfoTooltip({
  content,
  position = "top",
  size = "sm",
}: {
  content: ReactNode;
  position?: TooltipPosition;
  size?: TooltipSize;
}) {
  return (
    <Tooltip content={content} position={position} size={size} variant="info">
      <span className="inline-flex cursor-help items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 size-4">
        <svg
          className="size-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </span>
    </Tooltip>
  );
}
