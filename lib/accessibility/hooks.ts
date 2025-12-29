"use client";

/**
 * Accessibility React Hooks
 *
 * 접근성 관련 React 훅들을 제공합니다.
 *
 * @module accessibility/hooks
 */

import { useEffect, useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  trapFocus,
  focusFirst,
  announce,
} from "./index";

// ============================================================================
// useFocusTrap
// ============================================================================

/**
 * 포커스 트랩 훅 - 모달, 다이얼로그에서 포커스를 가둡니다.
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose, children }) {
 *   const { containerRef } = useFocusTrap(isOpen);
 *
 *   if (!isOpen) return null;
 *
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       {children}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // 현재 포커스된 요소 저장
    previousFocusRef.current = document.activeElement as HTMLElement;

    // 첫 번째 요소로 포커스 이동
    focusFirst(containerRef.current);

    // 포커스 트랩 설정
    const cleanup = trapFocus(containerRef.current);

    return () => {
      cleanup();
      // 이전 포커스 복원
      previousFocusRef.current?.focus();
    };
  }, [active]);

  return { containerRef };
}

// ============================================================================
// useAnnounce
// ============================================================================

/**
 * 스크린 리더 알림 훅
 *
 * @example
 * ```tsx
 * function SaveButton() {
 *   const { announce } = useAnnounce();
 *
 *   const handleSave = async () => {
 *     await saveData();
 *     announce("저장되었습니다");
 *   };
 *
 *   return <button onClick={handleSave}>저장</button>;
 * }
 * ```
 */
export function useAnnounce() {
  const announcePolite = useCallback((message: string) => {
    announce(message, "polite");
  }, []);

  const announceAssertive = useCallback((message: string) => {
    announce(message, "assertive");
  }, []);

  return {
    announce: announcePolite,
    announcePolite,
    announceAssertive,
  };
}

// ============================================================================
// useReducedMotion
// ============================================================================

// useSyncExternalStore를 위한 헬퍼 함수들
const getReducedMotionSnapshot = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const getServerReducedMotionSnapshot = () => false;

const subscribeToReducedMotion = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
};

/**
 * 모션 감소 선호 설정을 감지하는 훅
 *
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const prefersReduced = useReducedMotion();
 *
 *   return (
 *     <motion.div
 *       animate={{ x: 100 }}
 *       transition={{ duration: prefersReduced ? 0 : 0.3 }}
 *     />
 *   );
 * }
 * ```
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot
  );
}

// ============================================================================
// useArrowNavigation
// ============================================================================

/**
 * 화살표 키 탐색 훅 - 목록, 메뉴, 탭 등에서 사용
 *
 * @example
 * ```tsx
 * function Menu({ items }) {
 *   const { currentIndex, handleKeyDown, setCurrentIndex } = useArrowNavigation(items.length);
 *
 *   return (
 *     <ul role="menu" onKeyDown={handleKeyDown}>
 *       {items.map((item, index) => (
 *         <li
 *           key={index}
 *           role="menuitem"
 *           tabIndex={index === currentIndex ? 0 : -1}
 *           onClick={() => setCurrentIndex(index)}
 *         >
 *           {item}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useArrowNavigation(
  itemCount: number,
  options: {
    orientation?: "horizontal" | "vertical" | "both";
    loop?: boolean;
    initialIndex?: number;
  } = {}
) {
  const { orientation = "vertical", loop = true, initialIndex = 0 } = options;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isVertical = orientation === "vertical" || orientation === "both";
      const isHorizontal = orientation === "horizontal" || orientation === "both";

      let nextIndex = currentIndex;

      switch (e.key) {
        case "ArrowUp":
          if (isVertical) {
            e.preventDefault();
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
              nextIndex = loop ? itemCount - 1 : 0;
            }
          }
          break;
        case "ArrowDown":
          if (isVertical) {
            e.preventDefault();
            nextIndex = currentIndex + 1;
            if (nextIndex >= itemCount) {
              nextIndex = loop ? 0 : itemCount - 1;
            }
          }
          break;
        case "ArrowLeft":
          if (isHorizontal) {
            e.preventDefault();
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
              nextIndex = loop ? itemCount - 1 : 0;
            }
          }
          break;
        case "ArrowRight":
          if (isHorizontal) {
            e.preventDefault();
            nextIndex = currentIndex + 1;
            if (nextIndex >= itemCount) {
              nextIndex = loop ? 0 : itemCount - 1;
            }
          }
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = itemCount - 1;
          break;
        default:
          return;
      }

      setCurrentIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
    },
    [currentIndex, itemCount, loop, orientation]
  );

  const setItemRef = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    };
  }, []);

  return {
    currentIndex,
    setCurrentIndex,
    handleKeyDown,
    setItemRef,
    getTabIndex: (index: number) => (index === currentIndex ? 0 : -1),
  };
}

// ============================================================================
// useEscapeKey
// ============================================================================

/**
 * Escape 키 핸들러 훅 - 모달, 드롭다운 닫기에 사용
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   useEscapeKey(onClose, isOpen);
 *
 *   if (!isOpen) return null;
 *   return <div>Modal Content</div>;
 * }
 * ```
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onEscape, enabled]);
}

// ============================================================================
// useClickOutside
// ============================================================================

/**
 * 외부 클릭 감지 훅 - 드롭다운, 모달 닫기에 사용
 *
 * @example
 * ```tsx
 * function Dropdown({ isOpen, onClose, children }) {
 *   const ref = useClickOutside<HTMLDivElement>(onClose, isOpen);
 *
 *   if (!isOpen) return null;
 *   return <div ref={ref}>{children}</div>;
 * }
 * ```
 */
export function useClickOutside<T extends HTMLElement>(
  onClickOutside: () => void,
  enabled = true
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };

    // mousedown을 사용하여 포커스 이동 전에 처리
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClickOutside, enabled]);

  return ref;
}
