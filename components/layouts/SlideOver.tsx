"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  memo,
} from "react";
import { cn } from "@/lib/cn";
import { useDensityOptional } from "@/lib/contexts";

// ============================================================================
// Types
// ============================================================================

export type SlideOverSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface SlideOverConfig {
  id: string;
  title?: ReactNode;
  subtitle?: string;
  content: ReactNode;
  size?: SlideOverSize;
  showCloseButton?: boolean;
  headerAction?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  preventClose?: boolean;
}

interface SlideOverContextValue {
  /** 현재 열린 슬라이드오버 스택 */
  stack: SlideOverConfig[];
  /** 슬라이드오버 열기 */
  push: (config: SlideOverConfig) => void;
  /** 가장 위 슬라이드오버 닫기 */
  pop: () => void;
  /** 특정 ID의 슬라이드오버 닫기 */
  close: (id: string) => void;
  /** 모든 슬라이드오버 닫기 */
  closeAll: () => void;
  /** 특정 ID의 슬라이드오버가 열려 있는지 */
  isOpen: (id: string) => boolean;
}

export interface SlideOverProviderProps {
  children: ReactNode;
}

export interface SlideOverPanelProps extends Omit<SlideOverConfig, "content"> {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  /** 스택에서의 깊이 (0이 가장 위) */
  depth?: number;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  noPadding?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const sizeClasses: Record<SlideOverSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-full",
};

const depthOffsets = [0, -16, -32, -48]; // px offset for stacked panels

// ============================================================================
// Context
// ============================================================================

const SlideOverContext = createContext<SlideOverContextValue | null>(null);

/**
 * SlideOver 컨텍스트 훅
 */
