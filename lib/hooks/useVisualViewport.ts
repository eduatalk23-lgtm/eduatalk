"use client";

import { useEffect, useState } from "react";

interface VisualViewportState {
  /** visual viewport 높이 (px) */
  height: number;
  /** visual viewport 상단 오프셋 (px) */
  offsetTop: number;
  /** 추정 키보드 높이 (px) */
  keyboardHeight: number;
  /** 키보드가 열려있는지 여부 (threshold: 150px) */
  isKeyboardOpen: boolean;
}

const KEYBOARD_THRESHOLD_PX = 150;

function getState(): VisualViewportState {
  if (typeof window === "undefined" || !window.visualViewport) {
    return { height: 0, offsetTop: 0, keyboardHeight: 0, isKeyboardOpen: false };
  }

  const vv = window.visualViewport;
  const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
  return {
    height: vv.height,
    offsetTop: vv.offsetTop,
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > KEYBOARD_THRESHOLD_PX,
  };
}

/**
 * `window.visualViewport`의 resize/scroll 이벤트를 추적하여
 * 모바일 키보드 높이와 열림 상태를 반환합니다.
 *
 * SSR 및 visualViewport 미지원 환경에서는 기본값을 반환합니다.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(getState);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleUpdate = () => {
      setState((prev) => {
        const next = getState();
        if (prev.height === next.height && prev.offsetTop === next.offsetTop) return prev;
        return next;
      });
    };

    vv.addEventListener("resize", handleUpdate);
    vv.addEventListener("scroll", handleUpdate);

    return () => {
      vv.removeEventListener("resize", handleUpdate);
      vv.removeEventListener("scroll", handleUpdate);
    };
  }, []);

  return state;
}
