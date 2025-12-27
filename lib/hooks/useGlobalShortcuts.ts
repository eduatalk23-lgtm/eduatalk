"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 단축키 정의
 * - alt+n: 새 빠른 플랜 생성
 * - alt+t: 오늘의 학습으로 이동
 * - alt+c: 캘린더로 이동
 * - alt+h: 습관으로 이동
 * - space: 타이머 토글 (타이머 컨텍스트에서만)
 * - alt+enter: 현재 플랜 완료 (타이머 컨텍스트에서만)
 * - escape: 모달/오버레이 닫기
 */

export type ShortcutAction =
  | "newQuickPlan"
  | "goToToday"
  | "goToCalendar"
  | "goToHabits"
  | "toggleTimer"
  | "completeCurrentPlan"
  | "closeOverlay";

export interface ShortcutConfig {
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: ShortcutAction;
  description: string;
}

export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  {
    key: "n",
    alt: true,
    action: "newQuickPlan",
    description: "새 플랜 생성",
  },
  {
    key: "t",
    alt: true,
    action: "goToToday",
    description: "오늘의 학습",
  },
  {
    key: "c",
    alt: true,
    action: "goToCalendar",
    description: "캘린더",
  },
  {
    key: "h",
    alt: true,
    action: "goToHabits",
    description: "습관",
  },
  {
    key: " ", // space
    alt: false,
    action: "toggleTimer",
    description: "타이머 토글",
  },
  {
    key: "Enter",
    alt: true,
    action: "completeCurrentPlan",
    description: "플랜 완료",
  },
  {
    key: "Escape",
    action: "closeOverlay",
    description: "닫기",
  },
];

interface UseGlobalShortcutsOptions {
  enabled?: boolean;
  shortcuts?: ShortcutConfig[];
  onAction?: (action: ShortcutAction) => void;
  // 특정 액션에 대한 커스텀 핸들러
  onToggleTimer?: () => void;
  onCompleteCurrentPlan?: () => void;
  onCloseOverlay?: () => void;
}

function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutConfig
): boolean {
  // 키 매칭
  const keyMatch =
    event.key.toLowerCase() === shortcut.key.toLowerCase() ||
    event.code === shortcut.key;

  // 수정자 키 매칭
  const altMatch = shortcut.alt ? event.altKey : !event.altKey;
  const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
  const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;

  return keyMatch && altMatch && ctrlMatch && shiftMatch && metaMatch;
}

export function useGlobalShortcuts(options: UseGlobalShortcutsOptions = {}) {
  const {
    enabled = true,
    shortcuts = DEFAULT_SHORTCUTS,
    onAction,
    onToggleTimer,
    onCompleteCurrentPlan,
    onCloseOverlay,
  } = options;

  const router = useRouter();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 입력 필드에서는 단축키 비활성화
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Escape는 항상 허용
        if (event.key !== "Escape") {
          return;
        }
      }

      // 단축키 매칭
      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();

          // 액션 실행
          const action = shortcut.action;

          // 커스텀 핸들러 우선
          if (action === "toggleTimer" && optionsRef.current.onToggleTimer) {
            optionsRef.current.onToggleTimer();
            return;
          }
          if (
            action === "completeCurrentPlan" &&
            optionsRef.current.onCompleteCurrentPlan
          ) {
            optionsRef.current.onCompleteCurrentPlan();
            return;
          }
          if (action === "closeOverlay" && optionsRef.current.onCloseOverlay) {
            optionsRef.current.onCloseOverlay();
            return;
          }

          // 기본 액션
          switch (action) {
            case "newQuickPlan":
              router.push("/plan/quick-create");
              break;
            case "goToToday":
              router.push("/today");
              break;
            case "goToCalendar":
              router.push("/plan/calendar");
              break;
            case "goToHabits":
              router.push("/habits");
              break;
          }

          // 콜백 호출
          optionsRef.current.onAction?.(action);
          return;
        }
      }
    },
    [shortcuts, router]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    shortcuts,
  };
}

/**
 * 단축키 표시용 유틸리티
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.meta) parts.push("⌘");

  // 키 표시 포맷팅
  let keyDisplay = shortcut.key;
  if (keyDisplay === " ") keyDisplay = "Space";
  if (keyDisplay === "Escape") keyDisplay = "Esc";
  if (keyDisplay === "Enter") keyDisplay = "↵";

  parts.push(keyDisplay.toUpperCase());

  return parts.join("+");
}

/**
 * 단축키 가이드 컴포넌트에서 사용할 데이터
 */
export function getShortcutGuide(): Array<{
  action: string;
  shortcut: string;
  description: string;
}> {
  return DEFAULT_SHORTCUTS.filter(
    (s) => s.action !== "closeOverlay" && s.action !== "toggleTimer"
  ).map((shortcut) => ({
    action: shortcut.action,
    shortcut: formatShortcut(shortcut),
    description: shortcut.description,
  }));
}