export function useSlideOver(): SlideOverContextValue {
  const context = useContext(SlideOverContext);
  if (!context) {
    throw new Error("useSlideOver must be used within a SlideOverProvider");
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

/**
 * SlideOver 프로바이더
 *
 * 스택 가능한 슬라이드오버 패널 시스템을 제공합니다.
 *
 * @example
 * // 앱 루트에서 사용
 * <SlideOverProvider>
 *   <App />
 * </SlideOverProvider>
 *
 * // 컴포넌트에서 사용
 * function MyComponent() {
 *   const { push, pop } = useSlideOver();
 *
 *   const openDetail = () => {
 *     push({
 *       id: "student-detail",
 *       title: "학생 상세",
 *       content: <StudentDetail id="123" />,
 *     });
 *   };
 *
 *   return <button onClick={openDetail}>상세 보기</button>;
 * }
 */
export function SlideOverProvider({ children }: SlideOverProviderProps) {
  const [stack, setStack] = useState<SlideOverConfig[]>([]);

  const push = useCallback((config: SlideOverConfig) => {
    setStack((prev) => {
      // 같은 ID가 이미 있으면 업데이트
      const existingIndex = prev.findIndex((item) => item.id === config.id);
      if (existingIndex !== -1) {
        const newStack = [...prev];
        newStack[existingIndex] = config;
        return newStack;
      }
      return [...prev, config];
    });
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const lastItem = prev[prev.length - 1];
      if (lastItem.preventClose) return prev;
      lastItem.onClose?.();
      return prev.slice(0, -1);
    });
  }, []);

  const close = useCallback((id: string) => {
    setStack((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.preventClose) return prev;
      item?.onClose?.();
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const closeAll = useCallback(() => {
    setStack((prev) => {
      prev.forEach((item) => item.onClose?.());
      return prev.filter((item) => item.preventClose);
    });
  }, []);

  const isOpen = useCallback(
    (id: string) => {
      return stack.some((item) => item.id === id);
    },
    [stack]
  );

  // ESC 키로 최상위 패널 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack.length > 0) {
        pop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stack.length, pop]);

  // 스크롤 잠금
  useEffect(() => {
    if (stack.length > 0) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [stack.length]);

  return (
    <SlideOverContext.Provider value={{ stack, push, pop, close, closeAll, isOpen }}>
      {children}
      <SlideOverContainer />
    </SlideOverContext.Provider>
  );
}

// ============================================================================
// Container
// ============================================================================

/**
 * 슬라이드오버 컨테이너 (내부 컴포넌트)
 */
function SlideOverContainer() {
  const { stack, close } = useSlideOver();

  if (stack.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={() => close(stack[stack.length - 1].id)}
        aria-hidden="true"
      />

      {/* Stacked Panels */}
      {stack.map((config, index) => (
        <SlideOverPanelInternal
          key={config.id}
          config={config}
          depth={stack.length - 1 - index}
          onClose={() => close(config.id)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Internal Panel
// ============================================================================

function SlideOverPanelInternal({
  config,
  depth,
  onClose,
}: {
  config: SlideOverConfig;
  depth: number;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { getDensityClasses } = useDensityOptional();

  // 포커스 관리
  useEffect(() => {
    if (depth === 0 && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [depth]);

  const offset = depthOffsets[Math.min(depth, depthOffsets.length - 1)];
  const scale = 1 - depth * 0.02;
  const opacity = depth === 0 ? 1 : 0.95;

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute top-0 right-0 bottom-0",
        "w-full",
        sizeClasses[config.size ?? "lg"],
        "bg-white dark:bg-gray-900",
        "shadow-2xl",
        "flex flex-col",
        "transition-all duration-300 ease-out",
        "translate-x-0"
      )}
      style={{
        transform: `translateX(${offset}px) scale(${scale})`,
        opacity,
        zIndex: 50 - depth,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={config.title ? `slideover-title-${config.id}` : undefined}
    >
      {/* Header */}
      {(config.title || config.showCloseButton !== false || config.headerAction) && (
        <div
          className={cn(
            "flex items-center justify-between flex-shrink-0",
            "border-b border-gray-200 dark:border-gray-800",
            getDensityClasses("padding")
          )}
        >
          <div className="flex-1 min-w-0">
            {config.title && (
              <h2
                id={`slideover-title-${config.id}`}
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate"
              >
                {config.title}
              </h2>
            )}
            {config.subtitle && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{config.subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {config.headerAction}
            {config.showCloseButton !== false && (
              <button
                type="button"
                onClick={onClose}
                disabled={config.preventClose}
                className={cn(
                  "p-2 rounded-lg",
                  "text-gray-500 dark:text-gray-400",
                  "hover:text-gray-700 dark:hover:text-gray-200",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  "transition-colors",
                  config.preventClose && "opacity-50 cursor-not-allowed"
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
      <div className={cn("flex-1 overflow-y-auto", getDensityClasses("padding"))}>
        {config.content}
      </div>

      {/* Footer */}
      {config.footer && (
        <div
          className={cn(
            "flex-shrink-0",
            "border-t border-gray-200 dark:border-gray-800",
            getDensityClasses("padding")
          )}
        >
          {config.footer}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Standalone Panel Component
// ============================================================================

/**
 * 독립형 SlideOver 패널
 *
 * Provider 없이 직접 사용할 수 있는 슬라이드오버 패널입니다.
 *
 * @example
 * <SlideOverPanel
 *   isOpen={isDetailOpen}
 *   onClose={() => setIsDetailOpen(false)}
 *   title="학생 상세 정보"
 *   size="lg"
 * >
 *   <StudentDetail id={selectedId} />
 * </SlideOverPanel>
 */
function SlideOverPanelComponent({
  children,
  isOpen,
  onClose,
  id,
  title,
  subtitle,
  size = "lg",
  showCloseButton = true,
  headerAction,
  footer,
  depth = 0,
  className,
  bodyClassName,
  headerClassName,
  footerClassName,
  noPadding = false,
  preventClose = false,
}: SlideOverPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { getDensityClasses } = useDensityOptional();

  // ESC 키 처리
  useEffect(() => {
    if (!isOpen || preventClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, preventClose]);

  // 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const offset = depthOffsets[Math.min(depth, depthOffsets.length - 1)];
  const scale = 1 - depth * 0.02;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={preventClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "absolute top-0 right-0 bottom-0",
          "w-full",
          sizeClasses[size],
          "bg-white dark:bg-gray-900",
          "shadow-2xl",
          "flex flex-col",
          "transition-all duration-300 ease-out",
          className
        )}
        style={{
          transform: `translateX(${offset}px) scale(${scale})`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `slideover-title-${id}` : undefined}
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
                  id={`slideover-title-${id}`}
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
                  disabled={preventClose}
                  className={cn(
                    "p-2 rounded-lg",
                    "text-gray-500 dark:text-gray-400",
                    "hover:text-gray-700 dark:hover:text-gray-200",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                    "transition-colors",
                    preventClose && "opacity-50 cursor-not-allowed"
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

export const SlideOverPanel = memo(SlideOverPanelComponent);

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * 간편한 슬라이드오버 관리 훅
 *
 * @example
 * const [detailPanel, openDetail, closeDetail] = useSlideOverState<StudentData>();
 *
 * // 열기
 * openDetail({ id: "student-1", name: "김민수" });
 *
 * // 렌더링
 * <SlideOverPanel isOpen={detailPanel.isOpen} onClose={closeDetail}>
 *   {detailPanel.data && <StudentDetail student={detailPanel.data} />}
 * </SlideOverPanel>
 */
export function useSlideOverState<T = unknown>() {
  const [state, setState] = useState<{ isOpen: boolean; data: T | null }>({
    isOpen: false,
    data: null,
  });

  const open = useCallback((data: T) => {
    setState({ isOpen: true, data });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return [state, open, close] as const;
}

export default SlideOverPanel;
