"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEvent,
  memo,
} from "react";
import { cn } from "@/lib/cn";
import { useDensityOptional } from "@/lib/contexts";

// ============================================================================
// Types
// ============================================================================

export type SidePanelPosition = "left" | "right";
export type SidePanelSize = "sm" | "md" | "lg" | "xl" | "full";
export type SidePanelMode = "slide" | "push" | "overlay";

export interface SidePanelProps {
  children: ReactNode;
  /** 패널 제목 */
  title?: ReactNode;
  /** 부제목 */
  subtitle?: string;
  /** 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 패널 위치 */
  position?: SidePanelPosition;
  /** 패널 크기 */
  size?: SidePanelSize;
  /** 패널 모드 */
  mode?: SidePanelMode;
  /** 닫기 버튼 표시 */
  showCloseButton?: boolean;
  /** 오버레이 클릭으로 닫기 */
  closeOnOverlayClick?: boolean;
  /** ESC 키로 닫기 */
  closeOnEscape?: boolean;
  /** 헤더 액션 */
  headerAction?: ReactNode;
  /** 푸터 */
  footer?: ReactNode;
  /** 컨테이너 클래스 */
  className?: string;
  /** 헤더 클래스 */
  headerClassName?: string;
  /** 바디 클래스 */
  bodyClassName?: string;
  /** 푸터 클래스 */
  footerClassName?: string;
  /** 오버레이 클래스 */
  overlayClassName?: string;
  /** 패딩 없음 */
  noPadding?: boolean;
  /** z-index 레벨 */
  zIndex?: number;
  /** 포커스 트랩 */
  trapFocus?: boolean;
}

