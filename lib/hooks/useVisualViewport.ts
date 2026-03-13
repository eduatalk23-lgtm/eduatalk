"use client";

import { useEffect, useRef, useState } from "react";

interface VisualViewportState {
  /** visual viewport 높이 (px) */
  height: number;
  /** visual viewport 상단 오프셋 (px) */
  offsetTop: number;
  /** 추정 키보드 높이 (px) */
  keyboardHeight: number;
  /** 키보드가 열려있는지 여부 (threshold: 150px) */
  isKeyboardOpen: boolean;
  /** 뷰포트 크기 변경 후 안정화 여부 (연속 2프레임 변화 < 2px) */
  isStabilized: boolean;
}

const KEYBOARD_THRESHOLD_PX = 150;
/** rAF 폴링 지속 시간: 키보드 애니메이션 완료까지 (ms) */
const RAF_POLL_DURATION_MS = 500;
/** 안정화 감지 임계값 (px) */
const STABILIZE_THRESHOLD_PX = 2;
/** 안정화 후 최대 대기 (ms) — 기기가 느린 경우 fallback */
const MAX_STABILIZE_WAIT_MS = 600;

function getBaseState() {
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

function getState(isStabilized: boolean): VisualViewportState {
  return { ...getBaseState(), isStabilized };
}

/**
 * `window.visualViewport`의 resize/scroll 이벤트를 추적하여
 * 모바일 키보드 높이와 열림 상태를 반환합니다.
 *
 * 키보드 open/close 애니메이션 중 rAF 루프로 프레임 단위 추적하여
 * 네이티브 앱 수준의 부드러운 UI 전환을 지원합니다.
 *
 * `isStabilized`: 뷰포트 크기 변경 후 연속 2프레임 동안 변화 < 2px이면 true.
 * 키보드 애니메이션 완료를 감지하여 스크롤 보정 타이밍에 사용합니다.
 *
 * SSR 및 visualViewport 미지원 환경에서는 기본값을 반환합니다.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => getState(true));
  const rafIdRef = useRef<number>(0);
  const rafEndTimeRef = useRef<number>(0);
  const prevHeightRef = useRef<number>(0);
  const stableFrameCountRef = useRef(0);
  const resizeStartTimeRef = useRef(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    prevHeightRef.current = vv.height;

    const updateState = (forceStabilized?: boolean) => {
      setState((prev) => {
        const base = getBaseState();
        if (prev.height === base.height && prev.offsetTop === base.offsetTop) {
          // 높이/오프셋 변화 없음
          if (forceStabilized && !prev.isStabilized) {
            return { ...prev, isStabilized: true };
          }
          return prev;
        }
        // 안정화 감지: 이전 높이와의 차이가 임계값 미만이면 카운트 증가
        const delta = Math.abs(base.height - prevHeightRef.current);
        prevHeightRef.current = base.height;

        if (delta < STABILIZE_THRESHOLD_PX) {
          stableFrameCountRef.current++;
        } else {
          stableFrameCountRef.current = 0;
        }

        // 연속 2프레임 안정 또는 최대 대기 초과 → 안정화 완료
        const timeSinceResize = Date.now() - resizeStartTimeRef.current;
        const isStabilized =
          stableFrameCountRef.current >= 2 || timeSinceResize > MAX_STABILIZE_WAIT_MS;

        return { ...base, isStabilized };
      });
    };

    // rAF 폴링: 키보드 애니메이션 중 프레임 단위 업데이트
    const startRafPolling = () => {
      rafEndTimeRef.current = Date.now() + RAF_POLL_DURATION_MS;

      const poll = () => {
        updateState();
        if (Date.now() < rafEndTimeRef.current) {
          rafIdRef.current = requestAnimationFrame(poll);
        } else {
          // 폴링 종료 → 안정화 강제 설정 (최대 대기 완료)
          updateState(true);
          rafIdRef.current = 0;
        }
      };

      // 기존 폴링이 있으면 endTime만 갱신 (중복 루프 방지)
      if (!rafIdRef.current || Date.now() >= rafEndTimeRef.current) {
        rafIdRef.current = requestAnimationFrame(poll);
      }
    };

    const handleResize = () => {
      // 리사이즈 시작 → 안정화 해제
      resizeStartTimeRef.current = Date.now();
      stableFrameCountRef.current = 0;
      setState((prev) => prev.isStabilized ? { ...prev, isStabilized: false } : prev);
      updateState();
      startRafPolling();
    };

    const handleScroll = () => updateState();

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleScroll);

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return state;
}
