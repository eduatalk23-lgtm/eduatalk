"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export type ModifierKey = "ctrl" | "alt" | "shift" | "meta";

export interface KeyboardShortcut {
  /** 단축키 조합 (예: "ctrl+s", "meta+k", "g then d") */
  key: string;
  /** 실행 함수 */
  handler: (event: KeyboardEvent) => void;
  /** 설명 */
  description?: string;
  /** 활성화 여부 */
  enabled?: boolean;
  /** 입력 필드에서도 작동 */
  enableInInput?: boolean;
  /** 기본 동작 방지 */
  preventDefault?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  /** 단축키 목록 */
  shortcuts: KeyboardShortcut[];
  /** 전역 활성화 여부 */
  enabled?: boolean;
  /** 스코프 (특정 요소 내에서만 작동) */
  scope?: React.RefObject<HTMLElement>;
}

// ============================================================================
// Constants
// ============================================================================

const INPUT_TAGS = ["INPUT", "TEXTAREA", "SELECT"];
const CONTENT_EDITABLE_ATTR = "contenteditable";

// 시퀀스 키 타임아웃 (ms)
const SEQUENCE_TIMEOUT = 1000;

// ============================================================================
// Utilities
// ============================================================================

/**
 * 키 문자열 파싱
 * 예: "ctrl+shift+s" => { key: "s", ctrl: true, shift: true }
 */
function parseKeyString(keyString: string): {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
} {
  const parts = keyString.toLowerCase().split("+").map((p) => p.trim());
  const result = {
    key: "",
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };

  parts.forEach((part) => {
    switch (part) {
      case "ctrl":
      case "control":
        result.ctrl = true;
        break;
      case "alt":
      case "option":
        result.alt = true;
        break;
      case "shift":
        result.shift = true;
        break;
      case "meta":
      case "cmd":
      case "command":
      case "win":
      case "windows":
        result.meta = true;
        break;
      default:
        result.key = part;
    }
  });

  return result;
}

/**
 * 시퀀스 키 파싱
 * 예: "g then d" => ["g", "d"]
 */
function parseSequence(keyString: string): string[] {
  if (keyString.includes(" then ")) {
    return keyString.split(" then ").map((s) => s.trim());
  }
  return [keyString];
}

/**
 * 키보드 이벤트가 단축키와 일치하는지 확인
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ReturnType<typeof parseKeyString>
): boolean {
  const eventKey = event.key.toLowerCase();
  const eventCode = event.code.toLowerCase();

  // 특수 키 매핑
  const keyMap: Record<string, string[]> = {
    escape: ["escape", "esc"],
    enter: ["enter", "return"],
    space: [" ", "space"],
    arrowup: ["arrowup", "up"],
    arrowdown: ["arrowdown", "down"],
    arrowleft: ["arrowleft", "left"],
    arrowright: ["arrowright", "right"],
    backspace: ["backspace", "delete"],
  };

  const matchKey = (target: string): boolean => {
    const lowerTarget = target.toLowerCase();
    if (keyMap[lowerTarget]) {
      return keyMap[lowerTarget].includes(eventKey);
    }
    return eventKey === lowerTarget || eventCode === `key${lowerTarget}`;
  };

  return (
    matchKey(shortcut.key) &&
    event.ctrlKey === shortcut.ctrl &&
    event.altKey === shortcut.alt &&
    event.shiftKey === shortcut.shift &&
    event.metaKey === shortcut.meta
  );
}

/**
 * 입력 요소 내에서 이벤트가 발생했는지 확인
 */