export interface SidePanelSectionProps {
  children: ReactNode;
  title?: string;
  className?: string;
  noPadding?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const sizeClasses: Record<SidePanelSize, string> = {
  sm: "w-80", // 320px
  md: "w-96", // 384px
  lg: "w-[480px]",
  xl: "w-[640px]",
  full: "w-full",
};

const sizeMaxWidths: Record<SidePanelSize, string> = {
  sm: "max-w-[calc(100vw-2rem)]",
  md: "max-w-[calc(100vw-2rem)]",
  lg: "max-w-[calc(100vw-2rem)]",
  xl: "max-w-[calc(100vw-2rem)]",
  full: "max-w-full",
};

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 사이드 패널 내 섹션
 */
export const SidePanelSection = memo(function SidePanelSection({
  children,
  title,
  className,
  noPadding = false,
  collapsible = false,
  defaultCollapsed = false,
}: SidePanelSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { getDensityClasses } = useDensityOptional();

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div
      className={cn(
        "border-b border-gray-200 dark:border-gray-800 last:border-b-0",
        className
      )}
    >
      {title && (
        <div
          className={cn(
            "flex items-center justify-between",
            getDensityClasses("padding"),
            "py-3",
            collapsible && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
          )}
          onClick={toggleCollapse}
          role={collapsible ? "button" : undefined}
          tabIndex={collapsible ? 0 : undefined}
          onKeyDown={
            collapsible
              ? (e: KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCollapse();
                  }
                }
              : undefined
          }
          aria-expanded={collapsible ? !isCollapsed : undefined}
        >
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h4>
          {collapsible && (
            <svg
              className={cn(
                "size-4 text-gray-500 transition-transform duration-200",
                isCollapsed && "-rotate-90"
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      )}
      {!isCollapsed && (
        <div className={cn(!noPadding && getDensityClasses("padding"), !title && "pt-0")}>
          {children}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * SidePanel 컴포넌트
 *
 * 화면 측면에서 슬라이드되는 패널 컴포넌트입니다.
 * 상세 정보, 필터, 설정 등을 표시하는 데 사용됩니다.
 *
 * @example
 * // 기본 사용
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <SidePanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="학생 상세 정보"
 * >
 *   <StudentDetails id={selectedId} />
 * </SidePanel>
 *
 * @example
 * // 왼쪽 필터 패널
 * <SidePanel
 *   isOpen={showFilters}
 *   onClose={() => setShowFilters(false)}
 *   position="left"
 *   size="sm"
 *   title="필터"
 *   footer={<Button onClick={applyFilters}>적용</Button>}
 * >
 *   <FilterForm />
 * </SidePanel>
 */
function SidePanelComponent({
  children,
  title,
  subtitle,
  isOpen,
  onClose,
  position = "right",
  size = "md",
  mode = "overlay",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  headerAction,
  footer,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  overlayClassName,
  noPadding = false,
  zIndex = 50,
  trapFocus = true,
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { getDensityClasses } = useDensityOptional();

  // ESC 키 처리
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // 포커스 트랩
  useEffect(() => {
    if (!isOpen || !trapFocus || !panelRef.current) return;

    const panel = panelRef.current;
    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // 패널이 열리면 첫 번째 요소로 포커스
    firstElement?.focus();

    const handleTabKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    panel.addEventListener("keydown", handleTabKey);
    return () => panel.removeEventListener("keydown", handleTabKey);
  }, [isOpen, trapFocus]);

  // 오버레이 클릭 핸들러
  const handleOverlayClick = useCallback(() => {
    if (closeOnOverlayClick) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  // 패널 클릭 전파 방지
  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) return null;

  const isLeft = position === "left";

  return (
    <div
      className={cn("fixed inset-0", `z-${zIndex}`)}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "side-panel-title" : undefined}
    >
      {/* Overlay */}
      {mode !== "push" && (
        <div
          className={cn(
            "absolute inset-0 bg-black/50 dark:bg-black/70",
            "transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0",
            overlayClassName
          )}
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "absolute top-0 bottom-0 flex flex-col",
          "bg-white dark:bg-gray-900",
          "shadow-2xl",
          "transition-transform duration-300 ease-out",
          sizeClasses[size],
          sizeMaxWidths[size],
          isLeft ? "left-0 border-r" : "right-0 border-l",
          "border-gray-200 dark:border-gray-800",
          isOpen
            ? "translate-x-0"
            : isLeft
              ? "-translate-x-full"
              : "translate-x-full",
          className
        )}
        onClick={handlePanelClick}
      >
        {/* Header */}
        {(title || showCloseButton || headerAction) && (
          <div
            className={cn(
              "flex items-center justify-between flex-shrink-0",
              "border-b border-gray-200 dark:border-gray-800",
              getDensityClasses("padding"),
              headerClassName
            )}
          >
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id="side-panel-title"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate"
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {headerAction}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "p-2 rounded-lg",
                    "text-gray-500 dark:text-gray-400",
                    "hover:text-gray-700 dark:hover:text-gray-200",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                    "transition-colors"
                  )}
                  aria-label="닫기"
                >
                  <svg
                    className="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div
          className={cn(
            "flex-1 overflow-y-auto",
            !noPadding && getDensityClasses("padding"),
            bodyClassName
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={cn(
              "flex-shrink-0",
              "border-t border-gray-200 dark:border-gray-800",
              getDensityClasses("padding"),
              footerClassName
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const SidePanel = memo(SidePanelComponent);

// ============================================================================
// Hook
// ============================================================================

/**
 * 사이드 패널 상태 관리 훅
 *
 * @example
 * const panel = useSidePanel();
 *
 * <button onClick={() => panel.open("detail")}>상세 보기</button>
 *
 * <SidePanel
 *   isOpen={panel.isOpen && panel.type === "detail"}
 *   onClose={panel.close}
 * >
 *   ...
 * </SidePanel>
 */
export function useSidePanel<T extends string = string>() {
  const [state, setState] = useState<{
    isOpen: boolean;
    type: T | null;
    data?: unknown;
  }>({
    isOpen: false,
    type: null,
    data: undefined,
  });

  const open = useCallback((type: T, data?: unknown) => {
    setState({ isOpen: true, type, data });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggle = useCallback((type: T, data?: unknown) => {
    setState((prev) => {
      if (prev.isOpen && prev.type === type) {
        return { ...prev, isOpen: false };
      }
      return { isOpen: true, type, data };
    });
  }, []);

  return {
    isOpen: state.isOpen,
    type: state.type,
    data: state.data,
    open,
    close,
    toggle,
  };
}

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * 필터 사이드 패널 프리셋
 */
export function FilterSidePanel({
  isOpen,
  onClose,
  onApply,
  onReset,
  children,
  title = "필터",
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply?: () => void;
  onReset?: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      position="left"
      size="sm"
      title={title}
      footer={
        <div className="flex gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "text-gray-700 dark:text-gray-300",
                "border border-gray-300 dark:border-gray-600",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                "transition-colors"
              )}
            >
              초기화
            </button>
          )}
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "text-white bg-indigo-600",
                "hover:bg-indigo-700",
                "transition-colors"
              )}
            >
              적용
            </button>
          )}
        </div>
      }
    >
      {children}
    </SidePanel>
  );
}

/**
 * 상세 정보 사이드 패널 프리셋
 */
export function DetailSidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = "lg",
  headerAction,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  size?: SidePanelSize;
  headerAction?: ReactNode;
}) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      size={size}
      title={title}
      subtitle={subtitle}
      headerAction={headerAction}
    >
      {children}
    </SidePanel>
  );
}

export default SidePanel;
