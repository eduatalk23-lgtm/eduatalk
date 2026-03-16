'use client';

import { useEffect, useRef } from 'react';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  category: 'navigation' | 'action' | 'modal';
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts: ShortcutConfig[];
}

/**
 * event.code → 영문 키 매핑 (특수 키용)
 * 한글 IME 활성 시 event.key가 한글 문자('ㅅ' 등)로 변환되므로,
 * 물리적 키 위치(event.code)에서 영문자를 추출하여 매칭합니다.
 */
const CODE_SPECIAL_MAP: Record<string, string> = {
  BracketLeft: '[',
  BracketRight: ']',
  Slash: '/',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Backquote: '`',
};

function getKeyFromCode(code: string): string | null {
  // KeyA~KeyZ → a~z
  if (code.startsWith('Key') && code.length === 4) {
    return code.charAt(3).toLowerCase();
  }
  // Digit0~Digit9 → 0~9
  if (code.startsWith('Digit') && code.length === 6) {
    return code.charAt(5);
  }
  return CODE_SPECIAL_MAP[code] ?? null;
}

/**
 * 키보드 단축키 훅
 *
 * useRef로 shortcuts의 최신 값을 참조하여 이벤트 리스너 재등록을 방지합니다.
 * 한글 IME 호환: event.key와 event.code 둘 다 검사하여
 * 입력 언어와 무관하게 물리적 키 위치 기준으로 단축키를 매칭합니다.
 */
export function useKeyboardShortcuts({
  enabled = true,
  shortcuts,
}: UseKeyboardShortcutsOptions) {
  // useRef로 최신 shortcuts를 참조 → 리스너 재등록 없이 항상 최신 action 실행
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      // IME 조합 중에는 무시 (한글 입력 중간 상태)
      if (event.isComposing) return;

      // 입력 필드에서는 단축키 비활성화
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // event.key 기반 매칭 (영문 모드, 특수키, Arrow 등)
      // + event.code 기반 매칭 (한글 IME 활성 시 폴백)
      const pressedKey = event.key.toLowerCase();
      const codeKey = getKeyFromCode(event.code);

      for (const shortcut of shortcutsRef.current) {
        const shortcutKey = shortcut.key.toLowerCase();

        // Shift+? 같은 경우: event.key='?' 로 직접 매칭
        // 일반 문자(t, d, w 등): event.key 또는 event.code로 매칭
        const keyMatch = pressedKey === shortcutKey || (codeKey !== null && codeKey === shortcutKey);

        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

/**
 * 단축키 레이블 생성
 */
export function getShortcutLabel(shortcut: ShortcutConfig): string {
  const parts: string[] = [];

  if (shortcut.ctrl) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (shortcut.alt) {
    parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  }
  if (shortcut.shift) {
    parts.push('⇧');
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join(' + ');
}