function isInputElement(element: EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;

  if (INPUT_TAGS.includes(element.tagName)) return true;
  if (element.getAttribute(CONTENT_EDITABLE_ATTR) === "true") return true;

  return false;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 키보드 단축키 훅
 *
 * @example
 * // 단일 단축키
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     { key: "ctrl+s", handler: handleSave, description: "저장" },
 *     { key: "escape", handler: handleClose, description: "닫기" },
 *   ]
 * });
 *
 * @example
 * // 시퀀스 단축키 (vim 스타일)
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     { key: "g then d", handler: () => router.push("/dashboard"), description: "대시보드로 이동" },
 *     { key: "g then t", handler: () => router.push("/today"), description: "Today로 이동" },
 *   ]
 * });
 *
 * @example
 * // 스코프 제한
 * const containerRef = useRef<HTMLDivElement>(null);
 * useKeyboardShortcuts({
 *   shortcuts: [...],
 *   scope: containerRef,
 * });
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  scope,
}: UseKeyboardShortcutsOptions): void {
  const sequenceBufferRef = useRef<string[]>([]);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 시퀀스 버퍼 초기화
  const resetSequence = useCallback(() => {
    sequenceBufferRef.current = [];
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
    }
  }, []);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // 스코프 확인
      if (scope?.current && !scope.current.contains(event.target as Node)) {
        return;
      }

      // 입력 필드 확인
      const inInput = isInputElement(event.target);

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;
        if (inInput && !shortcut.enableInInput) continue;

        const sequence = parseSequence(shortcut.key);

        if (sequence.length === 1) {
          // 단일 키 단축키
          const parsed = parseKeyString(sequence[0]);
          if (matchesShortcut(event, parsed)) {
            if (shortcut.preventDefault !== false) {
              event.preventDefault();
            }
            shortcut.handler(event);
            resetSequence();
            return;
          }
        } else {
          // 시퀀스 단축키
          const currentKey = event.key.toLowerCase();
          const expectedIndex = sequenceBufferRef.current.length;

          if (expectedIndex < sequence.length) {
            const expectedParsed = parseKeyString(sequence[expectedIndex]);

            if (
              expectedParsed.key === currentKey &&
              !expectedParsed.ctrl &&
              !expectedParsed.alt &&
              !expectedParsed.shift &&
              !expectedParsed.meta
            ) {
              sequenceBufferRef.current.push(currentKey);

              // 시퀀스 완료 확인
              if (sequenceBufferRef.current.length === sequence.length) {
                if (shortcut.preventDefault !== false) {
                  event.preventDefault();
                }
                shortcut.handler(event);
                resetSequence();
                return;
              }

              // 타임아웃 설정
              if (sequenceTimeoutRef.current) {
                clearTimeout(sequenceTimeoutRef.current);
              }
              sequenceTimeoutRef.current = setTimeout(resetSequence, SEQUENCE_TIMEOUT);
              return;
            }
          }
        }
      }

      // 일치하는 단축키가 없으면 시퀀스 초기화
      if (sequenceBufferRef.current.length > 0) {
        resetSequence();
      }
    },
    [enabled, shortcuts, scope, resetSequence]
  );

  // 이벤트 리스너 등록
  useEffect(() => {
    const target = scope?.current ?? window;
    target.addEventListener("keydown", handleKeyDown as EventListener);

    return () => {
      target.removeEventListener("keydown", handleKeyDown as EventListener);
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, [handleKeyDown, scope]);
}

// ============================================================================
// Shortcut Registration Hook
// ============================================================================

/**
 * 단축키 등록 훅 (컴포넌트 생명주기에 맞춤)
 *
 * @example
 * // 컴포넌트 마운트 시 단축키 등록, 언마운트 시 해제
 * useShortcut("ctrl+s", handleSave, { description: "저장" });
 */
export function useShortcut(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options?: Omit<KeyboardShortcut, "key" | "handler">
): void {
  const shortcut = useMemo(
    () => ({
      key,
      handler,
      ...options,
    }),
    [key, handler, options]
  );

  useKeyboardShortcuts({
    shortcuts: [shortcut],
    enabled: options?.enabled ?? true,
  });
}

// ============================================================================
// Navigation Shortcuts Hook
// ============================================================================

/**
 * 네비게이션 단축키 훅
 *
 * @example
 * useNavigationShortcuts({
 *   "g then d": "/dashboard",
 *   "g then t": "/today",
 *   "g then p": "/plan",
 * });
 */
export function useNavigationShortcuts(
  routes: Record<string, string>,
  options?: { enabled?: boolean }
): void {
  const shortcuts = useMemo(() => {
    // router를 동적으로 가져오기 위해 next/navigation 대신 window.location 사용
    return Object.entries(routes).map(([key, path]) => ({
      key,
      handler: () => {
        window.location.href = path;
      },
      description: `${path}로 이동`,
      enabled: options?.enabled ?? true,
    }));
  }, [routes, options?.enabled]);

  useKeyboardShortcuts({ shortcuts });
}

// ============================================================================
// Shortcut Display Utilities
// ============================================================================

/**
 * 단축키를 사용자 친화적인 문자열로 변환
 */
export function formatShortcut(key: string): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return key
    .split(" then ")
    .map((part) =>
      part
        .split("+")
        .map((k) => {
          const lower = k.toLowerCase().trim();
          switch (lower) {
            case "ctrl":
            case "control":
              return isMac ? "⌃" : "Ctrl";
            case "alt":
            case "option":
              return isMac ? "⌥" : "Alt";
            case "shift":
              return isMac ? "⇧" : "Shift";
            case "meta":
            case "cmd":
            case "command":
              return isMac ? "⌘" : "Win";
            case "enter":
            case "return":
              return "↵";
            case "escape":
            case "esc":
              return "Esc";
            case "space":
              return "Space";
            case "arrowup":
            case "up":
              return "↑";
            case "arrowdown":
            case "down":
              return "↓";
            case "arrowleft":
            case "left":
              return "←";
            case "arrowright":
            case "right":
              return "→";
            case "backspace":
              return "⌫";
            case "delete":
              return "Del";
            case "tab":
              return "Tab";
            default:
              return k.toUpperCase();
          }
        })
        .join(isMac ? "" : "+")
    )
    .join(" → ");
}

/**
 * 단축키를 배열로 분리
 */
export function parseShortcutKeys(key: string): string[] {
  return key.split(" then ").flatMap((part) => part.split("+").map((k) => k.trim()));
}

// ============================================================================
// Preset Shortcuts
// ============================================================================

/**
 * 공통 단축키 프리셋
 */
export const commonShortcuts = {
  save: "ctrl+s",
  undo: "ctrl+z",
  redo: "ctrl+shift+z",
  copy: "ctrl+c",
  paste: "ctrl+v",
  cut: "ctrl+x",
  selectAll: "ctrl+a",
  find: "ctrl+f",
  close: "escape",
  submit: "ctrl+enter",
  newItem: "ctrl+n",
  delete: "delete",
  goBack: "alt+arrowleft",
  goForward: "alt+arrowright",
  refresh: "ctrl+r",
  help: "shift+?",
} as const;

/**
 * 에디터 단축키 프리셋
 */
export const editorShortcuts = {
  bold: "ctrl+b",
  italic: "ctrl+i",
  underline: "ctrl+u",
  strikethrough: "ctrl+shift+s",
  link: "ctrl+k",
  heading1: "ctrl+1",
  heading2: "ctrl+2",
  heading3: "ctrl+3",
  bulletList: "ctrl+shift+8",
  numberedList: "ctrl+shift+9",
  quote: "ctrl+shift+q",
  code: "ctrl+`",
} as const;

export default useKeyboardShortcuts;
