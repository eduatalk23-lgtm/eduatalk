/**
 * Accessibility Utilities
 *
 * 접근성(A11y) 관련 유틸리티 함수들을 제공합니다.
 * WCAG 2.1 AA 기준을 준수하기 위한 도구들입니다.
 *
 * @module accessibility
 */

// ============================================================================
// ARIA Live Region Announcements
// ============================================================================

/**
 * 스크린 리더에 동적 알림을 전달합니다.
 * polite: 현재 읽고 있는 내용이 끝난 후 알림
 * assertive: 즉시 알림 (긴급한 경우에만 사용)
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite") {
  if (typeof window === "undefined") return;

  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", priority);
  el.setAttribute("aria-atomic", "true");
  el.className = "sr-only";
  el.textContent = message;

  document.body.appendChild(el);

  // 스크린 리더가 읽을 수 있도록 잠시 대기 후 제거
  setTimeout(() => {
    document.body.removeChild(el);
  }, 1000);
}

// ============================================================================
// Focus Management
// ============================================================================

/**
 * 첫 번째 포커스 가능한 요소로 포커스를 이동합니다.
 */
export function focusFirst(container: HTMLElement | null) {
  if (!container) return;

  const focusableSelectors = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  const firstFocusable = container.querySelector<HTMLElement>(focusableSelectors);
  firstFocusable?.focus();
}

/**
 * 마지막 포커스 가능한 요소로 포커스를 이동합니다.
 */
export function focusLast(container: HTMLElement | null) {
  if (!container) return;

  const focusableSelectors = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  const focusables = container.querySelectorAll<HTMLElement>(focusableSelectors);
  const lastFocusable = focusables[focusables.length - 1];
  lastFocusable?.focus();
}

/**
 * 포커스 트랩을 생성합니다 (모달, 다이얼로그용).
 * 반환된 cleanup 함수를 컴포넌트 언마운트 시 호출하세요.
 */
export function trapFocus(container: HTMLElement | null) {
  if (!container) return () => {};

  const focusableSelectors = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const focusables = container.querySelectorAll<HTMLElement>(focusableSelectors);
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener("keydown", handleKeyDown);
  return () => container.removeEventListener("keydown", handleKeyDown);
}

// ============================================================================
// ARIA Helpers
// ============================================================================

/**
 * 차트에 사용할 접근성 속성을 생성합니다.
 */
export function getChartA11yProps(options: {
  title: string;
  description: string;
  dataPointsDescription?: string;
}) {
  return {
    role: "img" as const,
    "aria-label": `${options.title}. ${options.description}`,
    "aria-describedby": options.dataPointsDescription ? "chart-description" : undefined,
  };
}

/**
 * 테이블에 사용할 접근성 속성을 생성합니다.
 */
export function getTableA11yProps(options: {
  caption: string;
  rowCount: number;
  columnCount: number;
}) {
  return {
    role: "table" as const,
    "aria-label": options.caption,
    "aria-rowcount": options.rowCount,
    "aria-colcount": options.columnCount,
  };
}

/**
 * 폼 필드에 사용할 접근성 속성을 생성합니다.
 */
export function getFormFieldA11yProps(options: {
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
}) {
  const describedByIds: string[] = [];
  if (options.description) describedByIds.push("description");
  if (options.error) describedByIds.push("error");

  return {
    "aria-label": options.label,
    "aria-required": options.required ?? false,
    "aria-invalid": !!options.error,
    "aria-describedby": describedByIds.length > 0 ? describedByIds.join(" ") : undefined,
  };
}

// ============================================================================
// Keyboard Navigation Helpers
// ============================================================================

/**
 * 화살표 키로 목록 탐색을 처리합니다.
 */
export function handleArrowNavigation(
  e: React.KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  options: {
    orientation?: "horizontal" | "vertical" | "both";
    loop?: boolean;
    onSelect?: (index: number) => void;
  } = {}
) {
  const { orientation = "vertical", loop = true, onSelect } = options;

  let nextIndex = currentIndex;
  const isVertical = orientation === "vertical" || orientation === "both";
  const isHorizontal = orientation === "horizontal" || orientation === "both";

  switch (e.key) {
    case "ArrowUp":
      if (isVertical) {
        e.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? items.length - 1 : 0;
        }
      }
      break;
    case "ArrowDown":
      if (isVertical) {
        e.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = loop ? 0 : items.length - 1;
        }
      }
      break;
    case "ArrowLeft":
      if (isHorizontal) {
        e.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? items.length - 1 : 0;
        }
      }
      break;
    case "ArrowRight":
      if (isHorizontal) {
        e.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = loop ? 0 : items.length - 1;
        }
      }
      break;
    case "Home":
      e.preventDefault();
      nextIndex = 0;
      break;
    case "End":
      e.preventDefault();
      nextIndex = items.length - 1;
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      onSelect?.(currentIndex);
      return;
    default:
      return;
  }

  items[nextIndex]?.focus();
}

// ============================================================================
// Reduced Motion
// ============================================================================

/**
 * 사용자가 모션 감소를 선호하는지 확인합니다.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ============================================================================
// Screen Reader Utilities
// ============================================================================

/**
 * 스크린 리더 전용 텍스트를 위한 클래스명
 */
export const srOnlyClass = "sr-only";

/**
 * 스크린 리더 전용 텍스트 컴포넌트에 사용할 속성
 */
export const srOnlyProps = {
  className: srOnlyClass,
  "aria-hidden": false as const,
};

// ============================================================================
// Skip Link
// ============================================================================

/**
 * 스킵 링크를 위한 ID 상수
 */
export const SKIP_LINK_TARGETS = {
  mainContent: "main-content",
  navigation: "main-navigation",
  search: "main-search",
} as const;
